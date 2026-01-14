/**
 * Thumbnail Generation Worker
 * OPS-114: Permanent Document Thumbnails
 *
 * Background worker that processes document thumbnail generation jobs.
 * Uses BullMQ for job queue management.
 *
 * Thumbnail sources:
 * - SharePoint/OneDrive: Fetch from Microsoft Graph API (uses app-only tokens if no user token)
 * - R2 Images: Generate locally using Sharp
 * - Unsupported types: Mark as NOT_SUPPORTED
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import type { Client } from '@microsoft/microsoft-graph-client';
import { prisma, ThumbnailStatus } from '@legal-platform/database';
import {
  thumbnailStorageService,
  THUMBNAIL_SIZES,
  ThumbnailSize,
  DocumentThumbnailUrls,
} from '../services/thumbnail-storage.service';
import { sharePointService } from '../services/sharepoint.service';
import { oneDriveService } from '../services/onedrive.service';
import { GraphService } from '../services/graph.service';
import { r2StorageService } from '../services/r2-storage.service';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'thumbnail-generation';

// File types that support thumbnails
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);

const MICROSOFT_THUMBNAIL_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ...IMAGE_TYPES,
]);

// Sharp type - defined separately since Sharp is an optional dependency
type SharpInstance = {
  resize: (width: number, height: number, options?: object) => SharpInstance;
  jpeg: (options?: { quality?: number }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
};

type SharpModule = (input?: Buffer | string) => SharpInstance;

// ============================================================================
// Types
// ============================================================================

interface ThumbnailJobData {
  documentId: string;
  accessToken?: string; // Optional: for Microsoft Graph API
  triggeredBy: 'upload' | 'migration' | 'manual';
  priority?: number;
}

interface ThumbnailJobResult {
  success: boolean;
  documentId: string;
  thumbnailUrls?: DocumentThumbnailUrls;
  status: ThumbnailStatus;
  error?: string;
}

// ============================================================================
// Queue
// ============================================================================

// Create queue
export const thumbnailQueue = new Queue<ThumbnailJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 5000, // Keep last 5000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Add a thumbnail generation job to the queue
 */
export async function queueThumbnailJob(data: ThumbnailJobData): Promise<Job<ThumbnailJobData>> {
  // Check if job already exists for this document
  const existingJobs = await thumbnailQueue.getJobs(['waiting', 'active', 'delayed']);
  const duplicate = existingJobs.find((job) => job.data.documentId === data.documentId);

  if (duplicate) {
    logger.debug('Thumbnail job already queued, skipping duplicate', {
      documentId: data.documentId,
      existingJobId: duplicate.id,
    });
    return duplicate;
  }

  const job = await thumbnailQueue.add(`thumbnail-${data.documentId}`, data, {
    jobId: `thumbnail-${data.documentId}-${Date.now()}`,
    priority: data.priority ?? (data.triggeredBy === 'upload' ? 1 : 2),
  });

  logger.info('Thumbnail generation job queued', {
    jobId: job.id,
    documentId: data.documentId,
    triggeredBy: data.triggeredBy,
  });

  return job;
}

/**
 * Queue thumbnail jobs for multiple documents (batch)
 */
