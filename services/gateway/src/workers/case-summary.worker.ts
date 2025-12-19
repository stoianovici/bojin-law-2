/**
 * Case Summary Worker
 * OPS-048: AI Summary Generation Service
 *
 * Background worker that processes stale case summaries and generates
 * new summaries for cases that don't have one yet.
 */

import { prisma } from '@legal-platform/database';
import { caseSummaryService } from '../services/case-summary.service';

// ============================================================================
// Configuration
// ============================================================================

interface WorkerConfig {
  batchSize: number;
  intervalMs: number;
  enableNewCaseSummaries: boolean;
}

const DEFAULT_CONFIG: WorkerConfig = {
  batchSize: parseInt(process.env.CASE_SUMMARY_BATCH_SIZE || '5', 10),
  intervalMs: parseInt(process.env.CASE_SUMMARY_INTERVAL_MS || '300000', 10), // Default: 5 minutes
  enableNewCaseSummaries: process.env.CASE_SUMMARY_NEW_CASES !== 'false',
};

// Worker state
let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let isProcessing = false;

// Processing metrics
interface ProcessingMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  lastRunAt: Date | null;
  avgProcessingTimeMs: number;
}

let metrics: ProcessingMetrics = {
  totalProcessed: 0,
  successCount: 0,
  errorCount: 0,
  lastRunAt: null,
  avgProcessingTimeMs: 0,
};

// ============================================================================
// Worker Lifecycle
// ============================================================================

export function startCaseSummaryWorker(config: Partial<WorkerConfig> = {}): void {
  if (isRunning) {
    console.log('[CaseSummary Worker] Already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[CaseSummary Worker] Starting...');
  console.log('  Batch size:', finalConfig.batchSize);
  console.log('  Interval:', finalConfig.intervalMs / 1000, 'seconds');
  console.log('  New case summaries:', finalConfig.enableNewCaseSummaries);

  isRunning = true;

  // Run immediately
  processBatch(finalConfig).catch((error) => {
    console.error('[CaseSummary Worker] Error in initial processing:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processBatch(finalConfig).catch((error) => {
      console.error('[CaseSummary Worker] Error in batch processing:', error);
    });
  }, finalConfig.intervalMs);

  console.log('[CaseSummary Worker] Started successfully');
}

export function stopCaseSummaryWorker(): void {
  if (!isRunning) {
    console.log('[CaseSummary Worker] Not running');
    return;
  }

  console.log('[CaseSummary Worker] Stopping...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  console.log('[CaseSummary Worker] Stopped');
}

export function isWorkerRunning(): boolean {
  return isRunning;
}

export function getMetrics(): ProcessingMetrics {
  return { ...metrics };
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processBatch(config: WorkerConfig): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    console.log('[CaseSummary Worker] Already processing, skipping');
    return;
  }

  isProcessing = true;
  const startTime = Date.now();
  console.log('[CaseSummary Worker] Processing batch...');

  try {
    // 1. Process stale summaries first
    const staleSummaries = await caseSummaryService.getStaleSummaries(config.batchSize);
    console.log(`[CaseSummary Worker] Found ${staleSummaries.length} stale summaries`);

    for (const summary of staleSummaries) {
      try {
        await caseSummaryService.generateSummary(summary.caseId, summary.case.firmId);
        metrics.successCount++;
      } catch (error) {
        console.error(`[CaseSummary Worker] Error processing stale summary ${summary.id}:`, error);
        metrics.errorCount++;
      }
      metrics.totalProcessed++;

      // Small delay between summaries to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 2. Generate summaries for new cases (if enabled and we have capacity)
    if (config.enableNewCaseSummaries && staleSummaries.length < config.batchSize) {
      const remainingCapacity = config.batchSize - staleSummaries.length;

      // Get all firms to process new cases across all firms
      const firms = await prisma.firm.findMany({
        select: { id: true },
      });

      for (const firm of firms) {
        const casesWithoutSummary = await caseSummaryService.getCasesWithoutSummary(
          firm.id,
          Math.ceil(remainingCapacity / firms.length)
        );

        console.log(
          `[CaseSummary Worker] Found ${casesWithoutSummary.length} cases without summary in firm ${firm.id}`
        );

        for (const caseData of casesWithoutSummary) {
          try {
            await caseSummaryService.generateSummary(caseData.id, caseData.firmId);
            metrics.successCount++;
          } catch (error) {
            console.error(
              `[CaseSummary Worker] Error generating summary for case ${caseData.id}:`,
              error
            );
            metrics.errorCount++;
          }
          metrics.totalProcessed++;

          // Small delay between summaries
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Update metrics
    const processingTime = Date.now() - startTime;
    metrics.avgProcessingTimeMs =
      (metrics.avgProcessingTimeMs * (metrics.totalProcessed - 1) + processingTime) /
        metrics.totalProcessed || processingTime;
    metrics.lastRunAt = new Date();

    console.log(
      `[CaseSummary Worker] Batch complete: ${metrics.totalProcessed} total, ${metrics.successCount} success, ${metrics.errorCount} errors`
    );
  } catch (error) {
    console.error('[CaseSummary Worker] Batch processing error:', error);
    metrics.errorCount++;
  } finally {
    isProcessing = false;
  }
}

// ============================================================================
// Manual Trigger
// ============================================================================

export async function triggerSummaryGeneration(caseId: string, firmId: string): Promise<boolean> {
  try {
    await caseSummaryService.generateSummary(caseId, firmId);
    return true;
  } catch (error) {
    console.error(`[CaseSummary Worker] Manual trigger failed for case ${caseId}:`, error);
    return false;
  }
}

export async function markCaseSummaryStale(caseId: string): Promise<void> {
  await caseSummaryService.markSummaryStale(caseId);
}
