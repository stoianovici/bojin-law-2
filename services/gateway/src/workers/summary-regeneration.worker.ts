/**
 * Summary Regeneration Worker
 * OPS-047: Event-Driven Summary Invalidation
 *
 * Background worker that processes case summary regeneration jobs.
 * Uses BullMQ for job queue management with debouncing.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Queue Setup
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'summary-regeneration';

// Job data type
interface RegenerationJobData {
  caseId: string;
  triggeredBy: 'event' | 'hourly' | 'manual';
}

// Create queue
export const summaryRegenerationQueue = new Queue<RegenerationJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10 seconds initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 500,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

// ============================================================================
// Queue Functions
// ============================================================================

/**
 * Add a regeneration job to the queue with debouncing.
 * If a job is already queued for this case, skip to prevent duplicates.
 */
export async function queueSummaryRegeneration(
  caseId: string,
  triggeredBy: 'event' | 'hourly' | 'manual' = 'event'
): Promise<Job<RegenerationJobData> | null> {
  try {
    // Check for existing job (debouncing)
    const existingJobs = await summaryRegenerationQueue.getJobs(['waiting', 'delayed']);
    const duplicate = existingJobs.find((job) => job.data.caseId === caseId);

    if (duplicate) {
      logger.debug('Summary regeneration job already queued, skipping', {
        caseId,
        existingJobId: duplicate.id,
      });
      return duplicate;
    }

    // Add job with 5 second delay to batch rapid changes
    const job = await summaryRegenerationQueue.add(
      `regen-${caseId}`,
      { caseId, triggeredBy },
      {
        jobId: `regen-${caseId}`,
        delay: 5000, // Wait 5 seconds for batch changes
        priority: triggeredBy === 'manual' ? 1 : 2,
      }
    );

    logger.debug('Summary regeneration job queued', {
      jobId: job.id,
      caseId,
      triggeredBy,
    });

    return job;
  } catch (error: any) {
    logger.error('Failed to queue summary regeneration', {
      caseId,
      error: error.message,
    });
    return null;
  }
}

// ============================================================================
// Worker
// ============================================================================

/**
 * Process regeneration jobs
 */
async function processRegenerationJob(
  job: Job<RegenerationJobData>
): Promise<{ success: boolean; caseId: string }> {
  const { caseId, triggeredBy } = job.data;

  logger.info('Processing summary regeneration', {
    jobId: job.id,
    caseId,
    triggeredBy,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Get case with firmId
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, firmId: true, status: true },
    });

    if (!caseData) {
      logger.warn('Case not found for regeneration', { caseId });
      return { success: false, caseId };
    }

    // Skip closed cases
    if (caseData.status === 'Closed') {
      logger.debug('Skipping regeneration for closed case', { caseId });
      return { success: true, caseId };
    }

    // Import service dynamically to avoid circular dependencies
    const { caseSummaryService } = await import('../services/case-summary.service');

    // Generate the summary
    await caseSummaryService.generateSummary(caseId, caseData.firmId);

    logger.info('Summary regeneration completed', {
      jobId: job.id,
      caseId,
    });

    return { success: true, caseId };
  } catch (error: any) {
    logger.error('Summary regeneration failed', {
      jobId: job.id,
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
export function createSummaryRegenerationWorker(): Worker<RegenerationJobData> {
  const worker = new Worker<RegenerationJobData>(QUEUE_NAME, processRegenerationJob, {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 jobs concurrently
    limiter: {
      max: 30, // Max 30 jobs per minute (rate limiting for AI calls)
      duration: 60000,
    },
  });

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info('Regeneration job completed', {
      jobId: job.id,
      caseId: result.caseId,
      success: result.success,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Regeneration job failed', {
      jobId: job?.id,
      caseId: job?.data.caseId,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Summary regeneration worker error', { error: err.message });
  });

  logger.info('Summary regeneration worker started', {
    concurrency: 3,
    queue: QUEUE_NAME,
  });

  return worker;
}

// ============================================================================
// Hourly Stale Check
// ============================================================================

let hourlyCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start the hourly stale summary check
 */
export function startHourlyStaleCheck(): void {
  // Run immediately on startup
  runHourlyCheck();

  // Then run every hour
  hourlyCheckInterval = setInterval(runHourlyCheck, 60 * 60 * 1000);

  logger.info('Hourly stale check started');
}

/**
 * Stop the hourly stale check
 */
export function stopHourlyStaleCheck(): void {
  if (hourlyCheckInterval) {
    clearInterval(hourlyCheckInterval);
    hourlyCheckInterval = null;
    logger.info('Hourly stale check stopped');
  }
}

/**
 * Run the hourly check for stale summaries
 */
async function runHourlyCheck(): Promise<void> {
  try {
    const { caseSummaryService } = await import('../services/case-summary.service');

    // Get stale summaries
    const staleSummaries = await caseSummaryService.getStaleSummaries(50);

    logger.info('Hourly stale check running', {
      staleSummariesFound: staleSummaries.length,
    });

    // Queue regeneration for each
    for (const summary of staleSummaries) {
      await queueSummaryRegeneration(summary.caseId, 'hourly');
    }
  } catch (error: any) {
    logger.error('Hourly stale check failed', { error: error.message });
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

let worker: Worker<RegenerationJobData> | null = null;

/**
 * Start the summary regeneration worker
 */
export function startSummaryRegenerationWorker(): void {
  if (worker) {
    logger.warn('Summary regeneration worker already running');
    return;
  }

  worker = createSummaryRegenerationWorker();
  startHourlyStaleCheck();
}

/**
 * Stop the summary regeneration worker
 */
export async function stopSummaryRegenerationWorker(): Promise<void> {
  stopHourlyStaleCheck();

  if (worker) {
    logger.info('Shutting down summary regeneration worker...');
    await worker.close();
    worker = null;
  }

  await summaryRegenerationQueue.close();
  await redisConnection.quit();

  logger.info('Summary regeneration worker shut down');
}
