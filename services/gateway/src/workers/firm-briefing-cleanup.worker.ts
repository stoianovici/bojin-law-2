/**
 * Firm Briefing Cleanup Worker
 *
 * Background worker that cleans up old FirmBriefing and FirmBriefingRun records.
 * Runs daily to prevent unbounded table growth.
 *
 * Retention policy:
 * - FirmBriefing: Keep 30 days of briefings
 * - FirmBriefingRun: Keep 7 days of run logs
 *
 * Uses BullMQ for job queue management with repeatable job scheduling.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const QUEUE_NAME = 'firm-briefing-cleanup';

// Retention periods (aligned with plan: 90 days briefings, 30 days run logs)
const BRIEFING_RETENTION_DAYS = 90;
const RUN_LOGS_RETENTION_DAYS = 30;

// Threshold for Discord notification on large deletions
const LARGE_DELETION_THRESHOLD = 500;

// Run daily at 3:30 AM (before batch generation at 5 AM)
const CLEANUP_SCHEDULE = '30 3 * * *';

// ============================================================================
// Queue Setup
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Job data interface
export interface FirmBriefingCleanupJobData {
  timestamp: string;
  manual?: boolean;
}

// Create queue
export const firmBriefingCleanupQueue = new Queue<FirmBriefingCleanupJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10 seconds initial delay
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep completed jobs for 7 days
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // Keep failed jobs for 30 days
    },
  },
});

// ============================================================================
// Job Processing
// ============================================================================

interface CleanupResult {
  deletedBriefings: number;
  deletedRuns: number;
  duration: number;
  manual: boolean;
}

/**
 * Process firm briefing cleanup job
 */
