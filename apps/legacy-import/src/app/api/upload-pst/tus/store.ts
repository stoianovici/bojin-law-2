/**
 * Shared upload store for TUS protocol
 * In-memory storage for upload metadata (in production, use Redis)
 */

export interface UploadData {
  offset: number;
  length: number;
  metadata: Record<string, string>;
  sessionId: string;
  chunks: Buffer[];
}

// Global store shared between routes
export const uploadStore = new Map<string, UploadData>();
