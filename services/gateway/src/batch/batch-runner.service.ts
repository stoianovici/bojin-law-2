/**
 * Batch Runner Service
 * OPS-236: Batch Job Runner Framework
 *
 * Orchestrates batch processor execution with:
 * - Feature enable checks
 * - Job lifecycle management (create, update, complete)
 * - Error handling with partial success support
 * - Cron-based scheduling
 */

import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { prisma } from '@legal-platform/database';
import type { AIBatchJobRun } from '@prisma/client';
import { aiClient } from '../services/ai-client.service';
import { aiFeatureConfigService, type AIFeatureKey } from '../services/ai-feature-config.service';
import type {
  BatchProcessor,
  BatchProcessorResult,
  BatchableProcessor,
} from './batch-processor.interface';
import { isBatchableProcessor } from './batch-processor.interface';
import {
  anthropicBatchService,
  type WaitForCompletionOptions,
} from '../services/anthropic-batch.service';
import { getModelForFeature } from '../services/ai-client.service';
import { batchMetrics } from './batch-metrics';
import { formatBatchErrors } from './batch-utils';

// ============================================================================
// Types
// ============================================================================

export interface BatchRunResult {
  job: AIBatchJobRun;
  result?: BatchProcessorResult;
  error?: string;
}

export interface SchedulerOptions {
  /** If true, run all processors immediately on startup */
  runOnStartup?: boolean;
}

// ============================================================================
// Retry Configuration
// ============================================================================

/** Maximum number of retries for transient failures */
const MAX_RETRIES = 3;

/** Retry delays in ms: 1min, 5min, 15min */
const RETRY_DELAYS = [60_000, 300_000, 900_000];

/**
 * Check if an error is transient and should be retried.
 * Transient errors are typically network issues or lock timeouts.
 */
function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('deadlock') ||
    msg.includes('lock wait timeout') ||
    msg.includes('connection') ||
    msg.includes('timeout')
  );
}

// ============================================================================
// Batch Runner Service
// ============================================================================

export class BatchRunnerService {
  private processors: Map<string, BatchProcessor> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private isSchedulerRunning = false;
  // Track active Anthropic batches for cancellation on shutdown
  // Map: batchJobId -> anthropicBatchId
  private activeBatches: Map<string, string> = new Map();

  // ============================================================================
  // Processor Registration
  // ============================================================================

  /**
   * Register a batch processor
   * Call this at startup for each processor
   */
  registerProcessor(processor: BatchProcessor): void {
    if (this.processors.has(processor.feature)) {
      console.warn(
        `[BatchRunner] Processor for feature '${processor.feature}' already registered, replacing`
      );
    }
    this.processors.set(processor.feature, processor);
    console.log(`[BatchRunner] Registered processor: ${processor.name} (${processor.feature})`);
  }

  /**
   * Get registered processor by feature
   */
  getProcessor(feature: string): BatchProcessor | undefined {
    return this.processors.get(feature);
  }

  /**
   * Get all registered processors
   */
  getAllProcessors(): BatchProcessor[] {
    return Array.from(this.processors.values());
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Run a specific processor for a firm
   *
   * This method:
   * 1. Checks if feature is enabled
   * 2. Creates a batch job record
   * 3. Executes the processor
   * 4. Updates job with results
   *
   * @param firmId - Firm to process
   * @param feature - Feature key (must match a registered processor)
   * @param onProgress - Optional progress callback
   * @returns Job record and result
   */
  async runProcessor(
    firmId: string,
    feature: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<BatchRunResult> {
    const processor = this.processors.get(feature);
    if (!processor) {
      throw new Error(`No processor registered for feature: ${feature}`);
    }

    // Check if feature is enabled
    const isEnabled = await aiFeatureConfigService.isFeatureEnabled(
      firmId,
      feature as AIFeatureKey
    );
    if (!isEnabled) {
      console.log(`[BatchRunner] Feature '${feature}' is disabled for firm ${firmId}, skipping`);
      // Return a skipped job record
      const job = await this.createSkippedJob(firmId, feature);
      return { job };
    }

    // Start batch job
    const batchJobId = await aiClient.startBatchJob(firmId, feature);
    console.log(`[BatchRunner] Started job ${batchJobId} for ${processor.name} (firm: ${firmId})`);

    try {
      // Execute processor
      const result = await processor.process({
        firmId,
        batchJobId,
        onProgress,
      });

      // Determine status
      const status = this.determineStatus(result);

      // Complete job
      const errorMessage = formatBatchErrors(result.errors || []);

      await aiClient.completeBatchJob(batchJobId, {
        status,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
        totalTokens: result.totalTokens,
        totalCostEur: result.totalCost,
        errorMessage,
      });

      console.log(
        `[BatchRunner] Completed job ${batchJobId}: ${result.itemsProcessed} processed, ${result.itemsFailed} failed`
      );

      const job = await this.getJob(batchJobId);
      return { job: job!, result };
    } catch (error) {
      // Mark job as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await aiClient.completeBatchJob(batchJobId, {
        status: 'failed',
        itemsProcessed: 0,
        itemsFailed: 0,
        totalTokens: 0,
        totalCostEur: 0,
        errorMessage,
      });

      console.error(`[BatchRunner] Job ${batchJobId} failed:`, errorMessage);

      const job = await this.getJob(batchJobId);
      return { job: job!, error: errorMessage };
    }
  }

