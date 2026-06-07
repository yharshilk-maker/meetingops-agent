import { appendLiveCaptureChunk, assertExtensionAccess, extensionCorsHeaders } from "@/lib/agent/live-transcription";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: extensionCorsHeaders() });
}

export async function POST(request: Request) {
  try {
    assertExtensionAccess(request);
    const form = await request.formData();
    const sessionId = form.get("sessionId");
    const sequence = Number(form.get("sequence"));
    const audio = form.get("audio");
    if (typeof sessionId !== "string" || !Number.isInteger(sequence) || !(audio instanceof File)) {
      return Response.json({ error: "sessionId, integer sequence, and audio file are required." }, { status: 400, headers: extensionCorsHeaders() });
    }
    const { session, chunk } = await appendLiveCaptureChunk(sessionId, sequence, audio);
    return Response.json({ sessionId: session.id, sequence: chunk.sequence, text: chunk.text, chunksReceived: session.chunks.length }, { headers: extensionCorsHeaders() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not transcribe chunk." }, { status: 400, headers: extensionCorsHeaders() });
  }
}
