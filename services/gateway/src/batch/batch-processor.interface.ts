/**
 * Batch Processor Interface
 * OPS-236: Batch Job Runner Framework
 *
 * Defines the contract for batch processing jobs that run nightly.
 * Each processor handles a specific AI feature (search indexing, briefings, etc.)
 *
 * Extended with BatchableProcessor for Anthropic Batch API support.
 * Batch API provides 50% cost savings for non-time-critical operations.
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
  /**
   * Optional Prisma transaction client for transactional processing.
   * When provided, processors should use this instead of the global prisma client
   * to ensure atomic operations within a transaction.
   */
  prisma?:
    | import('@prisma/client').PrismaClient
    | import('@prisma/client').Prisma.TransactionClient;
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

// ============================================================================
// Anthropic Batch API Types
// ============================================================================

/**
 * A single request prepared for Anthropic Batch API submission.
 * Each request maps to one AI completion call.
 */
export interface BatchableRequest {
  /** Unique ID for this request. Format: "entityType:entityId" */
  customId: string;
  /** Type of entity (e.g., 'thread', 'document', 'case') */
  entityType: string;
  /** ID of the entity being processed */
  entityId: string;
  /** The user prompt for Claude */
  prompt: string;
  /** Optional system prompt */
  system?: string;
  /** Max tokens for response (default: 1024) */
  maxTokens?: number;
  /** Temperature for response (default: 0.3) */
  temperature?: number;
}

/**
 * Result from processing a single batch request.
 * Returned after Anthropic processes the batch.
 */
export interface BatchableResult {
  /** The customId from the original request */
  customId: string;
  /** Type of entity */
  entityType: string;
  /** ID of the entity */
  entityId: string;
  /** Processing status */
  status: 'succeeded' | 'errored' | 'canceled' | 'expired';
  /** The AI response content (if succeeded) */
  content?: string;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens used */
  outputTokens?: number;
  /** Error message (if errored) */
  error?: string;
}

/**
 * Configuration for batch processing behavior.
 */
export interface BatchProcessorConfig {
  /** Minimum items needed to use batch mode. Below this, use sync mode. */
  minBatchSize: number;
  /** Maximum items per Anthropic batch (API limit is 10,000) */
  maxBatchSize: number;
  /** Force synchronous mode even if batch threshold is met */
  forceSyncMode?: boolean;
  /** Initial polling interval in milliseconds (default: 30000) */
  pollingIntervalMs?: number;
  /** Maximum time to wait for batch completion in milliseconds (default: 4 hours) */
  maxPollingDurationMs?: number;
}

/**
 * Extended BatchProcessor that supports Anthropic Batch API.
 *
 * Processors implementing this interface can use the Batch API for
 * 50% cost savings. The BatchRunner will:
 * 1. Call prepareBatchRequests() to collect all AI requests
 * 2. Submit them to Anthropic Batch API (if count >= minBatchSize)
 * 3. Wait for completion
 * 4. Call processBatchResult() for each result
 *
 * If count < minBatchSize, falls back to regular process() method.
 */
export interface BatchableProcessor extends BatchProcessor {
  /** Configuration for batch processing */
  readonly batchConfig: BatchProcessorConfig;

  /**
   * Prepare all AI requests for batch submission.
   *
   * This method should:
   * 1. Query for items needing processing
   * 2. Build prompts for each item
   * 3. Return array of BatchableRequest objects
   *
   * This is a read-only phase - no database updates yet.
   *
   * @param ctx - Processing context
   * @returns Array of requests to submit to Anthropic Batch API
   */
  prepareBatchRequests(ctx: BatchProcessorContext): Promise<BatchableRequest[]>;

  /**
   * Process a single result from the batch.
   *
   * This method is called for each completed request. It should:
   * 1. Parse the AI response
   * 2. Update the database with results
   *
   * @param result - The result from Anthropic Batch API
   * @param ctx - Processing context
   */
  processBatchResult(result: BatchableResult, ctx: BatchProcessorContext): Promise<void>;
}

/**
 * Type guard to check if a processor supports batch mode.
 */
export function isBatchableProcessor(p: BatchProcessor): p is BatchableProcessor {
  return (
    'batchConfig' in p &&
    'prepareBatchRequests' in p &&
    'processBatchResult' in p &&
    typeof (p as BatchableProcessor).prepareBatchRequests === 'function' &&
    typeof (p as BatchableProcessor).processBatchResult === 'function'
  );
}
