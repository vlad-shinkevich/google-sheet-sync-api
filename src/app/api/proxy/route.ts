import { NextResponse } from "next/server";

const BYTES_20_MB = 20 * 1024 * 1024;

function parseInputUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Rewrite Google Drive links
    if (url.hostname === "drive.google.com") {
      // /file/d/<ID>/view → uc?export=download&id=<ID>
      const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)\/view$/);
      if (fileMatch?.[1]) {
        const id = fileMatch[1];
        return new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`);
      }
      // uc?id=<ID> → uc?export=download&id=<ID>
      if (url.pathname === "/uc" && url.searchParams.get("id")) {
        const id = url.searchParams.get("id") as string;
        return new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`);
      }
    }
    return url;
  } catch {
    return null;
  }
}

function getWhitelist(): string[] {
  const fromEnv = process.env.PROXY_WHITELIST_DOMAINS
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : [];
}

function isHostAllowed(hostname: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true;
  const host = hostname.toLowerCase();
  return whitelist.some((domain) => host === domain || host.endsWith("." + domain));
}

export async function GET(request: Request) {
  const urlParam = new URL(request.url).searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "Missing url" }, { status: 400, headers: { "access-control-allow-origin": "*" } });
  }

  const target = parseInputUrl(urlParam);
  if (!target) {
    return NextResponse.json({ error: "Invalid or unsupported url" }, { status: 400, headers: { "access-control-allow-origin": "*" } });
  }

  const whitelist = getWhitelist();
  if (!isHostAllowed(target.hostname, whitelist)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400, headers: { "access-control-allow-origin": "*" } });
  }

  // Try HEAD for size check (optional)
  try {
    const headRes = await fetch(target, { method: "HEAD", redirect: "follow" });
    const len = headRes.headers.get("content-length");
    if (len && parseInt(len, 10) > BYTES_20_MB) {
      return NextResponse.json({ error: "File too large" }, { status: 400, headers: { "access-control-allow-origin": "*" } });
    }
  } catch {
    // Some servers do not support HEAD; ignore and proceed
  }

  const upstream = await fetch(target, { method: "GET", redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Upstream not OK", status: upstream.status }, {
      status: 502,
      headers: { "access-control-allow-origin": "*" },
    });
  }

  // Enforce size limit while streaming
  let total = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const size = chunk.byteLength ?? chunk.length ?? 0;
      total += size;
      if (total > BYTES_20_MB) {
        controller.error(new Error("File too large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const limitedStream = upstream.body.pipeThrough(limiter);
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  const res = new NextResponse(limitedStream, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}


