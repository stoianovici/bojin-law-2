/**
 * Graph API Error Handling Integration Tests
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 14
 *
 * Tests error handling with retry logic and circuit breaker for:
 * - Network failures (ECONNRESET, ETIMEDOUT)
 * - Timeouts
 * - 429 Rate Limiting
 * - 500 Internal Server Error
 * - 503 Service Unavailable
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.AZURE_AD_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_AD_TENANT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret-12345678901234567890';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';
process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '3'; // Lower threshold for testing
process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '2000'; // 2 seconds for testing
process.env.GRAPH_RETRY_MAX_ATTEMPTS = '3'; // Fewer retries for faster tests
process.env.GRAPH_RETRY_INITIAL_DELAY = '100'; // Faster retries for testing
process.env.GRAPH_RETRY_MAX_DELAY = '1000'; // Lower max delay for testing

import { GraphService } from '../../src/services/graph.service';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import {
  retryWithBackoff,
  resetCircuitBreakers,
  getCircuitBreakerState,
  CircuitState,
} from '../../src/utils/retry.util';
import { parseGraphError, ErrorCategory } from '../../src/utils/graph-error-handler';

// Mock MSAL
jest.mock('@azure/msal-node');

// Mock Graph Client with error simulation
jest.mock('@microsoft/microsoft-graph-client', () => {
  const mockApi = jest.fn();
  const mockGet = jest.fn();
  const mockTop = jest.fn();
  const mockOrderby = jest.fn();

  return {
    Client: {
      init: jest.fn(() => ({
        api: mockApi.mockReturnValue({
          get: mockGet,
          top: mockTop.mockReturnValue({
            orderby: mockOrderby.mockReturnValue({
              get: mockGet,
            }),
            get: mockGet,
          }),
          orderby: mockOrderby.mockReturnValue({
            get: mockGet,
          }),
        }),
      })),
    },
    __mockApi: mockApi,
    __mockGet: mockGet,
    __mockTop: mockTop,
    __mockOrderby: mockOrderby,
  };
});

describe('Graph API Error Handling Integration Tests', () => {
  let graphService: GraphService;
  let mockMsalClient: jest.Mocked<ConfidentialClientApplication>;

  beforeEach(() => {
    // Reset only the mock functions we use, not the entire mock setup
    const { __mockGet, __mockApi } = require('@microsoft/microsoft-graph-client');
    __mockGet.mockReset();
    __mockApi.mockReset();

    resetCircuitBreakers();

    // Create mock MSAL client
    mockMsalClient = {
      acquireTokenByClientCredential: jest.fn(),
      acquireTokenByRefreshToken: jest.fn(),
    } as any;

    graphService = new GraphService(mockMsalClient);
  });

  describe('Network Failures', () => {
    it('should retry on ECONNRESET network error', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      // Fail twice, succeed on third attempt
      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error: any = new Error('Connection reset');
          error.code = 'ECONNRESET';
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const result = await graphService.getUserProfile(accessToken);

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(3); // 1 initial + 2 retries
    }, 10000);

    it('should retry on ETIMEDOUT network error', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      // Fail once, succeed on second attempt
      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error: any = new Error('Connection timed out');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const result = await graphService.getUserProfile(accessToken);

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(2);
    }, 10000);

    it('should fail after max retries for persistent network error', async () => {
      const accessToken = 'test-token';

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      // Always fail
      __mockGet.mockImplementation(() => {
        const error: any = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      await expect(graphService.getUserProfile(accessToken)).rejects.toThrow('Connection refused');

      // Should have attempted 4 times (1 initial + 3 retries)
      expect(__mockGet).toHaveBeenCalledTimes(4);
    }, 10000);
  });

  describe('429 Rate Limiting', () => {
    it('should retry on 429 with exponential backoff', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error: any = new Error('Too Many Requests');
          error.statusCode = 429;
          error.body = {
            error: {
              code: 'Throttled',
              message: 'Too many requests',
            },
          };
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const startTime = Date.now();
      const result = await graphService.getUserProfile(accessToken);
      const duration = Date.now() - startTime;

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(2);
      // Should have waited at least 100ms (initial delay) for retry
      expect(duration).toBeGreaterThanOrEqual(100);
    }, 10000);

    it('should respect Retry-After header from 429 response', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error: any = new Error('Too Many Requests');
          error.statusCode = 429;
          error.body = {
            error: {
              code: 'TooManyRequests',
              message: 'Rate limit exceeded',
            },
          };
          error.headers = {
            'retry-after': '1', // 1 second
          };
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const startTime = Date.now();
      const result = await graphService.getUserProfile(accessToken);
      const duration = Date.now() - startTime;

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(2);
      // Should have waited at least 1000ms (Retry-After)
      expect(duration).toBeGreaterThanOrEqual(1000);
    }, 10000);
  });

  describe('500 Internal Server Error', () => {
    it('should retry on 500 error', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error: any = new Error('Internal Server Error');
          error.statusCode = 500;
          error.body = {
            error: {
              code: 'InternalServerError',
              message: 'An internal error occurred',
            },
          };
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const result = await graphService.getUserProfile(accessToken);

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(2);
    }, 10000);

    it('should fail after max retries for persistent 500 error', async () => {
      const accessToken = 'test-token';

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        const error: any = new Error('Internal Server Error');
        error.statusCode = 500;
        error.body = {
          error: {
            code: 'InternalServerError',
            message: 'Persistent server error',
          },
        };
        throw error;
      });

      await expect(graphService.getUserProfile(accessToken)).rejects.toThrow();

      // Should have attempted 4 times (1 initial + 3 retries)
      expect(__mockGet).toHaveBeenCalledTimes(4);
    }, 10000);
  });

  describe('503 Service Unavailable', () => {
    it('should retry on 503 error', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          error.body = {
            error: {
              code: 'ServiceUnavailable',
              message: 'Service temporarily unavailable',
            },
          };
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const result = await graphService.getUserProfile(accessToken);

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(3);
    }, 10000);

    it('should handle 504 Gateway Timeout with retry', async () => {
      const accessToken = 'test-token';
      let attemptCount = 0;

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error: any = new Error('Gateway Timeout');
          error.statusCode = 504;
          error.body = {
            error: {
              code: 'GatewayTimeout',
              message: 'Gateway timeout',
            },
          };
          throw error;
        }
        return Promise.resolve({ id: 'user123', displayName: 'Test User' });
      });

      const result = await graphService.getUserProfile(accessToken);

      expect(result.id).toBe('user123');
      expect(attemptCount).toBe(2);
    }, 10000);
  });

  describe('Permanent Errors (No Retry)', () => {
    it('should NOT retry on 400 Bad Request', async () => {
      const accessToken = 'test-token';

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        const error: any = new Error('Bad Request');
        error.statusCode = 400;
        error.body = {
          error: {
            code: 'BadRequest',
            message: 'Invalid request parameters',
          },
        };
        throw error;
      });

      await expect(graphService.getUserProfile(accessToken)).rejects.toThrow();

      // Should only attempt once (no retries)
      expect(__mockGet).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should NOT retry on 403 Forbidden', async () => {
      const accessToken = 'test-token';

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        const error: any = new Error('Forbidden');
        error.statusCode = 403;
        error.body = {
          error: {
            code: 'Forbidden',
            message: 'Access denied',
          },
        };
        throw error;
      });

      await expect(graphService.getUserProfile(accessToken)).rejects.toThrow();

      // Should only attempt once (no retries)
      expect(__mockGet).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should NOT retry on 404 Not Found', async () => {
      const accessToken = 'test-token';

      const { __mockGet } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation(() => {
        const error: any = new Error('Not Found');
        error.statusCode = 404;
        error.body = {
          error: {
            code: 'ResourceNotFound',
            message: 'Resource not found',
          },
        };
        throw error;
      });

      await expect(graphService.getUserProfile(accessToken)).rejects.toThrow();

      // Should only attempt once (no retries)
      expect(__mockGet).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit after threshold failures', async () => {
      const serviceName = 'test-circuit-breaker';
      let attemptCount = 0;

      // Function that always fails
      const failingFunction = async () => {
        attemptCount++;
        const error: any = new Error('Service Unavailable');
        error.statusCode = 503;
        throw error;
      };

      // Attempt 1 - should fail after retries
      try {
        await retryWithBackoff(failingFunction, {}, serviceName);
      } catch (error) {
        // Expected to fail
      }

      // Circuit should still be closed after first attempt
      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.CLOSED);

      // Attempt 2 - should fail after retries
      try {
        await retryWithBackoff(failingFunction, {}, serviceName);
      } catch (error) {
        // Expected to fail
      }

      // Attempt 3 - should fail after retries and open circuit
      try {
        await retryWithBackoff(failingFunction, {}, serviceName);
      } catch (error) {
        // Expected to fail
      }

      // Circuit should now be open (threshold = 3 failures)
      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.OPEN);

      // Attempt 4 - should fail immediately due to open circuit
      await expect(retryWithBackoff(failingFunction, {}, serviceName)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );
    }, 15000);

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const serviceName = 'test-circuit-half-open';
      let callCount = 0;

      const failingThenSuccessFunction = async () => {
        callCount++;
        if (callCount <= 12) {
          // 3 attempts * 4 retries each = 12 calls to open circuit
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          throw error;
        }
        return { success: true };
      };

      // Trigger circuit open (3 failed attempts)
      for (let i = 0; i < 3; i++) {
        try {
          await retryWithBackoff(failingThenSuccessFunction, {}, serviceName);
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify circuit is open
      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.OPEN);

      // Wait for reset timeout (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Next attempt should transition to HALF_OPEN
      const result = await retryWithBackoff(failingThenSuccessFunction, {}, serviceName);

      // Circuit should be closed after successful request in HALF_OPEN
      expect(getCircuitBreakerState(serviceName)).toBe(CircuitState.CLOSED);
      expect(result.success).toBe(true);
    }, 20000);
  });

  describe('Error Categorization', () => {
    it('should correctly categorize transient errors', () => {
      const error429 = {
        statusCode: 429,
        body: { error: { code: 'Throttled', message: 'Rate limit' } },
      };
      const parsed429 = parseGraphError(error429);

      expect(parsed429.category).toBe(ErrorCategory.TRANSIENT);
      expect(parsed429.isRetryable).toBe(true);

      const error503 = {
        statusCode: 503,
        body: {
          error: { code: 'ServiceUnavailable', message: 'Service down' },
        },
      };
      const parsed503 = parseGraphError(error503);

      expect(parsed503.category).toBe(ErrorCategory.TRANSIENT);
      expect(parsed503.isRetryable).toBe(true);
    });

    it('should correctly categorize auth errors', () => {
      const error401 = {
        statusCode: 401,
        body: {
          error: {
            code: 'InvalidAuthenticationToken',
            message: 'Token expired',
          },
        },
      };
      const parsed401 = parseGraphError(error401);

      expect(parsed401.category).toBe(ErrorCategory.AUTH);
      expect(parsed401.isRetryable).toBe(true);
    });

    it('should correctly categorize permanent errors', () => {
      const error400 = {
        statusCode: 400,
        body: { error: { code: 'BadRequest', message: 'Invalid request' } },
      };
      const parsed400 = parseGraphError(error400);

      expect(parsed400.category).toBe(ErrorCategory.PERMANENT);
      expect(parsed400.isRetryable).toBe(false);

      const error404 = {
        statusCode: 404,
        body: {
          error: { code: 'ResourceNotFound', message: 'Not found' },
        },
      };
      const parsed404 = parseGraphError(error404);

      expect(parsed404.category).toBe(ErrorCategory.PERMANENT);
      expect(parsed404.isRetryable).toBe(false);
    });
  });

  describe('Multiple Graph Operations with Errors', () => {
    it('should handle errors across different Graph service methods', async () => {
      const accessToken = 'test-token';
      let getUserProfileAttempts = 0;
      let listMessagesAttempts = 0;

      // Mock getUserProfile to fail once then succeed
      const { __mockGet, __mockApi } = require('@microsoft/microsoft-graph-client');

      __mockGet.mockImplementation((url: string) => {
        if (url === '/me') {
          getUserProfileAttempts++;
          if (getUserProfileAttempts < 2) {
            const error: any = new Error('Timeout');
            error.code = 'ETIMEDOUT';
            throw error;
          }
          return Promise.resolve({ id: 'user123', displayName: 'Test User' });
        } else if (url === '/me/messages') {
          listMessagesAttempts++;
          if (listMessagesAttempts < 2) {
            const error: any = new Error('Service Unavailable');
            error.statusCode = 503;
            error.body = {
              error: {
                code: 'ServiceUnavailable',
                message: 'Temporarily unavailable',
              },
            };
            throw error;
          }
          return Promise.resolve({ value: [{ id: 'msg1' }] });
        }
      });

      // Test getUserProfile
      const userProfile = await graphService.getUserProfile(accessToken);
      expect(userProfile.id).toBe('user123');
      expect(getUserProfileAttempts).toBe(2);

      // Reset mocks for listMessages
      __mockApi.mockClear();

      // Test listMessages
      const messages = await graphService.listMessages(accessToken);
      expect(messages).toHaveLength(1);
      expect(listMessagesAttempts).toBe(2);
    }, 10000);
  });
});
