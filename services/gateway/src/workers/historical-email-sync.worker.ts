/**
 * Historical Email Sync Worker
 *
 * Background worker that processes historical email sync jobs.
 * When a client contact is added to a case, this worker fetches
 * all historical emails from/to that contact and links them to the case.
 *
 * Uses BullMQ for job queue management.
 * Uses app-only tokens (client credentials flow) for Graph API access,
 * allowing sync to work independently of user sessions.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import { getHistoricalEmailSyncService } from '../services/historical-email-sync.service';
import { GraphService } from '../services/graph.service';
import logger from '../utils/logger';

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'historical-email-sync';

// Job data interface
export interface HistoricalSyncJobData {
  jobId: string; // HistoricalEmailSyncJob.id in database
  caseId: string;
  contactEmail: string;
  userId: string;
  accessToken?: string; // Deprecated: kept for backward compatibility with queued jobs
}

// Create queue
export const historicalSyncQueue = new Queue<HistoricalSyncJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10 seconds initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 500, // Keep last 500 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Add a historical sync job to the queue
 */
export async function queueHistoricalSyncJob(
  data: Omit<HistoricalSyncJobData, 'jobId'>,
  existingJobId?: string
): Promise<Job<HistoricalSyncJobData>> {
  // Create or get the database job record
  let dbJob;

  if (existingJobId) {
    // Use existing job ID (e.g., when retrying)
    dbJob = await prisma.historicalEmailSyncJob.findUnique({
      where: { id: existingJobId },
    });

    if (!dbJob) {
      throw new Error(`Historical sync job not found: ${existingJobId}`);
    }
  } else {
    // Check for existing job for this case+contact
    const existing = await prisma.historicalEmailSyncJob.findUnique({
      where: {
        caseId_contactEmail: {
          caseId: data.caseId,
          contactEmail: data.contactEmail,
        },
      },
    });

    if (existing) {
      // If there's an existing job that's not completed/failed, skip
      if (existing.status === 'Pending' || existing.status === 'InProgress') {
        logger.debug('[HistoricalSyncWorker] Sync job already in progress, skipping', {
          caseId: data.caseId,
          contactEmail: data.contactEmail,
          existingJobId: existing.id,
        });

        // Return the existing job from queue if it exists
        const existingQueueJobs = await historicalSyncQueue.getJobs([
          'waiting',
          'active',
          'delayed',
        ]);
        const existingQueueJob = existingQueueJobs.find((j) => j.data.jobId === existing.id);
        if (existingQueueJob) {
          return existingQueueJob;
        }
      }

      // Reset existing job for retry
      dbJob = await prisma.historicalEmailSyncJob.update({
        where: { id: existing.id },
        data: {
          status: 'Pending',
          totalEmails: null,
          syncedEmails: 0,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        },
      });

      // Remove any existing BullMQ job with the same ID (might be in completed/failed state)
      const bullmqJobId = `historical-sync-${existing.id}`;
      const existingBullmqJob = await historicalSyncQueue.getJob(bullmqJobId);
      if (existingBullmqJob) {
        logger.debug('[HistoricalSyncWorker] Removing old job from queue before retry', {
          bullmqJobId,
          oldState: await existingBullmqJob.getState(),
        });
        await existingBullmqJob.remove();
      }
    } else {
      // Create new job record
      dbJob = await prisma.historicalEmailSyncJob.create({
        data: {
          caseId: data.caseId,
          contactEmail: data.contactEmail,
          contactRole: 'Client', // Default role
          status: 'Pending',
        },
      });
    }
  }

  // Add to BullMQ queue
  const jobData: HistoricalSyncJobData = {
    ...data,
    jobId: dbJob.id,
  };

  const job = await historicalSyncQueue.add(`sync-${data.caseId}-${data.contactEmail}`, jobData, {
    jobId: `historical-sync-${dbJob.id}`,
    priority: 2, // Lower priority than real-time operations
  });

  logger.info('[HistoricalSyncWorker] Job queued', {
    bullmqJobId: job.id,
    dbJobId: dbJob.id,
    caseId: data.caseId,
    contactEmail: data.contactEmail,
  });

  return job;
}

/**
 * Process historical sync jobs
 *
 * Uses app-only tokens (client credentials flow) to access Graph API,
 * eliminating dependency on user sessions for background sync.
 */