  /**
   * Run all enabled processors for a firm
   *
   * Processors run sequentially to avoid overloading the API
   *
   * @param firmId - Firm to process
   * @returns Array of results for each processor
   */
  async runAllForFirm(firmId: string): Promise<BatchRunResult[]> {
    const results: BatchRunResult[] = [];

    for (const processor of this.processors.values()) {
      try {
        const result = await this.runProcessor(firmId, processor.feature);
        results.push(result);
      } catch (error) {
        console.error(`[BatchRunner] Error running ${processor.name} for firm ${firmId}:`, error);
        // Continue with other processors
      }
    }

    return results;
  }

  // ============================================================================
  // Batch API Execution (50% Cost Savings)
  // ============================================================================

  /**
   * Run a batchable processor using Anthropic Batch API.
   *
   * This method provides 50% cost savings by using Anthropic's Batch API
   * for processors that implement BatchableProcessor interface.
   *
   * Flow:
   * 1. Check if feature is enabled
   * 2. Call processor.prepareBatchRequests() to collect all requests
   * 3. If count >= minBatchSize, use Batch API
   * 4. Otherwise, fall back to sync mode (regular process())
   * 5. For batch mode:
   *    - Submit to Anthropic Batch API
   *    - Wait for completion with polling
   *    - Retrieve results
   *    - Call processor.processBatchResult() for each result
   *
   * @param firmId - Firm to process
   * @param feature - Feature key (must match a batchable processor)
   * @param onProgress - Optional progress callback
   * @returns Job record and result
   */
  async runBatchableProcessor(
    firmId: string,
    feature: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<BatchRunResult> {
    const processor = this.processors.get(feature);
    if (!processor) {
      throw new Error(`No processor registered for feature: ${feature}`);
    }

    // Check if processor supports batch mode
    if (!isBatchableProcessor(processor)) {
      console.log(
        `[BatchRunner] Processor '${feature}' does not support batch mode, using sync mode`
      );
      return this.runProcessor(firmId, feature, onProgress);
    }

    // Check if feature is enabled
    const isEnabled = await aiFeatureConfigService.isFeatureEnabled(
      firmId,
      feature as AIFeatureKey
    );
    if (!isEnabled) {
      console.log(`[BatchRunner] Feature '${feature}' is disabled for firm ${firmId}, skipping`);
      const job = await this.createSkippedJob(firmId, feature);
      return { job };
    }

    // Start batch job
    const batchJobId = await aiClient.startBatchJob(firmId, feature);
    const startTime = Date.now();
    batchMetrics.recordJobStart(feature);

    console.log(
      `[BatchRunner] Started batchable job ${batchJobId} for ${processor.name} (firm: ${firmId})`
    );

    try {
      // Phase 1: Prepare requests
      console.log(`[BatchRunner] Preparing batch requests for ${processor.name}...`);
      const requests = await processor.prepareBatchRequests({
        firmId,
        batchJobId,
        onProgress,
      });

      console.log(`[BatchRunner] Prepared ${requests.length} requests for batch submission`);

      // Check if we should use batch mode or sync mode
      const { minBatchSize, forceSyncMode, maxBatchSize } = processor.batchConfig;

      if (forceSyncMode || requests.length < minBatchSize) {
        console.log(
          `[BatchRunner] Using sync mode (requests: ${requests.length}, minBatchSize: ${minBatchSize}, forceSyncMode: ${forceSyncMode})`
        );

        // Update job to indicate sync mode
        await prisma.aIBatchJobRun.update({
          where: { id: batchJobId },
          data: { batchMode: 'sync' },
        });

        // Execute sync processing with the EXISTING job (not creating a new one)
        try {
          const result = await processor.process({
            firmId,
            batchJobId,
            onProgress,
          });

          // Determine status and complete job
          const status = this.determineStatus(result);
          const errorMessage = formatBatchErrors(result.errors || []);

          await aiClient.completeBatchJob(batchJobId, {
            status,
            itemsProcessed: result.itemsProcessed,
            itemsFailed: result.itemsFailed,
            totalTokens: result.totalTokens,
            totalCostEur: result.totalCost,
            errorMessage,
          });

          // Record metrics
          const durationSeconds = (Date.now() - startTime) / 1000;
          batchMetrics.recordJobCompletion({
            feature,
            mode: 'sync',
            status,
            durationSeconds,
            itemsSucceeded: result.itemsProcessed,
            itemsFailed: result.itemsFailed,
            costEur: result.totalCost,
            inputTokens: result.totalTokens, // Sync mode doesn't separate input/output
            outputTokens: 0,
          });
          batchMetrics.recordJobEnd(feature);

          console.log(
            `[BatchRunner] Sync job completed: ${result.itemsProcessed} processed, ${result.itemsFailed} failed`
          );

          const job = await this.getJob(batchJobId);
          return { job: job!, result };
        } catch (error) {
          // Mark job as failed
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await aiClient.completeBatchJob(batchJobId, {
            status: 'failed',
            itemsProcessed: 0,
            itemsFailed: 0,
            totalTokens: 0,
            totalCostEur: 0,
            errorMessage,
          });

          // Record failure metrics
          const durationSeconds = (Date.now() - startTime) / 1000;
          batchMetrics.recordJobCompletion({
            feature,
            mode: 'sync',
            status: 'failed',
            durationSeconds,
            itemsSucceeded: 0,
            itemsFailed: 0,
            costEur: 0,
            inputTokens: 0,
            outputTokens: 0,
          });
          batchMetrics.recordJobEnd(feature);

          console.error(`[BatchRunner] Sync job ${batchJobId} failed:`, errorMessage);

          const job = await this.getJob(batchJobId);
          return { job: job!, error: errorMessage };
        }
      }

      // Truncate to maxBatchSize if needed
      const batchRequests = requests.slice(0, maxBatchSize);
      if (requests.length > maxBatchSize) {
        console.warn(
          `[BatchRunner] Truncating batch from ${requests.length} to ${maxBatchSize} requests`
        );
      }

      // Phase 2: Submit to Anthropic Batch API
      const model = await getModelForFeature(firmId, feature);
      console.log(
        `[BatchRunner] Submitting ${batchRequests.length} requests to Anthropic Batch API (model: ${model})`
      );

      const { anthropicBatchId } = await anthropicBatchService.submitBatch(
        batchRequests,
        model,
        batchJobId
      );

      // Track active batch for cancellation on shutdown
      this.activeBatches.set(batchJobId, anthropicBatchId);

      console.log(`[BatchRunner] Batch submitted: ${anthropicBatchId}`);

      // Phase 3: Wait for completion
      const pollingOptions: WaitForCompletionOptions = {
        initialIntervalMs: processor.batchConfig.pollingIntervalMs,
        maxDurationMs: processor.batchConfig.maxPollingDurationMs,
        onProgress: (status) => {
          const completed =
            status.request_counts.succeeded +
            status.request_counts.errored +
            status.request_counts.expired;
          const total = batchRequests.length;
          console.log(
            `[BatchRunner] Batch progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`
          );
          onProgress?.(completed, total);
        },
      };

      console.log(`[BatchRunner] Waiting for batch completion...`);
      await anthropicBatchService.waitForCompletion(anthropicBatchId, pollingOptions);

      // Phase 4: Retrieve and process results
      console.log(`[BatchRunner] Retrieving batch results...`);
      const completionResult = await anthropicBatchService.retrieveResults(
        anthropicBatchId,
        model,
        batchJobId
      );

      // Phase 5: Process results in chunks to avoid transaction timeouts
      console.log(`[BatchRunner] Processing ${completionResult.results.length} results...`);
      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process results in chunks with separate transactions
      const CHUNK_SIZE = 100;
      const chunks = this.chunkArray(completionResult.results, CHUNK_SIZE);
      console.log(
        `[BatchRunner] Processing ${completionResult.results.length} results in ${chunks.length} chunk(s)`
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // 5 min max per chunk (500ms base + 500ms per item)
        const chunkTimeout = Math.min(500 + chunk.length * 500, 5 * 60 * 1000);

        await prisma.$transaction(
          async (tx) => {
            for (const result of chunk) {
              try {
                if (result.status === 'succeeded') {
                  await processor.processBatchResult(result, {
                    firmId,
                    batchJobId,
                    onProgress,
                    prisma: tx, // Pass transaction client for atomic operations
                  });
                  processedCount++;
                } else {
                  failedCount++;
                  errors.push(
                    `${result.entityType}:${result.entityId}: ${result.error || result.status}`
                  );
                }
              } catch (error) {
                failedCount++;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`${result.entityType}:${result.entityId}: ${errorMsg}`);
                console.error(
                  `[BatchRunner] Failed to process result for ${result.customId}:`,
                  errorMsg
                );

                // Track retry counts for transient errors
                if (isTransientError(error)) {
                  try {
                    const request = await tx.aIBatchRequest.findFirst({
                      where: { batchJobId, customId: result.customId },
                    });
                    if (request && request.retryCount < MAX_RETRIES) {
                      await tx.aIBatchRequest.update({
                        where: { id: request.id },
                        data: {
                          retryCount: { increment: 1 },
                          lastRetryAt: new Date(),
                          errorMessage: `Transient error (retry ${request.retryCount + 1}/${MAX_RETRIES}): ${errorMsg}`,
                        },
                      });
                      console.log(
                        `[BatchRunner] Transient error for ${result.customId}, retry ${request.retryCount + 1}/${MAX_RETRIES} scheduled`
                      );
                    }
                  } catch (retryError) {
                    // Don't fail the whole chunk if retry tracking fails
                    console.warn(
                      `[BatchRunner] Failed to track retry for ${result.customId}:`,
                      retryError
                    );
                  }
                }
              }
            }
          },
          { timeout: chunkTimeout }
        );

        console.log(
          `[BatchRunner] Processed chunk ${i + 1}/${chunks.length} (${processedCount} succeeded, ${failedCount} failed)`
        );
      }

      // Phase 6: Complete the job
      const status = this.determineStatus({
        itemsProcessed: processedCount,
        itemsFailed: failedCount,
        totalTokens: completionResult.totalInputTokens + completionResult.totalOutputTokens,
        totalCost: completionResult.discountedCostEur,
        errors: errors.length > 0 ? errors : undefined,
      });

      const batchErrorMessage = formatBatchErrors(errors);

      await aiClient.completeBatchJob(batchJobId, {
        status,
        itemsProcessed: processedCount,
        itemsFailed: failedCount,
        totalTokens: completionResult.totalInputTokens + completionResult.totalOutputTokens,
        totalCostEur: completionResult.discountedCostEur,
        errorMessage: batchErrorMessage,
      });

      console.log(
        `[BatchRunner] Batch job completed: ${processedCount} processed, ${failedCount} failed, ` +
          `cost: €${completionResult.discountedCostEur.toFixed(4)} (saved €${(completionResult.baseCostEur - completionResult.discountedCostEur).toFixed(4)})`
      );

      // Remove from active batches tracking
      this.activeBatches.delete(batchJobId);

      // Clear processor cache for this job if supported
      if ('clearCacheForJob' in processor && typeof processor.clearCacheForJob === 'function') {
        processor.clearCacheForJob(batchJobId);
      }

      // Record metrics
      const durationSeconds = (Date.now() - startTime) / 1000;
      batchMetrics.recordJobCompletion({
        feature,
        mode: 'async_batch',
        status,
        durationSeconds,
        itemsSucceeded: processedCount,
        itemsFailed: failedCount,
        costEur: completionResult.discountedCostEur,
        inputTokens: completionResult.totalInputTokens,
        outputTokens: completionResult.totalOutputTokens,
      });
      batchMetrics.recordJobEnd(feature);

      const job = await this.getJob(batchJobId);
      return {
        job: job!,
        result: {
          itemsProcessed: processedCount,
          itemsFailed: failedCount,
          totalTokens: completionResult.totalInputTokens + completionResult.totalOutputTokens,
          totalCost: completionResult.discountedCostEur,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      // Mark job as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await aiClient.completeBatchJob(batchJobId, {
        status: 'failed',
        itemsProcessed: 0,
        itemsFailed: 0,
        totalTokens: 0,
        totalCostEur: 0,
        errorMessage,
      });

      // Remove from active batches tracking
      this.activeBatches.delete(batchJobId);

      // Record failure metrics
      const durationSeconds = (Date.now() - startTime) / 1000;
      batchMetrics.recordJobCompletion({
        feature,
        mode: 'async_batch',
        status: 'failed',
        durationSeconds,
        itemsSucceeded: 0,
        itemsFailed: 0,
        costEur: 0,
        inputTokens: 0,
        outputTokens: 0,
      });
      batchMetrics.recordJobEnd(feature);

      console.error(`[BatchRunner] Batch job ${batchJobId} failed:`, errorMessage);

      const job = await this.getJob(batchJobId);
      return { job: job!, error: errorMessage };
    }
  }

