import { cookies } from "next/headers";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.compose",
];

type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

const state = globalThis as typeof globalThis & { meetingOpsGoogleTokens?: GoogleTokens };
const DATA_DIR = process.env.MEETINGOPS_DATA_DIR ?? path.join(process.cwd(), ".meetingops");
const TOKEN_PATH = path.join(DATA_DIR, "google-tokens.json");

async function loadTokens() {
  if (state.meetingOpsGoogleTokens) return state.meetingOpsGoogleTokens;
  try {
    state.meetingOpsGoogleTokens = JSON.parse(await readFile(TOKEN_PATH, "utf8")) as GoogleTokens;
    return state.meetingOpsGoogleTokens;
  } catch {
    return undefined;
  }
}

async function saveTokens(tokens: GoogleTokens) {
  state.meetingOpsGoogleTokens = tokens;
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(tokens), { mode: 0o600 });
}

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/auth/google/callback";
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.");
  return { clientId, clientSecret, redirectUri };
}

export async function googleAuthorizationUrl() {
  const { clientId, redirectUri } = credentials();
  const nonce = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("meetingops_oauth_state", nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state: nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeGoogleCode(code: string, returnedState: string | null) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meetingops_oauth_state")?.value;
  if (!returnedState || returnedState !== expectedState) throw new Error("Invalid OAuth state.");
  const { clientId, clientSecret, redirectUri } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${await response.text()}`);
  const tokens = await response.json() as GoogleTokens;
  await saveTokens({ ...tokens, expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000 });
  cookieStore.delete("meetingops_oauth_state");
  return tokens;
}

export async function getGoogleAccessToken() {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (!tokens.expires_at || tokens.expires_at > Date.now() + 60_000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: tokens.refresh_token, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error(`Google token refresh failed: ${await response.text()}`);
  const refreshed = await response.json() as GoogleTokens;
  const updated = { ...tokens, ...refreshed, refresh_token: tokens.refresh_token, expires_at: Date.now() + (refreshed.expires_in ?? 3600) * 1000 };
  await saveTokens(updated);
  return updated.access_token;
}

export async function googleConnectionStatus() {
  const tokens = await loadTokens();
  return { configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), connected: Boolean(tokens?.refresh_token || tokens?.access_token) };
}

export async function disconnectGoogle() {
  state.meetingOpsGoogleTokens = undefined;
  await rm(TOKEN_PATH, { force: true });
}
