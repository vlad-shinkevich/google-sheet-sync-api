import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request) ?? withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  // No-op: in-memory store has its own sweeper; route can be used by uptime pings
  const res = NextResponse.json({ ok: true, ts: Date.now() });
  return withCors(res, request);
}


