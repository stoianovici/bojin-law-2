/**
 * Suggestion Cleanup Worker
 * Story 5.4: Proactive AI Suggestions System (AC: 6)
 *
 * Performs maintenance tasks for the AI suggestion system:
 * - Marks expired suggestions as Expired
 * - Archives old feedback data (> 1 year)
 * - Calculates and caches suggestion performance metrics
 *
 * Schedule: Daily at 3:00 AM (configurable)
 */

import { prisma } from '@legal-platform/database';
import * as cron from 'node-cron';
import Redis from 'ioredis';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

interface CleanupWorkerConfig {
  enabled: boolean;
  cronSchedule: string;
  timezone: string;
  feedbackRetentionDays: number; // Days to keep feedback (default: 365)
  metricsAggregationDays: number; // Days to include in metrics
}

const DEFAULT_CONFIG: CleanupWorkerConfig = {
  enabled: process.env.SUGGESTION_CLEANUP_WORKER_ENABLED !== 'false',
  cronSchedule: process.env.SUGGESTION_CLEANUP_CRON || '0 3 * * *', // Daily 3 AM
  timezone: process.env.SUGGESTION_CLEANUP_TIMEZONE || 'Europe/Bucharest',
  feedbackRetentionDays: parseInt(process.env.FEEDBACK_RETENTION_DAYS || '365', 10),
  metricsAggregationDays: parseInt(process.env.METRICS_AGGREGATION_DAYS || '30', 10),
};

const WORKER_NAME = 'suggestion-cleanup';
const REDIS_STATE_KEY = `proactive:worker:${WORKER_NAME}:lastRun`;
const REDIS_ERROR_KEY = `proactive:worker:${WORKER_NAME}:errors`;
const METRICS_CACHE_KEY = 'proactive:metrics:firm';
const METRICS_CACHE_TTL = 86400; // 24 hours

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let isProcessing = false;
let redis: Redis | null = null;

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the cleanup worker
 */
export function startSuggestionCleanupWorker(config: Partial<CleanupWorkerConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    logger.info(`[${WORKER_NAME}] Worker is disabled`);
    return;
  }

  if (isRunning) {
    logger.info(`[${WORKER_NAME}] Worker is already running`);
    return;
  }

  logger.info(`[${WORKER_NAME}] Starting worker...`);
  logger.info(`[${WORKER_NAME}] Schedule: ${finalConfig.cronSchedule}`);
  logger.info(`[${WORKER_NAME}] Feedback retention: ${finalConfig.feedbackRetentionDays} days`);

  // Initialize Redis
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redis = new Redis(redisUrl);
    }
  } catch (error) {
    logger.warn(`[${WORKER_NAME}] Redis not available, caching disabled`);
  }

  isRunning = true;

  // Schedule daily cron job
  cronJob = cron.schedule(
    finalConfig.cronSchedule,
    () => {
      runCleanup(finalConfig).catch((error) => {
        logError(error as Error);
      });
    },
    {
      timezone: finalConfig.timezone,
    }
  );

  logger.info(`[${WORKER_NAME}] Worker started successfully`);
}

/**
 * Stop the cleanup worker
 */
export function stopSuggestionCleanupWorker(): void {
  if (!isRunning) {
    logger.info(`[${WORKER_NAME}] Worker is not running`);
    return;
  }

  logger.info(`[${WORKER_NAME}] Stopping worker...`);

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  if (redis) {
    redis.disconnect();
    redis = null;
  }

  isRunning = false;

  logger.info(`[${WORKER_NAME}] Worker stopped successfully`);
}

/**
 * Check if the worker is running
 */
export function isSuggestionCleanupWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger cleanup (for testing/admin)
 */
export async function triggerCleanup(): Promise<void> {
  if (isProcessing) {
    logger.warn(`[${WORKER_NAME}] Already processing`);
    return;
  }
  await runCleanup(DEFAULT_CONFIG);
}

// ============================================================================
// Cleanup Logic
// ============================================================================

