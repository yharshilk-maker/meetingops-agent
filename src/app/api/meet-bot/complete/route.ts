import { assertExtensionAccess, extensionCorsHeaders } from "@/lib/agent/live-transcription";
import { getMeetBotJob } from "@/lib/agent/capture-orchestrator";
import { processMeetBotTranscript } from "@/lib/agent/runtime";
import { TranscriptLine } from "@/lib/meeting-engine";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: extensionCorsHeaders() });
}

export async function POST(request: Request) {
  try {
    assertExtensionAccess(request);
    const body = await request.json() as {
      meetingUrl?: string;
      title?: string;
      startedAt?: string;
      jobId?: string;
      participants?: string[];
      transcript?: TranscriptLine[];
    };
    const transcript = body.transcript?.filter((line) => line.text?.trim()) ?? [];
    if (!transcript.length) {
      return Response.json({ error: "The bot did not capture any caption text." }, { status: 400, headers: extensionCorsHeaders() });
    }
    const job = body.jobId ? await getMeetBotJob(body.jobId) : undefined;
    const run = await processMeetBotTranscript({
      id: job?.conferenceRecord ?? `meet-bot-${crypto.randomUUID()}`,
      title: body.title?.trim() || "Google Meet conversation",
      date: new Date(body.startedAt || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      participants: body.participants?.length ? body.participants : [...new Set(transcript.map((line) => line.speaker))],
      transcript,
    });
    return Response.json(run, { status: 202, headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Meet bot completion failed." }, { status: 400, headers: extensionCorsHeaders() });
  }
}
