/**
 * Unit Tests for Microsoft Graph API Error Handler
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 12
 */

import {
  parseGraphError,
  getUserFriendlyMessage,
  logGraphError,
  createErrorResponse,
  ErrorCategory,
  ParsedGraphError,
} from '../../src/utils/graph-error-handler';

describe('Graph Error Handler', () => {
  describe('parseGraphError', () => {
    it('should parse 401 Unauthorized error', () => {
      const error = {
        statusCode: 401,
        body: {
          error: {
            code: 'InvalidAuthenticationToken',
            message: 'Access token has expired',
            innerError: {
              'request-id': 'abc-123',
            },
          },
        },
      };

      const parsed = parseGraphError(error, 401);

      expect(parsed.category).toBe(ErrorCategory.AUTH);
      expect(parsed.statusCode).toBe(401);
      expect(parsed.errorCode).toBe('InvalidAuthenticationToken');
      expect(parsed.isRetryable).toBe(true);
      expect(parsed.requestId).toBe('abc-123');
    });

    it('should parse 429 Rate Limit error with Retry-After header', () => {
      const error = {
        statusCode: 429,
        body: {
          error: {
            code: 'Throttled',
            message: 'Rate limit exceeded',
          },
        },
      };

      const headers = {
        'retry-after': '30',
      };

      const parsed = parseGraphError(error, 429, headers);

      expect(parsed.category).toBe(ErrorCategory.TRANSIENT);
      expect(parsed.statusCode).toBe(429);
      expect(parsed.errorCode).toBe('Throttled');
      expect(parsed.isRetryable).toBe(true);
      expect(parsed.retryAfter).toBe(30);
    });

    it('should parse 500 Internal Server Error', () => {
      const error = {
        statusCode: 500,
        body: {
          error: {
            code: 'InternalServerError',
            message: 'An internal error occurred',
          },
        },
      };

      const parsed = parseGraphError(error, 500);

      expect(parsed.category).toBe(ErrorCategory.TRANSIENT);
      expect(parsed.statusCode).toBe(500);
      expect(parsed.errorCode).toBe('InternalServerError');
      expect(parsed.isRetryable).toBe(true);
    });

    it('should parse 503 Service Unavailable error', () => {
      const error = {
        statusCode: 503,
        body: {
          error: {
            code: 'ServiceNotAvailable',
            message: 'Service is temporarily unavailable',
          },
        },
      };

      const parsed = parseGraphError(error, 503);

      expect(parsed.category).toBe(ErrorCategory.TRANSIENT);
      expect(parsed.statusCode).toBe(503);
      expect(parsed.errorCode).toBe('ServiceNotAvailable');
      expect(parsed.isRetryable).toBe(true);
    });

    it('should parse 400 Bad Request as permanent error', () => {
      const error = {
        statusCode: 400,
        body: {
          error: {
            code: 'BadRequest',
            message: 'Invalid request',
          },
        },
      };

      const parsed = parseGraphError(error, 400);

      expect(parsed.category).toBe(ErrorCategory.PERMANENT);
      expect(parsed.statusCode).toBe(400);
      expect(parsed.errorCode).toBe('BadRequest');
      expect(parsed.isRetryable).toBe(false);
    });

    it('should parse 403 Forbidden as permanent error', () => {
      const error = {
        statusCode: 403,
        body: {
          error: {
            code: 'Forbidden',
            message: 'Insufficient permissions',
          },
        },
      };

      const parsed = parseGraphError(error, 403);

      expect(parsed.category).toBe(ErrorCategory.PERMANENT);
      expect(parsed.statusCode).toBe(403);
      expect(parsed.isRetryable).toBe(false);
    });

    it('should parse 404 Not Found as permanent error', () => {
      const error = {
        statusCode: 404,
        body: {
          error: {
            code: 'ResourceNotFound',
            message: 'Resource not found',
          },
        },
      };

      const parsed = parseGraphError(error, 404);

      expect(parsed.category).toBe(ErrorCategory.PERMANENT);
      expect(parsed.statusCode).toBe(404);
      expect(parsed.isRetryable).toBe(false);
    });

    it('should handle error object without body', () => {
      const error = {
        code: 'NetworkError',
        message: 'Network connection failed',
        statusCode: 0,
      };

      const parsed = parseGraphError(error);

      expect(parsed.errorCode).toBe('NetworkError');
      expect(parsed.message).toBe('Network connection failed');
    });

    it('should handle error with nested error structure', () => {
      const error = {
        error: {
          code: 'Timeout',
          message: 'Request timed out',
        },
      };

      const parsed = parseGraphError(error, 504);

      expect(parsed.errorCode).toBe('Timeout');
      expect(parsed.message).toBe('Request timed out');
      expect(parsed.category).toBe(ErrorCategory.TRANSIENT);
    });

    it('should default to status 500 if no status provided', () => {
      const error = {
        message: 'Unknown error',
      };

      const parsed = parseGraphError(error);

      expect(parsed.statusCode).toBe(500);
      expect(parsed.category).toBe(ErrorCategory.TRANSIENT);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return friendly message for InvalidAuthenticationToken', () => {
      const message = getUserFriendlyMessage('InvalidAuthenticationToken', 401);
      expect(message).toBe('Your session has expired. Please sign in again.');
    });

    it('should return friendly message for Throttled', () => {
      const message = getUserFriendlyMessage('Throttled', 429);
      expect(message).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('should return friendly message for ServiceNotAvailable', () => {
      const message = getUserFriendlyMessage('ServiceNotAvailable', 503);
      expect(message).toBe(
        'Microsoft Graph service is temporarily unavailable. Please try again later.'
      );
    });

    it('should return friendly message for Forbidden', () => {
      const message = getUserFriendlyMessage('Forbidden', 403);
      expect(message).toBe('You do not have permission to access this resource.');
    });

    it('should return generic message for unknown error code', () => {
      const message = getUserFriendlyMessage('UnknownErrorCode', 500);
      expect(message).toBe('A server error occurred. Please try again later.');
    });

    it('should return fallback message for 429 without specific code', () => {
      const message = getUserFriendlyMessage('UnknownCode', 429);
      expect(message).toBe('Too many requests. Please wait and try again.');
    });

    it('should return fallback message for 404 without specific code', () => {
      const message = getUserFriendlyMessage('UnknownCode', 404);
      expect(message).toBe('The requested resource was not found.');
    });

    it('should return fallback message for 401 without specific code', () => {
      const message = getUserFriendlyMessage('UnknownCode', 401);
      expect(message).toBe('Your session has expired. Please sign in again.');
    });

    it('should return fallback message for 403 without specific code', () => {
      const message = getUserFriendlyMessage('UnknownCode', 403);
      expect(message).toBe('You do not have permission to access this resource.');
    });

    it('should return fallback message for 400-level errors', () => {
      const message = getUserFriendlyMessage('UnknownCode', 422);
      expect(message).toBe('Invalid request. Please check your input and try again.');
    });
  });

  describe('logGraphError', () => {
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log transient errors as warnings', () => {
      const error: ParsedGraphError = {
        category: ErrorCategory.TRANSIENT,
        statusCode: 429,
        errorCode: 'Throttled',
        message: 'Rate limit exceeded',
        isRetryable: true,
        retryAfter: 30,
      };

      logGraphError(error, { endpoint: '/me/messages', userId: 'user123' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Graph API - Transient Error]',
        expect.objectContaining({
          category: ErrorCategory.TRANSIENT,
          statusCode: 429,
          errorCode: 'Throttled',
          endpoint: '/me/messages',
          userId: 'user123',
        })
      );
    });

    it('should log auth errors as warnings', () => {
      const error: ParsedGraphError = {
        category: ErrorCategory.AUTH,
        statusCode: 401,
        errorCode: 'InvalidAuthenticationToken',
        message: 'Token expired',
        isRetryable: true,
      };

      logGraphError(error);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Graph API - Auth Error]',
        expect.objectContaining({
          category: ErrorCategory.AUTH,
          statusCode: 401,
        })
      );
    });

    it('should log permanent errors as errors', () => {
      const error: ParsedGraphError = {
        category: ErrorCategory.PERMANENT,
        statusCode: 403,
        errorCode: 'Forbidden',
        message: 'Access denied',
        isRetryable: false,
      };

      logGraphError(error, { operation: 'getUserProfile' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Graph API - Permanent Error]',
        expect.objectContaining({
          category: ErrorCategory.PERMANENT,
          statusCode: 403,
          operation: 'getUserProfile',
        })
      );
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const error: ParsedGraphError = {
        category: ErrorCategory.TRANSIENT,
        statusCode: 429,
        errorCode: 'Throttled',
        message: 'Rate limit exceeded',
        isRetryable: true,
        retryAfter: 30,
        requestId: 'req-123',
      };

      const response = createErrorResponse(error);

      expect(response).toEqual({
        error: 'Throttled',
        message: 'Too many requests. Please wait a moment and try again.',
        statusCode: 429,
        retryAfter: 30,
        requestId: 'req-123',
      });
    });

    it('should create error response without optional fields', () => {
      const error: ParsedGraphError = {
        category: ErrorCategory.PERMANENT,
        statusCode: 404,
        errorCode: 'ResourceNotFound',
        message: 'Not found',
        isRetryable: false,
      };

      const response = createErrorResponse(error);

      expect(response).toEqual({
        error: 'ResourceNotFound',
        message: 'The requested resource was not found.',
        statusCode: 404,
        retryAfter: undefined,
        requestId: undefined,
      });
    });
  });
});
