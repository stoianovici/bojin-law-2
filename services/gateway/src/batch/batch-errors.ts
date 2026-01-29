/**
 * Batch Processing Error Classes
 * OPS-XXX: Batch Processing Remediation
 *
 * Custom error classes for batch processing operations.
 * Provides context-rich errors for debugging and monitoring.
 */

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for batch processing operations.
 * Includes phase information for debugging.
 */
export class BatchProcessingError extends Error {
  constructor(
    message: string,
    /** Processing phase where error occurred */
    public readonly phase: 'prepare' | 'submit' | 'poll' | 'retrieve' | 'process',
    /** Internal batch job ID (if available) */
    public readonly batchJobId?: string,
    /** Anthropic batch ID (if available) */
    public readonly anthropicBatchId?: string,
    /** Original error that caused this error */
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BatchProcessingError';

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BatchProcessingError);
    }
  }

  /**
   * Get a structured object for logging.
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      phase: this.phase,
      batchJobId: this.batchJobId,
      anthropicBatchId: this.anthropicBatchId,
      cause: this.cause?.message,
    };
  }
}

/**
 * Error thrown when batch polling exceeds the maximum duration.
 */
export class BatchTimeoutError extends BatchProcessingError {
  constructor(
    /** Elapsed time in milliseconds */
    public readonly elapsedMs: number,
    /** Maximum allowed duration in milliseconds */
    public readonly maxDurationMs: number,
    /** Anthropic batch ID */
    anthropicBatchId: string,
    /** Internal batch job ID (if available) */
    batchJobId?: string
  ) {
    super(
      `Batch polling timeout after ${Math.round(elapsedMs / 60000)} minutes (max: ${Math.round(maxDurationMs / 60000)} minutes)`,
      'poll',
      batchJobId,
      anthropicBatchId
    );
    this.name = 'BatchTimeoutError';
  }

  override toLogObject(): Record<string, unknown> {
    return {
      ...super.toLogObject(),
      elapsedMs: this.elapsedMs,
      maxDurationMs: this.maxDurationMs,
      elapsedMinutes: Math.round(this.elapsedMs / 60000),
      maxMinutes: Math.round(this.maxDurationMs / 60000),
    };
  }
}

/**
 * Error thrown when batch request validation fails.
 */
export class BatchValidationError extends BatchProcessingError {
  constructor(
    message: string,
    /** List of invalid item identifiers or descriptions */
    public readonly invalidItems: string[],
    /** Internal batch job ID (if available) */
    batchJobId?: string
  ) {
    super(message, 'prepare', batchJobId);
    this.name = 'BatchValidationError';
  }

  override toLogObject(): Record<string, unknown> {
    return {
      ...super.toLogObject(),
      invalidItems: this.invalidItems,
      invalidCount: this.invalidItems.length,
    };
  }
}

/**
 * Error thrown when Anthropic API response validation fails.
 */
export class BatchApiResponseError extends BatchProcessingError {
  constructor(
    message: string,
    /** Raw response snippet (truncated for logging) */
    public readonly responseSnippet: string,
    /** Validation error details */
    public readonly validationError: string,
    phase: 'poll' | 'retrieve',
    anthropicBatchId: string,
    batchJobId?: string
  ) {
    super(message, phase, batchJobId, anthropicBatchId);
    this.name = 'BatchApiResponseError';
  }

  override toLogObject(): Record<string, unknown> {
    return {
      ...super.toLogObject(),
      responseSnippet: this.responseSnippet,
      validationError: this.validationError,
    };
  }
}

/**
 * Error thrown when result processing fails for individual items.
 */
export class BatchResultProcessingError extends BatchProcessingError {
  constructor(
    message: string,
    /** Entity type (e.g., 'document', 'thread') */
    public readonly entityType: string,
    /** Entity ID */
    public readonly entityId: string,
    /** Original error that caused this error */
    cause?: Error,
    batchJobId?: string,
    anthropicBatchId?: string
  ) {
    super(message, 'process', batchJobId, anthropicBatchId, cause);
    this.name = 'BatchResultProcessingError';
  }

  override toLogObject(): Record<string, unknown> {
    return {
      ...super.toLogObject(),
      entityType: this.entityType,
      entityId: this.entityId,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a BatchProcessingError or subclass.
 */
export function isBatchProcessingError(error: unknown): error is BatchProcessingError {
  return error instanceof BatchProcessingError;
}

/**
 * Check if an error is a BatchTimeoutError.
 */
export function isBatchTimeoutError(error: unknown): error is BatchTimeoutError {
  return error instanceof BatchTimeoutError;
}

/**
 * Check if an error is a BatchValidationError.
 */
export function isBatchValidationError(error: unknown): error is BatchValidationError {
  return error instanceof BatchValidationError;
}
