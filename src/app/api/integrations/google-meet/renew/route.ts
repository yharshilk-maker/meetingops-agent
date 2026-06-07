import { renewStoredWorkspaceWatcher } from "@/lib/agent/workspace-watcher";

export async function POST() {
  try {
    const watcher = await renewStoredWorkspaceWatcher();
    return Response.json({ watcher, message: "Google Workspace Meet watcher renewed." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Watcher renewal failed." }, { status: 400 });
  }
}
