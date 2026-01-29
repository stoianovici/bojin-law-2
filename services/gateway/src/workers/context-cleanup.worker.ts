/**
 * Context Cleanup Worker
 *
 * Background worker that cleans up expired ContextFile records.
 * Runs daily to prevent unbounded table growth.
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

const QUEUE_NAME = 'context-cleanup';

// Grace period before deleting expired records (7 days)
// This handles clock skew and allows recovery if needed
const STALENESS_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Threshold for Discord notification on large deletions
const LARGE_DELETION_THRESHOLD = 1000;

// Run daily at 4 AM
const CLEANUP_SCHEDULE = '0 4 * * *';

// ============================================================================
// Queue Setup
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Job data interface
export interface ContextCleanupJobData {
  timestamp: string;
  manual?: boolean;
}

// Create queue
export const contextCleanupQueue = new Queue<ContextCleanupJobData>(QUEUE_NAME, {
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
  deletedContextFiles: number;
  deletedReferences: number;
  duration: number;
  manual: boolean;
}

/**
 * Process context cleanup job
 */
async function processCleanupJob(job: Job<ContextCleanupJobData>): Promise<CleanupResult> {
  const startTime = Date.now();
  const { manual = false } = job.data;

  logger.info('[ContextCleanup] Starting cleanup job', {
    bullmqJobId: job.id,
    manual,
  });

  try {
    const now = new Date();
    const graceDate = new Date(now.getTime() - STALENESS_GRACE_PERIOD_MS);

    // Find expired context files that are also past the grace period
    // This ensures we don't delete recently expired files that might still be regenerating
    const expiredFiles = await prisma.contextFile.findMany({
      where: {
        validUntil: { lt: now },
        generatedAt: { lt: graceDate },
      },
      select: { id: true },
    });

    const expiredCount = expiredFiles.length;

    if (expiredCount === 0) {
      logger.info('[ContextCleanup] No expired records to clean', {
        bullmqJobId: job.id,
      });
      return {
        deletedContextFiles: 0,
        deletedReferences: 0,
        duration: Date.now() - startTime,
        manual,
      };
    }

    // Log warning for large deletions
    if (expiredCount > LARGE_DELETION_THRESHOLD) {
      logger.warn('[ContextCleanup] Large deletion detected', {
        bullmqJobId: job.id,
        count: expiredCount,
        threshold: LARGE_DELETION_THRESHOLD,
      });

      // Send Discord notification for large deletions
      await sendDiscordNotification(
        `⚠️ Context Cleanup: About to delete ${expiredCount} expired records (threshold: ${LARGE_DELETION_THRESHOLD})`
      );
    }

    // Delete expired context files
    // ContextReferences will cascade-delete automatically due to onDelete: Cascade
    const deleteResult = await prisma.contextFile.deleteMany({
      where: {
        id: { in: expiredFiles.map((f) => f.id) },
      },
    });

    const duration = Date.now() - startTime;

    logger.info('[ContextCleanup] Cleanup completed', {
      bullmqJobId: job.id,
      deletedContextFiles: deleteResult.count,
      duration,
      manual,
    });

    // Send success notification for large cleanups
    if (expiredCount > LARGE_DELETION_THRESHOLD) {
      await sendDiscordNotification(
        `✅ Context Cleanup completed: Deleted ${deleteResult.count} expired records in ${duration}ms`
      );
    }

    return {
      deletedContextFiles: deleteResult.count,
      deletedReferences: 0, // Cascade-deleted, count not available
      duration,
      manual,
    };
  } catch (error: any) {
    logger.error('[ContextCleanup] Cleanup job failed', {
      bullmqJobId: job.id,
      error: error.message,
      stack: error.stack,
    });

    // Send failure notification
    await sendDiscordNotification(`❌ Context Cleanup FAILED: ${error.message}`);

    throw error;
  }
}

/**
 * Send Discord notification for cleanup events
 */
async function sendDiscordNotification(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.debug('[ContextCleanup] Discord webhook not configured, skipping notification');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Context Cleanup Bot',
      }),
    });
  } catch (error) {
    logger.warn('[ContextCleanup] Failed to send Discord notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Worker Management
// ============================================================================

let workerInstance: Worker<ContextCleanupJobData> | null = null;
let isScheduled = false;

/**
 * Create and start the cleanup worker
 */
function createCleanupWorker(): Worker<ContextCleanupJobData> {
  const worker = new Worker<ContextCleanupJobData>(QUEUE_NAME, processCleanupJob, {
    connection: redisConnection,
    concurrency: 1, // Only one cleanup job at a time
  });

  worker.on('completed', (job, result) => {
    logger.info('[ContextCleanup] Job completed', {
      bullmqJobId: job.id,
      deletedContextFiles: result.deletedContextFiles,
      duration: result.duration,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('[ContextCleanup] Job failed', {
      bullmqJobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[ContextCleanup] Worker error', { error: err.message });
  });

  logger.info('[ContextCleanup] Worker started', {
    queue: QUEUE_NAME,
  });

  return worker;
}

/**
 * Schedule the daily cleanup job
 */
async function scheduleCleanupJob(): Promise<void> {
  if (isScheduled) {
    logger.warn('[ContextCleanup] Cleanup job already scheduled');
    return;
  }

  // Remove any existing repeatable jobs first
  const existingJobs = await contextCleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'daily-cleanup') {
      await contextCleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  // Add new repeatable job
  await contextCleanupQueue.add(
    'daily-cleanup',
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: CLEANUP_SCHEDULE,
      },
    }
  );

  isScheduled = true;
  logger.info('[ContextCleanup] Daily cleanup scheduled', {
    schedule: CLEANUP_SCHEDULE,
  });
}

/**
 * Start the context cleanup worker and schedule daily job
 */
export function startContextCleanupWorker(): void {
  if (workerInstance) {
    logger.warn('[ContextCleanup] Worker already running');
    return;
  }

  workerInstance = createCleanupWorker();

  // Schedule the daily job
  scheduleCleanupJob().catch((error) => {
    logger.error('[ContextCleanup] Failed to schedule daily job', {
      error: error.message,
    });
  });
}

/**
 * Stop the context cleanup worker
 */
export async function stopContextCleanupWorker(): Promise<void> {
  if (workerInstance) {
    logger.info('[ContextCleanup] Shutting down worker...');
    await workerInstance.close();
    workerInstance = null;
    isScheduled = false;
    logger.info('[ContextCleanup] Worker shut down complete');
  }
}

/**
 * Manually trigger a cleanup job (for testing/admin purposes)
 */
export async function triggerManualCleanup(): Promise<Job<ContextCleanupJobData>> {
  const job = await contextCleanupQueue.add('manual-cleanup', {
    timestamp: new Date().toISOString(),
    manual: true,
  });

  logger.info('[ContextCleanup] Manual cleanup triggered', {
    bullmqJobId: job.id,
  });

  return job;
}

/**
 * Get cleanup statistics
 */
export async function getCleanupStats(): Promise<{
  totalExpired: number;
  oldestExpired: Date | null;
  scheduledJob: boolean;
}> {
  const now = new Date();

  const expiredCount = await prisma.contextFile.count({
    where: { validUntil: { lt: now } },
  });

  const oldestExpired = await prisma.contextFile.findFirst({
    where: { validUntil: { lt: now } },
    orderBy: { validUntil: 'asc' },
    select: { validUntil: true },
  });

  return {
    totalExpired: expiredCount,
    oldestExpired: oldestExpired?.validUntil ?? null,
    scheduledJob: isScheduled,
  };
}
