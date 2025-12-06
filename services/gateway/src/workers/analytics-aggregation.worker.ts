/**
 * Analytics Aggregation Worker
 * Story 4.7: Task Analytics and Optimization - Task 13
 *
 * Creates daily TaskAnalyticsSnapshot for each firm
 * AC: 1, 2, 3 - Pre-aggregates completion times, overdue counts, velocity scores
 *
 * Schedule: Daily at 2 AM (configurable via ANALYTICS_AGGREGATION_CRON)
 * Retention: Prunes snapshots older than 365 days
 */

import { PrismaClient, TaskStatus, SnapshotType, TaskTypeEnum } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

const WORKER_NAME = 'analytics-aggregation';
const DEFAULT_RETENTION_DAYS = 365;
const REDIS_STATE_KEY = `analytics:worker:${WORKER_NAME}:lastRun`;
const REDIS_ERROR_KEY = `analytics:worker:${WORKER_NAME}:errors`;

interface WorkerConfig {
  enabled: boolean;
  retentionDays: number;
}

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let redis: Redis | null = null;

// ============================================================================
// Worker Lifecycle
// ============================================================================

export function startAnalyticsAggregationWorker(
  intervalMs: number = 24 * 60 * 60 * 1000, // Default: 24 hours
  config: Partial<WorkerConfig> = {}
): void {
  if (isRunning) {
    console.log(`[${WORKER_NAME}] Worker is already running`);
    return;
  }

  const enabled = config.enabled ?? process.env.ANALYTICS_WORKER_ENABLED !== 'false';
  if (!enabled) {
    console.log(`[${WORKER_NAME}] Worker is disabled`);
    return;
  }

  const retentionDays = config.retentionDays ?? DEFAULT_RETENTION_DAYS;

  console.log(`[${WORKER_NAME}] Starting worker...`);
  console.log(`[${WORKER_NAME}] Interval: ${intervalMs / 1000 / 60 / 60} hours`);
  console.log(`[${WORKER_NAME}] Retention: ${retentionDays} days`);

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
      runAggregation(retentionDays).catch(logError);
    }
  });

  // Run on interval
  intervalHandle = setInterval(() => {
    runAggregation(retentionDays).catch(logError);
  }, intervalMs);

  console.log(`[${WORKER_NAME}] Worker started successfully`);
}

