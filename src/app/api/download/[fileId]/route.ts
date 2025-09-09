import { NextRequest, NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { driveService, DriveService } from "@/lib/drive-service";
import { logger } from "@/lib/logger";

const BYTES_20_MB = 20 * 1024 * 1024;

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  let ip = "unknown";
  if (cfConnectingIP) {
    ip = cfConnectingIP;
  } else if (realIP) {
    ip = realIP;
  } else if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  }

  return `rate_limit:${ip}`;
}

function checkRateLimit(request: NextRequest): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  limit.count++;
  return true;
}

export async function OPTIONS(request: NextRequest) {
  return (
    preflight(request) ??
    withCors(new NextResponse(null, { status: 204 }), request)
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  // Check rate limiting
  if (!checkRateLimit(request)) {
    logger.logRateLimit(request, "DRIVE_DOWNLOAD", "DOWNLOAD", fileId);
    const res = NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
    return withCors(res, request);
  }

  // Validate file ID
  if (!fileId || !DriveService.validateFileId(fileId)) {
    logger.logSecurity(
      request,
      "INVALID_FILE_ID",
      `Invalid file ID format: ${fileId}`
    );
    const res = NextResponse.json(
      { error: "Invalid file ID format" },
      { status: 400 }
    );
    return withCors(res, request);
  }

  // Check if Drive service is configured
  if (!driveService.isConfigured()) {
    logger.logHealth(
      request,
      "DRIVE_SERVICE",
      "DOWN",
      "Service not configured"
    );
    const res = NextResponse.json(
      { error: "Google Drive service not configured" },
      { status: 500 }
    );
    return withCors(res, request);
  }

  const startTime = Date.now();

  try {
    // Get file info first to check access and get metadata
    const fileInfo = await driveService.getFileInfo(fileId);

    // Check file size limit
    if (fileInfo.size && parseInt(fileInfo.size) > BYTES_20_MB) {
      logger.logDownload(
        request,
        fileId,
        false,
        "File too large",
        parseInt(fileInfo.size),
        Date.now() - startTime
      );
      const res = NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 413 }
      );
      return withCors(res, request);
    }

    // Download file stream
    const { stream, contentType, contentLength } =
      await driveService.downloadFile(fileId);

    // Create size limiter transform stream
    let totalBytes = 0;
    const sizeLimiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;
        if (totalBytes > BYTES_20_MB) {
          controller.error(new Error("File too large"));
          return;
        }
        controller.enqueue(chunk);
      },
    });

    // Convert Node.js stream to Web stream and pipe through size limiter
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (error: Error) => {
          controller.error(error);
        });
      },
    });

    const limitedStream = webStream.pipeThrough(sizeLimiter);

    // Create response with proper headers
    const response = new NextResponse(limitedStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          fileInfo.name
        )}"`,
        "Cache-Control": "public, max-age=3600",
        "X-File-Name": encodeURIComponent(fileInfo.name),
        "X-File-Size": fileInfo.size || "unknown",
        "X-File-Type": fileInfo.mimeType,
        ...(contentLength && { "Content-Length": contentLength.toString() }),
      },
    });

    logger.logDownload(
      request,
      fileId,
      true,
      undefined,
      fileInfo.size ? parseInt(fileInfo.size) : undefined,
      Date.now() - startTime
    );
    return withCors(response, request);
  } catch (error: unknown) {
    const err = error as { message?: string };
    const errorMessage = err.message || "Unknown error occurred";
    logger.logDownload(
      request,
      fileId,
      false,
      errorMessage,
      undefined,
      Date.now() - startTime
    );

    let status = 500;
    if (errorMessage.includes("not found")) {
      status = 404;
    } else if (errorMessage.includes("Access denied")) {
      status = 403;
    } else if (errorMessage.includes("too large")) {
      status = 413;
    }

    const res = NextResponse.json({ error: errorMessage }, { status });
    return withCors(res, request);
  }
}
