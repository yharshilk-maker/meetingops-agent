import { GoogleMeetEvent, GoogleMeetEventType } from "@/lib/agent/google-meet";
import { processGoogleMeetEvent } from "@/lib/agent/runtime";

const ALLOWED_EVENTS: GoogleMeetEventType[] = [
  "google.workspace.meet.conference.v2.started",
  "google.workspace.meet.participant.v2.joined",
  "google.workspace.meet.transcript.v2.started",
  "google.workspace.meet.conference.v2.ended",
];

export async function POST(request: Request) {
  const { type = ALLOWED_EVENTS[0] } = await request.json() as { type?: GoogleMeetEventType };
  if (!ALLOWED_EVENTS.includes(type)) return Response.json({ error: "Unsupported demo lifecycle event." }, { status: 400 });
  const event: GoogleMeetEvent = {
    id: `demo-lifecycle-${type}-${crypto.randomUUID()}`,
    type,
    subject: "//meet.googleapis.com/spaces/workspace-agent-demo",
    data: {
      conferenceRecord: { name: "conferenceRecords/workspace-agent-demo" },
      participantSession: type.includes("participant") ? { name: "conferenceRecords/workspace-agent-demo/participants/demo/participantSessions/1" } : undefined,
    },
  };
  return Response.json(await processGoogleMeetEvent(event), { status: 202 });
}
