import { completeMeetBotJob } from "@/lib/agent/capture-orchestrator";
import { assertExtensionAccess, extensionCorsHeaders } from "@/lib/agent/live-transcription";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertExtensionAccess(request);
    const { id } = await context.params;
    const body = await request.json() as { runId?: string; error?: string };
    return Response.json(await completeMeetBotJob(id, body), { headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update bot job." }, { status: 400 });
  }
}
