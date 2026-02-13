/**
 * Jurisprudence Rate Limiting
 *
 * Per-user rate limiting for jurisprudence research requests.
 * Uses atomic Redis operations to prevent race conditions.
 */

import { redis } from '@legal-platform/database';
import { JURISPRUDENCE_CONSTRAINTS } from './jurisprudence-agent.types';

// ============================================================================
// Constants
// ============================================================================

/** Redis key prefix for rate limiting */
const RATE_LIMIT_PREFIX = 'jurisprudence:rate:';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely get TTL from Redis, handling edge cases.
 * Redis TTL returns:
 * - Positive number: seconds remaining
 * - -1: key exists but has no expiry
 * - -2: key doesn't exist
 * We normalize these to a safe positive value.
 */
async function safeGetTtl(key: string, defaultSeconds: number): Promise<number> {
  const ttl = await redis.ttl(key);
  // If TTL is negative (no expiry or key doesn't exist), use default window
  return ttl > 0 ? ttl : defaultSeconds;
}

// ============================================================================
// Rate Limit Check
// ============================================================================

/**
 * Check rate limit for jurisprudence research.
 * Returns remaining requests and reset time.
 *
 * Uses atomic INCR to prevent race conditions in multi-instance deployments.
 * The pattern is:
 * 1. Atomically increment counter
 * 2. If first request (count === 1), set expiry
 * 3. If count > limit, deny (counter already incremented but will expire)
 *
 * This is safe because:
 * - INCR is atomic - two concurrent requests will get different counts
 * - Over-limit requests still increment but get denied and will expire
 * - No check-then-act race condition
 */
export async function checkJurisprudenceRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const key = `${RATE_LIMIT_PREFIX}${userId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowSeconds = JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_WINDOW_SECONDS;
  const maxRequests = JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS;

  // Atomically increment counter first (prevents race condition)
  const newCount = await redis.incr(key);

  // Set expiry on first request in the window
  if (newCount === 1) {
    await redis.expire(key, windowSeconds);
  }

  // Get TTL for reset time
  const ttl = await safeGetTtl(key, windowSeconds);
  const resetAt = new Date((now + ttl) * 1000);

  // Check if over limit (after atomic increment)
  if (newCount > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - newCount,
    resetAt,
  };
}
