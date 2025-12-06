/**
 * Document Sync Worker
 * Story 3.4: Word Integration with Live AI Assistance - Task 20
 *
 * Background worker that processes document synchronization jobs from OneDrive.
 * Uses BullMQ for job queue management.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import { oneDriveSyncService } from '../services/onedrive-sync.service';
import { trackChangesService } from '../services/track-changes.service';
import { documentCommentsService } from '../services/document-comments.service';
import logger from '../utils/logger';

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'document-sync';

// Job types
interface SyncJobData {
  documentId: string;
  accessToken: string;
  userId: string;
  syncType: 'full' | 'changes_only' | 'comments_only';
  triggeredBy: 'webhook' | 'manual' | 'scheduled';
}

// Create queue
export const documentSyncQueue = new Queue<SyncJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Add a sync job to the queue
 */
export async function queueSyncJob(data: SyncJobData): Promise<Job<SyncJobData>> {
  // Deduplicate: Check if same job already in queue
  const existingJobs = await documentSyncQueue.getJobs(['waiting', 'active', 'delayed']);
  const duplicate = existingJobs.find(
    (job) => job.data.documentId === data.documentId && job.data.syncType === data.syncType
  );

  if (duplicate) {
    logger.debug('Sync job already queued, skipping duplicate', {
      documentId: data.documentId,
      existingJobId: duplicate.id,
    });
    return duplicate;
  }

  const job = await documentSyncQueue.add(`sync-${data.documentId}`, data, {
    jobId: `sync-${data.documentId}-${Date.now()}`,
    priority: data.triggeredBy === 'webhook' ? 1 : 2, // Webhook-triggered jobs have higher priority
  });

  logger.info('Document sync job queued', {
    jobId: job.id,
    documentId: data.documentId,
    syncType: data.syncType,
    triggeredBy: data.triggeredBy,
  });

  return job;
}

/**
 * Process sync jobs
 */
async function processSyncJob(job: Job<SyncJobData>): Promise<{ success: boolean; details: any }> {
  const { documentId, accessToken, userId, syncType, triggeredBy } = job.data;

  logger.info('Processing document sync job', {
    jobId: job.id,
    documentId,
    syncType,
    triggeredBy,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, oneDriveId: true, firmId: true },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.oneDriveId) {
      logger.warn('Document not connected to OneDrive', { documentId });
      return { success: false, details: { reason: 'not_connected' } };
    }

    const results: any = {
      documentId,
      syncType,
      startedAt: new Date().toISOString(),
    };

    // Perform sync based on type
    if (syncType === 'full' || syncType === 'changes_only') {
      // Sync document content
      const syncResult = await oneDriveSyncService.syncDocumentChanges(documentId, accessToken);
      results.documentSync = syncResult;

      // Extract track changes
      const trackChanges = await trackChangesService.extractTrackChanges(
        documentId,
        accessToken,
        document.oneDriveId
      );
      results.trackChangesCount = trackChanges.length;

      if (trackChanges.length > 0) {
        results.trackChangesSummary = trackChangesService.formatChangesSummary(trackChanges);
      }
    }

    if (syncType === 'full' || syncType === 'comments_only') {
      // Sync comments
      const commentsCount = await documentCommentsService.syncCommentsFromWord(
        documentId,
        accessToken,
        document.oneDriveId
      );
      results.commentsCount = commentsCount;
    }

    results.completedAt = new Date().toISOString();

    logger.info('Document sync completed', {
      jobId: job.id,
      documentId,
      results,
    });

    return { success: true, details: results };
  } catch (error: any) {
    logger.error('Document sync failed', {
      jobId: job.id,
      documentId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create and start the worker
 */
export function createDocumentSyncWorker(): Worker<SyncJobData> {
  const worker = new Worker<SyncJobData>(QUEUE_NAME, processSyncJob, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 100, // Max 100 jobs per minute (rate limiting)
      duration: 60000,
    },
  });

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info('Sync job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
      success: result.success,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Sync job failed', {
      jobId: job?.id,
      documentId: job?.data.documentId,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { error: err.message });
  });

  logger.info('Document sync worker started', {
    concurrency: 5,
    queue: QUEUE_NAME,
  });

  return worker;
}

/**
 * Schedule periodic sync for all active documents
 */
export async function schedulePeriodicSync(): Promise<void> {
  // Get all documents with OneDrive connections that were recently active
  const activeDocuments = await prisma.document.findMany({
    where: {
      oneDriveId: { not: null },
      updatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Active in last 7 days
      },
    },
    select: { id: true, firmId: true },
    take: 100, // Limit batch size
  });

  logger.info('Scheduling periodic sync', {
    documentCount: activeDocuments.length,
  });

  for (const doc of activeDocuments) {
    // Note: In production, you would retrieve a valid access token
    // This is a placeholder - actual implementation would use stored refresh tokens
    await queueSyncJob({
      documentId: doc.id,
      accessToken: '', // Would need to be retrieved from token store
      userId: 'system',
      syncType: 'changes_only',
      triggeredBy: 'scheduled',
    });
  }
}

// Graceful shutdown
export async function shutdownWorker(worker: Worker): Promise<void> {
  logger.info('Shutting down document sync worker...');
  await worker.close();
  await documentSyncQueue.close();
  await redisConnection.quit();
  logger.info('Document sync worker shut down');
}
