/**
 * AI Rate Limiter
 *
 * Provides rate limiting and concurrency control for AI API calls.
 * Prevents API throttling and ensures controlled resource usage.
 */

import pLimit from 'p-limit';
import logger from './logger';

// ============================================================================
// Configuration
// ============================================================================

/** Maximum concurrent AI calls */
const MAX_CONCURRENT_CALLS = 5;

/** Maximum requests per minute (Anthropic typically allows ~60 RPM on most tiers) */
const MAX_REQUESTS_PER_MINUTE = 50;

/** Window size in milliseconds (1 minute) */
const RATE_WINDOW_MS = 60_000;

// ============================================================================
// State
// ============================================================================

/** Concurrency limiter for parallel AI calls */
export const aiRateLimiter = pLimit(MAX_CONCURRENT_CALLS);

/** Timestamps of recent requests for rate limiting */
const requestTimestamps: number[] = [];

// ============================================================================
// Rate Limiting Functions
// ============================================================================

/**
 * Clean old timestamps outside the rate window
 */
function cleanOldTimestamps(): void {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
}

/**
 * Calculate wait time if we're at the rate limit
 */
function getWaitTime(): number {
  if (requestTimestamps.length < MAX_REQUESTS_PER_MINUTE) {
    return 0;
  }

  // Calculate when the oldest request will fall outside the window
  const oldestTimestamp = requestTimestamps[0];
  const waitTime = oldestTimestamp + RATE_WINDOW_MS - Date.now();
  return Math.max(0, waitTime);
}

/**
 * Execute a function with rate limiting applied.
 *
 * This wrapper ensures:
 * 1. Maximum concurrent calls are limited (via p-limit)
 * 2. Per-minute request rate is respected
 *
 * @param fn - The async function to execute
 * @returns The result of the function
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  // Clean old timestamps
  cleanOldTimestamps();

  // Check if we need to wait
  const waitTime = getWaitTime();
  if (waitTime > 0) {
    logger.debug('AI rate limiter: waiting due to rate limit', {
      waitTimeMs: waitTime,
      currentRequests: requestTimestamps.length,
      maxPerMinute: MAX_REQUESTS_PER_MINUTE,
    });
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    // Clean again after waiting
    cleanOldTimestamps();
  }

  // Record this request timestamp
  requestTimestamps.push(Date.now());

  // Execute with concurrency limit
  return aiRateLimiter(fn);
}

/**
 * Get current rate limiter statistics
 */
export function getRateLimiterStats(): {
  currentRequestsInWindow: number;
  maxRequestsPerMinute: number;
  pendingConcurrent: number;
  maxConcurrent: number;
} {
  cleanOldTimestamps();
  return {
    currentRequestsInWindow: requestTimestamps.length,
    maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
    pendingConcurrent: aiRateLimiter.pendingCount,
    maxConcurrent: MAX_CONCURRENT_CALLS,
  };
}

/**
 * Reset rate limiter state (mainly for testing)
 */
export function resetRateLimiter(): void {
  requestTimestamps.length = 0;
}
