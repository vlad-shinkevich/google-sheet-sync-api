import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return preflight(request) ?? withCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: Request) {
  const { refresh_token } = await request.json().catch(() => ({ refresh_token: undefined }));
  if (!refresh_token) {
    const res = NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });
    return withCors(res, request);
  }

  const tokenEndpoint = "https://oauth2.googleapis.com/token";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    const res = NextResponse.json({ error: "Server not configured" }, { status: 500 });
    return withCors(res, request);
  }

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refresh_token);
  body.set("client_id", clientId);
  if (clientSecret) body.set("client_secret", clientSecret);

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    const res = NextResponse.json({ error: "Refresh failed", details: text }, { status: 400 });
    return withCors(res, request);
  }

  const tokenJson = await tokenRes.json();
  const res = NextResponse.json({ ok: true, tokens: tokenJson });
  return withCors(res, request);
}


