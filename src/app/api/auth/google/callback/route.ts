import { exchangeGoogleCode } from "@/lib/agent/google-oauth";

function publicOrigin(request: Request) {
  const configuredRedirect = process.env.GOOGLE_REDIRECT_URI;
  if (configuredRedirect) return new URL(configuredRedirect).origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  try {
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") ?? "Google did not return an authorization code.");
    await exchangeGoogleCode(code, url.searchParams.get("state"));
    return Response.redirect(new URL("/?google=connected", origin));
  } catch (error) {
    return Response.redirect(new URL(`/?google=error&message=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`, origin));
  }
}
