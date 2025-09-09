import { NextRequest, NextResponse } from "next/server";
import { withCors, preflight } from "@/lib/cors";
import { driveService, DriveService } from "@/lib/drive-service";
import { logger } from "@/lib/logger";

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP (higher than download)

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
    logger.logRateLimit(request, "DRIVE_INFO", "GET_INFO", fileId);
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
    // Get file information
    const fileInfo = await driveService.getFileInfo(fileId);

    // Format response with additional metadata
    const response = {
      id: fileInfo.id,
      name: fileInfo.name,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size ? parseInt(fileInfo.size) : null,
      sizeFormatted: fileInfo.size
        ? formatFileSize(parseInt(fileInfo.size))
        : null,
      createdTime: fileInfo.createdTime,
      modifiedTime: fileInfo.modifiedTime,
      webViewLink: fileInfo.webViewLink,
      downloadUrl: `/api/download/${fileId}`,
      thumbnailLink: fileInfo.thumbnailLink,
      parents: fileInfo.parents,
      isImage: fileInfo.mimeType.startsWith("image/"),
      isDocument: isDocumentType(fileInfo.mimeType),
      isSpreadsheet:
        fileInfo.mimeType.includes("spreadsheet") ||
        fileInfo.mimeType.includes("excel"),
      isPresentation:
        fileInfo.mimeType.includes("presentation") ||
        fileInfo.mimeType.includes("powerpoint"),
      isPdf: fileInfo.mimeType === "application/pdf",
      isVideo: fileInfo.mimeType.startsWith("video/"),
      isAudio: fileInfo.mimeType.startsWith("audio/"),
      isArchive: isArchiveType(fileInfo.mimeType),
    };

    logger.logInfo(request, fileId, true, undefined, Date.now() - startTime);
    const res = NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
    return withCors(res, request);
  } catch (error: unknown) {
    const err = error as { message?: string };
    const errorMessage = err.message || "Unknown error occurred";
    logger.logInfo(
      request,
      fileId,
      false,
      errorMessage,
      Date.now() - startTime
    );

    let status = 500;
    if (errorMessage.includes("not found")) {
      status = 404;
    } else if (errorMessage.includes("Access denied")) {
      status = 403;
    }

    const res = NextResponse.json({ error: errorMessage }, { status });
    return withCors(res, request);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function isDocumentType(mimeType: string): boolean {
  const documentTypes = [
    "application/vnd.google-apps.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/html",
    "text/rtf",
  ];
  return documentTypes.includes(mimeType);
}

function isArchiveType(mimeType: string): boolean {
  const archiveTypes = [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/gzip",
    "application/x-tar",
  ];
  return archiveTypes.includes(mimeType);
}
