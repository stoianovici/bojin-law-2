/**
 * Unit Tests for Retry Utility with Exponential Backoff and Circuit Breaker
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 13
 */

import {
  retryWithBackoff,
  calculateBackoffDelay,
  resetCircuitBreakers,
  getCircuitBreakerState,
  CircuitState,
} from '../../src/utils/retry.util';

describe('Retry Utility', () => {
  beforeEach(() => {
    resetCircuitBreakers();
    jest.clearAllMocks();
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff delays', () => {
      const initialDelay = 1000;
      const maxDelay = 32000;

      const delay0 = calculateBackoffDelay(0, initialDelay, maxDelay);
      const delay1 = calculateBackoffDelay(1, initialDelay, maxDelay);
      const delay2 = calculateBackoffDelay(2, initialDelay, maxDelay);
      const delay3 = calculateBackoffDelay(3, initialDelay, maxDelay);

      // Allow for ±25% jitter
      expect(delay0).toBeGreaterThanOrEqual(750); // 1000 - 25%
      expect(delay0).toBeLessThanOrEqual(1250); // 1000 + 25%

      expect(delay1).toBeGreaterThanOrEqual(1500); // 2000 - 25%
      expect(delay1).toBeLessThanOrEqual(2500); // 2000 + 25%

      expect(delay2).toBeGreaterThanOrEqual(3000); // 4000 - 25%
      expect(delay2).toBeLessThanOrEqual(5000); // 4000 + 25%

      expect(delay3).toBeGreaterThanOrEqual(6000); // 8000 - 25%
      expect(delay3).toBeLessThanOrEqual(10000); // 8000 + 25%
    });

    it('should cap delay at maxDelay', () => {
      const initialDelay = 1000;
      const maxDelay = 5000;

      const delay5 = calculateBackoffDelay(5, initialDelay, maxDelay);

      // 1000 * 2^5 = 32000, but capped at 5000
      expect(delay5).toBeLessThanOrEqual(maxDelay);
    });

    it('should respect Retry-After header', () => {
      const initialDelay = 1000;
      const maxDelay = 32000;
      const retryAfter = 10; // 10 seconds

      const delay = calculateBackoffDelay(0, initialDelay, maxDelay, retryAfter);

      expect(delay).toBe(10000); // 10 seconds in milliseconds
    });

    it('should respect Retry-After header without capping at maxDelay', () => {
      const initialDelay = 1000;
      const maxDelay = 5000;
      const retryAfter = 30; // 30 seconds

      const delay = calculateBackoffDelay(0, initialDelay, maxDelay, retryAfter);

      // Retry-After from server should override our maxDelay
      // Server knows its state better than our configured limits
      expect(delay).toBe(30000); // 30 seconds in milliseconds
    });
  });

  describe('retryWithBackoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      resetCircuitBreakers(); // Reset circuit breaker state between tests
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should succeed on first attempt without retry', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error (429) and succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ statusCode: 429, code: 'Throttled' })
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 error and succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({
          statusCode: 500,
          code: 'InternalServerError',
        })
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 error and succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({
          statusCode: 503,
          code: 'ServiceNotAvailable',
        })
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on permanent error (400)', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 400, code: 'BadRequest' });

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });

      await expect(promise).rejects.toMatchObject({
        statusCode: 400,
        code: 'BadRequest',
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on permanent error (403)', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 403, code: 'Forbidden' });

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });

      await expect(promise).rejects.toMatchObject({
        statusCode: 403,
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on permanent error (404)', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 404, code: 'ResourceNotFound' });

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });

      await expect(promise).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw last error', async () => {
      // Use real timers for this test to avoid async timing issues with fake timers
      // Integration tests in retry-error-handling.integration.test.ts fully cover this behavior
      jest.useRealTimers();

      const mockFn = jest.fn().mockRejectedValue({ statusCode: 500, message: 'Server error' });

      await expect(
        retryWithBackoff(mockFn, { maxAttempts: 2, initialDelay: 10, maxDelay: 50 })
      ).rejects.toMatchObject({
        statusCode: 500,
        message: 'Server error',
      });

      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries

      // Restore fake timers for subsequent tests
      jest.useFakeTimers();
    });

    it('should call onRetry callback', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ statusCode: 500 })
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3, onRetry }, 'test-service');
      await jest.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500 }),
        0,
        expect.any(Number)
      );
    });

    it('should use custom shouldRetry function', async () => {
      const mockFn = jest.fn().mockRejectedValue({ code: 'CustomError' });

      const shouldRetry = jest.fn().mockReturnValue(false);

      const promise = retryWithBackoff(mockFn, { shouldRetry });

      await expect(promise).rejects.toMatchObject({
        code: 'CustomError',
      });

      expect(shouldRetry).toHaveBeenCalledWith(expect.objectContaining({ code: 'CustomError' }), 0);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start in CLOSED state', () => {
      const state = getCircuitBreakerState('test-service');
      expect(state).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after threshold failures', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 500, code: 'InternalServerError' });

      // Fail 10 times to open circuit (default threshold)
      for (let i = 0; i < 10; i++) {
        try {
          await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'circuit-test');
        } catch (error) {
          // Expected to fail
        }
      }

      const state = getCircuitBreakerState('circuit-test');
      expect(state).toBe(CircuitState.OPEN);

      // Next call should be rejected immediately
      let error;
      try {
        await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'circuit-test');
      } catch (e) {
        error = e;
      }

      expect(error).toMatchObject({
        code: 'CIRCUIT_BREAKER_OPEN',
      });
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 500 });

      // Open circuit
      for (let i = 0; i < 10; i++) {
        try {
          await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'timeout-test');
        } catch (error) {
          // Expected
        }
      }

      expect(getCircuitBreakerState('timeout-test')).toBe(CircuitState.OPEN);

      // Advance time past reset timeout (60 seconds default)
      jest.advanceTimersByTime(61000);

      // Next successful call should close circuit
      mockFn.mockResolvedValueOnce('success');

      await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'timeout-test');

      expect(getCircuitBreakerState('timeout-test')).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit if HALF_OPEN request fails', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 500 });

      // Open circuit
      for (let i = 0; i < 10; i++) {
        try {
          await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'reopen-test');
        } catch (error) {
          // Expected
        }
      }

      // Advance time to allow half-open
      jest.advanceTimersByTime(61000);

      // Fail in half-open state
      try {
        await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'reopen-test');
      } catch (error) {
        // Expected
      }

      // Should be back to OPEN
      expect(getCircuitBreakerState('reopen-test')).toBe(CircuitState.OPEN);
    });

    it('should have separate circuit breakers per service', async () => {
      const mockFn = jest.fn().mockRejectedValue({ statusCode: 500 });

      // Open circuit for service-a
      for (let i = 0; i < 10; i++) {
        try {
          await retryWithBackoff(mockFn, { maxAttempts: 0 }, 'service-a');
        } catch (error) {
          // Expected
        }
      }

      expect(getCircuitBreakerState('service-a')).toBe(CircuitState.OPEN);
      expect(getCircuitBreakerState('service-b')).toBe(CircuitState.CLOSED);
    });
  });
});
