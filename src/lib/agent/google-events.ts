const EVENTS_API = "https://workspaceevents.googleapis.com/v1/subscriptions";

export const GOOGLE_MEET_AGENT_EVENTS = [
  "google.workspace.meet.conference.v2.started",
  "google.workspace.meet.conference.v2.ended",
  "google.workspace.meet.participant.v2.joined",
  "google.workspace.meet.participant.v2.left",
  "google.workspace.meet.transcript.v2.started",
  "google.workspace.meet.transcript.v2.ended",
  "google.workspace.meet.transcript.v2.fileGenerated",
] as const;

export type WorkspaceSubscription = {
  name?: string;
  uid?: string;
  targetResource?: string;
  eventTypes?: string[];
  state?: string;
  expireTime?: string;
};

export type WorkspaceWatcher = {
  mode: "workspace_user" | "meeting_space";
  targetResource: string;
  subscriptionName?: string;
  operationName?: string;
  state: "activating" | "active" | "needs_renewal" | "error";
  expireTime?: string;
  activatedAt: string;
  lastRenewedAt?: string;
  error?: string;
};

async function workspaceEventsRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${EVENTS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? `Workspace Events API returned ${response.status}`);
  return result as T;
}

export async function subscribeToGoogleMeetAgent(input: {
  accessToken: string;
  targetResource: string;
  pubsubTopic: string;
}) {
  return workspaceEventsRequest<{ name?: string; response?: WorkspaceSubscription }>("", input.accessToken, {
    method: "POST",
    body: JSON.stringify({
      targetResource: input.targetResource,
      eventTypes: GOOGLE_MEET_AGENT_EVENTS,
      notificationEndpoint: { pubsubTopic: input.pubsubTopic },
      ttl: "604800s",
    }),
  });
}

export async function listWorkspaceSubscriptions(accessToken: string, targetResource?: string) {
  const target = targetResource ? ` AND target_resource="${targetResource}"` : "";
  const filter = `event_types:"${GOOGLE_MEET_AGENT_EVENTS[0]}"${target}`;
  return workspaceEventsRequest<{ subscriptions?: WorkspaceSubscription[] }>(`?filter=${encodeURIComponent(filter)}`, accessToken);
}

export async function renewWorkspaceSubscription(accessToken: string, subscriptionName: string) {
  const name = subscriptionName.replace(/^subscriptions\//, "");
  return workspaceEventsRequest<{ name?: string; response?: WorkspaceSubscription }>(`/${name}?updateMask=ttl`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ name: subscriptionName, ttl: "604800s" }),
  });
}