async function runCleanup(config: CleanupWorkerConfig): Promise<void> {
  if (isProcessing) {
    logger.warn(`[${WORKER_NAME}] Already processing, skipping`);
    return;
  }

  isProcessing = true;
  const startTime = Date.now();

  logger.info(`[${WORKER_NAME}] Running cleanup...`);

  try {
    // Step 1: Mark expired suggestions
    const expiredCount = await markExpiredSuggestions();
    logger.info(`[${WORKER_NAME}] Marked ${expiredCount} suggestions as expired`);

    // Step 2: Archive old feedback data
    const archivedCount = await archiveOldFeedback(config.feedbackRetentionDays);
    logger.info(`[${WORKER_NAME}] Archived ${archivedCount} old feedback records`);

    // Step 3: Calculate and cache performance metrics
    await calculateAndCacheMetrics(config.metricsAggregationDays);
    logger.info(`[${WORKER_NAME}] Updated performance metrics cache`);

    // Step 4: Clean up orphaned patterns
    const orphanedCount = await cleanupOrphanedPatterns();
    logger.info(`[${WORKER_NAME}] Removed ${orphanedCount} orphaned patterns`);

    // Step 5: Cleanup old briefings (keep last 30 days)
    const oldBriefingsCount = await cleanupOldBriefings();
    logger.info(`[${WORKER_NAME}] Removed ${oldBriefingsCount} old briefings`);

    // Update last run
    await updateLastRun();

    const duration = Date.now() - startTime;
    logger.info(`[${WORKER_NAME}] Cleanup complete in ${duration}ms`);
    logger.info(`[${WORKER_NAME}] Summary: ${expiredCount} expired, ${archivedCount} archived, ${orphanedCount} orphaned removed`);
  } catch (error) {
    await logError(error as Error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Mark suggestions with passed expiresAt as Expired
 */
async function markExpiredSuggestions(): Promise<number> {
  const now = new Date();

  const result = await prisma.aISuggestion.updateMany({
    where: {
      status: 'Pending',
      expiresAt: { lt: now },
    },
    data: {
      status: 'Expired',
    },
  });

  return result.count;
}

/**
 * Archive old feedback data (soft delete or move to archive)
 */
async function archiveOldFeedback(retentionDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // For now, we delete old feedback records
  // In production, you might want to move them to an archive table
  const result = await prisma.suggestionFeedback.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Calculate and cache suggestion performance metrics per firm
 */
async function calculateAndCacheMetrics(aggregationDays: number): Promise<void> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - aggregationDays);

  // Get all firms
  const firms = await prisma.firm.findMany({
    select: { id: true },
  });

  for (const firm of firms) {
    const metrics = await calculateFirmMetrics(firm.id, startDate);

    // Cache the metrics
    if (redis) {
      try {
        await redis.setex(
          `${METRICS_CACHE_KEY}:${firm.id}`,
          METRICS_CACHE_TTL,
          JSON.stringify(metrics)
        );
      } catch (error) {
        logger.warn(`[${WORKER_NAME}] Failed to cache metrics for firm ${firm.id}`);
      }
    }
  }
}

/**
 * Calculate metrics for a specific firm
 */
async function calculateFirmMetrics(
  firmId: string,
  startDate: Date
): Promise<{
  totalSuggestions: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  averageResponseTimeMs: number;
  byType: Record<string, { count: number; acceptanceRate: number }>;
  byCategory: Record<string, { count: number; acceptanceRate: number }>;
  lastCalculated: string;
}> {
  // Get suggestion counts
  const [totalSuggestions, feedback] = await Promise.all([
    prisma.aISuggestion.count({
      where: {
        firmId,
        createdAt: { gte: startDate },
      },
    }),
    prisma.suggestionFeedback.findMany({
      where: {
        firmId,
        createdAt: { gte: startDate },
      },
      include: {
        suggestion: {
          select: {
            type: true,
            category: true,
          },
        },
      },
    }),
  ]);

  // Calculate aggregates
  let acceptedCount = 0;
  let dismissedCount = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;
  const byType: Record<string, { total: number; accepted: number }> = {};
  const byCategory: Record<string, { total: number; accepted: number }> = {};

  for (const fb of feedback) {
    if (fb.action === 'accepted' || fb.action === 'modified') {
      acceptedCount++;
    } else if (fb.action === 'dismissed') {
      dismissedCount++;
    }

    if (fb.responseTimeMs) {
      totalResponseTime += fb.responseTimeMs;
      responseTimeCount++;
    }

    // By type
    const type = fb.suggestion?.type || 'Unknown';
    if (!byType[type]) {
      byType[type] = { total: 0, accepted: 0 };
    }
    byType[type].total++;
    if (fb.action === 'accepted' || fb.action === 'modified') {
      byType[type].accepted++;
    }

    // By category
    const category = fb.suggestion?.category || 'Unknown';
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, accepted: 0 };
    }
    byCategory[category].total++;
    if (fb.action === 'accepted' || fb.action === 'modified') {
      byCategory[category].accepted++;
    }
  }

  // Format results
  const byTypeFormatted: Record<string, { count: number; acceptanceRate: number }> = {};
  for (const [type, stats] of Object.entries(byType)) {
    byTypeFormatted[type] = {
      count: stats.total,
      acceptanceRate: stats.total > 0 ? stats.accepted / stats.total : 0,
    };
  }

  const byCategoryFormatted: Record<string, { count: number; acceptanceRate: number }> = {};
  for (const [category, stats] of Object.entries(byCategory)) {
    byCategoryFormatted[category] = {
      count: stats.total,
      acceptanceRate: stats.total > 0 ? stats.accepted / stats.total : 0,
    };
  }

  return {
    totalSuggestions,
    acceptedCount,
    dismissedCount,
    acceptanceRate: feedback.length > 0 ? acceptedCount / feedback.length : 0,
    averageResponseTimeMs: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
    byType: byTypeFormatted,
    byCategory: byCategoryFormatted,
    lastCalculated: new Date().toISOString(),
  };
}