  // ============================================================================
  // Scheduling
  // ============================================================================

  /**
   * Start cron scheduler for all firms
   *
   * Reads schedules from AIFeatureConfig and creates cron jobs
   * for each enabled batch feature per firm.
   */
  async startScheduler(options: SchedulerOptions = {}): Promise<void> {
    if (this.isSchedulerRunning) {
      console.warn('[BatchRunner] Scheduler already running');
      return;
    }

    console.log('============================================================');
    console.log('[BatchRunner] Starting scheduler...');
    console.log(`[BatchRunner] Registered processors: ${this.processors.size}`);
    for (const processor of this.processors.values()) {
      console.log(`  - ${processor.name} (${processor.feature})`);
    }

    // Get all firms
    const firms = await prisma.firm.findMany({
      select: { id: true, name: true },
    });
    console.log(`[BatchRunner] Found ${firms.length} firm(s)`);

    for (const firm of firms) {
      console.log(`[BatchRunner] Scheduling for firm: ${firm.name} (${firm.id})`);
      await this.scheduleForFirm(firm.id);
    }

    this.isSchedulerRunning = true;
    console.log(`[BatchRunner] Scheduler started with ${this.scheduledTasks.size} scheduled tasks`);
    console.log(`[BatchRunner] runOnStartup: ${options.runOnStartup ? 'enabled' : 'disabled'}`);
    console.log('============================================================');

    // Run on startup if requested
    if (options.runOnStartup) {
      console.log('[BatchRunner] Running all processors on startup...');
      for (const firm of firms) {
        await this.runAllForFirm(firm.id);
      }
      console.log('[BatchRunner] Startup run complete');
    }
  }

