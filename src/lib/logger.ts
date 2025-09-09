import { NextRequest } from "next/server";

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  service: string;
  action: string;
  ip: string;
  userAgent: string;
  fileId?: string;
  success: boolean;
  error?: string;
  responseTime?: number;
  fileSize?: number;
}

export class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIP = request.headers.get("x-real-ip");
    const cfConnectingIP = request.headers.get("cf-connecting-ip");

    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) return forwarded.split(",")[0].trim();

    return "unknown";
  }

  private getUserAgent(request: NextRequest): string {
    return request.headers.get("user-agent") || "unknown";
  }

  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      entry.level,
      entry.service,
      entry.action,
      `IP:${entry.ip}`,
      `UA:${entry.userAgent}`,
      entry.fileId ? `FileID:${entry.fileId}` : "",
      entry.success ? "SUCCESS" : "ERROR",
      entry.error ? `Error:${entry.error}` : "",
      entry.responseTime ? `Time:${entry.responseTime}ms` : "",
      entry.fileSize ? `Size:${entry.fileSize}bytes` : "",
    ].filter(Boolean);

    return parts.join(" ");
  }

  log(
    entry: Omit<LogEntry, "timestamp" | "ip" | "userAgent"> & {
      request: NextRequest;
    }
  ): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      ip: this.getClientIP(entry.request),
      userAgent: this.getUserAgent(entry.request),
    };

    const logMessage = this.formatLogEntry(fullEntry);

    // Log to console (in production, you might want to send to external logging service)
    if (fullEntry.level === "ERROR") {
      console.error(logMessage);
    } else if (fullEntry.level === "WARN") {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }

    // In production, you might want to send logs to external service
    // this.sendToExternalService(fullEntry);
  }

  // Rate limiting specific logging
  logRateLimit(
    request: NextRequest,
    service: string,
    action: string,
    fileId?: string
  ): void {
    this.log({
      level: "WARN",
      service,
      action: `${action}_RATE_LIMIT`,
      request,
      fileId,
      success: false,
      error: "Rate limit exceeded",
    });
  }

  // Download specific logging
  logDownload(
    request: NextRequest,
    fileId: string,
    success: boolean,
    error?: string,
    fileSize?: number,
    responseTime?: number
  ): void {
    this.log({
      level: success ? "INFO" : "ERROR",
      service: "DRIVE_DOWNLOAD",
      action: "DOWNLOAD",
      request,
      fileId,
      success,
      error,
      fileSize,
      responseTime,
    });
  }

  // Info specific logging
  logInfo(
    request: NextRequest,
    fileId: string,
    success: boolean,
    error?: string,
    responseTime?: number
  ): void {
    this.log({
      level: success ? "INFO" : "ERROR",
      service: "DRIVE_INFO",
      action: "GET_INFO",
      request,
      fileId,
      success,
      error,
      responseTime,
    });
  }

  // Security logging for suspicious activity
  logSecurity(request: NextRequest, action: string, details: string): void {
    this.log({
      level: "WARN",
      service: "SECURITY",
      action,
      request,
      success: false,
      error: details,
    });
  }

  // Service health logging
  logHealth(
    request: NextRequest,
    service: string,
    status: "UP" | "DOWN",
    error?: string
  ): void {
    this.log({
      level: status === "UP" ? "INFO" : "ERROR",
      service: "HEALTH_CHECK",
      action: `${service}_${status}`,
      request,
      success: status === "UP",
      error,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
