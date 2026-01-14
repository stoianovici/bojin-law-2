/**
 * Attachment Upload Worker
 *
 * Background worker that uploads email attachments to SharePoint.
 * Uses app-only tokens (client credentials flow) - NO user session required.
 *
 * This worker is used after historical email sync records attachment metadata.
 * It can run independently of user sessions using Microsoft Graph application permissions.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import { GraphService } from '../services/graph.service';
import { getEmailAttachmentService } from '../services/email-attachment.service';
import logger from '../utils/logger';

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'attachment-upload';

// Job data interface
export interface AttachmentUploadJobData {
  emailAttachmentId: string;
  emailId: string;
  graphAttachmentId: string;
  userId: string;
}

// Create queue
export const attachmentUploadQueue = new Queue<AttachmentUploadJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Standard retries - no longer waiting for user login
    backoff: {
      type: 'exponential',
      delay: 10000, // 10 seconds initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Queue an attachment upload job
 */
export async function queueAttachmentUpload(
  data: AttachmentUploadJobData
): Promise<Job<AttachmentUploadJobData>> {
  const job = await attachmentUploadQueue.add(`upload-${data.emailAttachmentId}`, data, {
    jobId: `attachment-upload-${data.emailAttachmentId}`,
    // Delay first attempt by 5 seconds to allow any immediate token refresh
    delay: 5000,
  });

  logger.debug('[AttachmentUploadWorker] Job queued', {
    jobId: job.id,
    emailAttachmentId: data.emailAttachmentId,
  });

  return job;
}

/**
 * Process attachment upload jobs using app-only tokens
 * No user session required - uses client credentials flow
 */
async function processAttachmentUpload(
  job: Job<AttachmentUploadJobData>
): Promise<{ success: boolean; storageUrl?: string; documentId?: string }> {
  const { emailAttachmentId, emailId, graphAttachmentId, userId } = job.data;

  logger.info('[AttachmentUploadWorker] Processing job', {
    jobId: job.id,
    emailAttachmentId,
    attempt: job.attemptsMade + 1,
  });

  // Check if attachment already has storage URL (already uploaded)
  const existingAttachment = await prisma.emailAttachment.findUnique({
    where: { id: emailAttachmentId },
    select: { storageUrl: true, documentId: true },
  });

  if (existingAttachment?.storageUrl) {
    logger.info('[AttachmentUploadWorker] Attachment already uploaded, skipping', {
      emailAttachmentId,
      storageUrl: existingAttachment.storageUrl,
    });
    return {
      success: true,
      storageUrl: existingAttachment.storageUrl,
      documentId: existingAttachment.documentId || undefined,
    };
  }

  // Get user's Azure AD ID for Graph API calls
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { azureAdId: true },
  });

  if (!user?.azureAdId) {
    throw new Error(`User Azure AD ID not found for userId: ${userId}`);
  }

  // Get app-only Graph client (no user session required)
  const graphService = new GraphService();
  const appClient = await graphService.getAppClient();

  logger.info('[AttachmentUploadWorker] Using app-only token for upload', {
    jobId: job.id,
    emailAttachmentId,
    azureAdId: user.azureAdId,
  });

  try {
    const attachmentService = getEmailAttachmentService(prisma);
    const result = await attachmentService.syncAllAttachmentsWithClient(
      emailId,
      appClient,
      user.azureAdId
    );

    // Find the specific attachment in the result
    const uploadedAttachment = result.attachments.find(
      (a) => a.graphAttachmentId === graphAttachmentId
    );

    if (uploadedAttachment?.storageUrl) {
      logger.info('[AttachmentUploadWorker] Attachment uploaded successfully', {
        jobId: job.id,
        emailAttachmentId,
        storageUrl: uploadedAttachment.storageUrl,
        documentId: uploadedAttachment.documentId,
      });
      return {
        success: true,
        storageUrl: uploadedAttachment.storageUrl,
        documentId: uploadedAttachment.documentId,
      };
    }

    // Attachment wasn't in the result - might have been filtered or already exists
    logger.info('[AttachmentUploadWorker] Attachment sync completed but attachment not in result', {
      jobId: job.id,
      emailAttachmentId,
      syncedCount: result.attachmentsSynced,
    });
    return { success: true };
  } catch (error: any) {
    logger.error('[AttachmentUploadWorker] Upload failed', {
      jobId: job.id,
      emailAttachmentId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create and start the worker
 */
export function createAttachmentUploadWorker(): Worker<AttachmentUploadJobData> {
  const worker = new Worker<AttachmentUploadJobData>(QUEUE_NAME, processAttachmentUpload, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 uploads concurrently
    lockDuration: 120000, // 2 minutes per upload
    stalledInterval: 30000,
    limiter: {
      max: 30, // Max 30 jobs per minute
      duration: 60000,
    },
  });

  worker.on('completed', (job, result) => {
    if (result.storageUrl) {
      logger.info('[AttachmentUploadWorker] Job completed with upload', {
        jobId: job.id,
        storageUrl: result.storageUrl,
      });
    }
  });

  worker.on('failed', (job, err) => {
    logger.error('[AttachmentUploadWorker] Job failed', {
      jobId: job?.id,
      error: err.message,
      attempt: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[AttachmentUploadWorker] Worker error', { error: err.message });
  });

  logger.info('[AttachmentUploadWorker] Worker started', {
    concurrency: 5,
    queue: QUEUE_NAME,
  });

  return worker;
}

// Graceful shutdown
export async function shutdownAttachmentUploadWorker(worker: Worker): Promise<void> {
  logger.info('[AttachmentUploadWorker] Shutting down...');
  await worker.close();
  await attachmentUploadQueue.close();
  logger.info('[AttachmentUploadWorker] Shut down complete');
}

// ============================================================================
// Singleton worker management
// ============================================================================

let workerInstance: Worker<AttachmentUploadJobData> | null = null;

/**
 * Start the attachment upload worker (singleton)
 */
export function startAttachmentUploadWorker(): void {
  if (workerInstance) {
    logger.warn('[AttachmentUploadWorker] Worker already running');
    return;
  }
  workerInstance = createAttachmentUploadWorker();
}

/**
 * Stop the attachment upload worker
 */
export async function stopAttachmentUploadWorker(): Promise<void> {
  if (workerInstance) {
    await shutdownAttachmentUploadWorker(workerInstance);
    workerInstance = null;
  }
}
