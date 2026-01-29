/**
 * Anthropic Batch API Service
 * OPS-XXX: Anthropic Batch API Integration
 *
 * Wraps Anthropic's Message Batches API for cost-effective batch processing.
 * Provides 50% cost savings for non-time-critical AI operations.
 *
 * Features:
 * - Submit batches of requests to Anthropic
 * - Poll for completion with adaptive intervals
 * - Stream results as JSONL
 * - Calculate discounted costs
 *
 * @see https://docs.anthropic.com/en/api/creating-message-batches
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { prisma } from '@legal-platform/database';
import { Decimal } from '@prisma/client/runtime/library';
import type { BatchableRequest, BatchableResult } from '../batch/batch-processor.interface';
import { calculateCostEur, DEFAULT_MODEL } from './ai-client.service';
import logger from '../utils/logger';

// ============================================================================
// Zod Schemas for Anthropic API Response Validation
// ============================================================================

/**
 * Schema for validating Anthropic Batch API status responses.
 * Ensures we catch API changes or malformed responses early.
 */
const AnthropicBatchStatusSchema = z.object({
  id: z.string(),
  type: z.literal('message_batch'),
  processing_status: z.enum(['in_progress', 'ended']),
  request_counts: z.object({
    processing: z.number(),
    succeeded: z.number(),
    errored: z.number(),
    canceled: z.number(),
    expired: z.number(),
  }),
  ended_at: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  cancel_initiated_at: z.string().nullable(),
  results_url: z.string().nullable(),
});

/**
 * Schema for validating individual batch result items.
 */
