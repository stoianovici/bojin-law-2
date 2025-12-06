/**
 * Lock Cleanup Worker
 * Story 3.4: Word Integration with Live AI Assistance - Task 21
 *
 * Background worker that cleans up expired document locks.
 * Runs periodically to release stale locks that weren't properly released.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'lock-cleanup';

// Job types
interface CleanupJobData {
  type: 'expired' | 'orphaned' | 'all';
  batchSize?: number;
}

interface CleanupResult {
  releasedCount: number;
  locksProcessed: string[];
  errors: string[];
}

// Create queue
export const lockCleanupQueue = new Queue<CleanupJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

/**
 * Schedule a cleanup job
 */
export async function scheduleCleanup(data: CleanupJobData): Promise<Job<CleanupJobData>> {
  const job = await lockCleanupQueue.add('cleanup', data, {
    jobId: `cleanup-${data.type}-${Date.now()}`,
  });

  logger.info('Lock cleanup job scheduled', {
    jobId: job.id,
    type: data.type,
  });

  return job;
}

/**
 * Process cleanup jobs
 */
async function processCleanupJob(job: Job<CleanupJobData>): Promise<CleanupResult> {
  const { type, batchSize = 100 } = job.data;

  logger.info('Processing lock cleanup job', {
    jobId: job.id,
    type,
    batchSize,
  });

  const result: CleanupResult = {
    releasedCount: 0,
    locksProcessed: [],
    errors: [],
  };

  try {
    if (type === 'expired' || type === 'all') {
      // Find and release expired locks
      const expiredLocks = await prisma.documentLock.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
        take: batchSize,
        select: {
          id: true,
          documentId: true,
          userId: true,
          expiresAt: true,
          sessionType: true,
        },
      });

      for (const lock of expiredLocks) {
        try {
          await releaseLock(lock.id, lock.documentId);
          result.locksProcessed.push(lock.id);
          result.releasedCount++;

          logger.info('Released expired lock', {
            lockId: lock.id,
            documentId: lock.documentId,
            userId: lock.userId,
            expiredAt: lock.expiresAt.toISOString(),
          });
        } catch (error: any) {
          result.errors.push(`Lock ${lock.id}: ${error.message}`);
          logger.error('Failed to release expired lock', {
            lockId: lock.id,
            error: error.message,
          });
        }
      }
    }

    if (type === 'orphaned' || type === 'all') {
      // Find orphaned locks by checking if document/user exists
      // First get all locks
      const allLocks = await prisma.documentLock.findMany({
        take: batchSize,
        select: {
          id: true,
          documentId: true,
          userId: true,
        },
      });

      // Then filter for orphaned locks (document or user doesn't exist)
      const orphanedLocks: typeof allLocks = [];
      for (const lock of allLocks) {
        const [document, user] = await Promise.all([
          prisma.document.findUnique({ where: { id: lock.documentId }, select: { id: true } }),
          prisma.user.findUnique({ where: { id: lock.userId }, select: { id: true } }),
        ]);
        if (!document || !user) {
          orphanedLocks.push(lock);
        }
      }

      for (const lock of orphanedLocks) {
        try {
          await prisma.documentLock.delete({
            where: { id: lock.id },
          });
          result.locksProcessed.push(lock.id);
          result.releasedCount++;

          logger.info('Deleted orphaned lock', {
            lockId: lock.id,
            documentId: lock.documentId,
            userId: lock.userId,
          });
        } catch (error: any) {
          result.errors.push(`Orphaned lock ${lock.id}: ${error.message}`);
          logger.error('Failed to delete orphaned lock', {
            lockId: lock.id,
            error: error.message,
          });
        }
      }
    }

    logger.info('Lock cleanup completed', {
      jobId: job.id,
      releasedCount: result.releasedCount,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error: any) {
    logger.error('Lock cleanup job failed', {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Release a lock and update document status
 */
async function releaseLock(lockId: string, documentId: string): Promise<void> {
  // Use a transaction to ensure consistency
  await prisma.$transaction(async (tx) => {
    // Delete the lock
    await tx.documentLock.delete({
      where: { id: lockId },
    });

    // Log the release event (could be stored in audit log)
    logger.debug('Lock released by cleanup worker', {
      lockId,
      documentId,
    });
  });
}

/**
 * Create and start the lock cleanup worker
 */
export function createLockCleanupWorker(): Worker<CleanupJobData> {
  const worker = new Worker<CleanupJobData>(QUEUE_NAME, processCleanupJob, {
    connection: redisConnection,
    concurrency: 1, // Only one cleanup job at a time
  });

  // Event handlers
  worker.on('completed', (job, result: CleanupResult) => {
    logger.info('Lock cleanup job completed', {
      jobId: job.id,
      releasedCount: result.releasedCount,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Lock cleanup job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on('error', (err) => {
    logger.error('Lock cleanup worker error', { error: err.message });
  });

  logger.info('Lock cleanup worker started');

  return worker;
}

/**
 * Schedule recurring cleanup jobs
 */
export async function scheduleRecurringCleanup(): Promise<void> {
  // Add repeatable job for expired lock cleanup (every 5 minutes)
  await lockCleanupQueue.add(
    'cleanup-expired',
    { type: 'expired', batchSize: 50 },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'recurring-cleanup-expired',
    }
  );

  // Add repeatable job for orphaned lock cleanup (every hour)
  await lockCleanupQueue.add(
    'cleanup-orphaned',
    { type: 'orphaned', batchSize: 100 },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour
      },
      jobId: 'recurring-cleanup-orphaned',
    }
  );

  logger.info('Scheduled recurring lock cleanup jobs');
}

/**
 * Get lock statistics
 */
export async function getLockStatistics(): Promise<{
  totalLocks: number;
  expiredLocks: number;
  locksExpiringSoon: number;
  locksBySessionType: Record<string, number>;
}> {
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

  const [
    totalLocks,
    expiredLocks,
    locksExpiringSoon,
    locksByType,
  ] = await Promise.all([
    prisma.documentLock.count(),
    prisma.documentLock.count({
      where: { expiresAt: { lt: now } },
    }),
    prisma.documentLock.count({
      where: {
        expiresAt: {
          gte: now,
          lte: soonThreshold,
        },
      },
    }),
    prisma.documentLock.groupBy({
      by: ['sessionType'],
      _count: { id: true },
    }),
  ]);

  const locksBySessionType: Record<string, number> = {};
  locksByType.forEach((item) => {
    locksBySessionType[item.sessionType] = item._count.id;
  });

  return {
    totalLocks,
    expiredLocks,
    locksExpiringSoon,
    locksBySessionType,
  };
}

// Graceful shutdown
export async function shutdownWorker(worker: Worker): Promise<void> {
  logger.info('Shutting down lock cleanup worker...');
  await worker.close();
  await lockCleanupQueue.close();
  await redisConnection.quit();
  logger.info('Lock cleanup worker shut down');
}
