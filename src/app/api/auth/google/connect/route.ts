import { googleAuthorizationUrl } from "@/lib/agent/google-oauth";

export async function GET() {
  try {
    return Response.redirect(await googleAuthorizationUrl());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Google OAuth is not configured." }, { status: 400 });
  }
}
