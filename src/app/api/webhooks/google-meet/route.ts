import { GoogleMeetTranscriptEvent } from "@/lib/agent/google-meet";
import { processGoogleMeetEvent } from "@/lib/agent/runtime";

export async function POST(request: Request) {
  const configuredSecret = process.env.GOOGLE_WEBHOOK_SECRET;
  if (configuredSecret && request.headers.get("x-meetingops-webhook-secret") !== configuredSecret) {
    return Response.json({ error: "Unauthorized webhook." }, { status: 401 });
  }
  const body = await request.json() as GoogleMeetTranscriptEvent | { message?: { data?: string; messageId?: string } };
  let event: GoogleMeetTranscriptEvent;
  if ("message" in body && body.message?.data) {
    event = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8")) as GoogleMeetTranscriptEvent;
    event.id ??= body.message.messageId;
  } else {
    event = body as GoogleMeetTranscriptEvent;
  }
  const { getGoogleAccessToken } = await import("@/lib/agent/google-oauth");
  const accessToken = request.headers.get("x-google-access-token") ?? await getGoogleAccessToken() ?? undefined;
  try {
    const run = await processGoogleMeetEvent(event, accessToken);
    return Response.json(run, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agent run failed" }, { status: 400 });
  }
}
