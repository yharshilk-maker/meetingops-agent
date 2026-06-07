import { assertExtensionAccess, extensionCorsHeaders, finishLiveCaptureSession } from "@/lib/agent/live-transcription";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: extensionCorsHeaders() });
}

export async function POST(request: Request) {
  try {
    assertExtensionAccess(request);
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400, headers: extensionCorsHeaders() });
    return Response.json(await finishLiveCaptureSession(sessionId), { status: 202, headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not finish capture." }, { status: 400, headers: extensionCorsHeaders() });
  }
}
