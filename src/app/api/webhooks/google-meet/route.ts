import { GoogleMeetEvent } from "@/lib/agent/google-meet";
import { processGoogleMeetEvent } from "@/lib/agent/runtime";

export async function POST(request: Request) {
  const configuredSecret = process.env.GOOGLE_WEBHOOK_SECRET;
  if (configuredSecret && request.headers.get("x-meetingops-webhook-secret") !== configuredSecret) {
    return Response.json({ error: "Unauthorized webhook." }, { status: 401 });
  }
  type IncomingEvent = GoogleMeetEvent | { id?: string; type: string; data?: unknown };
  const body = await request.json() as IncomingEvent | { message?: { data?: string; messageId?: string } };
  let event: IncomingEvent;
  if ("message" in body && body.message?.data) {
    event = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8")) as IncomingEvent;
    event.id ??= body.message.messageId;
  } else {
    event = body as IncomingEvent;
  }
  if (event.type === "google.workspace.events.subscription.v1.expirationReminder") {
    const { renewStoredWorkspaceWatcher } = await import("@/lib/agent/workspace-watcher");
    return Response.json({ watcher: await renewStoredWorkspaceWatcher() }, { status: 202 });
  }
  const { getGoogleAccessToken } = await import("@/lib/agent/google-oauth");
  const accessToken = request.headers.get("x-google-access-token") ?? await getGoogleAccessToken() ?? undefined;
  try {
    const run = await processGoogleMeetEvent(event as GoogleMeetEvent, accessToken);
    return Response.json(run, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agent run failed" }, { status: 400 });
  }
}
