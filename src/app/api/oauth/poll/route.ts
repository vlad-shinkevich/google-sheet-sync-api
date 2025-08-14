import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { getSession, hasResult, takeResult } from "@/lib/store";

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
  // Return saved result as soon as it exists, regardless of session presence
  if (await hasResult(sessionId)) {
    const result = await takeResult(sessionId);
    const res = NextResponse.json({ exists: true, done: true, result });
    return withCors(res, request);
  }
  const session = await getSession(sessionId);
  if (!session) {
    const res = NextResponse.json({ exists: false });
    return withCors(res, request);
  }
  const res = NextResponse.json({ exists: true, done: false });
  return withCors(res, request);
}


