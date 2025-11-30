/**
 * Cloudflare R2 Storage Service
 * S3-compatible API for secure document storage during PST import
 * Part of Story 3.2.5 - Legacy Document Import
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

// Environment validation
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legacy-import';

// R2 endpoint format
const R2_ENDPOINT = R2_ACCOUNT_ID
  ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : process.env.R2_ENDPOINT;

// Initialize S3 client for R2
const getR2Client = () => {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    throw new Error(
      'R2 configuration missing. Check R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID environment variables.'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
};

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  sessionId?: string;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

/**
 * Upload a file to R2 with encryption
 * Files are encrypted at rest by R2 (AES-256)
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Readable | string,
  options: UploadOptions = {}
): Promise<{ key: string; etag: string }> {
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: options.contentType || 'application/octet-stream',
    Metadata: {
      ...options.metadata,
      uploadedAt: new Date().toISOString(),
      ...(options.sessionId && { sessionId: options.sessionId }),
    },
  });

  const response = await client.send(command);

  return {
    key,
    etag: response.ETag || '',
  };
}

/**
 * Upload a PST file to R2 for processing
 * Stored under: pst/{sessionId}/{filename}
 */
export async function uploadPSTFile(
  sessionId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<{ key: string; size: number }> {
  const key = `pst/${sessionId}/${fileName}`;

  await uploadToR2(key, fileBuffer, {
    contentType: 'application/vnd.ms-outlook',
    sessionId,
    metadata: {
      originalFileName: fileName,
      fileType: 'pst',
    },
  });

  return {
    key,
    size: fileBuffer.length,
  };
}

/**
 * Upload an extracted document to R2
 * Stored under: documents/{sessionId}/{documentId}.{extension}
 */
export async function uploadExtractedDocument(
  sessionId: string,
  documentId: string,
  fileBuffer: Buffer,
  extension: string,
  metadata: {
    originalFileName: string;
    folderPath: string;
    emailSubject?: string;
  }
): Promise<{ key: string; size: number }> {
  const key = `documents/${sessionId}/${documentId}.${extension}`;

  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
  };

  await uploadToR2(key, fileBuffer, {
    contentType: contentTypeMap[extension] || 'application/octet-stream',
    sessionId,
    metadata: {
      ...metadata,
      documentId,
      fileExtension: extension,
    },
  });

  return {
    key,
    size: fileBuffer.length,
  };
}

/**
 * Download a file from R2
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  const stream = response.Body as Readable;

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Stream a file from R2 directly to a local file path
 * Memory-efficient for large files like PST
 */
export async function streamFromR2ToFile(key: string, destPath: string): Promise<void> {
  const fs = await import('fs');
  const { pipeline } = await import('stream/promises');
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  const writeStream = fs.createWriteStream(destPath);
  const readStream = response.Body as Readable;

  await pipeline(readStream, writeStream);
}

/**
 * Generate a pre-signed URL for temporary access
 * Default expiration: 1 hour
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a pre-signed URL for uploading
 * Used for large file uploads directly from client
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
}

/**
 * Delete all files for a session (cleanup after export)
 * Deletes PST file and all extracted documents
 */
export async function deleteSessionFiles(sessionId: string): Promise<{
  deletedCount: number;
  deletedKeys: string[];
}> {
  const client = getR2Client();

  // List all objects with session prefix
  const prefixes = [`pst/${sessionId}/`, `documents/${sessionId}/`];
  const deletedKeys: string[] = [];

  for (const prefix of prefixes) {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const listResponse = await client.send(listCommand);

    if (listResponse.Contents) {
      for (const object of listResponse.Contents) {
        if (object.Key) {
          await deleteFromR2(object.Key);
          deletedKeys.push(object.Key);
        }
      }
    }
  }

  return {
    deletedCount: deletedKeys.length,
    deletedKeys,
  };
}

/**
 * List all documents for a session
 */
export async function listSessionDocuments(sessionId: string): Promise<R2Object[]> {
  const client = getR2Client();

  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: `documents/${sessionId}/`,
  });

  const response = await client.send(command);

  if (!response.Contents) {
    return [];
  }

  return response.Contents.map((obj) => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
    etag: obj.ETag,
  }));
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getR2Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file metadata from R2
 */
export async function getFileMetadata(key: string): Promise<{
  size: number;
  contentType: string;
  lastModified: Date;
  metadata: Record<string, string>;
} | null> {
  const client = getR2Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await client.send(command);

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
      metadata: response.Metadata || {},
    };
  } catch {
    return null;
  }
}

// Export the client getter for advanced usage
export { getR2Client };

// =============================================================================
// Multipart Upload Support (for large files like 47GB PST)
// =============================================================================

export interface MultipartUploadSession {
  uploadId: string;
  key: string;
  parts: CompletedPart[];
  partNumber: number;
}

/**
 * Start a multipart upload session for large files
 * Returns uploadId needed for subsequent part uploads
 */
export async function startMultipartUpload(
  key: string,
  contentType: string = 'application/octet-stream',
  metadata: Record<string, string> = {}
): Promise<{ uploadId: string; key: string }> {
  const client = getR2Client();

  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: {
      ...metadata,
      uploadedAt: new Date().toISOString(),
    },
  });

  const response = await client.send(command);

  if (!response.UploadId) {
    throw new Error('Failed to initiate multipart upload - no uploadId returned');
  }

  return {
    uploadId: response.UploadId,
    key,
  };
}

/**
 * Upload a single part to an ongoing multipart upload
 * Part numbers must be between 1 and 10000
 * Minimum part size is 5MB (except for the last part)
 */
export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer
): Promise<CompletedPart> {
  const client = getR2Client();

  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: body,
  });

  const response = await client.send(command);

  return {
    ETag: response.ETag,
    PartNumber: partNumber,
  };
}

/**
 * Complete a multipart upload by combining all parts
 * Parts must be provided in order
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<{ key: string; etag: string }> {
  const client = getR2Client();

  // Sort parts by part number
  const sortedParts = [...parts].sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0));

  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  const response = await client.send(command);

  return {
    key,
    etag: response.ETag || '',
  };
}

/**
 * Abort a multipart upload (cleanup on error or cancellation)
 */
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const client = getR2Client();

  const command = new AbortMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  await client.send(command);
}
