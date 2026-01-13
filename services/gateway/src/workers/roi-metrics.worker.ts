/**
 * ROI Metrics Worker
 * Story 4.7: Task Analytics and Optimization - Task 15
 *
 * NOTE: This worker is now a no-op. The AutomationROIMetrics table and
 * TaskParseHistory model have been removed as dead code. ROI calculations
 * are now performed on-demand by ROICalculatorService.calculateROI().
 *
 * This file is kept to maintain the interface expected by task-analytics.resolvers.ts
 */

// ============================================================================
// Configuration
// ============================================================================

const WORKER_NAME = 'roi-metrics';

let isRunning = false;

// ============================================================================
// Worker Lifecycle (No-op implementations)
// ============================================================================

export function startROIMetricsWorker(
  _intervalMs: number = 30 * 24 * 60 * 60 * 1000
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

  console.log(`[${WORKER_NAME}] Worker started (no-op - ROI calculated on-demand)`);
  isRunning = true;
}

export function stopROIMetricsWorker(): void {
  if (!isRunning) {
    console.log(`[${WORKER_NAME}] Worker is not running`);
    return;
  }

  console.log(`[${WORKER_NAME}] Worker stopped`);
  isRunning = false;
}

export function isROIMetricsWorkerRunning(): boolean {
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

  // Return healthy status - ROI is calculated on-demand by ROICalculatorService
  return {
    workerName: WORKER_NAME,
    lastRunAt: new Date(),
    status: 'HEALTHY',
    lastError: null,
  };
}

// Manual trigger (no-op - ROI is calculated on-demand)
export async function triggerROICalculation(_month?: Date): Promise<void> {
  console.log(`[${WORKER_NAME}] Trigger called (no-op - ROI calculated on-demand by ROICalculatorService)`);
}

export default {
  start: startROIMetricsWorker,
  stop: stopROIMetricsWorker,
  isRunning: isROIMetricsWorkerRunning,
  getHealth: getWorkerHealth,
  trigger: triggerROICalculation,
};
