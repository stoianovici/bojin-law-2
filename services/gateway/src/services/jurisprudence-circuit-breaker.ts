/**
 * Jurisprudence Circuit Breaker
 *
 * Redis-backed circuit breaker for web search service.
 * Prevents cascading failures when the search service is unavailable.
 */

import { redis } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

export const CIRCUIT_BREAKER_CONFIG = {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: 5,
  /** Time in seconds to wait before allowing a test request (30 seconds) */
  resetTimeoutSeconds: 30,
  /** Time in seconds after which failure count resets if no new failures (5 minutes) */
  failureWindowSeconds: 300,
} as const;

/** Redis keys for circuit breaker state */
const CIRCUIT_BREAKER_KEYS = {
  failures: 'jurisprudence:circuit:failures',
  openedAt: 'jurisprudence:circuit:opened_at',
} as const;

// ============================================================================
// Circuit Breaker Functions
// ============================================================================

/**
 * Check if the circuit breaker allows a request.
 * Returns true if request should proceed, false if circuit is open.
 *
 * Uses Redis to check state, making it safe for multi-instance deployments.
 */
export async function isCircuitBreakerClosed(): Promise<boolean> {
  try {
    const openedAtStr = await redis.get(CIRCUIT_BREAKER_KEYS.openedAt);

    if (openedAtStr) {
      // Circuit is open - check if we should allow a test request
      const openedAt = parseInt(openedAtStr, 10);
      const timeSinceOpened = Date.now() - openedAt;

      if (timeSinceOpened >= CIRCUIT_BREAKER_CONFIG.resetTimeoutSeconds * 1000) {
        // Allow a test request (half-open state)
        logger.info('[JurisprudenceAgent] Circuit breaker half-open, allowing test request');
        return true;
      }
      return false;
    }

    // Circuit not open - check failure count (TTL handles window reset automatically)
    return true;
  } catch (error) {
    // On Redis error, fail open (allow requests) to avoid blocking all operations
    logger.warn('[JurisprudenceAgent] Circuit breaker Redis check failed, failing open', {
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * Get the opened_at timestamp for error messages.
 */
export async function getCircuitOpenedAt(): Promise<number> {
  try {
    const openedAtStr = await redis.get(CIRCUIT_BREAKER_KEYS.openedAt);
    return openedAtStr ? parseInt(openedAtStr, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Record a successful request, closing the circuit if it was open.
 */
export async function recordCircuitSuccess(): Promise<void> {
  try {
    const wasOpen = await redis.get(CIRCUIT_BREAKER_KEYS.openedAt);

    // Delete both keys to reset state
    // Use Promise.allSettled to ensure both deletions are attempted even if one fails
    const results = await Promise.allSettled([
      redis.del(CIRCUIT_BREAKER_KEYS.failures),
      redis.del(CIRCUIT_BREAKER_KEYS.openedAt),
    ]);

    // Log any individual failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const keyName = index === 0 ? 'failures' : 'openedAt';
        logger.warn(`[JurisprudenceAgent] Failed to delete circuit breaker key: ${keyName}`, {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });

    if (wasOpen) {
      logger.info('[JurisprudenceAgent] Circuit breaker closed after successful request');
    }
  } catch (error) {
    // Log but don't fail the operation
    logger.warn('[JurisprudenceAgent] Failed to record circuit success', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Record a failed request, potentially opening the circuit.
 */
export async function recordCircuitFailure(): Promise<void> {
  try {
    // Increment failure counter with TTL (auto-resets after window)
    const failures = await redis.incr(CIRCUIT_BREAKER_KEYS.failures);

    // Set TTL on first failure or refresh it
    await redis.expire(CIRCUIT_BREAKER_KEYS.failures, CIRCUIT_BREAKER_CONFIG.failureWindowSeconds);

    if (failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      // Open the circuit
      const now = Date.now();
      await redis.setex(
        CIRCUIT_BREAKER_KEYS.openedAt,
        CIRCUIT_BREAKER_CONFIG.resetTimeoutSeconds + 60, // Extra buffer for cleanup
        String(now)
      );

      logger.warn('[JurisprudenceAgent] Circuit breaker opened due to repeated failures', {
        failures,
        resetAfterMs: CIRCUIT_BREAKER_CONFIG.resetTimeoutSeconds * 1000,
      });
    }
  } catch (error) {
    // Log but don't fail the operation
    logger.warn('[JurisprudenceAgent] Failed to record circuit failure', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