async function processHistoricalSyncJob(
  job: Job<HistoricalSyncJobData>
): Promise<{ success: boolean; details: any }> {
  const { jobId, caseId, contactEmail, userId } = job.data;

  logger.info('[HistoricalSyncWorker] Processing job', {
    bullmqJobId: job.id,
    dbJobId: jobId,
    caseId,
    contactEmail,
    attempt: job.attemptsMade + 1,
  });

  try {
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

    logger.debug('[HistoricalSyncWorker] Using app-only token for Graph API', {
      bullmqJobId: job.id,
      azureAdId: user.azureAdId,
    });

    const service = getHistoricalEmailSyncService();
    const result = await service.syncHistoricalEmails(
      jobId,
      caseId,
      contactEmail,
      user.azureAdId,
      userId,
      appClient,
      job // Pass the BullMQ job for progress updates
    );

    if (result.success) {
      logger.info('[HistoricalSyncWorker] Job completed successfully', {
        bullmqJobId: job.id,
        dbJobId: jobId,
        emailsLinked: result.emailsLinked,
        attachmentsSynced: result.attachmentsSynced,
      });

      return {
        success: true,
        details: {
          emailsLinked: result.emailsLinked,
          attachmentsSynced: result.attachmentsSynced,
        },
      };
    } else {
      throw new Error(result.error || 'Unknown error during historical sync');
    }
  } catch (error: any) {
    logger.error('[HistoricalSyncWorker] Job failed', {
      bullmqJobId: job.id,
      dbJobId: jobId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create and start the worker
 */
export function createHistoricalSyncWorker(): Worker<HistoricalSyncJobData> {
  const worker = new Worker<HistoricalSyncJobData>(QUEUE_NAME, processHistoricalSyncJob, {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 jobs concurrently
    lockDuration: 300000, // 5 minutes - allows long sync operations without stalling
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    limiter: {
      max: 50, // Max 50 jobs per minute (rate limiting for Graph API)
      duration: 60000,
    },
  });

  // Event handlers
  worker.on('completed', async (job, result) => {
    logger.info('[HistoricalSyncWorker] Job completed', {
      bullmqJobId: job.id,
      success: result.success,
      emailsLinked: result.details?.emailsLinked,
    });

    // Check if all sync jobs for this case are complete
    await checkAndUpdateCaseSyncStatus(job.data.caseId);
  });

  worker.on('failed', async (job, err) => {
    logger.error('[HistoricalSyncWorker] Job failed', {
      bullmqJobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });

    // Check if this was the last retry attempt
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await checkAndUpdateCaseSyncStatus(job.data.caseId);
    }
  });

  worker.on('error', (err) => {
    logger.error('[HistoricalSyncWorker] Worker error', { error: err.message });
  });

  logger.info('[HistoricalSyncWorker] Worker started', {
    concurrency: 3,
    queue: QUEUE_NAME,
    rateLimitPerMinute: 50,
  });

  return worker;
}

/**
 * Get sync status for a case
 */
export async function getHistoricalSyncStatus(caseId: string) {
  const jobs = await prisma.historicalEmailSyncJob.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });

  return jobs;
}

/**
 * Check if all sync jobs for a case are complete and update case status
 */
async function checkAndUpdateCaseSyncStatus(caseId: string): Promise<void> {
  try {
    // Get all historical sync jobs for this case
    const jobs = await prisma.historicalEmailSyncJob.findMany({
      where: { caseId },
      select: { status: true, errorMessage: true },
    });

    if (jobs.length === 0) {
      logger.debug('[HistoricalSyncWorker] No sync jobs found for case', { caseId });
      return;
    }

    // Check if any jobs are still in progress
    const pendingOrInProgress = jobs.filter(
      (job) => job.status === 'Pending' || job.status === 'InProgress'
    );

    if (pendingOrInProgress.length > 0) {
      logger.debug('[HistoricalSyncWorker] Some jobs still in progress', {
        caseId,
        pending: pendingOrInProgress.length,
        total: jobs.length,
      });
      return;
    }

    // All jobs are in terminal state - check for failures
    const failedJobs = jobs.filter((job) => job.status === 'Failed');

    // Import case sync service lazily to avoid circular dependency
    const { getCaseSyncService } = await import('../services/case-sync.service');
    const caseSyncService = getCaseSyncService();

    if (failedJobs.length > 0) {
      // At least one job failed
      const errorMessages = failedJobs
        .map((job) => job.errorMessage)
        .filter(Boolean)
        .join('; ');

      await caseSyncService.markSyncFailed(caseId, errorMessages || 'One or more sync jobs failed');

      logger.info('[HistoricalSyncWorker] Case sync marked as failed', {
        caseId,
        failedCount: failedJobs.length,
        totalCount: jobs.length,
      });
    } else {
      // All jobs completed successfully
      await caseSyncService.markSyncCompleted(caseId);

      logger.info('[HistoricalSyncWorker] Case sync marked as completed', {
        caseId,
        jobCount: jobs.length,
      });
    }
  } catch (error: any) {
    logger.error('[HistoricalSyncWorker] Error updating case sync status', {
      caseId,
      error: error.message,
    });
  }
}

// Graceful shutdown
export async function shutdownHistoricalSyncWorker(worker: Worker): Promise<void> {
  logger.info('[HistoricalSyncWorker] Shutting down...');
  await worker.close();
  await historicalSyncQueue.close();
  await redisConnection.quit();
  logger.info('[HistoricalSyncWorker] Shut down complete');
}

// ============================================================================
// Singleton worker management (for index.ts integration)
// ============================================================================

let workerInstance: Worker<HistoricalSyncJobData> | null = null;

/**
 * Start the historical sync worker (singleton)
 */
export function startHistoricalSyncWorker(): void {
  if (workerInstance) {
    logger.warn('[HistoricalSyncWorker] Worker already running');
    return;
  }
  workerInstance = createHistoricalSyncWorker();
}

/**
 * Stop the historical sync worker
 */
export async function stopHistoricalSyncWorker(): Promise<void> {
  if (workerInstance) {
    await shutdownHistoricalSyncWorker(workerInstance);
    workerInstance = null;
  }
}
