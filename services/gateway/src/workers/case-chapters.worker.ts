/**
 * Case Chapters Worker
 * Weekly batch processing of case history chapters.
 *
 * Regenerates chapter summaries and timeline events for cases that:
 * - Have no chapters yet (priority)
 * - Have stale chapters (isStale = true)
 *
 * Runs weekly on Mondays at 2 AM to balance freshness with compute cost.
 */

import { prisma } from '@legal-platform/database';
import { caseChaptersService } from '../services/case-chapters.service';
import * as cron from 'node-cron';

// ============================================================================
// Configuration
// ============================================================================

interface WorkerConfig {
  batchSize: number;
  cronSchedule: string;
  timezone: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: WorkerConfig = {
  batchSize: parseInt(process.env.CASE_CHAPTERS_BATCH_SIZE || '10', 10),
  cronSchedule: process.env.CASE_CHAPTERS_CRON || '0 2 * * 1', // Mondays at 2 AM
  timezone: process.env.CASE_CHAPTERS_TIMEZONE || 'Europe/Bucharest',
  enabled: process.env.CASE_CHAPTERS_WORKER_ENABLED !== 'false',
};

// Worker state
let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let isProcessing = false;

// Processing metrics
interface ProcessingMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  lastRunAt: Date | null;
}

let metrics: ProcessingMetrics = {
  totalProcessed: 0,
  successCount: 0,
  errorCount: 0,
  lastRunAt: null,
};

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the case chapters worker with weekly scheduling.
 * @param config - Optional configuration overrides
 */
export function startCaseChaptersWorker(config: Partial<WorkerConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log('[CaseChapters Worker] Worker is disabled');
    return;
  }

  if (isRunning) {
    console.log('[CaseChapters Worker] Already running');
    return;
  }

  console.log('[CaseChapters Worker] Starting...');
  console.log('  Batch size:', finalConfig.batchSize);
  console.log('  Schedule:', finalConfig.cronSchedule);
  console.log('  Timezone:', finalConfig.timezone);

  isRunning = true;

  // Schedule cron job for weekly processing
  cronJob = cron.schedule(
    finalConfig.cronSchedule,
    () => {
      processBatch(finalConfig).catch((error) => {
        console.error('[CaseChapters Worker] Error in batch processing:', error);
      });
    },
    {
      timezone: finalConfig.timezone,
    }
  );

  console.log('[CaseChapters Worker] Started successfully');
}

/**
 * Stop the case chapters worker.
 */
export function stopCaseChaptersWorker(): void {
  if (!isRunning) {
    console.log('[CaseChapters Worker] Not running');
    return;
  }

  console.log('[CaseChapters Worker] Stopping...');

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  isRunning = false;
  console.log('[CaseChapters Worker] Stopped');
}

/**
 * Check if the worker is running.
 */
export function isWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Get processing metrics.
 */
export function getMetrics(): ProcessingMetrics {
  return { ...metrics };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process a batch of cases that need chapter generation/regeneration.
 * Priority: stale chapters first, then cases without chapters.
 */
async function processBatch(config: WorkerConfig): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    console.log('[CaseChapters Worker] Already processing, skipping');
    return;
  }

  isProcessing = true;
  const startTime = Date.now();
  console.log('[CaseChapters Worker] Processing batch...');

  try {
    let processedInBatch = 0;

    // 1. Process cases with stale chapters first
    const staleChapters = await prisma.caseChapter.findMany({
      where: { isStale: true },
      take: config.batchSize,
      orderBy: { updatedAt: 'asc' },
      select: {
        caseId: true,
        case: {
          select: { id: true, firmId: true },
        },
      },
      distinct: ['caseId'], // One entry per case
    });

    console.log(`[CaseChapters Worker] Found ${staleChapters.length} cases with stale chapters`);

    for (const chapter of staleChapters) {
      try {
        await caseChaptersService.generateChapters(chapter.caseId, chapter.case.firmId);
        metrics.successCount++;
        console.log(`[CaseChapters Worker] Regenerated chapters for case ${chapter.caseId}`);
      } catch (error) {
        console.error(
          `[CaseChapters Worker] Error regenerating chapters for case ${chapter.caseId}:`,
          error
        );
        metrics.errorCount++;
      }
      metrics.totalProcessed++;
      processedInBatch++;

      // Rate limiting delay - 500ms between cases
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 2. If we have remaining capacity, process cases without chapters
    const remainingCapacity = config.batchSize - processedInBatch;
    if (remainingCapacity > 0) {
      // Get cases without any chapters, prioritizing recently updated ones
      const casesWithoutChapters = await prisma.case.findMany({
        where: {
          chapters: { none: {} },
          status: { not: 'Closed' }, // Skip closed cases
        },
        take: remainingCapacity,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, firmId: true },
      });

      console.log(
        `[CaseChapters Worker] Found ${casesWithoutChapters.length} cases without chapters`
      );

      for (const caseData of casesWithoutChapters) {
        try {
          await caseChaptersService.generateChapters(caseData.id, caseData.firmId);
          metrics.successCount++;
          console.log(`[CaseChapters Worker] Generated chapters for case ${caseData.id}`);
        } catch (error) {
          console.error(
            `[CaseChapters Worker] Error generating chapters for case ${caseData.id}:`,
            error
          );
          metrics.errorCount++;
        }
        metrics.totalProcessed++;

        // Rate limiting delay - 500ms between cases
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update last run timestamp
    metrics.lastRunAt = new Date();

    const duration = Date.now() - startTime;
    console.log(`[CaseChapters Worker] Batch complete in ${duration}ms`);
    console.log(
      `[CaseChapters Worker] Stats: ${metrics.totalProcessed} total, ${metrics.successCount} success, ${metrics.errorCount} errors`
    );
  } catch (error) {
    console.error('[CaseChapters Worker] Batch processing error:', error);
    metrics.errorCount++;
  } finally {
    isProcessing = false;
  }
}

// ============================================================================
// Manual Trigger
// ============================================================================

/**
 * Manually trigger chapter generation for a specific case.
 * Useful for on-demand regeneration.
 */
export async function triggerChapterGeneration(caseId: string, firmId: string): Promise<boolean> {
  try {
    await caseChaptersService.generateChapters(caseId, firmId);
    return true;
  } catch (error) {
    console.error(`[CaseChapters Worker] Manual trigger failed for case ${caseId}:`, error);
    return false;
  }
}

/**
 * Mark all chapters for a case as stale, triggering regeneration on next run.
 */
export async function markCaseChaptersStale(caseId: string): Promise<void> {
  await prisma.caseChapter.updateMany({
    where: { caseId },
    data: { isStale: true },
  });
  console.log(`[CaseChapters Worker] Marked chapters stale for case ${caseId}`);
}

/**
 * Manually trigger batch processing (for testing or administrative use).
 */
export async function triggerBatchProcessing(config: Partial<WorkerConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  await processBatch(finalConfig);
}
