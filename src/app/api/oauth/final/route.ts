import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { takeResult, OAuthResult } from "@/lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request) ?? withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    const res = NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    return withCors(res, request);
  }
  const result = await takeResult(sessionId);
  if (!result) {
    const res = NextResponse.json({ error: "No result" }, { status: 404 });
    return withCors(res, request);
  }
  const payload: OAuthResult & { ok: true } = { ok: true, ...result };
  const res = NextResponse.json(payload);
  return withCors(res, request);
}


