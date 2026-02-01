/**
 * Stream Utilities for Word Add-in
 * Phase 1.2: Extract streaming cleanup utility
 *
 * Provides shared utilities for SSE streaming operations to prevent
 * code duplication and ensure consistent cleanup behavior.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Context object for streaming operations.
 * Holds mutable state that needs to be cleaned up on completion or error.
 */
export interface StreamCleanupContext {
  /** Timeout ID for the overall operation timeout */
  timeoutId: ReturnType<typeof setTimeout> | null;
  /** Reader for the response body stream */
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  /** Accumulated content from the stream */
  accumulatedContent: string;
}

// ============================================================================
// Stream Cleanup Utility
// ============================================================================

/**
 * Create a cleanup function for streaming operations.
 *
 * This factory function creates a cleanup handler that:
 * 1. Clears the timeout to prevent memory leaks
 * 2. Resets the accumulated content buffer
 * 3. Cancels the stream reader if active
 * 4. Optionally rejects the promise with an error
 *
 * @param context - Mutable context object holding stream state
 * @param reject - Promise reject function for error handling
 * @returns Cleanup function that can be called on success or failure
 *
 * @example
 * ```typescript
 * const context: StreamCleanupContext = {
 *   timeoutId: null,
 *   reader: null,
 *   accumulatedContent: ''
 * };
 *
 * return new Promise((resolve, reject) => {
 *   const cleanup = createStreamCleanup(context, reject);
 *
 *   context.timeoutId = setTimeout(() => cleanup(new Error('Timeout')), 60000);
 *
 *   // ... streaming logic ...
 *
 *   // On success:
 *   cleanup();
 *   resolve(result);
 *
 *   // On error:
 *   cleanup(error);
 * });
 * ```
 */
export function createStreamCleanup(
  context: StreamCleanupContext,
  reject: (error: Error) => void
): (error?: Error) => void {
  return (error?: Error) => {
    // Clear timeout to prevent callback after cleanup
    if (context.timeoutId) {
      clearTimeout(context.timeoutId);
      context.timeoutId = null;
    }

    // Reset accumulated content to free memory
    context.accumulatedContent = '';

    // Cancel stream reader if active
    if (context.reader) {
      context.reader.cancel().catch(() => {
        // Ignore cancellation errors - reader may already be closed
      });
      context.reader = null;
    }

    // Reject promise if error provided
    if (error) {
      reject(error);
    }
  };
}

/**
 * Create initial stream context with default values.
 * Convenience function for creating a clean context object.
 *
 * @returns Fresh StreamCleanupContext with null/empty values
 */
export function createStreamContext(): StreamCleanupContext {
  return {
    timeoutId: null,
    reader: null,
    accumulatedContent: '',
  };
}
