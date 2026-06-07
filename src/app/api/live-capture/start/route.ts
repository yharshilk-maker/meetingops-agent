import { assertExtensionAccess, createLiveCaptureSession, extensionCorsHeaders } from "@/lib/agent/live-transcription";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: extensionCorsHeaders() });
}

export async function POST(request: Request) {
  try {
    assertExtensionAccess(request);
    const input = await request.json().catch(() => ({})) as { title?: string; meetingUrl?: string };
    return Response.json(await createLiveCaptureSession(input), { status: 201, headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not start capture." }, { status: 401, headers: extensionCorsHeaders() });
  }
}
