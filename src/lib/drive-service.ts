import { google, drive_v3 } from "googleapis";
import { JWT } from "google-auth-library";

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  permissions?: drive_v3.Schema$Permission[];
}

export interface DriveServiceConfig {
  serviceAccountEmail: string;
  privateKey: string;
  scopes: string[];
}

class DriveService {
  private auth: JWT | null = null;
  private drive: drive_v3.Drive | null = null;
  private config: DriveServiceConfig | null = null;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const scopes = ["https://www.googleapis.com/auth/drive.readonly"];

    if (!serviceAccountEmail || !privateKey) {
      console.warn("Google Drive service account credentials not configured");
      return;
    }

    this.config = {
      serviceAccountEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
      scopes,
    };

    this.auth = new JWT({
      email: serviceAccountEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes,
    });

    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  private ensureInitialized(): void {
    if (!this.drive || !this.auth) {
      throw new Error(
        "Google Drive service not initialized. Check service account credentials."
      );
    }
  }

  /**
   * Get file metadata by ID
   */
  async getFileInfo(fileId: string): Promise<DriveFileInfo> {
    this.ensureInitialized();

    try {
      const response = await this.drive!.files.get({
        fileId,
        fields:
          "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,parents,permissions",
      });

      const file = response.data;

      if (!file) {
        throw new Error("File not found");
      }

      return {
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: file.size || undefined,
        createdTime: file.createdTime!,
        modifiedTime: file.modifiedTime!,
        webViewLink: file.webViewLink || undefined,
        webContentLink: file.webContentLink || undefined,
        thumbnailLink: file.thumbnailLink || undefined,
        parents: file.parents || undefined,
        permissions: file.permissions || undefined,
      };
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 404) {
        throw new Error("File not found");
      }
      if (err.code === 403) {
        throw new Error(
          "Access denied. Check file permissions and service account access."
        );
      }
      throw new Error(
        `Failed to get file info: ${err.message || "Unknown error"}`
      );
    }
  }

  /**
   * Download file content as stream
   */
  async downloadFile(
    fileId: string
  ): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    contentLength?: number;
  }> {
    this.ensureInitialized();

    try {
      // First get file info to check if it exists and get content type
      const fileInfo = await this.getFileInfo(fileId);

      const response = await this.drive!.files.get(
        {
          fileId,
          alt: "media",
        },
        {
          responseType: "stream",
        }
      );

      const stream = response.data as NodeJS.ReadableStream;
      const contentType = this.getContentType(fileInfo.mimeType);

      return {
        stream,
        contentType,
        contentLength: fileInfo.size ? parseInt(fileInfo.size) : undefined,
      };
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 404) {
        throw new Error("File not found");
      }
      if (err.code === 403) {
        throw new Error(
          "Access denied. Check file permissions and service account access."
        );
      }
      throw new Error(
        `Failed to download file: ${err.message || "Unknown error"}`
      );
    }
  }

  /**
   * Check if service account has access to a file
   */
  async checkFileAccess(fileId: string): Promise<boolean> {
    try {
      await this.getFileInfo(fileId);
      return true;
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (
        err.message?.includes("not found") ||
        err.message?.includes("Access denied")
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get content type from MIME type
   */
  private getContentType(mimeType: string): string {
    // Common MIME type mappings
    const mimeTypeMap: Record<string, string> = {
      "application/pdf": "application/pdf",
      "image/jpeg": "image/jpeg",
      "image/png": "image/png",
      "image/gif": "image/gif",
      "image/webp": "image/webp",
      "text/plain": "text/plain",
      "text/csv": "text/csv",
      "application/json": "application/json",
      "application/zip": "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel": "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint",
    };

    return mimeTypeMap[mimeType] || "application/octet-stream";
  }

  /**
   * Validate file ID format
   */
  static validateFileId(fileId: string): boolean {
    // Google Drive file IDs are typically 28-33 characters long and contain alphanumeric characters and some special chars
    const fileIdRegex = /^[a-zA-Z0-9_-]{28,33}$/;
    return fileIdRegex.test(fileId);
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return this.drive !== null && this.auth !== null;
  }
}

// Export singleton instance
export const driveService = new DriveService();

// Export class for static methods
export { DriveService };
