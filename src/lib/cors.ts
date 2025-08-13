import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://www.figma.com",
  // Figma plugin worker/iframe can send Origin: null. Allow literal "null".
  "null",
];

export function getAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]));
}

export function withCors(response: NextResponse, request: Request): NextResponse {
  const originHeader = request.headers.get("origin");
  const originCandidate = originHeader ?? "null";
  const allowed = getAllowedOrigins();

  let allowOrigin = "*";
  let allowCredentials = true;

  if (allowed.includes(originCandidate)) {
    allowOrigin = originCandidate;
  } else if (allowed.includes("*")) {
    allowOrigin = "*";
    allowCredentials = false; // cannot use credentials with wildcard
  } else if (allowed.length > 0) {
    allowOrigin = allowed[0];
    if (allowOrigin === "*") allowCredentials = false;
  }

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
  if (allowCredentials) response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export function preflight(request: Request): NextResponse | null {
  if (request.method !== "OPTIONS") return null;
  return withCors(new NextResponse(null, { status: 204 }), request);
}


