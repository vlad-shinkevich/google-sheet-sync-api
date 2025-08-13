import { NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return preflight(request) ?? withCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: Request) {
  const res = NextResponse.json({ ok: true, ts: Date.now() });
  return withCors(res, request);
}


