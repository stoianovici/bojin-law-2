/**
 * Comprehension Maintenance Worker
 *
 * Background worker that performs scheduled maintenance on case comprehension:
 * 1. Regenerate stale comprehensions (daily 3 AM)
 * 2. Regenerate expired comprehensions (daily 4 AM)
 * 3. Clean up old thinking content to save storage (weekly Sunday 5 AM)
 *
 * Uses BullMQ for job queue management with repeatable job scheduling.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import { comprehensionTriggerService } from '../services/comprehension-trigger.service';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const QUEUE_NAME = 'comprehension-maintenance';

// Job names
const JOB_REGENERATE_STALE = 'regenerate-stale';
const JOB_REGENERATE_EXPIRED = 'regenerate-expired';
const JOB_CLEANUP_THINKING = 'cleanup-thinking';

// Schedules (cron patterns)
const SCHEDULE_REGENERATE_STALE = '0 3 * * *'; // Daily at 3 AM
const SCHEDULE_REGENERATE_EXPIRED = '0 4 * * *'; // Daily at 4 AM
const SCHEDULE_CLEANUP_THINKING = '0 5 * * 0'; // Weekly Sunday at 5 AM

// Batch limits
const STALE_BATCH_LIMIT = 50;
const EXPIRED_BATCH_LIMIT = 50;

// Thinking content retention period (30 days)
const THINKING_RETENTION_DAYS = 30;

// ============================================================================
// Queue Setup
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Job data interface
export interface ComprehensionMaintenanceJobData {
  timestamp: string;
  manual?: boolean;
}

// Create queue
export const comprehensionMaintenanceQueue = new Queue<ComprehensionMaintenanceJobData>(
  QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30000, // 30 seconds initial delay (AI calls are expensive)
      },
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep completed jobs for 7 days
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // Keep failed jobs for 30 days
      },
    },
  }
);

// ============================================================================
// Discord Notifications
// ============================================================================

/**
 * Send Discord notification for maintenance events
 */
async function sendDiscordNotification(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.debug(
      '[ComprehensionMaintenance] Discord webhook not configured, skipping notification'
    );
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Comprehension Bot',
      }),
    });
  } catch (error) {
    logger.warn('[ComprehensionMaintenance] Failed to send Discord notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Job Processing: Regenerate Stale
// ============================================================================

interface RegenerationResult {
  processed: number;
  succeeded: number;
  failed: number;
  duration: number;
  manual: boolean;
}

/**
 * Process stale comprehension regeneration job
 */
async function processRegenerateStaleJob(
  job: Job<ComprehensionMaintenanceJobData>
): Promise<RegenerationResult> {
  const startTime = Date.now();
  const { manual = false } = job.data;

  logger.info('[ComprehensionMaintenance] Starting stale regeneration', {
    bullmqJobId: job.id,
    manual,
    limit: STALE_BATCH_LIMIT,
  });

  try {
    const result = await comprehensionTriggerService.regenerateStale({
      limit: STALE_BATCH_LIMIT,
    });

    const duration = Date.now() - startTime;

    logger.info('[ComprehensionMaintenance] Stale regeneration completed', {
      bullmqJobId: job.id,
      ...result,
      duration,
      manual,
    });

    // Send Discord notification with results
    if (result.processed > 0) {
      const status = result.failed === 0 ? '✅' : '⚠️';
      await sendDiscordNotification(
        `${status} Stale Comprehension Regeneration:\n` +
          `• Processed: ${result.processed}\n` +
          `• Succeeded: ${result.succeeded}\n` +
          `• Failed: ${result.failed}\n` +
          `• Duration: ${(duration / 1000).toFixed(1)}s`
      );
    }

    return {
      ...result,
      duration,
      manual,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[ComprehensionMaintenance] Stale regeneration failed', {
      bullmqJobId: job.id,
      error: error.message,
      stack: error.stack,
    });

    // Send failure notification
    await sendDiscordNotification(`❌ Stale Comprehension Regeneration FAILED:\n${error.message}`);

    throw error;
  }
}

// ============================================================================
// Job Processing: Regenerate Expired
// ============================================================================

/**
 * Process expired comprehension regeneration job
 */
async function processRegenerateExpiredJob(
  job: Job<ComprehensionMaintenanceJobData>
): Promise<RegenerationResult> {
  const startTime = Date.now();
  const { manual = false } = job.data;

  logger.info('[ComprehensionMaintenance] Starting expired regeneration', {
    bullmqJobId: job.id,
    manual,
    limit: EXPIRED_BATCH_LIMIT,
  });

  try {
    const result = await comprehensionTriggerService.regenerateExpired({
      limit: EXPIRED_BATCH_LIMIT,
    });

    const duration = Date.now() - startTime;

    logger.info('[ComprehensionMaintenance] Expired regeneration completed', {
      bullmqJobId: job.id,
      ...result,
      duration,
      manual,
    });

    // Send Discord notification with results
    if (result.processed > 0) {
      const status = result.failed === 0 ? '✅' : '⚠️';
      await sendDiscordNotification(
        `${status} Expired Comprehension Regeneration:\n` +
          `• Processed: ${result.processed}\n` +
          `• Succeeded: ${result.succeeded}\n` +
          `• Failed: ${result.failed}\n` +
          `• Duration: ${(duration / 1000).toFixed(1)}s`
      );
    }

    return {
      ...result,
      duration,
      manual,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[ComprehensionMaintenance] Expired regeneration failed', {
      bullmqJobId: job.id,
      error: error.message,
      stack: error.stack,
    });

    // Send failure notification
    await sendDiscordNotification(
      `❌ Expired Comprehension Regeneration FAILED:\n${error.message}`
    );

    throw error;
  }
}