const AnthropicBatchResultItemSchema = z.object({
  custom_id: z.string(),
  result: z.object({
    type: z.enum(['succeeded', 'errored', 'canceled', 'expired']),
    message: z
      .object({
        content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
        usage: z.object({
          input_tokens: z.number(),
          output_tokens: z.number(),
        }),
      })
      .optional(),
    error: z
      .object({
        type: z.string(),
        message: z.string(),
      })
      .optional(),
  }),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Anthropic Batch API status response.
 * Type inferred from Zod schema for consistency.
 */
type AnthropicBatchStatus = z.infer<typeof AnthropicBatchStatusSchema>;

/**
 * Single result from the JSONL results file.
 * Type inferred from Zod schema for consistency.
 */
type AnthropicBatchResultItem = z.infer<typeof AnthropicBatchResultItemSchema>;

/**
 * Options for waiting for batch completion
 */
export interface WaitForCompletionOptions {
  /** Initial polling interval in ms (default: 30000) */
  initialIntervalMs?: number;
  /** Maximum polling interval in ms (default: 120000) */
  maxIntervalMs?: number;
  /** Maximum time to wait in ms (default: 4 hours) */
  maxDurationMs?: number;
  /** Callback for progress updates */
  onProgress?: (status: AnthropicBatchStatus) => void;
}

/**
 * Result from batch submission
 */
export interface BatchSubmissionResult {
  anthropicBatchId: string;
  requestCount: number;
}

/**
 * Aggregated results from a completed batch
 */
export interface BatchCompletionResult {
  results: BatchableResult[];
  totalInputTokens: number;
  totalOutputTokens: number;
  succeeded: number;
  errored: number;
  expired: number;
  canceled: number;
  baseCostEur: number;
  discountedCostEur: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Batch API discount rate (50% off) */
const BATCH_DISCOUNT_RATE = 0.5;

/** Default polling configuration */
const DEFAULT_INITIAL_INTERVAL_MS = 30_000; // 30 seconds
const DEFAULT_MAX_INTERVAL_MS = 120_000; // 2 minutes
const DEFAULT_MAX_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

// ============================================================================
// Service
// ============================================================================

export class AnthropicBatchService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  // ============================================================================
  // Batch Submission
  // ============================================================================

  /**
   * Submit a batch of requests to Anthropic Batch API.
   *
   * Creates request records in the database and submits to Anthropic.
   *
   * @param requests - Array of BatchableRequest objects
   * @param model - Model to use for all requests
   * @param batchJobId - Internal batch job ID for tracking
   * @returns Anthropic batch ID and request count
   */
  async submitBatch(
    requests: BatchableRequest[],
    model: string,
    batchJobId: string
  ): Promise<BatchSubmissionResult> {
    if (requests.length === 0) {
      throw new Error('Cannot submit empty batch');
    }

    if (requests.length > 10_000) {
      throw new Error('Batch size exceeds Anthropic limit of 10,000 requests');
    }

    // Validate customId uniqueness and format
    const customIds = new Set<string>();
    for (const req of requests) {
      // Check uniqueness
      if (customIds.has(req.customId)) {
        throw new Error(`Duplicate customId: ${req.customId}`);
      }
      // Check length limit (Anthropic requires <= 64 chars)
      if (req.customId.length > 64) {
        throw new Error(`customId exceeds 64 char limit: ${req.customId}`);
      }
      // Check format: must be "entityType:entityId"
      if (!req.customId.includes(':')) {
        throw new Error(`customId must be in format 'entityType:entityId': ${req.customId}`);
      }
      customIds.add(req.customId);
    }

    // Estimate tokens for safety limit check (rough estimate: 4 chars ≈ 1 token)
    const estimatedTokens = requests.reduce((sum, req) => {
      const promptTokens = Math.ceil((req.prompt.length + (req.system?.length || 0)) / 4);
      const maxOutputTokens = req.maxTokens || 1024;
      return sum + promptTokens + maxOutputTokens;
    }, 0);

    // Safety limit: 10M tokens per batch
    const MAX_BATCH_TOKENS = 10_000_000;
    if (estimatedTokens > MAX_BATCH_TOKENS) {
      throw new Error(
        `Estimated token count (${estimatedTokens.toLocaleString()}) exceeds safety limit (${MAX_BATCH_TOKENS.toLocaleString()})`
      );
    }

    logger.info('Submitting batch to Anthropic', {
      requestCount: requests.length,
      model,
      batchJobId,
      estimatedTokens,
    });

    // Build Anthropic batch request format
    const batchRequests = requests.map((req) => ({
      custom_id: req.customId,
      params: {
        model: model || DEFAULT_MODEL,
        max_tokens: req.maxTokens || 1024,
        temperature: req.temperature ?? 0.3,
        messages: [{ role: 'user' as const, content: req.prompt }],
        ...(req.system && { system: req.system }),
      },
    }));

    // Submit to Anthropic
    const batch = await this.anthropic.messages.batches.create({
      requests: batchRequests,
    });

    logger.info('Batch submitted to Anthropic', {
      anthropicBatchId: batch.id,
      requestCount: requests.length,
      batchJobId,
    });

    // Create request records in database
    await prisma.aIBatchRequest.createMany({
      data: requests.map((req) => ({
        batchJobId,
        customId: req.customId,
        entityType: req.entityType,
        entityId: req.entityId,
        status: 'pending',
      })),
    });

    // Update batch job with Anthropic batch ID
    await prisma.aIBatchJobRun.update({
      where: { id: batchJobId },
      data: {
        anthropicBatchId: batch.id,
        batchMode: 'async_batch',
        itemsSubmitted: requests.length,
      },
    });

    return {
      anthropicBatchId: batch.id,
      requestCount: requests.length,
    };
  }

  // ============================================================================
  // Polling
  // ============================================================================

  /**
   * Get current status of a batch.
   *
   * @param anthropicBatchId - Anthropic batch ID
   * @returns Current batch status
   */
  async getBatchStatus(anthropicBatchId: string): Promise<AnthropicBatchStatus> {
    const batch = await this.anthropic.messages.batches.retrieve(anthropicBatchId);

    // Validate response against schema
    const parsed = AnthropicBatchStatusSchema.safeParse(batch);
    if (!parsed.success) {
      logger.error('Invalid batch status response from Anthropic API', {
        anthropicBatchId,
        error: parsed.error.message,
      });
      throw new Error(`Invalid batch status response: ${parsed.error.message}`);
    }

    return parsed.data;
  }

  /**
   * Wait for a batch to complete with adaptive polling.
   *
   * Polling strategy:
   * - Start at initialIntervalMs
   * - Double interval on each poll (up to maxIntervalMs)
   * - Poll faster when >90% complete
   * - Timeout after maxDurationMs
   *
   * @param anthropicBatchId - Anthropic batch ID
   * @param options - Polling configuration
   * @returns Final batch status
   */
  async waitForCompletion(
    anthropicBatchId: string,
    options: WaitForCompletionOptions = {}
  ): Promise<AnthropicBatchStatus> {
    const {
      initialIntervalMs = DEFAULT_INITIAL_INTERVAL_MS,
      maxIntervalMs = DEFAULT_MAX_INTERVAL_MS,
      maxDurationMs = DEFAULT_MAX_DURATION_MS,
      onProgress,
    } = options;

    const startTime = Date.now();
    let currentInterval = initialIntervalMs;
    let pollCount = 0;

    logger.info('Starting batch polling', {
      anthropicBatchId,
      initialIntervalMs,
      maxIntervalMs,
      maxDurationMs,
    });

    while (true) {
      pollCount++;
      const elapsed = Date.now() - startTime;

      if (elapsed > maxDurationMs) {
        throw new Error(`Batch polling timeout after ${Math.round(elapsed / 60000)} minutes`);
      }

      const status = await this.getBatchStatus(anthropicBatchId);

      // Calculate progress percentage
      const total =
        status.request_counts.processing +
        status.request_counts.succeeded +
        status.request_counts.errored +
        status.request_counts.canceled +
        status.request_counts.expired;
      const completed =
        status.request_counts.succeeded +
        status.request_counts.errored +
        status.request_counts.canceled +
        status.request_counts.expired;
      const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

      logger.debug('Batch poll', {
        anthropicBatchId,
        pollCount,
        elapsed: `${Math.round(elapsed / 1000)}s`,
        status: status.processing_status,
        progress: `${progressPct}%`,
        counts: status.request_counts,
      });

      // Notify progress callback
      onProgress?.(status);

      // Check if complete
      if (status.processing_status === 'ended') {
        logger.info('Batch completed', {
          anthropicBatchId,
          pollCount,
          elapsed: `${Math.round(elapsed / 1000)}s`,
          succeeded: status.request_counts.succeeded,
          errored: status.request_counts.errored,
        });
        return status;
      }

      // Adaptive interval: poll faster as completion approaches
      if (progressPct >= 90) {
        // Almost done - poll every 10 seconds for quick completion
        currentInterval = Math.min(10_000, initialIntervalMs);
      } else if (progressPct >= 50) {
        // Half done - maintain moderate polling, slightly increase
        currentInterval = Math.min(currentInterval * 1.2, initialIntervalMs * 1.5);
      } else {
        // Early stage - use exponential backoff to reduce API calls
        currentInterval = Math.min(currentInterval * 1.5, maxIntervalMs);
      }

      // Wait before next poll
      await this.sleep(currentInterval);
    }
  }

  // ============================================================================
  // Result Retrieval
  // ============================================================================

  /**
   * Retrieve and process results from a completed batch.
   *
   * Streams the JSONL results file, parses each result, and calculates costs.
   *
   * @param anthropicBatchId - Anthropic batch ID
   * @param model - Model used (for cost calculation)
   * @param batchJobId - Internal batch job ID
   * @returns Aggregated batch results with cost information
   */
  async retrieveResults(
    anthropicBatchId: string,
    model: string,
    batchJobId: string
  ): Promise<BatchCompletionResult> {
    logger.info('Retrieving batch results', { anthropicBatchId, batchJobId });

    // Get batch status to verify completion
    const status = await this.getBatchStatus(anthropicBatchId);
    if (status.processing_status !== 'ended') {
      throw new Error(
        `Batch ${anthropicBatchId} is not complete (status: ${status.processing_status})`
      );
    }

    // Stream results from Anthropic
    const results: BatchableResult[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Collect update data for batch update at the end (ensures atomicity)
    const requestUpdates: Array<{
      customId: string;
      status: string;
      inputTokens?: number;
      outputTokens?: number;
      errorMessage?: string;
    }> = [];

    // Use the SDK's results streaming
    // The results() method returns a Promise<JSONLDecoder>, so we need to await it first
    const resultsStream = await this.anthropic.messages.batches.results(anthropicBatchId);
    for await (const result of resultsStream) {
      // Validate result item against schema
      const parsed = AnthropicBatchResultItemSchema.safeParse(result);
      if (!parsed.success) {
        logger.warn('Invalid batch result item, skipping', {
          anthropicBatchId,
          error: parsed.error.message,
          rawResult: JSON.stringify(result).substring(0, 200),
        });
        continue;
      }
      const item = parsed.data;
      const [entityType, entityId] = this.parseCustomId(item.custom_id);

      const batchableResult: BatchableResult = {
        customId: item.custom_id,
        entityType,
        entityId,
        status: item.result.type,
      };

      if (item.result.type === 'succeeded' && item.result.message) {
        // Extract text content
        const textContent = item.result.message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');

        batchableResult.content = textContent;
        batchableResult.inputTokens = item.result.message.usage.input_tokens;
        batchableResult.outputTokens = item.result.message.usage.output_tokens;

        totalInputTokens += item.result.message.usage.input_tokens;
        totalOutputTokens += item.result.message.usage.output_tokens;
      } else if (item.result.type === 'errored' && item.result.error) {
        batchableResult.error = item.result.error.message;
      }

      results.push(batchableResult);

      // Collect update data (will be applied atomically below)
      requestUpdates.push({
        customId: item.custom_id,
        status: item.result.type,
        inputTokens: batchableResult.inputTokens,
        outputTokens: batchableResult.outputTokens,
        errorMessage: batchableResult.error,
      });
    }

    // Batch update all AIBatchRequest records in a transaction for consistency
    // This ensures either all records are updated or none are
    const processedAt = new Date();
    await prisma.$transaction(
      requestUpdates.map((update) =>
        prisma.aIBatchRequest.update({
          where: {
            batchJobId_customId: {
              batchJobId,
              customId: update.customId,
            },
          },
          data: {
            status: update.status,
            inputTokens: update.inputTokens,
            outputTokens: update.outputTokens,
            errorMessage: update.errorMessage,
            processedAt,
          },
        })
      )
    );

    // Calculate costs
    const baseCostEur = calculateCostEur(model, totalInputTokens, totalOutputTokens);
    const discountedCostEur = baseCostEur * BATCH_DISCOUNT_RATE;
    const discountAmount = baseCostEur - discountedCostEur;

    // Update batch job with results
    await prisma.aIBatchJobRun.update({
      where: { id: batchJobId },
      data: {
        itemsSucceeded: status.request_counts.succeeded,
        itemsErrored: status.request_counts.errored,
        itemsExpired: status.request_counts.expired,
        baseCostEur: new Decimal(baseCostEur),
        discountApplied: new Decimal(discountAmount),
        totalCostEur: new Decimal(discountedCostEur),
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    });

    // Verify result count matches expected
    const expectedCount =
      status.request_counts.succeeded +
      status.request_counts.errored +
      status.request_counts.expired +
      status.request_counts.canceled;

    if (results.length !== expectedCount) {
      logger.warn('Result count mismatch - possible incomplete retrieval', {
        expected: expectedCount,
        received: results.length,
        anthropicBatchId,
        batchJobId,
      });
    }

    logger.info('Batch results retrieved', {
      anthropicBatchId,
      batchJobId,
      resultCount: results.length,
      expectedCount,
      succeeded: status.request_counts.succeeded,
      errored: status.request_counts.errored,
      baseCostEur: baseCostEur.toFixed(4),
      discountedCostEur: discountedCostEur.toFixed(4),
      savings: `${Math.round((1 - BATCH_DISCOUNT_RATE) * 100)}%`,
    });

    return {
      results,
      totalInputTokens,
      totalOutputTokens,
      succeeded: status.request_counts.succeeded,
      errored: status.request_counts.errored,
      expired: status.request_counts.expired,
      canceled: status.request_counts.canceled,
      baseCostEur,
      discountedCostEur,
    };
  }

  // ============================================================================
  // Batch Management
  // ============================================================================

  /**
   * Cancel a running batch.
   *
   * @param anthropicBatchId - Anthropic batch ID to cancel
   */
  async cancelBatch(anthropicBatchId: string): Promise<void> {
    logger.info('Canceling batch', { anthropicBatchId });
    await this.anthropic.messages.batches.cancel(anthropicBatchId);
  }

  /**
   * List recent batches for debugging.
   *
   * @param limit - Maximum number of batches to return
   * @returns Array of batch statuses
   */
  async listBatches(limit = 10): Promise<AnthropicBatchStatus[]> {
    const response = await this.anthropic.messages.batches.list({ limit });
    return response.data as unknown as AnthropicBatchStatus[];
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Parse customId back into entityType and entityId.
   * Format: "entityType:entityId"
   *
   * @throws Error if customId format is invalid
   */
  private parseCustomId(customId: string): [string, string] {
    const colonIndex = customId.indexOf(':');
    if (colonIndex === -1) {
      logger.error('Invalid customId format - missing colon', { customId });
      throw new Error(`Invalid customId format (missing colon): ${customId}`);
    }
    const entityType = customId.substring(0, colonIndex);
    const entityId = customId.substring(colonIndex + 1);
    if (!entityType || !entityId) {
      logger.error('Invalid customId format - empty parts', { customId, entityType, entityId });
      throw new Error(`Invalid customId format (empty parts): ${customId}`);
    }
    return [entityType, entityId];
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const anthropicBatchService = new AnthropicBatchService();