  /**
   * Stop cron scheduler and cancel active batches
   */
  async stopScheduler(): Promise<void> {
    if (!this.isSchedulerRunning) {
      return;
    }

    console.log('[BatchRunner] Stopping scheduler...');

    for (const [key, task] of this.scheduledTasks) {
      task.stop();
      console.log(`[BatchRunner] Stopped task: ${key}`);
    }
    this.scheduledTasks.clear();

    // Cancel any active Anthropic batches to avoid wasting API credits
    if (this.activeBatches.size > 0) {
      console.log(`[BatchRunner] Canceling ${this.activeBatches.size} active batch(es)...`);
      for (const [jobId, anthropicId] of this.activeBatches) {
        try {
          await anthropicBatchService.cancelBatch(anthropicId);
          console.log(`[BatchRunner] Canceled batch ${anthropicId} for job ${jobId}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[BatchRunner] Failed to cancel batch ${anthropicId}:`, errorMsg);
        }
      }
      this.activeBatches.clear();
    }

    this.isSchedulerRunning = false;
    console.log('[BatchRunner] Scheduler stopped');
  }

  /**
   * Refresh schedule for a specific firm
   * Call this when feature config is updated
   */
  async refreshScheduleForFirm(firmId: string): Promise<void> {
    // Remove existing schedules for this firm
    for (const [key, task] of this.scheduledTasks) {
      if (key.startsWith(`${firmId}:`)) {
        task.stop();
        this.scheduledTasks.delete(key);
      }
    }

    // Re-schedule
    await this.scheduleForFirm(firmId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set up cron schedules for a firm
   */
  private async scheduleForFirm(firmId: string): Promise<void> {
    const batchFeatures = await aiFeatureConfigService.getBatchFeatures(firmId);

    for (const config of batchFeatures) {
      if (!config.enabled || !config.schedule) {
        continue;
      }

      // Only schedule if we have a processor for this feature
      if (!this.processors.has(config.feature)) {
        continue;
      }

      const taskKey = `${firmId}:${config.feature}`;

      // Validate cron expression
      if (!cron.validate(config.schedule)) {
        console.error(
          `[BatchRunner] Invalid cron expression for ${config.feature}: ${config.schedule}`
        );
        continue;
      }

      // Create scheduled task with jitter to prevent thundering herd
      const task = cron.schedule(
        config.schedule,
        async () => {
          // Add random jitter to prevent all firms running simultaneously
          const jitter = this.getJitteredDelay();
          console.log(
            `[BatchRunner] Cron triggered: ${config.feature} for firm ${firmId}, waiting ${Math.round(jitter / 1000)}s jitter`
          );
          await this.sleep(jitter);

          try {
            // Use batchable processor if available for 50% cost savings
            const processor = this.processors.get(config.feature);
            if (processor && isBatchableProcessor(processor)) {
              await this.runBatchableProcessor(firmId, config.feature);
            } else {
              await this.runProcessor(firmId, config.feature);
            }
          } catch (error) {
            console.error(`[BatchRunner] Cron execution failed for ${config.feature}:`, error);
          }
        },
        {
          timezone: 'Europe/Bucharest', // Romanian timezone
        }
      );

      this.scheduledTasks.set(taskKey, task);
      // Parse cron for human-readable display
      const scheduleDesc = this.parseCronToReadable(config.schedule);
      console.log(`[BatchRunner]   ✓ ${config.feature}: ${scheduleDesc} (${config.schedule})`);
    }
  }

  /**
   * Parse cron expression to human-readable format
   */
  private parseCronToReadable(cronExpr: string): string {
    const parts = cronExpr.split(' ');
    if (parts.length < 5) return cronExpr;

    const [minute, hour, , ,] = parts;
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);

    if (isNaN(hourNum) || isNaN(minuteNum)) return cronExpr;

    const hourStr = hourNum.toString().padStart(2, '0');
    const minuteStr = minuteNum.toString().padStart(2, '0');
    return `daily at ${hourStr}:${minuteStr}`;
  }

  /**
   * Create a job record for skipped (disabled) features
   */
  private async createSkippedJob(firmId: string, feature: string): Promise<AIBatchJobRun> {
    return prisma.aIBatchJobRun.create({
      data: {
        firmId,
        feature,
        status: 'skipped',
        startedAt: new Date(),
        completedAt: new Date(),
        itemsProcessed: 0,
        itemsFailed: 0,
        totalTokens: 0,
        totalCostEur: 0,
        errorMessage: 'Feature is disabled',
      },
    });
  }

  /**
   * Determine job status from result
   */
  private determineStatus(result: BatchProcessorResult): 'completed' | 'failed' | 'partial' {
    if (result.itemsFailed === 0 && result.itemsProcessed > 0) {
      return 'completed';
    }
    if (result.itemsProcessed === 0 && result.itemsFailed > 0) {
      return 'failed';
    }
    if (result.itemsProcessed === 0 && result.itemsFailed === 0) {
      // No items to process - still counts as completed
      return 'completed';
    }
    // Some succeeded, some failed
    return 'partial';
  }

  /**
   * Get job by ID
   */
  private async getJob(jobId: string): Promise<AIBatchJobRun | null> {
    return prisma.aIBatchJobRun.findUnique({
      where: { id: jobId },
    });
  }

  /**
   * Get a random jitter delay to prevent thundering herd.
   * Spreads execution across a 5-minute window.
   */
  private getJitteredDelay(): number {
    // Random delay between 0-5 minutes
    return Math.floor(Math.random() * 5 * 60 * 1000);
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Split an array into chunks of specified size.
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const batchRunner = new BatchRunnerService();

// Processors are registered via initializeBatchProcessors() in batch-init.ts
// Call initializeBatchProcessors() during server startup to avoid circular dependencies