// ============================================================================
// Job Processing: Cleanup Thinking Content
// ============================================================================

interface ThinkingCleanupResult {
  clearedCount: number;
  duration: number;
  manual: boolean;
}

/**
 * Process thinking content cleanup job
 * Nulls out thinkingContent older than THINKING_RETENTION_DAYS to save storage
 */
async function processCleanupThinkingJob(
  job: Job<ComprehensionMaintenanceJobData>
): Promise<ThinkingCleanupResult> {
  const startTime = Date.now();
  const { manual = false } = job.data;

  logger.info('[ComprehensionMaintenance] Starting thinking content cleanup', {
    bullmqJobId: job.id,
    manual,
    retentionDays: THINKING_RETENTION_DAYS,
  });

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - THINKING_RETENTION_DAYS);

    // Null out thinkingContent older than retention period
    const result = await prisma.comprehensionAgentRun.updateMany({
      where: {
        thinkingContent: { not: null },
        createdAt: { lt: cutoffDate },
      },
      data: { thinkingContent: null },
    });

    const duration = Date.now() - startTime;

    logger.info('[ComprehensionMaintenance] Thinking content cleanup completed', {
      bullmqJobId: job.id,
      clearedCount: result.count,
      duration,
      manual,
    });

    // Send Discord notification if significant cleanup occurred
    if (result.count > 0) {
      await sendDiscordNotification(
        `🧹 Thinking Content Cleanup:\n` +
          `• Cleared: ${result.count} records\n` +
          `• Retention: ${THINKING_RETENTION_DAYS} days\n` +
          `• Duration: ${(duration / 1000).toFixed(1)}s`
      );
    }

    return {
      clearedCount: result.count,
      duration,
      manual,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[ComprehensionMaintenance] Thinking content cleanup failed', {
      bullmqJobId: job.id,
      error: error.message,
      stack: error.stack,
    });

    // Send failure notification
    await sendDiscordNotification(`❌ Thinking Content Cleanup FAILED:\n${error.message}`);

    throw error;
  }
}

// ============================================================================
// Job Router
// ============================================================================

/**
 * Route jobs to appropriate processor based on job name
 */
async function processJob(
  job: Job<ComprehensionMaintenanceJobData>
): Promise<RegenerationResult | ThinkingCleanupResult> {
  switch (job.name) {
    case JOB_REGENERATE_STALE:
      return processRegenerateStaleJob(job);
    case JOB_REGENERATE_EXPIRED:
      return processRegenerateExpiredJob(job);
    case JOB_CLEANUP_THINKING:
      return processCleanupThinkingJob(job);
    default:
      throw new Error(`Unknown job name: ${job.name}`);
  }
}

// ============================================================================
// Worker Management
// ============================================================================

let workerInstance: Worker<ComprehensionMaintenanceJobData> | null = null;
let isScheduled = false;

/**
 * Create and start the maintenance worker
 */
