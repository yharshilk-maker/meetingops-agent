import { MeetingInput, TranscriptLine } from "@/lib/meeting-engine";

type MeetTranscriptEntry = {
  participant?: string;
  text?: string;
  startTime?: string;
};

type MeetListResponse<T> = {
  transcripts?: T[];
  transcriptEntries?: T[];
  nextPageToken?: string;
};

const MEET_API = "https://meet.googleapis.com/v2";

async function googleGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${MEET_API}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google Meet API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function resolveMeetTargetResource(target: string, accessToken: string) {
  if (target.startsWith("//cloudidentity.googleapis.com/users/")) return target;
  const meetingCodeOrId = target
    .trim()
    .replace(/^https?:\/\/meet\.google\.com\//, "")
    .replace(/^\/\/meet\.google\.com\//, "")
    .replace(/^\/\/meet\.googleapis\.com\/spaces\//, "")
    .replace(/^spaces\//, "")
    .replace(/[/?#].*$/, "");
  if (!meetingCodeOrId) throw new Error("The configured Meet target does not contain a meeting code or space ID.");
  const space = await googleGet<{ name: string }>(`spaces/${encodeURIComponent(meetingCodeOrId)}`, accessToken);
  if (!space.name?.startsWith("spaces/")) throw new Error("Google Meet did not return a canonical space resource.");
  return `//meet.googleapis.com/${space.name}`;
}

/**
 * Fetches the transcript created by Google Meet after a conference ends.
 * The caller supplies a user OAuth token with Meet transcript access.
 */
export async function fetchGoogleMeetTranscript(
  conferenceRecord: string,
  accessToken: string,
): Promise<TranscriptLine[]> {
  const transcriptList = await googleGet<MeetListResponse<{ name: string }>>(
    `${conferenceRecord}/transcripts?pageSize=100`,
    accessToken,
  );
  const transcriptName = transcriptList.transcripts?.[0]?.name;
  if (!transcriptName) throw new Error("Google Meet has not generated a transcript.");

  const lines: TranscriptLine[] = [];
  let pageToken = "";
  do {
    const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const page = await googleGet<MeetListResponse<MeetTranscriptEntry>>(
      `${transcriptName}/entries?pageSize=100${suffix}`,
      accessToken,
    );
    for (const entry of page.transcriptEntries ?? []) {
      if (entry.text) lines.push({ speaker: entry.participant ?? "Participant", text: entry.text });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return lines;
}

export type GoogleMeetEventType =
  | "google.workspace.meet.conference.v2.started"
  | "google.workspace.meet.conference.v2.ended"
  | "google.workspace.meet.participant.v2.joined"
  | "google.workspace.meet.participant.v2.left"
  | "google.workspace.meet.transcript.v2.started"
  | "google.workspace.meet.transcript.v2.ended"
  | "google.workspace.meet.transcript.v2.fileGenerated";

export type GoogleMeetEvent = {
  id?: string;
  type: GoogleMeetEventType;
  subject?: string;
  data: {
    conferenceRecord?: { name?: string };
    transcript?: { name?: string };
    participantSession?: { name?: string };
    demoMeeting?: MeetingInput;
  };
};
