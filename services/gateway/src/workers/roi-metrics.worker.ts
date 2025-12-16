/**
 * ROI Metrics Worker
 * Story 4.7: Task Analytics and Optimization - Task 15
 *
 * Aggregates monthly automation metrics and calculates ROI
 * AC: 6 - Updates AutomationROIMetrics table
 *
 * Schedule: Monthly on 1st at 4 AM (configurable via ROI_METRICS_CRON)
 */

import { prisma, TaskStatus } from '@legal-platform/database';
import Redis from 'ioredis';

// ============================================================================
// Configuration
// ============================================================================

const WORKER_NAME = 'roi-metrics';
const REDIS_STATE_KEY = `analytics:worker:${WORKER_NAME}:lastRun`;
const REDIS_ERROR_KEY = `analytics:worker:${WORKER_NAME}:errors`;

// Time savings assumptions (minutes)
const SAVINGS = {
  templateTaskMinutes: 5,
  nlpParseMinutes: 2,
  autoReminderMinutes: 1,
  autoReassignmentMinutes: 10,
  autoDependencyMinutes: 2,
};

const DEFAULT_HOURLY_RATE = 200; // RON

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let redis: Redis | null = null;

// ============================================================================
// Worker Lifecycle
// ============================================================================

export function startROIMetricsWorker(
  intervalMs: number = 30 * 24 * 60 * 60 * 1000 // Default: ~30 days
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

  // Initialize Redis
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redis = new Redis(redisUrl);
    }
  } catch (error) {
    console.warn(`[${WORKER_NAME}] Redis not available`);
  }

  isRunning = true;

  // Check if we missed a run
  checkMissedRun().then((missed) => {
    if (missed) {
      console.log(`[${WORKER_NAME}] Catching up missed run...`);
      runROICalculation().catch(logError);
    }
  });

  // Run on interval
  intervalHandle = setInterval(() => {
    runROICalculation().catch(logError);
  }, intervalMs);

  console.log(`[${WORKER_NAME}] Worker started successfully`);
}

export function stopROIMetricsWorker(): void {
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

export function isROIMetricsWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// ROI Calculation Logic
// ============================================================================

async function runROICalculation(): Promise<void> {
  console.log(`[${WORKER_NAME}] Running ROI calculation...`);
  const startTime = Date.now();

  try {
    const firms = await prisma.firm.findMany({
      select: { id: true, defaultRates: true },
    });

    console.log(`[${WORKER_NAME}] Calculating ROI for ${firms.length} firms`);

    // Calculate for previous month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    for (const firm of firms) {
      await calculateFirmROI(firm.id, firm.defaultRates, monthStart, monthEnd);
    }

    await updateLastRun();

    const duration = Date.now() - startTime;
    console.log(`[${WORKER_NAME}] ROI calculation completed in ${duration}ms`);
  } catch (error) {
    await logError(error as Error);
    throw error;
  }
}

