type ActionRequest = {
  meetingId: string;
  actionId: string;
  actionType: "drive_save" | "gmail_draft" | "memory_update";
  meeting?: import("@/lib/meeting-engine").Meeting;
};

export async function POST(request: Request) {
  try {
    const action = await request.json() as ActionRequest;
    if (!action.meetingId || !action.actionId || !action.actionType) {
      return Response.json({ error: "meetingId, actionId, and actionType are required." }, { status: 400 });
    }
    const { getGoogleAccessToken } = await import("@/lib/agent/google-oauth");
    const accessToken = request.headers.get("x-google-access-token") ?? await getGoogleAccessToken();
    let result: Record<string, unknown>;
    if (action.actionType === "drive_save" && accessToken && action.meeting) {
      const { saveMeetingBriefToDrive } = await import("@/lib/agent/google-actions");
      result = { mode: "google_drive", ...(await saveMeetingBriefToDrive(action.meeting, accessToken)) };
    } else if (action.actionType === "gmail_draft" && accessToken && action.meeting) {
      const { createGmailFollowUpDraft } = await import("@/lib/agent/google-actions");
      result = { mode: "gmail", ...(await createGmailFollowUpDraft(action.meeting, accessToken)) };
    } else {
      result = action.actionType === "drive_save"
        ? { mode: "demo", message: "Meeting packet prepared for Google Drive. Connect Google OAuth to execute." }
        : action.actionType === "gmail_draft"
          ? { mode: "demo", message: "Follow-up prepared for Gmail draft. Connect Google OAuth to execute." }
          : { mode: "local", message: "Workspace memory update approved." };
    }
    return Response.json({
      status: "completed",
      executedAt: new Date().toISOString(),
      actionId: action.actionId,
      result,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Action execution failed." }, { status: 500 });
  }
}
