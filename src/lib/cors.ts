import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://www.figma.com",
];

export function getAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]));
}

export function withCors(response: NextResponse, request: Request): NextResponse {
  const origin = request.headers.get("origin");
  const allowed = getAllowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0] ?? "*";

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Vary", "Origin");
  response.headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("access-control-request-headers") || "Content-Type, Authorization"
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    request.headers.get("access-control-request-method") || "GET, POST, OPTIONS"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export function preflight(request: Request): NextResponse | null {
  if (request.method !== "OPTIONS") return null;
  return withCors(new NextResponse(null, { status: 204 }), request);
}


