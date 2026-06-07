import { readJson, removeDataFile, writeJson } from "@/lib/agent/data-store";
import {
  WorkspaceSubscription,
  WorkspaceWatcher,
  listWorkspaceSubscriptions,
  renewWorkspaceSubscription,
  subscribeToGoogleMeetAgent,
} from "@/lib/agent/google-events";
import { getGoogleAccessToken, getGoogleWorkspaceIdentity } from "@/lib/agent/google-oauth";

const WATCHER_FILE = "workspace-watcher.json";

export async function getStoredWatcher() {
  return readJson<WorkspaceWatcher>(WATCHER_FILE);
}

async function saveWatcher(watcher: WorkspaceWatcher) {
  await writeJson(WATCHER_FILE, watcher);
  return watcher;
}

function watcherFromSubscription(subscription: WorkspaceSubscription, fallback: WorkspaceWatcher): WorkspaceWatcher {
  return {
    ...fallback,
    subscriptionName: subscription.name ?? fallback.subscriptionName,
    targetResource: subscription.targetResource ?? fallback.targetResource,
    state: subscription.state === "ACTIVE" ? "active" : fallback.state,
    expireTime: subscription.expireTime ?? fallback.expireTime,
  };
}

export async function activateWorkspaceWatcher() {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error("Connect Google Workspace first.");
  const identity = await getGoogleWorkspaceIdentity(accessToken);
  if (!identity?.sub) throw new Error("Google Workspace user identity could not be resolved.");
  const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!pubsubTopic) throw new Error("GOOGLE_PUBSUB_TOPIC is required.");

  const targetResource = `//cloudidentity.googleapis.com/users/${identity.sub}`;
  const base: WorkspaceWatcher = {
    mode: "workspace_user",
    targetResource,
    state: "activating",
    activatedAt: new Date().toISOString(),
  };

  try {
    const operation = await subscribeToGoogleMeetAgent({ accessToken, targetResource, pubsubTopic });
    const watcher = operation.response
      ? watcherFromSubscription(operation.response, base)
      : { ...base, operationName: operation.name };
    return saveWatcher(watcher);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace watcher activation failed.";
    if (message.toLowerCase().includes("already exists")) {
      const subscriptions = await listWorkspaceSubscriptions(accessToken, targetResource);
      const existing = subscriptions.subscriptions?.find((item) => item.targetResource === targetResource);
      if (existing) return saveWatcher(watcherFromSubscription(existing, base));
    }
    await saveWatcher({ ...base, state: "error", error: message });
    throw error;
  }
}

export async function syncWorkspaceWatcher() {
  const watcher = await getStoredWatcher();
  if (!watcher) return undefined;
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return watcher;
  const subscriptions = await listWorkspaceSubscriptions(accessToken, watcher.targetResource);
  const subscription = subscriptions.subscriptions?.find((item) =>
    item.name === watcher.subscriptionName || item.targetResource === watcher.targetResource);
  if (!subscription) return saveWatcher({ ...watcher, state: "needs_renewal" });
  return saveWatcher(watcherFromSubscription(subscription, watcher));
}

export async function renewStoredWorkspaceWatcher() {
  const watcher = await syncWorkspaceWatcher();
  if (!watcher?.subscriptionName) return activateWorkspaceWatcher();
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error("Connect Google Workspace first.");
  const operation = await renewWorkspaceSubscription(accessToken, watcher.subscriptionName);
  return saveWatcher({
    ...(operation.response ? watcherFromSubscription(operation.response, watcher) : watcher),
    state: "active",
    lastRenewedAt: new Date().toISOString(),
  });
}

export async function clearWorkspaceWatcher() {
  await removeDataFile(WATCHER_FILE);
}