function createMaintenanceWorker(): Worker<ComprehensionMaintenanceJobData> {
  const worker = new Worker<ComprehensionMaintenanceJobData>(QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: 1, // Only one job at a time (AI calls are expensive)
  });

  worker.on('completed', (job, result) => {
    logger.info('[ComprehensionMaintenance] Job completed', {
      bullmqJobId: job.id,
      jobName: job.name,
      result,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('[ComprehensionMaintenance] Job failed', {
      bullmqJobId: job?.id,
      jobName: job?.name,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[ComprehensionMaintenance] Worker error', { error: err.message });
  });

  logger.info('[ComprehensionMaintenance] Worker started', {
    queue: QUEUE_NAME,
  });

  return worker;
}

/**
 * Schedule all maintenance jobs
 */
async function scheduleMaintenanceJobs(): Promise<void> {
  if (isScheduled) {
    logger.warn('[ComprehensionMaintenance] Jobs already scheduled');
    return;
  }

  // Remove any existing repeatable jobs first
  const existingJobs = await comprehensionMaintenanceQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await comprehensionMaintenanceQueue.removeRepeatableByKey(job.key);
  }

  // Schedule regenerate stale job
  await comprehensionMaintenanceQueue.add(
    JOB_REGENERATE_STALE,
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: SCHEDULE_REGENERATE_STALE,
      },
    }
  );

  // Schedule regenerate expired job
  await comprehensionMaintenanceQueue.add(
    JOB_REGENERATE_EXPIRED,
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: SCHEDULE_REGENERATE_EXPIRED,
      },
    }
  );

  // Schedule cleanup thinking job
  await comprehensionMaintenanceQueue.add(
    JOB_CLEANUP_THINKING,
    { timestamp: new Date().toISOString() },
    {
      repeat: {
        pattern: SCHEDULE_CLEANUP_THINKING,
      },
    }
  );

  isScheduled = true;
  logger.info('[ComprehensionMaintenance] All jobs scheduled', {
    stale: SCHEDULE_REGENERATE_STALE,
    expired: SCHEDULE_REGENERATE_EXPIRED,
    thinking: SCHEDULE_CLEANUP_THINKING,
  });
}

/**
 * Start the comprehension maintenance worker and schedule all jobs
 */
export function startComprehensionMaintenanceWorker(): void {
  if (workerInstance) {
    logger.warn('[ComprehensionMaintenance] Worker already running');
    return;
  }

  workerInstance = createMaintenanceWorker();

  // Schedule the jobs
  scheduleMaintenanceJobs().catch((error) => {
    logger.error('[ComprehensionMaintenance] Failed to schedule jobs', {
      error: error.message,
    });
  });
}

/**
 * Stop the comprehension maintenance worker
 */
export async function stopComprehensionMaintenanceWorker(): Promise<void> {
  if (workerInstance) {
    logger.info('[ComprehensionMaintenance] Shutting down worker...');
    await workerInstance.close();
    workerInstance = null;
    isScheduled = false;
    logger.info('[ComprehensionMaintenance] Worker shut down complete');
  }
}

/**
 * Manually trigger a stale regeneration job (for testing/admin purposes)
 */
export async function triggerManualStaleRegeneration(): Promise<
  Job<ComprehensionMaintenanceJobData>
> {
  const job = await comprehensionMaintenanceQueue.add(JOB_REGENERATE_STALE, {
    timestamp: new Date().toISOString(),
    manual: true,
  });

  logger.info('[ComprehensionMaintenance] Manual stale regeneration triggered', {
    bullmqJobId: job.id,
  });

  return job;
}

/**
 * Manually trigger an expired regeneration job (for testing/admin purposes)
 */
export async function triggerManualExpiredRegeneration(): Promise<
  Job<ComprehensionMaintenanceJobData>
> {
  const job = await comprehensionMaintenanceQueue.add(JOB_REGENERATE_EXPIRED, {
    timestamp: new Date().toISOString(),
    manual: true,
  });

  logger.info('[ComprehensionMaintenance] Manual expired regeneration triggered', {
    bullmqJobId: job.id,
  });

  return job;
}

/**
 * Manually trigger thinking content cleanup (for testing/admin purposes)
 */
export async function triggerManualThinkingCleanup(): Promise<
  Job<ComprehensionMaintenanceJobData>
> {
  const job = await comprehensionMaintenanceQueue.add(JOB_CLEANUP_THINKING, {
    timestamp: new Date().toISOString(),
    manual: true,
  });

  logger.info('[ComprehensionMaintenance] Manual thinking cleanup triggered', {
    bullmqJobId: job.id,
  });

  return job;
}

/**
 * Get maintenance statistics
 */
export async function getMaintenanceStats(): Promise<{
  staleCount: number;
  expiredCount: number;
  thinkingContentCount: number;
  oldestStale: Date | null;
  scheduledJobs: boolean;
}> {
  const now = new Date();

  const [staleCount, expiredCount, thinkingContentCount, oldestStale] = await Promise.all([
    prisma.caseComprehension.count({
      where: { isStale: true },
    }),
    prisma.caseComprehension.count({
      where: {
        validUntil: { lt: now },
        isStale: false,
      },
    }),
    prisma.comprehensionAgentRun.count({
      where: { thinkingContent: { not: null } },
    }),
    prisma.caseComprehension.findFirst({
      where: { isStale: true },
      orderBy: { staleSince: 'asc' },
      select: { staleSince: true },
    }),
  ]);

  return {
    staleCount,
    expiredCount,
    thinkingContentCount,
    oldestStale: oldestStale?.staleSince ?? null,
    scheduledJobs: isScheduled,
  };
}
