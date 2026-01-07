/**
 * Case Sync Worker
 *
 * Background worker that processes case sync jobs.
 * When a new case is created, this worker orchestrates the full sync pipeline:
 * Email sync -> attachment extraction -> document triage -> timeline building
 *
 * Uses BullMQ for job queue management.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { getCaseSyncService } from '../services/case-sync.service';
import logger from '../utils/logger';

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'case-sync';

// Job data interface
export interface CaseSyncJobData {
  caseId: string;
  accessToken: string;
  userId: string;
}

// Create queue
export const caseSyncQueue = new Queue<CaseSyncJobData>(QUEUE_NAME, {
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
 * Add a case sync job to the queue
 */
export async function queueCaseSyncJob(data: CaseSyncJobData): Promise<Job<CaseSyncJobData>> {
  const job = await caseSyncQueue.add(`sync-case-${data.caseId}`, data, {
    jobId: `case-sync-${data.caseId}`,
    priority: 1, // Higher priority than historical sync
  });

  logger.info('[CaseSyncWorker] Job queued', {
    bullmqJobId: job.id,
    caseId: data.caseId,
  });

  return job;
}

/**
 * Process case sync jobs
 */
async function processCaseSyncJob(
  job: Job<CaseSyncJobData>
): Promise<{ success: boolean; details: any }> {
  const { caseId, accessToken, userId } = job.data;

  logger.info('[CaseSyncWorker] Processing job', {
    bullmqJobId: job.id,
    caseId,
    attempt: job.attemptsMade + 1,
  });

  try {
    const service = getCaseSyncService();
    const result = await service.startCaseSync(caseId, accessToken, userId);

    if (result.success) {
      logger.info('[CaseSyncWorker] Job completed successfully', {
        bullmqJobId: job.id,
        caseId,
      });

      return {
        success: true,
        details: { caseId },
      };
    } else {
      throw new Error(result.error || 'Unknown error during case sync');
    }
  } catch (error: any) {
    logger.error('[CaseSyncWorker] Job failed', {
      bullmqJobId: job.id,
      caseId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create and start the worker
 */
export function createCaseSyncWorker(): Worker<CaseSyncJobData> {
  const worker = new Worker<CaseSyncJobData>(QUEUE_NAME, processCaseSyncJob, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
  });

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info('[CaseSyncWorker] Job completed', {
      bullmqJobId: job.id,
      success: result.success,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('[CaseSyncWorker] Job failed', {
      bullmqJobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[CaseSyncWorker] Worker error', { error: err.message });
  });

  logger.info('[CaseSyncWorker] Worker started', {
    concurrency: 5,
    queue: QUEUE_NAME,
  });

  return worker;
}

// Graceful shutdown
export async function shutdownCaseSyncWorker(worker: Worker): Promise<void> {
  logger.info('[CaseSyncWorker] Shutting down...');
  await worker.close();
  await caseSyncQueue.close();
  await redisConnection.quit();
  logger.info('[CaseSyncWorker] Shut down complete');
}

// ============================================================================
// Singleton worker management (for index.ts integration)
// ============================================================================

let workerInstance: Worker<CaseSyncJobData> | null = null;

/**
 * Start the case sync worker (singleton)
 */
export function startCaseSyncWorker(): void {
  if (workerInstance) {
    logger.warn('[CaseSyncWorker] Worker already running');
    return;
  }
  workerInstance = createCaseSyncWorker();
}

/**
 * Stop the case sync worker
 */
export async function stopCaseSyncWorker(): Promise<void> {
  if (workerInstance) {
    await shutdownCaseSyncWorker(workerInstance);
    workerInstance = null;
  }
}
