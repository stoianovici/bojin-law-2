/**
 * Pattern Analysis Worker
 * Story 4.7: Task Analytics and Optimization - Task 14
 *
 * Detects new task patterns and analyzes delegation patterns weekly
 * AC: 4, 5 - Updates TaskPatternAnalysis and DelegationAnalytics tables
 *
 * Schedule: Weekly on Sunday at 3 AM (configurable via PATTERN_ANALYSIS_CRON)
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import { PatternDetectionService } from '../services/pattern-detection.service';
import { DelegationAnalyticsService } from '../services/delegation-analytics.service';

// ============================================================================
// Configuration
// ============================================================================

const WORKER_NAME = 'pattern-analysis';
const REDIS_STATE_KEY = `analytics:worker:${WORKER_NAME}:lastRun`;
const REDIS_ERROR_KEY = `analytics:worker:${WORKER_NAME}:errors`;

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let redis: Redis | null = null;

// ============================================================================
// Worker Lifecycle
// ============================================================================

export function startPatternAnalysisWorker(
  intervalMs: number = 7 * 24 * 60 * 60 * 1000 // Default: 7 days
): void {
  if (isRunning) {
    console.log(`[${WORKER_NAME}] Worker is already running`);
    return;
  }

  const enabled = process.env.ANALYTICS_WORKER_ENABLED !== 'false';
  if (!enabled) {
    console.log(`[${WORKER_NAME}] Worker is disabled`);
    return;
  }

  console.log(`[${WORKER_NAME}] Starting worker...`);
  console.log(`[${WORKER_NAME}] Interval: ${intervalMs / 1000 / 60 / 60 / 24} days`);

  // Initialize Redis
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redis = new Redis(redisUrl);
    }
  } catch (error) {
    console.warn(`[${WORKER_NAME}] Redis not available, state tracking disabled`);
  }

  isRunning = true;

  // Check if we missed a run
  checkMissedRun(intervalMs).then((missed) => {
    if (missed) {
      console.log(`[${WORKER_NAME}] Catching up missed run...`);
      runPatternAnalysis().catch(logError);
    }
  });

  // Run on interval
  intervalHandle = setInterval(() => {
    runPatternAnalysis().catch(logError);
  }, intervalMs);

  console.log(`[${WORKER_NAME}] Worker started successfully`);
}

export function stopPatternAnalysisWorker(): void {
  if (!isRunning) {
    console.log(`[${WORKER_NAME}] Worker is not running`);
    return;
  }

  console.log(`[${WORKER_NAME}] Stopping worker...`);

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  if (redis) {
    redis.disconnect();
    redis = null;
  }

  isRunning = false;
  console.log(`[${WORKER_NAME}] Worker stopped successfully`);
}

export function isPatternAnalysisWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Analysis Logic
// ============================================================================

async function runPatternAnalysis(): Promise<void> {
  console.log(`[${WORKER_NAME}] Running pattern analysis...`);
  const startTime = Date.now();

  try {
    const firms = await prisma.firm.findMany({
      select: { id: true },
    });

    console.log(`[${WORKER_NAME}] Analyzing ${firms.length} firms`);

    const patternService = new PatternDetectionService(prisma);
    const delegationService = new DelegationAnalyticsService(prisma);

    for (const firm of firms) {
      // Detect task patterns (AC: 4)
      console.log(`[${WORKER_NAME}] Detecting patterns for firm ${firm.id}`);
      await patternService.detectTaskPatterns(firm.id);

      // Analyze delegation patterns (AC: 5)
      console.log(`[${WORKER_NAME}] Analyzing delegations for firm ${firm.id}`);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      await delegationService.getDelegationAnalytics(firm.id, {
        firmId: firm.id,
        dateRange: { start: thirtyDaysAgo, end: now },
      });

      // Store monthly delegation analytics
      await storeDelegationAnalytics(firm.id);
    }

    // Update last run timestamp
    await updateLastRun();

    const duration = Date.now() - startTime;
    console.log(`[${WORKER_NAME}] Analysis completed in ${duration}ms`);
  } catch (error) {
    await logError(error as Error);
    throw error;
  }
}

async function storeDelegationAnalytics(firmId: string): Promise<void> {
  // Get first of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get users in firm
  const users = await prisma.user.findMany({
    where: { firmId },
    select: { id: true },
  });

  for (const user of users) {
    // Get delegations for this user this month
    const delegationsReceived = await prisma.taskDelegation.count({
      where: {
        delegatedTo: user.id,
        sourceTask: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      },
    });

    const delegationsGiven = await prisma.taskDelegation.count({
      where: {
        delegatedBy: user.id,
        sourceTask: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      },
    });

    if (delegationsReceived === 0 && delegationsGiven === 0) continue;

    // Calculate success rate
    const completedDelegations = await prisma.taskDelegation.count({
      where: {
        delegatedTo: user.id,
        status: 'Accepted',
        sourceTask: {
          createdAt: { gte: monthStart, lte: monthEnd },
          completedAt: { not: undefined },
        },
      },
    });

    const successRate = delegationsReceived > 0 ? completedDelegations / delegationsReceived : 0;

    // Get delegations by type
    const byType = await prisma.taskDelegation.groupBy({
      by: ['sourceTaskId'],
      where: {
        delegatedTo: user.id,
        sourceTask: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      },
      _count: true,
    });

    // Upsert analytics record
    await prisma.delegationAnalytics.upsert({
      where: {
        firmId_userId_analysisMonth: {
          firmId,
          userId: user.id,
          analysisMonth: monthStart,
        },
      },
      create: {
        firmId,
        userId: user.id,
        analysisMonth: monthStart,
        delegationsReceived,
        delegationsGiven,
        delegationsByType: {},
        successRate,
        struggleAreas: [],
        strengthAreas: [],
      },
      update: {
        delegationsReceived,
        delegationsGiven,
        successRate,
      },
    });
  }
}

// ============================================================================
// State Management
// ============================================================================

async function checkMissedRun(intervalMs: number): Promise<boolean> {
  if (!redis) return false;

  try {
    const lastRun = await redis.get(REDIS_STATE_KEY);
    if (!lastRun) return true;

    const lastRunTime = new Date(lastRun).getTime();
    const expectedNext = lastRunTime + intervalMs;
    return Date.now() > expectedNext;
  } catch {
    return false;
  }
}

async function updateLastRun(): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(REDIS_STATE_KEY, new Date().toISOString());
  } catch {
    // Ignore Redis errors
  }
}

async function logError(error: Error): Promise<void> {
  console.error(`[${WORKER_NAME}] Error:`, error.message);

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
  const enabled = process.env.ANALYTICS_WORKER_ENABLED !== 'false';
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
    if (daysSinceRun > 14) {
      // 2x weekly interval
      status = 'STALE';
    }
  }

  return { workerName: WORKER_NAME, lastRunAt, status, lastError };
}

// Manual trigger for admin
export async function triggerPatternAnalysis(): Promise<void> {
  await runPatternAnalysis();
}

export default {
  start: startPatternAnalysisWorker,
  stop: stopPatternAnalysisWorker,
  isRunning: isPatternAnalysisWorkerRunning,
  getHealth: getWorkerHealth,
  trigger: triggerPatternAnalysis,
};
