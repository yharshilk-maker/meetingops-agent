const EVENTS_API = "https://workspaceevents.googleapis.com/v1/subscriptions";

export async function subscribeToGoogleMeetTranscripts(input: {
  accessToken: string;
  targetResource: string;
  pubsubTopic: string;
}) {
  const response = await fetch(EVENTS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      targetResource: input.targetResource,
      eventTypes: ["google.workspace.meet.transcript.v2.fileGenerated"],
      notificationEndpoint: { pubsubTopic: input.pubsubTopic },
      ttl: "86400s",
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? `Workspace Events API returned ${response.status}`);
  return result;
}
