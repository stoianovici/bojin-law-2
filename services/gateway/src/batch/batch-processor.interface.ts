/**
 * Batch Processor Interface
 * OPS-236: Batch Job Runner Framework
 *
 * Defines the contract for batch processing jobs that run nightly.
 * Each processor handles a specific AI feature (search indexing, briefings, etc.)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Result returned by a batch processor after execution
 */
export interface BatchProcessorResult {
  /** Number of items successfully processed */
  itemsProcessed: number;
  /** Number of items that failed processing */
  itemsFailed: number;
  /** Total input + output tokens used */
  totalTokens: number;
  /** Total cost in EUR */
  totalCost: number;
  /** Error messages for failed items (optional) */
  errors?: string[];
}

/**
 * Progress callback for long-running jobs
 */
export type BatchProgressCallback = (processed: number, total: number) => void;

/**
 * Context passed to batch processor
 */
export interface BatchProcessorContext {
  /** ID of the firm being processed */
  firmId: string;
  /** ID of this batch job run (for logging AI calls) */
  batchJobId: string;
  /** Optional progress callback */
  onProgress?: BatchProgressCallback;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Batch Processor Interface
 *
 * Implement this interface to create a new batch job processor.
 * The BatchRunner will handle:
 * - Feature enable check
 * - Job status tracking
 * - Error handling
 * - Scheduling
 *
 * @example
 * ```typescript
 * export class SearchIndexProcessor implements BatchProcessor {
 *   readonly name = 'Search Index Generator';
 *   readonly feature = 'search_index';
 *
 *   async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
 *     const documents = await prisma.document.findMany({
 *       where: { firmId: ctx.firmId }
 *     });
 *
 *     let processed = 0;
 *     let failed = 0;
 *     let totalTokens = 0;
 *     let totalCost = 0;
 *     const errors: string[] = [];
 *
 *     for (const doc of documents) {
 *       try {
 *         const result = await this.indexDocument(doc, ctx.batchJobId);
 *         processed++;
 *         totalTokens += result.inputTokens + result.outputTokens;
 *         totalCost += result.costEur;
 *       } catch (error) {
 *         failed++;
 *         errors.push(`Doc ${doc.id}: ${error.message}`);
 *       }
 *       ctx.onProgress?.(processed + failed, documents.length);
 *     }
 *
 *     return { itemsProcessed: processed, itemsFailed: failed, totalTokens, totalCost, errors };
 *   }
 * }
 * ```
 */
export interface BatchProcessor {
  /** Human-readable name for logs and UI */
  readonly name: string;

  /**
   * Feature key matching AIFeatureConfig.feature
   * Used to check if feature is enabled and for logging
   */
  readonly feature: string;

  /**
   * Process items for a firm
   *
   * The processor is responsible for:
   * 1. Fetching items to process
   * 2. Processing each item (calling AI, updating DB)
   * 3. Tracking processed/failed counts
   * 4. Calling onProgress for long-running jobs
   * 5. Returning aggregate results
   *
   * Errors thrown here will be caught by BatchRunner and logged.
   * For partial failures, return items in the errors array.
   *
   * @param ctx - Processing context with firmId, batchJobId, and optional progress callback
   * @returns Processing result with counts, tokens, cost, and any errors
   */
  process(ctx: BatchProcessorContext): Promise<BatchProcessorResult>;
}
