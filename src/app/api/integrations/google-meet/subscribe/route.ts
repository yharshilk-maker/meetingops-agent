import { subscribeToGoogleMeetTranscripts } from "@/lib/agent/google-events";
import { getGoogleAccessToken } from "@/lib/agent/google-oauth";

export async function POST(request: Request) {
  const accessToken = request.headers.get("x-google-access-token") ?? await getGoogleAccessToken();
  const { targetResource, pubsubTopic } = await request.json() as {
    targetResource?: string;
    pubsubTopic?: string;
  };
  if (!accessToken || !targetResource || !pubsubTopic) {
    return Response.json({ error: "Google access token, targetResource, and pubsubTopic are required." }, { status: 400 });
  }
  try {
    const subscription = await subscribeToGoogleMeetTranscripts({ accessToken, targetResource, pubsubTopic });
    return Response.json(subscription, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Subscription failed" }, { status: 400 });
  }
}
