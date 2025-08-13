import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { generateCodeChallenge, generateCodeVerifier } from "@/lib/pkce";
import { saveSession } from "@/lib/store";

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function OPTIONS(request: Request) {
  return preflight(request) ?? withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") || undefined;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const defaultScopes = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ];
  const scope = process.env.GOOGLE_SCOPE ?? defaultScopes.join(" ");

  if (!clientId || !redirectUri) {
    const res = NextResponse.json({ error: "Server not configured" }, { status: 500 });
    return withCors(res, request);
  }

  const sessionId = randomId();
  const state = randomId();
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  saveSession(sessionId, {
    state,
    codeVerifier,
    createdAt: Date.now(),
    redirectTo,
    provider: "google",
  });

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", scope);
  auth.searchParams.set("state", `${sessionId}:${state}`);
  auth.searchParams.set("code_challenge", codeChallenge);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");

  const res = NextResponse.json({ url: auth.toString(), sessionId });
  return withCors(res, request);
}


