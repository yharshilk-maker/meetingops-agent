import { subscribeToGoogleMeetTranscripts } from "@/lib/agent/google-events";
import { resolveMeetTargetResource } from "@/lib/agent/google-meet";
import { getGoogleAccessToken } from "@/lib/agent/google-oauth";

export async function POST() {
  const accessToken = await getGoogleAccessToken();
  const targetResource = process.env.GOOGLE_MEET_TARGET_RESOURCE;
  const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!accessToken) return Response.json({ error: "Connect Google Workspace first." }, { status: 401 });
  if (!targetResource || !pubsubTopic) return Response.json({ error: "GOOGLE_MEET_TARGET_RESOURCE and GOOGLE_PUBSUB_TOPIC are required." }, { status: 400 });
  try {
    const resolvedTarget = await resolveMeetTargetResource(targetResource, accessToken);
    const operation = await subscribeToGoogleMeetTranscripts({ accessToken, targetResource: resolvedTarget, pubsubTopic });
    return Response.json({ active: true, targetResource: resolvedTarget, operation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watcher activation failed.";
    if (message.toLowerCase().includes("already exists")) {
      return Response.json({ active: true, alreadyExists: true, message: "Meet watcher is already active for this space." });
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
