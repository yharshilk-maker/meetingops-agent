import { assertExtensionAccess, extensionCorsHeaders } from "@/lib/agent/live-transcription";
import { claimMeetBotJob, listMeetBotJobs, queueMeetBotJob } from "@/lib/agent/capture-orchestrator";

export async function GET(request: Request) {
  try {
    assertExtensionAccess(request);
    const workerId = new URL(request.url).searchParams.get("workerId");
    return Response.json(workerId ? { job: await claimMeetBotJob(workerId) } : { jobs: await listMeetBotJobs() }, {
      headers: extensionCorsHeaders(),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load bot jobs." }, { status: 401 });
  }
}

// Dispatch the MeetingOps bot to a specific Google Meet link on demand.
// A locally running `npm run worker` (in meet-bot/) claims the job and joins.
export async function POST(request: Request) {
  try {
    assertExtensionAccess(request);
    const body = await request.json().catch(() => ({})) as { meetingUrl?: string; title?: string };
    const meetingUrl = body.meetingUrl?.trim();
    if (!meetingUrl || !/^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(meetingUrl)) {
      return Response.json({ error: "A valid https://meet.google.com/xxx-xxxx-xxx link is required." }, { status: 400 });
    }
    const code = meetingUrl.replace(/^https:\/\/meet\.google\.com\//i, "").replace(/[/?#].*$/, "");
    const job = await queueMeetBotJob({
      conferenceRecord: `manual/${code}`,
      meetingUrl,
      title: body.title?.trim() || `Google Meet ${code}`,
    });
    return Response.json({ job }, { headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not dispatch bot." }, { status: 400 });
  }
}
