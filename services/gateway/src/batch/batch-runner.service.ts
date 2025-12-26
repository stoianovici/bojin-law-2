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
import type { BatchProcessor, BatchProcessorResult } from './batch-processor.interface';

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
// Batch Runner Service
// ============================================================================

export class BatchRunnerService {
  private processors: Map<string, BatchProcessor> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private isSchedulerRunning = false;

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
      await aiClient.completeBatchJob(batchJobId, {
        status,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
        totalTokens: result.totalTokens,
        totalCostEur: result.totalCost,
        errorMessage:
          result.errors && result.errors.length > 0
            ? result.errors.slice(0, 10).join('; ') // Limit error message length
            : undefined,
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

    console.log('[BatchRunner] Starting scheduler...');

    // Get all firms
    const firms = await prisma.firm.findMany({
      select: { id: true, name: true },
    });

    for (const firm of firms) {
      await this.scheduleForFirm(firm.id);
    }

    this.isSchedulerRunning = true;
    console.log(`[BatchRunner] Scheduler started with ${this.scheduledTasks.size} scheduled tasks`);

    // Run on startup if requested
    if (options.runOnStartup) {
      console.log('[BatchRunner] Running all processors on startup...');
      for (const firm of firms) {
        await this.runAllForFirm(firm.id);
      }
    }
  }

  /**
   * Stop cron scheduler
   */
  stopScheduler(): void {
    if (!this.isSchedulerRunning) {
      return;
    }

    console.log('[BatchRunner] Stopping scheduler...');

    for (const [key, task] of this.scheduledTasks) {
      task.stop();
      console.log(`[BatchRunner] Stopped task: ${key}`);
    }
    this.scheduledTasks.clear();

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

      // Create scheduled task
      const task = cron.schedule(
        config.schedule,
        async () => {
          console.log(`[BatchRunner] Cron triggered: ${config.feature} for firm ${firmId}`);
          try {
            await this.runProcessor(firmId, config.feature);
          } catch (error) {
            console.error(`[BatchRunner] Cron execution failed for ${config.feature}:`, error);
          }
        },
        {
          timezone: 'Europe/Bucharest', // Romanian timezone
        }
      );

      this.scheduledTasks.set(taskKey, task);
      console.log(
        `[BatchRunner] Scheduled ${config.feature} for firm ${firmId}: ${config.schedule}`
      );
    }
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
}

// ============================================================================
// Singleton Export
// ============================================================================

export const batchRunner = new BatchRunnerService();

// Auto-register processors
// Import done here to avoid circular dependency issues
import {
  searchIndexProcessor,
  morningBriefingsProcessor,
  caseHealthProcessor,
  threadSummariesProcessor,
  caseContextProcessor,
} from './processors';

batchRunner.registerProcessor(searchIndexProcessor);
batchRunner.registerProcessor(morningBriefingsProcessor);
batchRunner.registerProcessor(caseHealthProcessor);
batchRunner.registerProcessor(threadSummariesProcessor);
batchRunner.registerProcessor(caseContextProcessor);
