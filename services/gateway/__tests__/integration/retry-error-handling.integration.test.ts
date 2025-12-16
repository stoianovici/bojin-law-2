/**
 * Retry and Error Handling Integration Tests
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 14
 *
 * Integration tests for retry utility combined with error handler
 * Validates retry behavior for:
 * - Network failures (ECONNRESET, ETIMEDOUT, ECONNREFUSED)
 * - Timeouts
 * - 429 Rate Limiting
 * - 500 Internal Server Error
 * - 503 Service Unavailable
 * - Circuit breaker pattern
 */

import { ErrorCategory, parseGraphError } from '../../src/utils/graph-error-handler';
import {
  CircuitState,
  getCircuitBreakerState,
  resetCircuitBreakers,
  retryWithBackoff,
} from '../../src/utils/retry.util';

// Set test environment
process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '3';
process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '1000';
process.env.GRAPH_RETRY_MAX_ATTEMPTS = '3';
process.env.GRAPH_RETRY_INITIAL_DELAY = '50';
process.env.GRAPH_RETRY_MAX_DELAY = '500';

describe('Retry and Error Handling Integration', () => {
  beforeEach(() => {
    resetCircuitBreakers();
  });

  describe('Network Error Retry Behavior', () => {
    it('should retry on ECONNRESET and eventually succeed', async () => {
      let attempt = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 3) {
          const error: any = new Error('Connection reset');
          error.code = 'ECONNRESET';
          throw error;
        }
        return { success: true, attempt };
      });

      const result = await retryWithBackoff(mockOperation, {}, 'test-econnreset');

      expect((result as any).success).toBe(true);
      expect((result as any).attempt).toBe(3);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on ETIMEDOUT and eventually succeed', async () => {
      let attempt = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 2) {
          const error: any = new Error('Connection timed out');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        return { success: true, attempt };
      });

      const result = await retryWithBackoff(mockOperation, {}, 'test-etimedout');

      expect((result as any).success).toBe(true);
      expect((result as any).attempt).toBe(2);
    }, 10000);

    it('should fail after max retries on persistent ECONNREFUSED', async () => {
      const mockOperation = jest.fn().mockImplementation(async () => {
        const error: any = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      await expect(retryWithBackoff(mockOperation, {}, 'test-econnrefused')).rejects.toThrow(
        'Connection refused'
      );

      expect(mockOperation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 10000);
  });

  describe('429 Rate Limiting Retry', () => {
    it('should retry on 429 error with exponential backoff', async () => {
      let attempt = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 2) {
          const error: any = new Error('Too Many Requests');
          error.statusCode = 429;
          error.body = {
            error: {
              code: 'Throttled',
              message: 'Rate limit exceeded',
            },
          };
          throw error;
        }
        return { success: true };
      });

      const startTime = Date.now();
      const result = await retryWithBackoff(mockOperation, {}, 'test-429');
      const duration = Date.now() - startTime;

      expect((result as any).success).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(2);
      // Should have waited at least initial delay (50ms)
      expect(duration).toBeGreaterThanOrEqual(50);
    }, 10000);

    it('should respect Retry-After header from 429 response', async () => {
      let attempt = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 2) {
          const error: any = new Error('Too Many Requests');
          error.statusCode = 429;
          error.headers = {
            'retry-after': '1', // 1 second
          };
          throw error;
        }
        return { success: true };
      });

      const startTime = Date.now();
      await retryWithBackoff(mockOperation, {}, 'test-429-retry-after');
      const duration = Date.now() - startTime;

      // Should have waited at least 1 second (retry-after header)
      expect(duration).toBeGreaterThanOrEqual(900); // Allow some margin
    }, 10000);
  });

  describe('500/503 Server Error Retry', () => {
    it('should retry on 500 Internal Server Error', async () => {
      let attempt = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 2) {
          const error: any = new Error('Internal Server Error');
          error.statusCode = 500;
          error.body = {
            error: {
              code: 'InternalServerError',
              message: 'Server error',
            },
          };
          throw error;
        }
        return { success: true };
      });

      const result = await retryWithBackoff(mockOperation, {}, 'test-500');

      expect((result as any).success).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should retry on 503 Service Unavailable', async () => {
      let attempt = 0;

      const mockOperation = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt < 3) {
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          error.body = {
            error: {
              code: 'ServiceUnavailable',
              message: 'Service down',
            },
          };
          throw error;
        }
        return { success: true };
      });

      const result = await retryWithBackoff(mockOperation, {}, 'test-503');

      expect((result as any).success).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should fail after max retries on persistent 500 error', async () => {
      const mockOperation = jest.fn().mockImplementation(async () => {
        const error: any = new Error('Internal Server Error');
        error.statusCode = 500;
        throw error;
      });

      await expect(retryWithBackoff(mockOperation, {}, 'test-500-persistent')).rejects.toThrow(
        'Internal Server Error'
      );

      expect(mockOperation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 10000);
  });

  describe('Permanent Errors (No Retry)', () => {
    it('should NOT retry on 400 Bad Request', async () => {
      const mockOperation = jest.fn().mockImplementation(async () => {
        const error: any = new Error('Bad Request');
        error.statusCode = 400;
        error.body = {
          error: {
            code: 'BadRequest',
            message: 'Invalid request',
          },
        };
        throw error;
      });

      await expect(retryWithBackoff(mockOperation, {}, 'test-400')).rejects.toThrow('Bad Request');

      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
    }, 10000);

    it('should NOT retry on 403 Forbidden', async () => {
      const mockOperation = jest.fn().mockImplementation(async () => {
        const error: any = new Error('Forbidden');
        error.statusCode = 403;
        throw error;
      });

      await expect(retryWithBackoff(mockOperation, {}, 'test-403')).rejects.toThrow('Forbidden');

      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
    }, 10000);

    it('should NOT retry on 404 Not Found', async () => {
      const mockOperation = jest.fn().mockImplementation(async () => {
        const error: any = new Error('Not Found');
        error.statusCode = 404;
        throw error;
      });

      await expect(retryWithBackoff(mockOperation, {}, 'test-404')).rejects.toThrow('Not Found');

      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
    }, 10000);
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit after threshold failures', async () => {
      const serviceName = 'test-circuit-breaker-open';

      const failingOperation = jest.fn().mockImplementation(async () => {
        const error: any = new Error('Service Unavailable');
        error.statusCode = 503;
        throw error;
      });

      // Trigger 3 failures to open circuit (threshold = 3)
      for (let i = 0; i < 3; i++) {
        try {
          await retryWithBackoff(failingOperation, {}, serviceName);
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open
      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.OPEN);

      // Next attempt should fail immediately
      await expect(retryWithBackoff(failingOperation, {}, serviceName)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );
    }, 15000);

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const serviceName = 'test-circuit-half-open';
      let callCount = 0;

      const operation = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 12) {
          // 3 failures * 4 attempts each
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          throw error;
        }
        return { success: true };
      });

      // Trigger circuit open
      for (let i = 0; i < 3; i++) {
        try {
          await retryWithBackoff(operation, {}, serviceName);
        } catch (error) {
          // Expected
        }
      }

      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.OPEN);

      // Wait for reset timeout (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next attempt should transition to HALF_OPEN and succeed
      const result = await retryWithBackoff(operation, {}, serviceName);

      expect((result as any).success).toBe(true);
      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.CLOSED);
    }, 15000);
  });

  describe('Error Classification Integration', () => {
    it('should correctly identify and handle transient errors', () => {
      const errors = [
        { statusCode: 429, body: { error: { code: 'Throttled' } } },
        { statusCode: 500, body: { error: { code: 'InternalServerError' } } },
        { statusCode: 503, body: { error: { code: 'ServiceUnavailable' } } },
        { code: 'ETIMEDOUT' },
        { code: 'ECONNRESET' },
      ];

      errors.forEach((error) => {
        const parsed = parseGraphError(error);
        expect(parsed.isRetryable).toBe(true);
        expect([ErrorCategory.TRANSIENT, ErrorCategory.AUTH]).toContain(parsed.category);
      });
    });

    it('should correctly identify and handle permanent errors', () => {
      const errors = [
        { statusCode: 400, body: { error: { code: 'BadRequest' } } },
        { statusCode: 403, body: { error: { code: 'Forbidden' } } },
        { statusCode: 404, body: { error: { code: 'NotFound' } } },
      ];

      errors.forEach((error) => {
        const parsed = parseGraphError(error);
        expect(parsed.isRetryable).toBe(false);
        expect(parsed.category).toBe(ErrorCategory.PERMANENT);
      });
    });

    it('should correctly identify auth errors', () => {
      const errors = [
        { statusCode: 401, body: { error: { code: 'InvalidAuthenticationToken' } } },
        { statusCode: 401, body: { error: { code: 'ExpiredAuthenticationToken' } } },
      ];

      errors.forEach((error) => {
        const parsed = parseGraphError(error);
        expect(parsed.isRetryable).toBe(true);
        expect(parsed.category).toBe(ErrorCategory.AUTH);
      });
    });
  });
});