export function stopAnalyticsAggregationWorker(): void {
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

export function isAnalyticsAggregationWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Aggregation Logic
// ============================================================================

async function runAggregation(retentionDays: number): Promise<void> {
  console.log(`[${WORKER_NAME}] Running aggregation...`);
  const startTime = Date.now();

  try {
    // Get all firms
    const firms = await prisma.firm.findMany({
      select: { id: true },
    });

    console.log(`[${WORKER_NAME}] Processing ${firms.length} firms`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    for (const firm of firms) {
      await aggregateFirmSnapshot(firm.id, yesterday);
    }

    // Prune old snapshots
    await pruneOldSnapshots(retentionDays);

    // Update last run timestamp
    await updateLastRun();

    const duration = Date.now() - startTime;
    console.log(`[${WORKER_NAME}] Aggregation completed in ${duration}ms`);
  } catch (error) {
    await logError(error as Error);
    throw error;
  }
}

async function aggregateFirmSnapshot(firmId: string, date: Date): Promise<void> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if snapshot already exists
  const existing = await prisma.taskAnalyticsSnapshot.findFirst({
    where: {
      firmId,
      snapshotDate: startOfDay,
      snapshotType: SnapshotType.Daily,
    },
  });

  if (existing) {
    console.log(`[${WORKER_NAME}] Snapshot already exists for firm ${firmId} on ${date.toISOString().split('T')[0]}`);
    return;
  }

  // Get tasks created on this day
  const tasksCreated = await prisma.task.count({
    where: {
      firmId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  // Get tasks completed on this day
  const completedTasks = await prisma.task.findMany({
    where: {
      firmId,
      completedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: TaskStatus.Completed,
    },
    select: {
      type: true,
      assignedTo: true,
      createdAt: true,
      completedAt: true,
    },
  });

  // Calculate completion times
  const completionTimes = completedTasks
    .filter((t) => t.completedAt)
    .map((t) => {
      const created = new Date(t.createdAt);
      const completed = new Date(t.completedAt!);
      return (completed.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    });

  const avgCompletionTimeHours =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

  // Group by type
  const completionByType: Record<string, { count: number; avgHours: number }> = {};
  const byTypeMap = new Map<TaskTypeEnum, number[]>();
  for (const task of completedTasks) {
    if (!task.completedAt) continue;
    const hours =
      (new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) /
      (1000 * 60 * 60);
    const existing = byTypeMap.get(task.type) || [];
    existing.push(hours);
    byTypeMap.set(task.type, existing);
  }
  for (const [type, hours] of byTypeMap) {
    completionByType[type] = {
      count: hours.length,
      avgHours: hours.reduce((a, b) => a + b, 0) / hours.length,
    };
  }

  // Group by user
  const completionByUser: Record<string, { count: number; avgHours: number }> = {};
  const byUserMap = new Map<string, number[]>();
  for (const task of completedTasks) {
    if (!task.completedAt) continue;
    const hours =
      (new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) /
      (1000 * 60 * 60);
    const existing = byUserMap.get(task.assignedTo) || [];
    existing.push(hours);
    byUserMap.set(task.assignedTo, existing);
  }
  for (const [userId, hours] of byUserMap) {
    completionByUser[userId] = {
      count: hours.length,
      avgHours: hours.reduce((a, b) => a + b, 0) / hours.length,
    };
  }

  // Get overdue tasks (as of end of day)
  const overdueTasks = await prisma.task.findMany({
    where: {
      firmId,
      dueDate: { lt: endOfDay },
      status: { notIn: [TaskStatus.Completed, TaskStatus.Cancelled] },
      createdAt: { lte: endOfDay },
    },
    select: {
      id: true,
      type: true,
      assignedTo: true,
      successors: { select: { successorId: true } },
    },
  });

  const overdueCount = overdueTasks.length;

  // Group overdue by type
  const overdueByType: Record<string, number> = {};
  for (const task of overdueTasks) {
    overdueByType[task.type] = (overdueByType[task.type] || 0) + 1;
  }

  // Group overdue by user
  const overdueByUser: Record<string, number> = {};
  for (const task of overdueTasks) {
    overdueByUser[task.assignedTo] = (overdueByUser[task.assignedTo] || 0) + 1;
  }

  // Find bottleneck tasks (blocking most other tasks)
  const bottleneckTasks = overdueTasks
    .filter((t) => t.successors.length > 0)
    .sort((a, b) => b.successors.length - a.successors.length)
    .slice(0, 10)
    .map((t) => t.id);

  // Calculate velocity
  // Target based on 30-day average before this date
  const thirtyDaysAgo = new Date(date);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const historicalCompleted = await prisma.task.count({
    where: {
      firmId,
      completedAt: {
        gte: thirtyDaysAgo,
        lt: startOfDay,
      },
      status: TaskStatus.Completed,
    },
  });
  const dailyTarget = historicalCompleted / 30;
  const velocityScore = dailyTarget > 0 ? completedTasks.length / dailyTarget : 0;

  // Get previous day's velocity for trend
  const previousSnapshot = await prisma.taskAnalyticsSnapshot.findFirst({
    where: {
      firmId,
      snapshotDate: { lt: startOfDay },
      snapshotType: SnapshotType.Daily,
    },
    orderBy: { snapshotDate: 'desc' },
  });

  let velocityTrend: string = 'stable';
  if (previousSnapshot) {
    const prevVelocity = Number(previousSnapshot.velocityScore);
    if (velocityScore > prevVelocity * 1.05) velocityTrend = 'improving';
    else if (velocityScore < prevVelocity * 0.95) velocityTrend = 'declining';
  }

  // Create snapshot
  await prisma.taskAnalyticsSnapshot.create({
    data: {
      firmId,
      snapshotDate: startOfDay,
      snapshotType: SnapshotType.Daily,
      totalTasksCreated: tasksCreated,
      totalTasksCompleted: completedTasks.length,
      avgCompletionTimeHours,
      completionByType,
      completionByUser,
      overdueCount,
      overdueByType,
      overdueByUser,
      bottleneckTasks,
      velocityScore,
      velocityTrend,
    },
  });

  console.log(`[${WORKER_NAME}] Created snapshot for firm ${firmId}`);
}

async function pruneOldSnapshots(retentionDays: number): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const deleted = await prisma.taskAnalyticsSnapshot.deleteMany({
    where: {
      snapshotDate: { lt: cutoffDate },
    },
  });

  if (deleted.count > 0) {
    console.log(`[${WORKER_NAME}] Pruned ${deleted.count} old snapshots`);
  }
}

// ============================================================================
// State Management
// ============================================================================

async function checkMissedRun(intervalMs: number): Promise<boolean> {
  if (!redis) return false;

  try {
    const lastRun = await redis.get(REDIS_STATE_KEY);
    if (!lastRun) return true; // Never run before

    const lastRunTime = new Date(lastRun).getTime();
    const expectedNext = lastRunTime + intervalMs;
    const now = Date.now();

    return now > expectedNext;
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
    await redis.ltrim(REDIS_ERROR_KEY, 0, 99); // Keep last 100 errors
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
      if (lastRun) {
        lastRunAt = new Date(lastRun);
      }

      const errors = await redis.lrange(REDIS_ERROR_KEY, 0, 0);
      if (errors.length > 0) {
        const parsed = JSON.parse(errors[0]);
        lastError = parsed.message;
      }
    } catch {
      // Ignore Redis errors
    }
  }

  // Determine status
  let status: 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED' = 'HEALTHY';
  if (lastError) {
    status = 'ERROR';
  } else if (lastRunAt) {
    const hoursSinceRun = (Date.now() - lastRunAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceRun > 48) {
      // 2x daily interval
      status = 'STALE';
    }
  }

  return {
    workerName: WORKER_NAME,
    lastRunAt,
    status,
    lastError,
  };
}

// Manual trigger for admin
export async function triggerAggregation(date?: Date): Promise<void> {
  const targetDate = date || new Date();
  targetDate.setDate(targetDate.getDate() - 1);

  const firms = await prisma.firm.findMany({ select: { id: true } });
  for (const firm of firms) {
    await aggregateFirmSnapshot(firm.id, targetDate);
  }
}

export default {
  start: startAnalyticsAggregationWorker,
  stop: stopAnalyticsAggregationWorker,
  isRunning: isAnalyticsAggregationWorkerRunning,
  getHealth: getWorkerHealth,
  trigger: triggerAggregation,
};
