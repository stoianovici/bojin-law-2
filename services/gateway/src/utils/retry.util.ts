/**
 * Retry Utility with Exponential Backoff and Circuit Breaker
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 13
 *
 * Implements retry logic for transient Graph API failures with:
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max 5 retries)
 * - Respects Retry-After header from 429 responses
 * - Circuit breaker pattern (opens after 10 consecutive failures)
 *
 * References:
 * - Exponential Backoff: https://en.wikipedia.org/wiki/Exponential_backoff
 * - Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
 */

import { graphConfig } from '../config/graph.config';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number; // Maximum retry attempts
  initialDelay: number; // Initial delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  shouldRetry?: (error: any, attempt: number) => boolean; // Custom retry predicate
  onRetry?: (error: any, attempt: number, delay: number) => void; // Retry callback
}

/**
 * Get default retry configuration (reads fresh values from environment)
 * Using a getter function ensures test environment variables are respected
 */
export const getDefaultRetryConfig = (): RetryConfig => ({
  maxAttempts: parseInt(process.env.GRAPH_RETRY_MAX_ATTEMPTS || '5', 10),
  initialDelay: parseInt(process.env.GRAPH_RETRY_INITIAL_DELAY || '1000', 10),
  maxDelay: parseInt(process.env.GRAPH_RETRY_MAX_DELAY || '32000', 10),
});

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed', // Normal operation - requests pass through
  OPEN = 'open', // Failing - reject requests immediately
  HALF_OPEN = 'half_open', // Testing - allow one request through
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Open circuit after N consecutive failures
  resetTimeout: number; // Time to wait before attempting to close circuit (ms)
}

/**
 * Circuit breaker instance
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '10', 10),
      resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '60000', 10),
    }
  ) {}

  /**
   * Check if circuit allows request
   */
  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try half-open
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        console.log(`[Circuit Breaker - ${this.serviceName}] Transitioning to HALF_OPEN`);
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow one request through
    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // Close circuit after successful request in half-open state
      console.log(
        `[Circuit Breaker - ${this.serviceName}] Transitioning to CLOSED (success in HALF_OPEN)`
      );
      this.state = CircuitState.CLOSED;
      this.successCount = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state - reopen circuit
      console.warn(
        `[Circuit Breaker - ${this.serviceName}] Transitioning to OPEN (failure in HALF_OPEN)`
      );
      this.state = CircuitState.OPEN;
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      // Threshold exceeded - open circuit
      console.error(
        `[Circuit Breaker - ${this.serviceName}] Transitioning to OPEN (${this.failureCount} consecutive failures)`
      );
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
  }
}

/**
 * Global circuit breakers for different Graph API resources
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create circuit breaker for a service
 */
function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Calculate delay for exponential backoff
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param retryAfter - Optional Retry-After value from server (in seconds)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  retryAfter?: number
): number {
  // If server provided Retry-After header, respect it (override maxDelay)
  // Server knows its state better than our configured limits
  if (retryAfter !== undefined && retryAfter > 0) {
    // Convert seconds to milliseconds
    return retryAfter * 1000;
  }

  // Exponential backoff: initialDelay * 2^attempt
  const exponentialDelay = initialDelay * Math.pow(2, attempt);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
  const delayWithJitter = exponentialDelay + jitter;

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Sleep for specified duration
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry predicate - determines if error should be retried
 *
 * @param error - Error object
 * @returns true if error should be retried
 */
function defaultShouldRetry(error: any): boolean {
  // Retry transient errors: 429, 500, 503, 504, network errors
  const status = error.statusCode || error.status || 0;

  if (status === 429 || status === 500 || status === 503 || status === 504) {
    return true;
  }

  // Retry network errors (ECONNRESET, ETIMEDOUT, etc.)
  if (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ECONNREFUSED'
  ) {
    return true;
  }

  // Check Graph API error codes
  const errorCode = error.body?.error?.code || error.error?.code || error.code;

  const retryableErrors = new Set([
    'Throttled',
    'TooManyRequests',
    'ServiceNotAvailable',
    'ServiceUnavailable',
    'GatewayTimeout',
    'Timeout',
    'InternalServerError',
  ]);

  return retryableErrors.has(errorCode);
}

/**
 * Execute async function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @param serviceName - Service name for circuit breaker (e.g., 'graph-api-users')
 * @returns Result from function execution
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  serviceName: string = 'graph-api'
): Promise<T> {
  const retryConfig: RetryConfig = {
    ...getDefaultRetryConfig(),
    ...config,
    shouldRetry: config.shouldRetry || defaultShouldRetry,
  };

  const circuitBreaker = getCircuitBreaker(serviceName);

  // Check circuit breaker
  if (!circuitBreaker.canAttempt()) {
    const error = new Error(
      `Circuit breaker is OPEN for ${serviceName}. Request blocked to prevent cascading failures.`
    );
    (error as any).code = 'CIRCUIT_BREAKER_OPEN';
    (error as any).serviceName = serviceName;
    throw error;
  }

  let lastError: any;
  let operationFailed = false;

  for (let attempt = 0; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const result = await fn();

      // Success - record in circuit breaker
      circuitBreaker.recordSuccess();

      // Log retry success if this wasn't first attempt
      if (attempt > 0) {
        console.log(
          `[Retry Success] Service: ${serviceName}, Attempt: ${attempt + 1}/${retryConfig.maxAttempts + 1}`
        );
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetry =
        retryConfig.shouldRetry!(error, attempt) && attempt < retryConfig.maxAttempts;

      if (!shouldRetry) {
        // Don't retry - mark operation as failed for circuit breaker
        operationFailed = true;
        console.error(`[Retry Failed] Service: ${serviceName}, No retry for error:`, {
          attempt: attempt + 1,
          errorCode: error.code || error.statusCode,
          message: error.message,
        });
        break;
      }

      // Extract Retry-After header if present
      const retryAfter = error.response?.headers?.['retry-after'] || error.headers?.['retry-after'];
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;

      // Calculate backoff delay
      const delay = calculateBackoffDelay(
        attempt,
        retryConfig.initialDelay,
        retryConfig.maxDelay,
        retryAfterSeconds
      );

      // Log retry attempt
      console.warn(
        `[Retry Attempt] Service: ${serviceName}, Attempt: ${attempt + 1}/${retryConfig.maxAttempts + 1}, Delay: ${delay}ms`,
        {
          errorCode: error.code || error.statusCode,
          message: error.message,
          retryAfter: retryAfterSeconds,
        }
      );

      // Call retry callback if provided
      if (retryConfig.onRetry) {
        retryConfig.onRetry(error, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Operation failed after all retries - record single failure in circuit breaker
  if (operationFailed || lastError) {
    circuitBreaker.recordFailure();
  }

  // All retries exhausted - throw last error
  console.error(
    `[Retry Exhausted] Service: ${serviceName}, All ${retryConfig.maxAttempts + 1} attempts failed`
  );
  throw lastError;
}

/**
 * Reset all circuit breakers (for testing)
 */
export function resetCircuitBreakers(): void {
  circuitBreakers.forEach((breaker) => breaker.reset());
}

/**
 * Get circuit breaker state for a service
 */
export function getCircuitBreakerState(serviceName: string): CircuitState {
  return getCircuitBreaker(serviceName).getState();
}
