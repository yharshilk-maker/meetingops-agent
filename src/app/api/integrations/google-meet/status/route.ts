import { googleConnectionStatus } from "@/lib/agent/google-oauth";
import { getCaptureConfig, listMeetBotJobs } from "@/lib/agent/capture-orchestrator";
import { getStoredWatcher, syncWorkspaceWatcher } from "@/lib/agent/workspace-watcher";

export async function GET() {
  const connection = await googleConnectionStatus();
  let watcher = await getStoredWatcher();
  if (connection.connected && watcher) {
    try {
      watcher = await syncWorkspaceWatcher();
    } catch {
      // Return the last persisted watcher state if Google is temporarily unavailable.
    }
  }
  return Response.json({ ...connection, watcher, capture: await getCaptureConfig(), botJobs: await listMeetBotJobs() });
}
