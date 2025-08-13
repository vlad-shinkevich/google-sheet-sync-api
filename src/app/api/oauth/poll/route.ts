import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { getSession } from "@/lib/store";

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
  const session = getSession(sessionId);
  const res = NextResponse.json({ exists: !!session });
  return withCors(res, request);
}


