import { readJson, writeJson } from "@/lib/agent/data-store";
import { AgentRun, processLiveAudioTranscript } from "@/lib/agent/runtime";
import { TranscriptLine } from "@/lib/meeting-engine";

const SESSION_FILE = "live-capture-sessions.json";

export type LiveCaptureSession = {
  id: string;
  title: string;
  meetingUrl?: string;
  startedAt: string;
  finishedAt?: string;
  status: "recording" | "processing" | "completed" | "failed";
  chunks: { sequence: number; text: string; duration?: number }[];
  error?: string;
  runId?: string;
};

type StoredSessions = Record<string, LiveCaptureSession>;

const state = globalThis as typeof globalThis & { meetingOpsLiveCaptureSessions?: StoredSessions };
let writeQueue = Promise.resolve();

async function loadSessions() {
  if (state.meetingOpsLiveCaptureSessions) return state.meetingOpsLiveCaptureSessions;
  state.meetingOpsLiveCaptureSessions = await readJson<StoredSessions>(SESSION_FILE) ?? {};
  return state.meetingOpsLiveCaptureSessions;
}

async function saveSessions(sessions: StoredSessions) {
  state.meetingOpsLiveCaptureSessions = sessions;
  writeQueue = writeQueue.then(() => writeJson(SESSION_FILE, sessions));
  await writeQueue;
}

export function assertExtensionAccess(request: Request) {
  const required = process.env.MEETINGOPS_EXTENSION_TOKEN;
  if (required && request.headers.get("x-meetingops-extension-token") !== required) {
    throw new Error("Unauthorized extension request.");
  }
}

export function extensionCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-MeetingOps-Extension-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export async function createLiveCaptureSession(input: { title?: string; meetingUrl?: string }) {
  const sessions = await loadSessions();
  for (const old of Object.values(sessions)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(50)) delete sessions[old.id];
  const id = crypto.randomUUID();
  const session: LiveCaptureSession = {
    id,
    title: input.title?.trim() || "Google Meet conversation",
    meetingUrl: input.meetingUrl,
    startedAt: new Date().toISOString(),
    status: "recording",
    chunks: [],
  };
  sessions[id] = session;
  await saveSessions(sessions);
  return session;
}

export async function getLiveCaptureSession(id: string) {
  return (await loadSessions())[id];
}

export async function transcribeAudioChunk(file: File) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is required for live transcription.");
  const form = new FormData();
  form.set("file", file, file.name || "meeting.webm");
  form.set("model", process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo");
  form.set("response_format", "verbose_json");
  form.set("temperature", "0");
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Groq transcription returned ${response.status}: ${await response.text()}`);
  const result = await response.json() as { text?: string; duration?: number };
  return { text: result.text?.trim() ?? "", duration: result.duration };
}

export async function appendLiveCaptureChunk(id: string, sequence: number, file: File) {
  const sessions = await loadSessions();
  const session = sessions[id];
  if (!session) throw new Error("Capture session not found.");
  if (session.status !== "recording") throw new Error("Capture session is no longer recording.");
  if (file.size > 24 * 1024 * 1024) throw new Error("Audio segment exceeds the 24 MB upload limit.");
  const existing = session.chunks.find((chunk) => chunk.sequence === sequence);
  if (existing) return { session, chunk: existing };

  const chunk = { sequence, ...(await transcribeAudioChunk(file)) };
  session.chunks.push(chunk);
  session.chunks.sort((a, b) => a.sequence - b.sequence);
  await saveSessions(sessions);
  return { session, chunk };
}

export async function finishLiveCaptureSession(id: string): Promise<{ session: LiveCaptureSession; run: AgentRun }> {
  const sessions = await loadSessions();
  const session = sessions[id];
  if (!session) throw new Error("Capture session not found.");
  session.status = "processing";
  session.finishedAt = new Date().toISOString();
  await saveSessions(sessions);

  try {
    const transcript: TranscriptLine[] = session.chunks
      .filter((chunk) => chunk.text)
      .map((chunk) => ({ speaker: "Meeting audio", text: chunk.text }));
    if (!transcript.length) throw new Error("No speech was transcribed from the captured meeting.");
    const run = await processLiveAudioTranscript({
      id: `live-capture-${session.id}`,
      title: session.title,
      date: new Date(session.startedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      participants: [],
      transcript,
    });
    session.status = "completed";
    session.runId = run.id;
    await saveSessions(sessions);
    return { session, run };
  } catch (error) {
    session.status = "failed";
    session.error = error instanceof Error ? error.message : "Live capture processing failed.";
    await saveSessions(sessions);
    throw error;
  }
}
