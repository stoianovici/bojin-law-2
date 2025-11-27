/**
 * Thumbnail Generation Service
 * Story 2.9: Document Storage with OneDrive Integration (AC5)
 *
 * Service for generating and caching document thumbnails.
 * Supports:
 * - Image files (PNG, JPG, JPEG, GIF, WEBP) via Sharp library
 * - PDF and Office files via OneDrive thumbnail endpoint
 *
 * Caching strategy:
 * - Thumbnails cached in Redis with 24-hour TTL
 * - Cache key pattern: thumbnail:{documentId}
 */

import logger from '../utils/logger';
import { oneDriveService } from './onedrive.service';

// Sharp type - defined separately since Sharp is an optional dependency
type SharpInstance = {
  resize: (width: number, height: number, options?: any) => SharpInstance;
  jpeg: (options?: { quality?: number }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
};

type SharpModule = {
  (input?: Buffer | string): SharpInstance;
};

// Thumbnail configuration
const THUMBNAIL_CONFIG = {
  // Thumbnail dimensions
  WIDTH: 200,
  HEIGHT: 200,
  // JPEG quality for generated thumbnails
  QUALITY: 80,
  // Cache TTL in seconds (24 hours)
  CACHE_TTL: 24 * 60 * 60,
  // Redis key prefix
  CACHE_KEY_PREFIX: 'thumbnail:',
};

// File types that can be processed locally with Sharp
const LOCAL_PROCESSABLE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

// File types that use OneDrive thumbnail endpoint
const ONEDRIVE_THUMBNAIL_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/**
 * Thumbnail result containing the URL or base64 data
 */
export interface ThumbnailResult {
  /** Base64 data URI for local thumbnails, URL for OneDrive thumbnails */
  url: string;
  /** Source of the thumbnail */
  source: 'local' | 'onedrive' | 'cache';
  /** Expiration time (for OneDrive thumbnails) */
  expiresAt?: string;
}

/**
 * Thumbnail Service Class
 * Handles thumbnail generation for documents
 */
export class ThumbnailService {
  private sharp: SharpModule | null = null;
  private redisClient: any = null;

  /**
   * Initialize Sharp library lazily
   * This allows graceful degradation if Sharp is not installed
   */
  private async getSharp(): Promise<SharpModule | null> {
    if (this.sharp) return this.sharp;

    try {
      // Dynamic import of sharp - it's an optional dependency
      // Using require for dynamic loading to avoid TypeScript module resolution issues
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharpModule = require('sharp');
      this.sharp = sharpModule as SharpModule;
      return this.sharp;
    } catch (error) {
      logger.warn('Sharp library not available, local image thumbnail generation disabled', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Set Redis client for caching
   * @param client - Redis client instance
   */
  setRedisClient(client: any): void {
    this.redisClient = client;
  }

  /**
   * Check if a file type supports thumbnail generation
   * @param fileType - MIME type of the file
   * @returns True if thumbnails can be generated
   */
  canGenerateThumbnail(fileType: string): boolean {
    return LOCAL_PROCESSABLE_TYPES.has(fileType) || ONEDRIVE_THUMBNAIL_TYPES.has(fileType);
  }

  /**
   * Generate thumbnail for a document
   *
   * @param documentId - Database document ID (for caching)
   * @param fileType - MIME type of the file
   * @param options - Optional parameters
   * @param options.fileBuffer - File buffer for local processing (images)
   * @param options.oneDriveId - OneDrive item ID for remote thumbnails
   * @param options.accessToken - User access token for OneDrive API
   * @returns Thumbnail result or null if generation failed
   */
  async generateThumbnail(
    documentId: string,
    fileType: string,
    options: {
      fileBuffer?: Buffer;
      oneDriveId?: string;
      accessToken?: string;
    }
  ): Promise<ThumbnailResult | null> {
    try {
      // Check cache first
      const cached = await this.getCachedThumbnail(documentId);
      if (cached) {
        logger.debug('Thumbnail cache hit', { documentId });
        return { url: cached, source: 'cache' };
      }

      let thumbnailUrl: string | null = null;
      let source: 'local' | 'onedrive' = 'local';
      let expiresAt: string | undefined;

      // Generate thumbnail based on file type
      if (LOCAL_PROCESSABLE_TYPES.has(fileType) && options.fileBuffer) {
        // Local image processing with Sharp
        thumbnailUrl = await this.generateLocalThumbnail(options.fileBuffer, fileType);
        source = 'local';
      } else if (ONEDRIVE_THUMBNAIL_TYPES.has(fileType) && options.oneDriveId && options.accessToken) {
        // OneDrive thumbnail endpoint for PDFs and Office files
        const result = await this.getOneDriveThumbnail(
          options.accessToken,
          options.oneDriveId
        );
        if (result) {
          thumbnailUrl = result.url;
          source = 'onedrive';
          expiresAt = result.expiresAt;
        }
      }

      if (!thumbnailUrl) {
        logger.debug('Could not generate thumbnail', { documentId, fileType });
        return null;
      }

      // Cache the thumbnail
      await this.cacheThumbnail(documentId, thumbnailUrl);

      logger.info('Thumbnail generated', {
        documentId,
        fileType,
        source,
      });

      return { url: thumbnailUrl, source, expiresAt };
    } catch (error) {
      logger.error('Failed to generate thumbnail', {
        documentId,
        fileType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate thumbnail locally using Sharp
   *
   * @param fileBuffer - Image file buffer
   * @param fileType - MIME type
   * @returns Base64 data URI or null
   */
  async generateLocalThumbnail(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<string | null> {
    const sharp = await this.getSharp();
    if (!sharp) {
      logger.warn('Sharp not available for local thumbnail generation');
      return null;
    }

    try {
      const thumbnail = await sharp(fileBuffer)
        .resize(THUMBNAIL_CONFIG.WIDTH, THUMBNAIL_CONFIG.HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: THUMBNAIL_CONFIG.QUALITY })
        .toBuffer();

      const base64 = thumbnail.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      logger.error('Sharp thumbnail generation failed', {
        fileType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get thumbnail from OneDrive for PDFs and Office files
   *
   * @param accessToken - User access token
   * @param oneDriveId - OneDrive item ID
   * @returns Thumbnail URL or null
   */
  async getOneDriveThumbnail(
    accessToken: string,
    oneDriveId: string
  ): Promise<{ url: string; expiresAt?: string } | null> {
    try {
      const thumbnailUrl = await oneDriveService.getFileThumbnail(
        accessToken,
        oneDriveId,
        'medium'
      );

      if (!thumbnailUrl) {
        return null;
      }

      return {
        url: thumbnailUrl,
        // OneDrive thumbnail URLs typically expire, set approximate expiration
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      };
    } catch (error) {
      logger.error('OneDrive thumbnail fetch failed', {
        oneDriveId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get cached thumbnail from Redis
   *
   * @param documentId - Document ID
   * @returns Cached thumbnail URL or null
   */
  private async getCachedThumbnail(documentId: string): Promise<string | null> {
    if (!this.redisClient) {
      return null;
    }

    try {
      const cacheKey = `${THUMBNAIL_CONFIG.CACHE_KEY_PREFIX}${documentId}`;
      const cached = await this.redisClient.get(cacheKey);
      return cached || null;
    } catch (error) {
      logger.warn('Redis cache read failed for thumbnail', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cache thumbnail in Redis
   *
   * @param documentId - Document ID
   * @param thumbnailUrl - Thumbnail URL or data URI
   */
  private async cacheThumbnail(documentId: string, thumbnailUrl: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      const cacheKey = `${THUMBNAIL_CONFIG.CACHE_KEY_PREFIX}${documentId}`;
      await this.redisClient.setEx(cacheKey, THUMBNAIL_CONFIG.CACHE_TTL, thumbnailUrl);
      logger.debug('Thumbnail cached', { documentId });
    } catch (error) {
      logger.warn('Redis cache write failed for thumbnail', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate cached thumbnail
   *
   * @param documentId - Document ID
   */
  async invalidateThumbnailCache(documentId: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      const cacheKey = `${THUMBNAIL_CONFIG.CACHE_KEY_PREFIX}${documentId}`;
      await this.redisClient.del(cacheKey);
      logger.debug('Thumbnail cache invalidated', { documentId });
    } catch (error) {
      logger.warn('Redis cache delete failed for thumbnail', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get thumbnail configuration
   * @returns Configuration object
   */
  getConfig(): typeof THUMBNAIL_CONFIG {
    return { ...THUMBNAIL_CONFIG };
  }
}

// Export singleton instance
export const thumbnailService = new ThumbnailService();
