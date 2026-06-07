import { GoogleMeetEvent, fetchGoogleMeetTranscript } from "@/lib/agent/google-meet";
import { analyzeWithLlm } from "@/lib/agent/llm";
import { DEMO_MEETINGS, INITIAL_WORKSPACE, Meeting, analyzeTranscript, meetingFromAnalysis } from "@/lib/meeting-engine";

export type AgentStage = "idle" | "event_received" | "observing" | "fetching_transcript" | "analyzing" | "planning_actions" | "awaiting_approval" | "completed" | "failed";
export type AgentRun = {
  id: string;
  provider: "google_meet" | "manual_test";
  stage: AgentStage;
  startedAt: string;
  completedAt?: string;
  conferenceRecord?: string;
  eventType?: string;
  log: { stage: AgentStage; message: string; at: string }[];
  meeting?: Meeting;
  reasoningMode?: "structured_llm" | "deterministic_fallback";
  reasoningProvider?: "groq" | "openai";
  reasoningModel?: string;
  error?: string;
};

const state = globalThis as typeof globalThis & { meetingOpsRuns?: AgentRun[]; meetingOpsEventIds?: Set<string> };
state.meetingOpsRuns ??= [];
state.meetingOpsEventIds ??= new Set<string>();

function addLog(run: AgentRun, stage: AgentStage, message: string) {
  run.stage = stage;
  run.log.push({ stage, message, at: new Date().toISOString() });
}

export function getAgentRuns() {
  return state.meetingOpsRuns ?? [];
}

async function analyzeInput(run: AgentRun, input: import("@/lib/meeting-engine").MeetingInput) {
  addLog(run, "analyzing", "Classifying meeting and extracting evidence-backed state.");
  let llmAnalysis = null;
  let modelAttemptFailed = false;
  try {
    llmAnalysis = await analyzeWithLlm(input);
  } catch (error) {
    modelAttemptFailed = true;
    addLog(run, "analyzing", `Model reasoning unavailable; safely falling back. ${error instanceof Error ? error.message : ""}`.trim());
  }
  run.reasoningMode = llmAnalysis ? "structured_llm" : "deterministic_fallback";
  run.reasoningProvider = llmAnalysis?.provider;
  run.reasoningModel = llmAnalysis?.model;
  run.meeting = llmAnalysis ? meetingFromAnalysis(input, llmAnalysis.analysis) : analyzeTranscript(input, INITIAL_WORKSPACE);
  run.meeting.reasoningMode = run.reasoningMode;
  addLog(run, "analyzing", llmAnalysis ? llmAnalysis.recovered ? `Structured reasoning from ${llmAnalysis.provider} was recovered, normalized, and validated.` : `Structured reasoning completed with ${llmAnalysis.provider} (${llmAnalysis.model}) and validated.` : modelAttemptFailed ? "Configured model failed; deterministic fallback completed." : "No model key configured; deterministic fallback completed.");
  addLog(run, "planning_actions", "Routing artifacts and preparing controlled follow-up actions.");
  addLog(run, "awaiting_approval", "Analysis complete. External actions are awaiting approval.");
  run.completedAt = new Date().toISOString();
  return run;
}

export async function processManualTranscript(input: import("@/lib/meeting-engine").MeetingInput) {
  const run: AgentRun = {
    id: crypto.randomUUID(),
    provider: "manual_test",
    stage: "event_received",
    startedAt: new Date().toISOString(),
    log: [],
  };
  state.meetingOpsRuns = [run, ...(state.meetingOpsRuns ?? [])].slice(0, 20);
  addLog(run, "event_received", "Transcript test bench submitted a meeting.");
  addLog(run, "fetching_transcript", `Parsed ${input.transcript.length} transcript entries.`);
  try {
    return await analyzeInput(run, input);
  } catch (error) {
    run.error = error instanceof Error ? error.message : "Unknown agent error";
    addLog(run, "failed", run.error);
    throw error;
  }
}

export async function processGoogleMeetEvent(event: GoogleMeetEvent, accessToken?: string) {
  const eventId = event.id ?? event.data.transcript?.name ?? event.data.participantSession?.name ?? `${event.type}:${event.data.conferenceRecord?.name}`;
  if (eventId && state.meetingOpsEventIds?.has(eventId)) {
    const existing = state.meetingOpsRuns?.find((item) => item.conferenceRecord === event.data.conferenceRecord?.name);
    if (existing) return existing;
  }
  if (eventId) state.meetingOpsEventIds?.add(eventId);
  const existingRun = state.meetingOpsRuns?.find((item) =>
    item.provider === "google_meet" &&
    item.conferenceRecord === event.data.conferenceRecord?.name &&
    !item.meeting);
  const run: AgentRun = existingRun ?? {
    id: crypto.randomUUID(),
    provider: "google_meet",
    stage: "event_received",
    startedAt: new Date().toISOString(),
    conferenceRecord: event.data.conferenceRecord?.name,
    eventType: event.type,
    log: [],
  };
  run.eventType = event.type;
  if (!existingRun) state.meetingOpsRuns = [run, ...(state.meetingOpsRuns ?? [])].slice(0, 20);

  try {
    addLog(run, "event_received", `Google Workspace event received: ${event.type}.`);
    if (event.type === "google.workspace.meet.conference.v2.started") {
      addLog(run, "observing", "MeetingOps is awake and observing this active Google Meet conference.");
      return run;
    }
    if (event.type === "google.workspace.meet.participant.v2.joined") {
      addLog(run, "observing", "A participant joined. MeetingOps updated the live conference activity.");
      return run;
    }
    if (event.type === "google.workspace.meet.participant.v2.left") {
      addLog(run, "observing", "A participant left. MeetingOps updated the live conference activity.");
      return run;
    }
    if (event.type === "google.workspace.meet.transcript.v2.started") {
      addLog(run, "observing", "Google Meet transcription started. MeetingOps is waiting for the final transcript artifact.");
      return run;
    }
    if (event.type === "google.workspace.meet.transcript.v2.ended") {
      addLog(run, "observing", "Google Meet transcription ended. MeetingOps is waiting for Google to generate the transcript file.");
      return run;
    }
    if (event.type === "google.workspace.meet.conference.v2.ended") {
      addLog(run, "completed", "The conference ended. MeetingOps remains ready for the transcript-generated event.");
      run.completedAt = new Date().toISOString();
      return run;
    }
    addLog(run, "fetching_transcript", "Fetching transcript entries from Google Meet.");
    let input = event.data.demoMeeting;
    if (!input) {
      if (!run.conferenceRecord || !accessToken) throw new Error("Conference record and Google OAuth token are required.");
      const transcript = await fetchGoogleMeetTranscript(run.conferenceRecord, accessToken);
      input = {
        id: run.conferenceRecord,
        title: "Google Meet conference",
        date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        participants: [...new Set(transcript.map((line) => line.speaker))],
        transcript,
      };
    }
    return await analyzeInput(run, input);
  } catch (error) {
    run.error = error instanceof Error ? error.message : "Unknown agent error";
    addLog(run, "failed", run.error);
    throw error;
  }
}

export function demoMeetEvent(index: number): GoogleMeetEvent {
  return {
    type: "google.workspace.meet.transcript.v2.fileGenerated",
    subject: `//meet.googleapis.com/spaces/demo-${index + 1}`,
    data: {
      conferenceRecord: { name: `conferenceRecords/demo-${index + 1}` },
      transcript: { name: `conferenceRecords/demo-${index + 1}/transcripts/1` },
      demoMeeting: DEMO_MEETINGS[index] ?? DEMO_MEETINGS[0],
    },
  };
}
