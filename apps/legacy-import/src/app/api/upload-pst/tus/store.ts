/**
 * Shared upload store for TUS protocol
 * Uses streaming multipart upload to R2 instead of memory buffering
 * This allows uploading files of any size (tested with 47GB+)
 */

import type { CompletedPart } from '@aws-sdk/client-s3';

export interface UploadData {
  offset: number;
  length: number;
  metadata: Record<string, string>;
  sessionId: string;
  // Multipart upload state (streaming to R2)
  r2UploadId: string | null;
  r2Key: string | null;
  completedParts: CompletedPart[];
  currentPartNumber: number;
  // Buffer for accumulating chunks until we reach minimum part size (5MB)
  pendingBuffer: Buffer;
}

// Minimum part size for S3/R2 multipart upload (5MB, except last part)
export const MIN_PART_SIZE = 5 * 1024 * 1024;

// Global store shared between routes
export const uploadStore = new Map<string, UploadData>();
