import { exchangeGoogleCode } from "@/lib/agent/google-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") ?? "Google did not return an authorization code.");
    await exchangeGoogleCode(code, url.searchParams.get("state"));
    return Response.redirect(new URL("/?google=connected", url.origin));
  } catch (error) {
    return Response.redirect(new URL(`/?google=error&message=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`, url.origin));
  }
}
