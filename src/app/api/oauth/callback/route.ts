import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { getSession, deleteSession, saveResult } from "@/lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request) ?? withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const res = NextResponse.json({ error }, { status: 400 });
    return withCors(res, request);
  }

  if (!code || !stateParam) {
    const res = NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    return withCors(res, request);
  }

  const [sessionId, state] = stateParam.split(":");
  const session = sessionId ? getSession(sessionId) : undefined;
  if (!session || session.state !== state) {
    const res = NextResponse.json({ error: "Invalid state" }, { status: 400 });
    return withCors(res, request);
  }

  const tokenEndpoint = "https://oauth2.googleapis.com/token";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    const res = NextResponse.json({ error: "Server not configured" }, { status: 500 });
    return withCors(res, request);
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("client_id", clientId);
  if (clientSecret) body.set("client_secret", clientSecret);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", session.codeVerifier);

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    const res = NextResponse.json({ error: "Token exchange failed", details: text }, { status: 400 });
    return withCors(res, request);
  }

  const tokenJson = await tokenRes.json();

  // Option 1: return tokens directly to the plugin (short-lived in-memory session)
  // Option 2: persist securely and return a reference. For now, return directly.
  // Save result for polling by the plugin UI
  saveResult(sessionId, { tokens: tokenJson as Record<string, unknown>, redirectTo: session.redirectTo });
  deleteSession(sessionId);

  // Return minimal HTML page that can be safely opened in a browser window
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Success</title></head><body>
  <p>Authentication complete. You can close this window.</p>
  </body></html>`;
  const res = new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  return withCors(res, request);
}