/**
 * Clean up orphaned patterns (users no longer active)
 */
async function cleanupOrphanedPatterns(): Promise<number> {
  // Get inactive user IDs
  const inactiveUsers = await prisma.user.findMany({
    where: {
      status: { not: 'Active' },
    },
    select: { id: true },
  });

  if (inactiveUsers.length === 0) return 0;

  const inactiveIds = inactiveUsers.map((u) => u.id);

  // Delete patterns for inactive users
  const result = await prisma.userActionPattern.deleteMany({
    where: {
      userId: { in: inactiveIds },
    },
  });

  return result.count;
}

/**
 * Clean up old morning briefings (keep last 30 days)
 */
async function cleanupOldBriefings(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const result = await prisma.morningBriefing.deleteMany({
    where: {
      briefingDate: { lt: cutoffDate },
    },
  });

  return result.count;
}

// ============================================================================
// State Management
// ============================================================================

async function updateLastRun(): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(REDIS_STATE_KEY, new Date().toISOString());
  } catch {
    // Ignore Redis errors
  }
}

async function logError(error: Error): Promise<void> {
  logger.error(`[${WORKER_NAME}] Error:`, { message: error.message, stack: error.stack });

  if (!redis) return;

  try {
    const errorEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
    });
    await redis.lpush(REDIS_ERROR_KEY, errorEntry);
    await redis.ltrim(REDIS_ERROR_KEY, 0, 99);
  } catch {
    // Ignore Redis errors
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function getWorkerHealth(): Promise<{
  workerName: string;
  lastRunAt: Date | null;
  status: 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED';
  lastError: string | null;
}> {
  const enabled = process.env.SUGGESTION_CLEANUP_WORKER_ENABLED !== 'false';
  if (!enabled) {
    return {
      workerName: WORKER_NAME,
      lastRunAt: null,
      status: 'DISABLED',
      lastError: null,
    };
  }

  let lastRunAt: Date | null = null;
  let lastError: string | null = null;

  if (redis) {
    try {
      const lastRun = await redis.get(REDIS_STATE_KEY);
      if (lastRun) lastRunAt = new Date(lastRun);

      const errors = await redis.lrange(REDIS_ERROR_KEY, 0, 0);
      if (errors.length > 0) {
        lastError = JSON.parse(errors[0]).message;
      }
    } catch {
      // Ignore Redis errors
    }
  }

  let status: 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED' = 'HEALTHY';
  if (lastError) {
    status = 'ERROR';
  } else if (lastRunAt) {
    const daysSinceRun = (Date.now() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRun > 3) {
      // More than 3 days since daily cleanup
      status = 'STALE';
    }
  }

  return { workerName: WORKER_NAME, lastRunAt, status, lastError };
}

/**
 * Get cached metrics for a firm
 */
export async function getCachedMetrics(firmId: string): Promise<{
  totalSuggestions: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  averageResponseTimeMs: number;
  byType: Record<string, { count: number; acceptanceRate: number }>;
  byCategory: Record<string, { count: number; acceptanceRate: number }>;
  lastCalculated: string;
} | null> {
  if (!redis) return null;

  try {
    const cached = await redis.get(`${METRICS_CACHE_KEY}:${firmId}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  start: startSuggestionCleanupWorker,
  stop: stopSuggestionCleanupWorker,
  isRunning: isSuggestionCleanupWorkerRunning,
  trigger: triggerCleanup,
  getHealth: getWorkerHealth,
  getCachedMetrics,
};
