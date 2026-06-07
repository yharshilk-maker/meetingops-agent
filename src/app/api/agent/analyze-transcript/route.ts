import { processManualTranscript } from "@/lib/agent/runtime";
import { TranscriptLine } from "@/lib/meeting-engine";

function parseTranscript(raw: string): TranscriptLine[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: TranscriptLine[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, "");
    const match = cleaned.match(/^([^:]{1,80}):\s*(.+)$/);
    if (match) parsed.push({ speaker: match[1].trim(), text: match[2].trim() });
    else if (parsed.length) parsed[parsed.length - 1].text += ` ${cleaned}`;
    else parsed.push({ speaker: "Speaker", text: cleaned });
  }
  return parsed;
}

export async function POST(request: Request) {
  const body = await request.json() as { title?: string; date?: string; participants?: string; transcript?: string };
  if (!body.transcript?.trim()) return Response.json({ error: "Transcript text is required." }, { status: 400 });
  const transcript = parseTranscript(body.transcript);
  if (!transcript.length) return Response.json({ error: "No transcript entries could be parsed." }, { status: 400 });
  const participants = body.participants?.split(",").map((item) => item.trim()).filter(Boolean) ?? [...new Set(transcript.map((line) => line.speaker))];
  const run = await processManualTranscript({
    id: `manual-${crypto.randomUUID()}`,
    title: body.title?.trim() || "Transcript Test",
    date: body.date?.trim() || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    participants,
    transcript,
  });
  return Response.json(run, { status: 202 });
}