async function processCleanupJob(job: Job<FirmBriefingCleanupJobData>): Promise<CleanupResult> {
  const startTime = Date.now();
  const { manual = false } = job.data;

  logger.info('[FirmBriefingCleanup] Starting cleanup job', {
    bullmqJobId: job.id,
    manual,
  });

  try {
    const now = new Date();

    // Calculate cutoff dates
    const briefingCutoff = new Date(now.getTime() - BRIEFING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const runsCutoff = new Date(now.getTime() - RUN_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Count records to be deleted
    const briefingsToDelete = await prisma.firmBriefing.count({
      where: { briefingDate: { lt: briefingCutoff } },
    });

    const runsToDelete = await prisma.firmBriefingRun.count({
      where: { startedAt: { lt: runsCutoff } },
    });

    const totalToDelete = briefingsToDelete + runsToDelete;

    if (totalToDelete === 0) {
      logger.info('[FirmBriefingCleanup] No records to clean', {
        bullmqJobId: job.id,
      });
      return {
        deletedBriefings: 0,
        deletedRuns: 0,
        duration: Date.now() - startTime,
        manual,
      };
    }

    // Log warning for large deletions
    if (totalToDelete > LARGE_DELETION_THRESHOLD) {
      logger.warn('[FirmBriefingCleanup] Large deletion detected', {
        bullmqJobId: job.id,
        briefings: briefingsToDelete,
        runs: runsToDelete,
        total: totalToDelete,
        threshold: LARGE_DELETION_THRESHOLD,
      });

      await sendDiscordNotification(
        `⚠️ Firm Briefing Cleanup: About to delete ${briefingsToDelete} briefings and ${runsToDelete} run logs`
      );
    }

    // Delete old briefings
    const briefingResult = await prisma.firmBriefing.deleteMany({
      where: { briefingDate: { lt: briefingCutoff } },
    });

    // Delete old run logs
    const runsResult = await prisma.firmBriefingRun.deleteMany({
      where: { startedAt: { lt: runsCutoff } },
    });

    const duration = Date.now() - startTime;

    logger.info('[FirmBriefingCleanup] Cleanup completed', {
      bullmqJobId: job.id,
      deletedBriefings: briefingResult.count,
      deletedRuns: runsResult.count,
      duration,
      manual,
    });

    // Send success notification for large cleanups
    if (totalToDelete > LARGE_DELETION_THRESHOLD) {
      await sendDiscordNotification(
        `✅ Firm Briefing Cleanup completed: ${briefingResult.count} briefings, ${runsResult.count} runs in ${duration}ms`
      );
    }

    return {
      deletedBriefings: briefingResult.count,
      deletedRuns: runsResult.count,
      duration,
      manual,
    };
  } catch (error: any) {
    logger.error('[FirmBriefingCleanup] Cleanup job failed', {
      bullmqJobId: job.id,
      error: error.message,
      stack: error.stack,
    });

    await sendDiscordNotification(`❌ Firm Briefing Cleanup FAILED: ${error.message}`);

    throw error;
  }
}

/**
 * Send Discord notification for cleanup events
 */
async function sendDiscordNotification(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.debug('[FirmBriefingCleanup] Discord webhook not configured, skipping notification');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Firm Briefing Cleanup Bot',
      }),
    });
  } catch (error) {
    logger.warn('[FirmBriefingCleanup] Failed to send Discord notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Worker Management
// ============================================================================

let workerInstance: Worker<FirmBriefingCleanupJobData> | null = null;
let isScheduled = false;

/**
 * Create and start the cleanup worker
 */
function createCleanupWorker(): Worker<FirmBriefingCleanupJobData> {
  const worker = new Worker<FirmBriefingCleanupJobData>(QUEUE_NAME, processCleanupJob, {
    connection: redisConnection,
    concurrency: 1, // Only one cleanup job at a time
  });

  worker.on('completed', (job, result) => {
    logger.info('[FirmBriefingCleanup] Job completed', {
      bullmqJobId: job.id,
      deletedBriefings: result.deletedBriefings,
      deletedRuns: result.deletedRuns,
      duration: result.duration,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('[FirmBriefingCleanup] Job failed', {
      bullmqJobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[FirmBriefingCleanup] Worker error', { error: err.message });
  });

  logger.info('[FirmBriefingCleanup] Worker started', {
    queue: QUEUE_NAME,
  });

  return worker;
}

/**
 * Schedule the daily cleanup job
 */
async function scheduleCleanupJob(): Promise<void> {
  if (isScheduled) {
    logger.warn('[FirmBriefingCleanup] Cleanup job already scheduled');
    return;
  }

  // Remove any existing repeatable jobs first
  const existingJobs = await firmBriefingCleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'daily-cleanup') {
      await firmBriefingCleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  // Add new repeatable job
  await firmBriefingCleanupQueue.add(
    'daily-cleanup',
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: CLEANUP_SCHEDULE,
      },
    }
  );

  isScheduled = true;
  logger.info('[FirmBriefingCleanup] Daily cleanup scheduled', {
    schedule: CLEANUP_SCHEDULE,
  });
}

/**
 * Start the firm briefing cleanup worker and schedule daily job
 */
export function startFirmBriefingCleanupWorker(): void {
  if (workerInstance) {
    logger.warn('[FirmBriefingCleanup] Worker already running');
    return;
  }

  workerInstance = createCleanupWorker();

  // Schedule the daily job
  scheduleCleanupJob().catch((error) => {
    logger.error('[FirmBriefingCleanup] Failed to schedule daily job', {
      error: error.message,
    });
  });
}

/**
 * Stop the firm briefing cleanup worker
 */
export async function stopFirmBriefingCleanupWorker(): Promise<void> {
  if (workerInstance) {
    logger.info('[FirmBriefingCleanup] Shutting down worker...');
    await workerInstance.close();
    workerInstance = null;
    isScheduled = false;
    logger.info('[FirmBriefingCleanup] Worker shut down complete');
  }
}

/**
 * Manually trigger a cleanup job (for testing/admin purposes)
 */
export async function triggerManualFirmBriefingCleanup(): Promise<Job<FirmBriefingCleanupJobData>> {
  const job = await firmBriefingCleanupQueue.add('manual-cleanup', {
    timestamp: new Date().toISOString(),
    manual: true,
  });

  logger.info('[FirmBriefingCleanup] Manual cleanup triggered', {
    bullmqJobId: job.id,
  });

  return job;
}

/**
 * Get cleanup statistics
 */
export async function getFirmBriefingCleanupStats(): Promise<{
  totalBriefings: number;
  briefingsOverRetention: number;
  totalRuns: number;
  runsOverRetention: number;
  scheduledJob: boolean;
}> {
  const now = new Date();
  const briefingCutoff = new Date(now.getTime() - BRIEFING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const runsCutoff = new Date(now.getTime() - RUN_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [totalBriefings, briefingsOverRetention, totalRuns, runsOverRetention] = await Promise.all([
    prisma.firmBriefing.count(),
    prisma.firmBriefing.count({ where: { briefingDate: { lt: briefingCutoff } } }),
    prisma.firmBriefingRun.count(),
    prisma.firmBriefingRun.count({ where: { startedAt: { lt: runsCutoff } } }),
  ]);

  return {
    totalBriefings,
    briefingsOverRetention,
    totalRuns,
    runsOverRetention,
    scheduledJob: isScheduled,
  };
}
