import { activateWorkspaceWatcher } from "@/lib/agent/workspace-watcher";

export async function POST() {
  try {
    const watcher = await activateWorkspaceWatcher();
    return Response.json({
      active: watcher.state === "active" || watcher.state === "activating",
      watcher,
      message: "MeetingOps is watching all Google Meet spaces owned by this Workspace user.",
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Watcher activation failed." }, { status: 400 });
  }
}
