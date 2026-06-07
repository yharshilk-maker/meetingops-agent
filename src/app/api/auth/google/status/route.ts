import { disconnectGoogle, googleConnectionStatus } from "@/lib/agent/google-oauth";

export async function GET() {
  return Response.json(await googleConnectionStatus());
}

export async function DELETE() {
  await disconnectGoogle();
  return Response.json({ connected: false });
}