export async function queueThumbnailBatch(
  documentIds: string[],
  triggeredBy: 'migration' | 'manual' = 'migration'
): Promise<number> {
  let queued = 0;

  for (const documentId of documentIds) {
    try {
      await queueThumbnailJob({
        documentId,
        triggeredBy,
        priority: 10, // Lower priority for batch jobs
      });
      queued++;
    } catch (error) {
      logger.warn('Failed to queue thumbnail job', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Thumbnail batch queued', { total: documentIds.length, queued });
  return queued;
}

// ============================================================================
// Job Processor
// ============================================================================

let sharpModule: SharpModule | null = null;

/**
 * Load Sharp module lazily
 */
async function getSharp(): Promise<SharpModule | null> {
  if (sharpModule) return sharpModule;

  try {
    const sharp = require('sharp');
    sharpModule = sharp as SharpModule;
    return sharpModule;
  } catch (error) {
    logger.warn('Sharp library not available', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Generate thumbnail buffer from image using Sharp
 */
async function generateLocalThumbnail(buffer: Buffer, size: ThumbnailSize): Promise<Buffer | null> {
  const sharp = await getSharp();
  if (!sharp) return null;

  const config = THUMBNAIL_SIZES[size];

  try {
    return await sharp(buffer)
      .resize(config.width, config.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.quality })
      .toBuffer();
  } catch (error) {
    logger.error('Sharp thumbnail generation failed', {
      size,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Fetch thumbnail from Microsoft Graph API
 * Supports both user token and app-only client
 */
async function fetchMicrosoftThumbnail(
  itemId: string,
  isSharePoint: boolean,
  size: 'small' | 'medium' | 'large',
  accessToken?: string,
  graphClient?: Client
): Promise<Buffer | null> {
  try {
    // Get thumbnail URL from Microsoft
    let thumbnailUrl: string | undefined;

    if (isSharePoint) {
      if (graphClient) {
        const thumbnails = await sharePointService.getThumbnailsWithClient(graphClient, itemId);
        thumbnailUrl = thumbnails[size];
      } else if (accessToken) {
        const thumbnails = await sharePointService.getThumbnails(accessToken, itemId);
        thumbnailUrl = thumbnails[size];
      }
    } else {
      // OneDrive - use existing service (only with access token for now)
      if (accessToken) {
        thumbnailUrl = await oneDriveService.getFileThumbnail(accessToken, itemId, size);
      }
    }

    if (!thumbnailUrl) {
      return null;
    }

    // Fetch the thumbnail image
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error('Failed to fetch Microsoft thumbnail', {
      itemId,
      isSharePoint,
      size,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Process a thumbnail generation job
 */
async function processThumbnailJob(job: Job<ThumbnailJobData>): Promise<ThumbnailJobResult> {
  const { documentId, accessToken, triggeredBy } = job.data;

  logger.info('Processing thumbnail job', {
    jobId: job.id,
    documentId,
    triggeredBy,
    attempt: job.attemptsMade + 1,
  });

  // Mark document as PROCESSING
  await prisma.document.update({
    where: { id: documentId },
    data: {
      thumbnailStatus: ThumbnailStatus.PROCESSING,
      thumbnailError: null,
    },
  });

  try {
    // Get document details
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileType: true,
        fileName: true,
        storagePath: true,
        sharePointItemId: true,
        oneDriveId: true,
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const fileType = document.fileType.toLowerCase();

    // Check if file type supports thumbnails
    const isImage = IMAGE_TYPES.has(fileType);
    const isMicrosoftType = MICROSOFT_THUMBNAIL_TYPES.has(fileType);
    const hasSharePoint = !!document.sharePointItemId;
    const hasOneDrive = !!document.oneDriveId;

    if (!isImage && !isMicrosoftType) {
      // Mark as NOT_SUPPORTED
      await prisma.document.update({
        where: { id: documentId },
        data: {
          thumbnailStatus: ThumbnailStatus.NOT_SUPPORTED,
          thumbnailError: `File type ${fileType} does not support thumbnails`,
        },
      });

      return {
        success: true,
        documentId,
        status: ThumbnailStatus.NOT_SUPPORTED,
      };
    }

    const thumbnailBuffers = new Map<ThumbnailSize, Buffer>();

    // Strategy 1: SharePoint/OneDrive documents (use app-only token if no user token)
    if ((hasSharePoint || hasOneDrive) && isMicrosoftType) {
      const itemId = document.sharePointItemId || document.oneDriveId!;
      const isSharePoint = hasSharePoint;

      // Get app-only client if no access token provided
      let appClient: Client | undefined;
      if (!accessToken) {
        logger.info('Using app-only token for thumbnail generation', { documentId, itemId });
        const graphService = new GraphService();
        appClient = await graphService.getAppClient();
      }

      // Fetch all sizes from Microsoft
      for (const size of ['small', 'medium', 'large'] as const) {
        const buffer = await fetchMicrosoftThumbnail(
          itemId,
          isSharePoint,
          size,
          accessToken,
          appClient
        );
        if (buffer) {
          thumbnailBuffers.set(size, buffer);
        }
      }
    }
    // Strategy 2: R2-stored images (generate locally with Sharp)
    else if (isImage && document.storagePath && r2StorageService.isConfigured()) {
      try {
        const imageBuffer = await r2StorageService.downloadDocument(document.storagePath);

        // Generate all sizes
        for (const size of ['small', 'medium', 'large'] as const) {
          const thumbnail = await generateLocalThumbnail(imageBuffer, size);
          if (thumbnail) {
            thumbnailBuffers.set(size, thumbnail);
          }
        }
      } catch (error) {
        logger.warn('Failed to download image from R2 for thumbnail', {
          documentId,
          storagePath: document.storagePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Upload generated thumbnails to R2
    if (thumbnailBuffers.size > 0) {
      const urls = await thumbnailStorageService.uploadAllThumbnails(documentId, thumbnailBuffers);

      // Update document with permanent URLs
      await prisma.document.update({
        where: { id: documentId },
        data: {
          thumbnailSmallUrl: urls.small || null,
          thumbnailMediumUrl: urls.medium || null,
          thumbnailLargeUrl: urls.large || null,
          thumbnailStatus: ThumbnailStatus.COMPLETED,
          thumbnailError: null,
        },
      });

      logger.info('Thumbnails generated and stored', {
        documentId,
        sizes: Array.from(thumbnailBuffers.keys()),
        urls,
      });

      return {
        success: true,
        documentId,
        thumbnailUrls: urls,
        status: ThumbnailStatus.COMPLETED,
      };
    }

    // No thumbnails generated
    await prisma.document.update({
      where: { id: documentId },
      data: {
        thumbnailStatus: ThumbnailStatus.FAILED,
        thumbnailError: 'Could not generate thumbnails from any source',
      },
    });

    return {
      success: false,
      documentId,
      status: ThumbnailStatus.FAILED,
      error: 'Could not generate thumbnails from any source',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update document with failure
    await prisma.document.update({
      where: { id: documentId },
      data: {
        thumbnailStatus: ThumbnailStatus.FAILED,
        thumbnailError: errorMessage.substring(0, 500),
      },
    });

    logger.error('Thumbnail generation failed', {
      jobId: job.id,
      documentId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

// ============================================================================
// Worker
// ============================================================================

// Module-level worker instance for singleton pattern
let thumbnailWorker: Worker<ThumbnailJobData> | null = null;

/**
 * Create and start the thumbnail generation worker
 */
export function createThumbnailWorker(): Worker<ThumbnailJobData> {
  const worker = new Worker<ThumbnailJobData>(QUEUE_NAME, processThumbnailJob, {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 jobs concurrently
    limiter: {
      max: 60, // Max 60 jobs per minute (respect API rate limits)
      duration: 60000,
    },
  });

  // Event handlers
  worker.on('completed', (job, result: ThumbnailJobResult) => {
    logger.info('Thumbnail job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
      status: result.status,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Thumbnail job failed', {
      jobId: job?.id,
      documentId: job?.data.documentId,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Thumbnail worker error', { error: err.message });
  });

  logger.info('Thumbnail generation worker started', {
    concurrency: 3,
    queue: QUEUE_NAME,
  });

  return worker;
}

/**
 * Graceful shutdown
 */
export async function shutdownThumbnailWorker(worker: Worker): Promise<void> {
  logger.info('Shutting down thumbnail generation worker...');
  await worker.close();
  await thumbnailQueue.close();
  await redisConnection.quit();
  logger.info('Thumbnail generation worker shut down');
}

/**
 * Start the thumbnail generation worker (singleton pattern)
 * Matches the pattern used by other workers in the gateway
 */
export function startThumbnailWorker(): void {
  if (thumbnailWorker) {
    logger.warn('Thumbnail worker already started');
    return;
  }
  thumbnailWorker = createThumbnailWorker();
}

/**
 * Stop the thumbnail generation worker
 */
export async function stopThumbnailWorker(): Promise<void> {
  if (!thumbnailWorker) {
    return;
  }
  await shutdownThumbnailWorker(thumbnailWorker);
  thumbnailWorker = null;
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Queue thumbnail generation for documents missing thumbnails
 * Useful for migration of existing documents
 */
export async function migrateThumbnails(options: {
  batchSize?: number;
  fileTypes?: string[];
  firmId?: string;
}): Promise<{ total: number; queued: number }> {
  const { batchSize = 100, fileTypes, firmId } = options;

  // Find documents without thumbnails
  const documents = await prisma.document.findMany({
    where: {
      thumbnailStatus: ThumbnailStatus.PENDING,
      ...(fileTypes ? { fileType: { in: fileTypes } } : {}),
      ...(firmId ? { firmId } : {}),
    },
    select: { id: true },
    take: batchSize,
    orderBy: { uploadedAt: 'desc' }, // Prioritize recent documents
  });

  if (documents.length === 0) {
    logger.info('No documents need thumbnail migration');
    return { total: 0, queued: 0 };
  }

  const documentIds = documents.map((d) => d.id);
  const queued = await queueThumbnailBatch(documentIds, 'migration');

  return { total: documents.length, queued };
}
