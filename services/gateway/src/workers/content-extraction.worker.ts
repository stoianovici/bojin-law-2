/**
 * Content Extraction Worker
 * Background worker for extracting text content from documents.
 * Uses BullMQ for job queue management.
 *
 * Processes jobs with document ID and file buffer, extracts text,
 * and stores in Document.extractedContent for AI context.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma, DocumentExtractionStatus } from '@legal-platform/database';
import { extractContent, isSupportedFormat } from '../services/content-extraction.service';
import { sharePointService } from '../services/sharepoint.service';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'content-extraction';

// ============================================================================
// Types
// ============================================================================

export interface ContentExtractionJobData {
  documentId: string;
  // Base64 encoded file buffer (for uploads)
  fileBufferBase64?: string;
  // If not provided, fetch from SharePoint/OneDrive using accessToken
  accessToken?: string;
  triggeredBy: 'upload' | 'manual' | 'retry';
}

interface ContentExtractionJobResult {
  success: boolean;
  documentId: string;
  status: DocumentExtractionStatus;
  contentLength?: number;
  error?: string;
}

// ============================================================================
// Queue
// ============================================================================

// Create queue
export const contentExtractionQueue = new Queue<ContentExtractionJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10s initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 5000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Add a content extraction job to the queue
 */
export async function queueContentExtractionJob(
  data: ContentExtractionJobData
): Promise<Job<ContentExtractionJobData>> {
  // Check if job already exists for this document
  const existingJobs = await contentExtractionQueue.getJobs(['waiting', 'active', 'delayed']);
  const duplicate = existingJobs.find((job) => job.data.documentId === data.documentId);

  if (duplicate) {
    logger.debug('Content extraction job already queued, skipping duplicate', {
      documentId: data.documentId,
      existingJobId: duplicate.id,
    });
    return duplicate;
  }

  const job = await contentExtractionQueue.add(`extraction-${data.documentId}`, data, {
    jobId: `extraction-${data.documentId}-${Date.now()}`,
    priority: data.triggeredBy === 'upload' ? 1 : 2,
  });

  logger.info('Content extraction job queued', {
    jobId: job.id,
    documentId: data.documentId,
    triggeredBy: data.triggeredBy,
    hasBuffer: !!data.fileBufferBase64,
  });

  return job;
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process a content extraction job
 */
async function processContentExtractionJob(
  job: Job<ContentExtractionJobData>
): Promise<ContentExtractionJobResult> {
  const { documentId, fileBufferBase64, accessToken, triggeredBy } = job.data;

  logger.info('Processing content extraction job', {
    jobId: job.id,
    documentId,
    triggeredBy,
    attempt: job.attemptsMade + 1,
    hasBuffer: !!fileBufferBase64,
  });

  // Mark document as PROCESSING
  await prisma.document.update({
    where: { id: documentId },
    data: {
      extractionStatus: DocumentExtractionStatus.PROCESSING,
      extractionError: null,
    },
  });

  try {
    // Get document details
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        sharePointItemId: true,
        oneDriveId: true,
        storagePath: true,
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Check if file type is supported
    if (!isSupportedFormat(document.fileType)) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractionStatus: DocumentExtractionStatus.UNSUPPORTED,
          extractionError: `File type ${document.fileType} does not support text extraction`,
        },
      });

      return {
        success: true,
        documentId,
        status: DocumentExtractionStatus.UNSUPPORTED,
      };
    }

    // Get file buffer
    let fileBuffer: Buffer;

    if (fileBufferBase64) {
      // Use provided buffer (from upload)
      fileBuffer = Buffer.from(fileBufferBase64, 'base64');
    } else if ((document.sharePointItemId || document.oneDriveId) && accessToken) {
      // Fetch from SharePoint/OneDrive
      const itemId = document.sharePointItemId || document.oneDriveId!;
      const downloadUrl = await sharePointService.getDownloadUrl(accessToken, itemId);

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // Cannot fetch file - mark as pending for retry when user accesses
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractionStatus: DocumentExtractionStatus.PENDING,
          extractionError: 'Awaiting access token to fetch file',
        },
      });

      return {
        success: true,
        documentId,
        status: DocumentExtractionStatus.PENDING,
      };
    }

    // Extract content
    const result = await extractContent(fileBuffer, document.fileType, document.fileName);

    if (!result.success) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractionStatus: DocumentExtractionStatus.FAILED,
          extractionError: result.error || 'Extraction failed',
        },
      });

      return {
        success: false,
        documentId,
        status: DocumentExtractionStatus.FAILED,
        error: result.error,
      };
    }

    // Store extracted content
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedContent: result.content,
        extractedContentUpdatedAt: new Date(),
        extractionStatus: DocumentExtractionStatus.COMPLETED,
        extractionError: null,
      },
    });

    logger.info('Content extraction completed', {
      documentId,
      contentLength: result.content.length,
      truncated: result.truncated,
    });

    return {
      success: true,
      documentId,
      status: DocumentExtractionStatus.COMPLETED,
      contentLength: result.content.length,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update document with failure
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractionStatus: DocumentExtractionStatus.FAILED,
        extractionError: errorMessage.substring(0, 500),
      },
    });

    logger.error('Content extraction failed', {
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

/**
 * Create and start the content extraction worker
 */
export function createContentExtractionWorker(): Worker<ContentExtractionJobData> {
  const worker = new Worker<ContentExtractionJobData>(QUEUE_NAME, processContentExtractionJob, {
    connection: redisConnection,
    concurrency: 2, // Process up to 2 jobs concurrently (extraction is CPU intensive)
    limiter: {
      max: 30, // Max 30 jobs per minute
      duration: 60000,
    },
  });

  // Event handlers
  worker.on('completed', (job, result: ContentExtractionJobResult) => {
    logger.info('Content extraction job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
      status: result.status,
      contentLength: result.contentLength,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Content extraction job failed', {
      jobId: job?.id,
      documentId: job?.data.documentId,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Content extraction worker error', { error: err.message });
  });

  logger.info('Content extraction worker started', {
    concurrency: 2,
    queue: QUEUE_NAME,
  });

  return worker;
}

/**
 * Graceful shutdown
 */
export async function shutdownContentExtractionWorker(worker: Worker): Promise<void> {
  logger.info('Shutting down content extraction worker...');
  await worker.close();
  await contentExtractionQueue.close();
  logger.info('Content extraction worker shut down');
}
