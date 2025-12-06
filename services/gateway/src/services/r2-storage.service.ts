/**
 * R2 Storage Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Cloudflare R2 integration for document storage operations.
 * Used by OneDrive sync service to retrieve and update document content.
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import logger from '../utils/logger';

// Environment configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legal-documents';

// R2 endpoint format
const R2_ENDPOINT = R2_ACCOUNT_ID
  ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : process.env.R2_ENDPOINT;

/**
 * R2 Storage Service Class
 * Provides document storage operations using Cloudflare R2 (S3-compatible)
 */
export class R2StorageService {
  private client: S3Client | null = null;
  private bucketName: string;

  constructor() {
    this.bucketName = R2_BUCKET_NAME;
  }

  /**
   * Initialize the R2 client lazily
   */
  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
      throw new Error(
        'R2 configuration missing. Required environment variables: ' +
          'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and either R2_ACCOUNT_ID or R2_ENDPOINT'
      );
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    return this.client;
  }

  /**
   * Check if R2 is configured and available
   */
  isConfigured(): boolean {
    return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT);
  }

  /**
   * Download a document from R2 storage
   *
   * @param storagePath - The storage path/key of the document
   * @returns Buffer containing the document content
   */
  async downloadDocument(storagePath: string): Promise<Buffer> {
    logger.debug('Downloading document from R2', { storagePath });

    const client = this.getClient();

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storagePath,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error(`Empty response body for document: ${storagePath}`);
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as Readable;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => {
        logger.error('Error streaming document from R2', { storagePath, error: err });
        reject(err);
      });
      stream.on('end', () => {
        logger.debug('Document downloaded from R2', {
          storagePath,
          size: Buffer.concat(chunks).length,
        });
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Upload a document to R2 storage
   *
   * @param storagePath - The storage path/key for the document
   * @param content - The document content as a Buffer
   * @param contentType - MIME type of the document
   * @returns Upload result with etag
   */
  async uploadDocument(
    storagePath: string,
    content: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<{ storagePath: string; etag: string; size: number }> {
    logger.debug('Uploading document to R2', { storagePath, contentType, size: content.length });

    const client = this.getClient();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storagePath,
      Body: content,
      ContentType: contentType,
      Metadata: {
        updatedAt: new Date().toISOString(),
      },
    });

    const response = await client.send(command);

    logger.info('Document uploaded to R2', {
      storagePath,
      etag: response.ETag,
      size: content.length,
    });

    return {
      storagePath,
      etag: response.ETag || '',
      size: content.length,
    };
  }

  /**
   * Check if a document exists in R2 storage
   *
   * @param storagePath - The storage path/key of the document
   * @returns True if document exists
   */
  async documentExists(storagePath: string): Promise<boolean> {
    try {
      const client = this.getClient();

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath,
      });

      await client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get document metadata from R2 storage
   *
   * @param storagePath - The storage path/key of the document
   * @returns Document metadata or null if not found
   */
  async getDocumentMetadata(storagePath: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
  } | null> {
    try {
      const client = this.getClient();

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath,
      });

      const response = await client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get content type based on file extension
   */
  getContentTypeForExtension(extension: string): string {
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      txt: 'text/plain',
      rtf: 'application/rtf',
      html: 'text/html',
      htm: 'text/html',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}

// Export singleton instance
export const r2StorageService = new R2StorageService();
