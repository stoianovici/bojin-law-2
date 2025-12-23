/**
 * Thumbnail Storage Service
 * OPS-114: Permanent Document Thumbnails
 *
 * Service for storing and retrieving document thumbnails from Cloudflare R2.
 * Thumbnails are stored permanently with public CDN access for fast grid loading.
 *
 * Storage structure:
 * - thumbnails/{documentId}/small.jpg  (48x48)
 * - thumbnails/{documentId}/medium.jpg (200x200)
 * - thumbnails/{documentId}/large.jpg  (800x800)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

// Environment configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legal-documents';
// Public URL for R2 bucket (via Cloudflare custom domain or R2 public bucket URL)
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// R2 endpoint format
const R2_ENDPOINT = R2_ACCOUNT_ID
  ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : process.env.R2_ENDPOINT;

// Thumbnail size configurations
export const THUMBNAIL_SIZES = {
  small: { width: 48, height: 48, quality: 80 },
  medium: { width: 200, height: 200, quality: 85 },
  large: { width: 800, height: 800, quality: 90 },
} as const;

export type ThumbnailSize = keyof typeof THUMBNAIL_SIZES;

// ============================================================================
// Types
// ============================================================================

export interface ThumbnailUploadResult {
  size: ThumbnailSize;
  storagePath: string;
  publicUrl: string;
  bytes: number;
}

export interface DocumentThumbnailUrls {
  small?: string;
  medium?: string;
  large?: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Thumbnail Storage Service Class
 * Handles R2 storage operations for document thumbnails
 */
export class ThumbnailStorageService {
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
   * Generate storage path for a thumbnail
   * @param documentId - Document UUID
   * @param size - Thumbnail size (small, medium, large)
   * @returns Storage path like "thumbnails/{documentId}/medium.jpg"
   */
  getStoragePath(documentId: string, size: ThumbnailSize): string {
    return `thumbnails/${documentId}/${size}.jpg`;
  }

  /**
   * Generate public URL for a thumbnail
   * Falls back to signed URL if public URL not configured
   * @param storagePath - The R2 storage path
   * @returns Public URL for the thumbnail
   */
  getPublicUrl(storagePath: string): string {
    if (R2_PUBLIC_URL) {
      // Use configured public URL (CDN)
      return `${R2_PUBLIC_URL}/${storagePath}`;
    }

    // Fallback: construct R2 URL (requires public bucket access)
    if (R2_ACCOUNT_ID) {
      return `https://pub-${R2_ACCOUNT_ID}.r2.dev/${storagePath}`;
    }

    logger.warn('No R2 public URL configured, thumbnails may not be accessible');
    return storagePath;
  }

  /**
   * Upload a thumbnail to R2
   *
   * @param documentId - Document UUID
   * @param size - Thumbnail size
   * @param buffer - JPEG image buffer
   * @returns Upload result with public URL
   */
  async uploadThumbnail(
    documentId: string,
    size: ThumbnailSize,
    buffer: Buffer
  ): Promise<ThumbnailUploadResult> {
    const storagePath = this.getStoragePath(documentId, size);

    logger.debug('Uploading thumbnail to R2', {
      documentId,
      size,
      storagePath,
      bytes: buffer.length,
    });

    const client = this.getClient();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storagePath,
      Body: buffer,
      ContentType: 'image/jpeg',
      // Set long cache headers for CDN caching
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        documentId,
        size,
        generatedAt: new Date().toISOString(),
      },
    });

    await client.send(command);

    const publicUrl = this.getPublicUrl(storagePath);

    logger.info('Thumbnail uploaded to R2', {
      documentId,
      size,
      storagePath,
      publicUrl,
      bytes: buffer.length,
    });

    return {
      size,
      storagePath,
      publicUrl,
      bytes: buffer.length,
    };
  }

  /**
   * Upload all thumbnail sizes for a document
   *
   * @param documentId - Document UUID
   * @param thumbnails - Map of size to buffer
   * @returns Upload results for all sizes
   */
  async uploadAllThumbnails(
    documentId: string,
    thumbnails: Map<ThumbnailSize, Buffer>
  ): Promise<DocumentThumbnailUrls> {
    const urls: DocumentThumbnailUrls = {};

    for (const [size, buffer] of thumbnails) {
      try {
        const result = await this.uploadThumbnail(documentId, size, buffer);
        urls[size] = result.publicUrl;
      } catch (error) {
        logger.error('Failed to upload thumbnail size', {
          documentId,
          size,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other sizes even if one fails
      }
    }

    return urls;
  }

  /**
   * Delete all thumbnails for a document
   *
   * @param documentId - Document UUID
   */
  async deleteThumbnails(documentId: string): Promise<void> {
    const client = this.getClient();
    const sizes: ThumbnailSize[] = ['small', 'medium', 'large'];

    for (const size of sizes) {
      const storagePath = this.getStoragePath(documentId, size);

      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: storagePath,
          })
        );
        logger.debug('Thumbnail deleted', { documentId, size, storagePath });
      } catch (error) {
        // Ignore 404 errors (already deleted)
        logger.debug('Thumbnail delete failed or not found', {
          documentId,
          size,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Thumbnails deleted for document', { documentId });
  }

  /**
   * Check if a thumbnail exists
   *
   * @param documentId - Document UUID
   * @param size - Thumbnail size
   * @returns True if thumbnail exists
   */
  async thumbnailExists(documentId: string, size: ThumbnailSize): Promise<boolean> {
    try {
      const client = this.getClient();
      const storagePath = this.getStoragePath(documentId, size);

      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: storagePath,
        })
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration for thumbnail sizes
   */
  getConfig(): typeof THUMBNAIL_SIZES {
    return { ...THUMBNAIL_SIZES };
  }
}

// Export singleton instance
export const thumbnailStorageService = new ThumbnailStorageService();