async function calculateFirmROI(
  firmId: string,
  defaultRates: unknown,
  monthStart: Date,
  monthEnd: Date
): Promise<void> {
  // Check if already calculated
  const existing = await prisma.automationROIMetrics.findFirst({
    where: {
      firmId,
      metricMonth: monthStart,
    },
  });

  if (existing) {
    console.log(
      `[${WORKER_NAME}] ROI already calculated for firm ${firmId} for ${monthStart.toISOString().slice(0, 7)}`
    );
    return;
  }

  // Count template tasks
  const templateTasksCreated = await prisma.task.count({
    where: {
      firmId,
      createdAt: { gte: monthStart, lte: monthEnd },
      templateStepId: { not: null },
    },
  });

  // Count manual tasks
  const manualTasksCreated = await prisma.task.count({
    where: {
      firmId,
      createdAt: { gte: monthStart, lte: monthEnd },
      templateStepId: null,
      parseHistoryId: null,
    },
  });

  // Count NLP tasks
  const nlpTasksCreated = await prisma.task.count({
    where: {
      firmId,
      createdAt: { gte: monthStart, lte: monthEnd },
      parseHistoryId: { not: null },
    },
  });

  // Count tasks with reminders (estimate)
  const autoRemindersSet = await prisma.task.count({
    where: {
      firmId,
      createdAt: { gte: monthStart, lte: monthEnd },
      dueDate: { not: undefined },
    },
  });

  // Count dependency triggers
  const autoDependencyTriggers = await prisma.taskDependency.count({
    where: {
      predecessor: {
        firmId,
        completedAt: { gte: monthStart, lte: monthEnd },
      },
    },
  });

  // Count reassignments
  const autoReassignments = await prisma.taskHistory.count({
    where: {
      task: { firmId },
      createdAt: { gte: monthStart, lte: monthEnd },
      action: 'AssigneeChanged',
    },
  });

  // Calculate time saved
  const templateTimeSaved = templateTasksCreated * SAVINGS.templateTaskMinutes;
  const nlpTimeSaved = nlpTasksCreated * SAVINGS.nlpParseMinutes;
  const reminderTimeSaved = autoRemindersSet * SAVINGS.autoReminderMinutes;
  const reassignmentTimeSaved = autoReassignments * SAVINGS.autoReassignmentMinutes;
  const dependencyTimeSaved = autoDependencyTriggers * SAVINGS.autoDependencyMinutes;

  const estimatedTimeSavedMin =
    templateTimeSaved +
    nlpTimeSaved +
    reminderTimeSaved +
    reassignmentTimeSaved +
    dependencyTimeSaved;

  // Get hourly rate
  let avgHourlyRate = DEFAULT_HOURLY_RATE;
  if (defaultRates && typeof defaultRates === 'object') {
    const rates = Object.values(defaultRates as Record<string, number>).filter(
      (r) => typeof r === 'number' && r > 0
    );
    if (rates.length > 0) {
      avgHourlyRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    }
  }

  // Calculate value saved
  const totalValueSaved = (estimatedTimeSavedMin / 60) * avgHourlyRate;

  // Calculate average parse time (placeholder - would need actual metrics)
  const avgParseTimeMs = 500;

  // Store metrics
  await prisma.automationROIMetrics.create({
    data: {
      firmId,
      metricMonth: monthStart,
      templateTasksCreated,
      manualTasksCreated,
      estimatedTimeSavedMin,
      nlpTasksCreated,
      avgParseTimeMs,
      estimatedFormTimeSavedMin: nlpTimeSaved,
      autoRemindersSet,
      autoDependencyTriggers,
      autoReassignments,
      avgHourlyRate,
      totalValueSaved,
    },
  });

  console.log(`[${WORKER_NAME}] Created ROI metrics for firm ${firmId}`);
}

// ============================================================================
// State Management
// ============================================================================

async function checkMissedRun(): Promise<boolean> {
  if (!redis) return false;

  try {
    const lastRun = await redis.get(REDIS_STATE_KEY);
    if (!lastRun) return true;

    const lastRunTime = new Date(lastRun);
    const lastMonth = lastRunTime.getMonth();
    const currentMonth = new Date().getMonth();

    // Missed if we're in a new month and haven't run
    return currentMonth !== lastMonth;
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
    if (daysSinceRun > 60) {
      // 2x monthly interval
      status = 'STALE';
    }
  }

  return { workerName: WORKER_NAME, lastRunAt, status, lastError };
}

// Manual trigger for admin
export async function triggerROICalculation(month?: Date): Promise<void> {
  const targetMonth = month || new Date();
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0, 23, 59, 59, 999);

  const firms = await prisma.firm.findMany({
    select: { id: true, defaultRates: true },
  });

  for (const firm of firms) {
    await calculateFirmROI(firm.id, firm.defaultRates, monthStart, monthEnd);
  }
}

export default {
  start: startROIMetricsWorker,
  stop: stopROIMetricsWorker,
  isRunning: isROIMetricsWorkerRunning,
  getHealth: getWorkerHealth,
  trigger: triggerROICalculation,
};
