/**
 * Analytics Aggregation Worker
 * Story 4.7: Task Analytics and Optimization - Task 13
 *
 * NOTE: This worker is now a no-op. The TaskAnalyticsSnapshot model and
 * SnapshotType enum have been removed as dead code. Analytics calculations
 * are now performed on-demand by the various analytics services:
 * - TaskCompletionAnalyticsService
 * - OverdueAnalysisService
 * - VelocityTrendsService
 *
 * This file is kept to maintain the interface expected by task-analytics.resolvers.ts
 */

// ============================================================================
// Configuration
// ============================================================================

const WORKER_NAME = 'analytics-aggregation';

let isRunning = false;

// ============================================================================
// Worker Lifecycle (No-op implementations)
// ============================================================================

export function startAnalyticsAggregationWorker(_intervalMs: number = 24 * 60 * 60 * 1000): void {
  if (isRunning) {
    console.log(`[${WORKER_NAME}] Worker is already running`);
    return;
  }

  const enabled = process.env.ANALYTICS_WORKER_ENABLED !== 'false';
  if (!enabled) {
    console.log(`[${WORKER_NAME}] Worker is disabled`);
    return;
  }

  console.log(`[${WORKER_NAME}] Worker started (no-op - analytics calculated on-demand)`);
  isRunning = true;
}

export function stopAnalyticsAggregationWorker(): void {
  if (!isRunning) {
    console.log(`[${WORKER_NAME}] Worker is not running`);
    return;
  }

  console.log(`[${WORKER_NAME}] Worker stopped`);
  isRunning = false;
}

export function isAnalyticsAggregationWorkerRunning(): boolean {
  return isRunning;
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

  // Return healthy status - analytics are calculated on-demand by services
  return {
    workerName: WORKER_NAME,
    lastRunAt: new Date(),
    status: 'HEALTHY',
    lastError: null,
  };
}

// Manual trigger (no-op - analytics calculated on-demand)
export async function triggerAggregation(_date?: Date): Promise<void> {
  console.log(
    `[${WORKER_NAME}] Trigger called (no-op - analytics calculated on-demand by analytics services)`
  );
}

export default {
  start: startAnalyticsAggregationWorker,
  stop: stopAnalyticsAggregationWorker,
  isRunning: isAnalyticsAggregationWorkerRunning,
  getHealth: getWorkerHealth,
  trigger: triggerAggregation,
};
