import { assertExtensionAccess, extensionCorsHeaders } from "@/lib/agent/live-transcription";
import { claimMeetBotJob, listMeetBotJobs } from "@/lib/agent/capture-orchestrator";

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
