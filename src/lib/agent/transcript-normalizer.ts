import { diarizeTranscript } from "@/lib/agent/llm";
import { TranscriptLine } from "@/lib/meeting-engine";

const AUDIO_SPEAKER = "Meeting audio";

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function parseSpeakerLines(rawText: string): TranscriptLine[] {
  const turns: TranscriptLine[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, "");
    const match = cleaned.match(/^([^:\n]{1,80}):\s*(.+)$/);
    if (match) {
      turns.push({ speaker: match[1].trim(), text: cleanText(match[2]) });
    } else if (turns.length) {
      turns[turns.length - 1].text = cleanText(`${turns[turns.length - 1].text} ${cleaned}`);
    } else {
      turns.push({ speaker: "Speaker", text: cleanText(cleaned) });
    }
  }
  return turns.filter((turn) => turn.text);
}

function fallbackSplit(rawText: string, participants: string[]): TranscriptLine[] {
  const speakerNames = participants.length >= 2 ? participants : ["Speaker 1", "Speaker 2"];
  const segments = rawText
    .split(/(?<=[.!?])\s+(?=(?:[A-Z0-9"]|I\b))/)
    .map(cleanText)
    .filter(Boolean);

  if (segments.length <= 1) return [{ speaker: speakerNames[0] ?? "Speaker", text: cleanText(rawText) }];

  return segments.map((text, index) => ({
    speaker: speakerNames[index % speakerNames.length],
    text,
  }));
}

function mergeAdjacentSameSpeaker(transcript: TranscriptLine[]) {
  const merged: TranscriptLine[] = [];
  for (const line of transcript) {
    const speaker = line.speaker?.trim() || "Speaker";
    const text = cleanText(line.text ?? "");
    if (!text) continue;
    const previous = merged[merged.length - 1];
    if (previous?.speaker === speaker) {
      previous.text = cleanText(`${previous.text} ${text}`);
    } else {
      merged.push({ speaker, text });
    }
  }
  return merged;
}

function isRawAudioTranscript(transcript: TranscriptLine[]) {
  return transcript.length > 0 && transcript.every((line) => !line.speaker || line.speaker === AUDIO_SPEAKER);
}

export async function normalizeTranscript(
  transcript: TranscriptLine[],
  options: { title?: string; participants?: string[] } = {},
) {
  const cleaned = transcript
    .map((line) => ({ speaker: line.speaker?.trim() || "", text: cleanText(line.text ?? "") }))
    .filter((line) => line.text);
  if (!cleaned.length) return [];

  const rawText = cleaned.map((line) => line.text).join("\n");
  const speakerLineTurns = parseSpeakerLines(rawText);
  if (speakerLineTurns.length > cleaned.length || speakerLineTurns.some((line) => line.speaker !== "Speaker")) {
    return mergeAdjacentSameSpeaker(speakerLineTurns);
  }

  if (!isRawAudioTranscript(cleaned)) return mergeAdjacentSameSpeaker(cleaned);

  const diarized = await diarizeTranscript(rawText, options.title);
  if (diarized?.length) {
    return mergeAdjacentSameSpeaker(diarized.map((turn) => ({ speaker: turn.speaker, text: turn.text })));
  }

  return fallbackSplit(rawText, options.participants ?? []);
}

export function transcriptParticipants(transcript: TranscriptLine[]) {
  return [...new Set(transcript.map((line) => line.speaker).filter(Boolean))];
}
