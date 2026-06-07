import { assertExtensionAccess, extensionCorsHeaders, getLiveCaptureSession } from "@/lib/agent/live-transcription";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: extensionCorsHeaders() });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertExtensionAccess(request);
    const session = await getLiveCaptureSession((await params).id);
    return session
      ? Response.json(session, { headers: extensionCorsHeaders() })
      : Response.json({ error: "Capture session not found." }, { status: 404, headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not read capture status." }, { status: 401, headers: extensionCorsHeaders() });
  }
}
