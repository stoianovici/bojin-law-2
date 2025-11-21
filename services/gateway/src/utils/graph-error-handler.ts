/**
 * Microsoft Graph API Error Handler
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 12
 *
 * Handles Graph API errors, maps error codes to meaningful messages,
 * and categorizes errors as transient or permanent for retry logic.
 *
 * Error Categories:
 * - Transient: 429 (Rate Limit), 500 (Server Error), 503 (Service Unavailable), Network Timeouts
 * - Permanent: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)
 *
 * Reference: https://learn.microsoft.com/en-us/graph/errors
 */

/**
 * Graph API error response structure
 */
export interface GraphApiErrorResponse {
  error: {
    code: string;
    message: string;
    innerError?: {
      code?: string;
      date?: string;
      'request-id'?: string;
      'client-request-id'?: string;
    };
  };
}

/**
 * Categorized error types
 */
export enum ErrorCategory {
  TRANSIENT = 'transient', // Retry recommended
  PERMANENT = 'permanent', // Do not retry
  AUTH = 'auth', // Authentication issue - trigger token refresh
}

/**
 * Parsed Graph API error
 */
export interface ParsedGraphError {
  category: ErrorCategory;
  statusCode: number;
  errorCode: string;
  message: string;
  retryAfter?: number; // Seconds to wait before retry (from Retry-After header)
  requestId?: string;
  isRetryable: boolean;
}

/**
 * HTTP status codes categorization
 */
const TRANSIENT_STATUS_CODES = new Set([429, 500, 503, 504]);
const AUTH_STATUS_CODES = new Set([401]);
const PERMANENT_STATUS_CODES = new Set([400, 403, 404, 405, 406, 409, 410, 422]);

/**
 * Transient Graph API error codes (should be retried)
 */
const TRANSIENT_ERROR_CODES = new Set([
  'Throttled',
  'TooManyRequests',
  'ServiceNotAvailable',
  'ServiceUnavailable',
  'GatewayTimeout',
  'Timeout',
  'generalException', // Sometimes transient
  'InternalServerError',
]);

/**
 * Authentication-related error codes (trigger token refresh)
 */
const AUTH_ERROR_CODES = new Set([
  'InvalidAuthenticationToken',
  'AuthenticationFailed',
  'ExpiredAuthenticationToken',
  'Unauthenticated',
  'CompactTokenParsingFailed',
]);

/**
 * Parse Graph API error response
 *
 * @param error - Error object from Graph API call
 * @param statusCode - HTTP status code
 * @param headers - Response headers (for Retry-After)
 * @returns Parsed error with category and retry information
 */
export function parseGraphError(
  error: any,
  statusCode?: number,
  headers?: Record<string, string>
): ParsedGraphError {
  // Extract status code
  const status = statusCode || error.statusCode || error.status || 500;

  // Extract error code and message
  let errorCode = 'UnknownError';
  let message = 'An unknown error occurred';
  let requestId: string | undefined;

  // Handle Graph API error response structure
  if (error.body?.error) {
    const graphError = error.body.error;
    errorCode = graphError.code || errorCode;
    message = graphError.message || message;
    requestId = graphError.innerError?.['request-id'];
  } else if (error.error?.code) {
    errorCode = error.error.code;
    message = error.error.message || message;
    requestId = error.error.innerError?.['request-id'];
  } else if (error.code) {
    errorCode = error.code;
    message = error.message || message;
  } else if (error.message) {
    message = error.message;
  }

  // Determine category
  let category: ErrorCategory;
  let isRetryable: boolean;

  // Check auth errors first
  if (AUTH_STATUS_CODES.has(status) || AUTH_ERROR_CODES.has(errorCode)) {
    category = ErrorCategory.AUTH;
    isRetryable = true; // Can retry after token refresh
  }
  // Check transient errors
  else if (TRANSIENT_STATUS_CODES.has(status) || TRANSIENT_ERROR_CODES.has(errorCode)) {
    category = ErrorCategory.TRANSIENT;
    isRetryable = true;
  }
  // Permanent errors
  else {
    category = ErrorCategory.PERMANENT;
    isRetryable = false;
  }

  // Extract Retry-After header (for 429 responses)
  let retryAfter: number | undefined;
  if (headers?.['retry-after']) {
    const retryAfterValue = headers['retry-after'];
    // Retry-After can be in seconds (number) or HTTP date
    const parsedRetryAfter = parseInt(retryAfterValue, 10);
    if (!isNaN(parsedRetryAfter)) {
      retryAfter = parsedRetryAfter;
    }
  }

  return {
    category,
    statusCode: status,
    errorCode,
    message,
    retryAfter,
    requestId,
    isRetryable,
  };
}

/**
 * Get user-friendly error message for Graph API errors
 *
 * @param errorCode - Graph API error code
 * @param statusCode - HTTP status code
 * @returns User-friendly error message
 */
export function getUserFriendlyMessage(errorCode: string, statusCode: number): string {
  const errorMessages: Record<string, string> = {
    // Auth errors
    InvalidAuthenticationToken: 'Your session has expired. Please sign in again.',
    AuthenticationFailed: 'Authentication failed. Please sign in again.',
    ExpiredAuthenticationToken: 'Your session has expired. Please sign in again.',
    Unauthenticated: 'You are not authenticated. Please sign in.',

    // Rate limiting
    Throttled: 'Too many requests. Please wait a moment and try again.',
    TooManyRequests: 'Too many requests. Please wait a moment and try again.',

    // Service errors
    ServiceNotAvailable:
      'Microsoft Graph service is temporarily unavailable. Please try again later.',
    ServiceUnavailable:
      'Microsoft Graph service is temporarily unavailable. Please try again later.',
    GatewayTimeout: 'Request timed out. Please check your connection and try again.',
    Timeout: 'Request timed out. Please check your connection and try again.',
    InternalServerError: 'An internal server error occurred. Please try again later.',

    // Permission errors
    Forbidden: 'You do not have permission to access this resource.',
    AccessDenied: 'Access denied. You do not have permission to perform this action.',

    // Not found
    ResourceNotFound: 'The requested resource was not found.',
    ItemNotFound: 'The requested item was not found.',

    // Bad request
    BadRequest: 'Invalid request. Please check your input and try again.',
    InvalidRequest: 'Invalid request. Please check your input and try again.',
  };

  // Return mapped message or default based on status code
  if (errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  // Fallback messages based on status code
  if (statusCode >= 500) {
    return 'A server error occurred. Please try again later.';
  } else if (statusCode === 429) {
    return 'Too many requests. Please wait and try again.';
  } else if (statusCode === 404) {
    return 'The requested resource was not found.';
  } else if (statusCode === 403) {
    return 'You do not have permission to access this resource.';
  } else if (statusCode === 401) {
    return 'Your session has expired. Please sign in again.';
  } else if (statusCode >= 400) {
    return 'Invalid request. Please check your input and try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log Graph API error with structured format
 *
 * @param error - Parsed Graph error
 * @param context - Additional context (endpoint, userId, etc.)
 */
export function logGraphError(
  error: ParsedGraphError,
  context: {
    endpoint?: string;
    userId?: string;
    operation?: string;
    [key: string]: any;
  } = {}
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    category: error.category,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    message: error.message,
    isRetryable: error.isRetryable,
    retryAfter: error.retryAfter,
    requestId: error.requestId,
    ...context,
  };

  // Log based on severity
  if (error.category === ErrorCategory.TRANSIENT) {
    console.warn('[Graph API - Transient Error]', logData);
  } else if (error.category === ErrorCategory.AUTH) {
    console.warn('[Graph API - Auth Error]', logData);
  } else {
    console.error('[Graph API - Permanent Error]', logData);
  }
}

/**
 * Create standardized error response for API consumers
 *
 * @param error - Parsed Graph error
 * @returns Standardized error response object
 */
export function createErrorResponse(error: ParsedGraphError): {
  error: string;
  message: string;
  statusCode: number;
  retryAfter?: number;
  requestId?: string;
} {
  return {
    error: error.errorCode,
    message: getUserFriendlyMessage(error.errorCode, error.statusCode),
    statusCode: error.statusCode,
    retryAfter: error.retryAfter,
    requestId: error.requestId,
  };
}

/**
 * Check if error is an authentication error (401 Unauthorized)
 *
 * @param error - Error object from Graph API
 * @returns true if error is a 401 authentication error
 */
export function isAuthError(error: any): boolean {
  // Check status code
  const statusCode = error.statusCode || error.status || 0;
  if (statusCode === 401) {
    return true;
  }

  // Check error code
  const errorCode = error.body?.error?.code || error.error?.code || error.code || '';

  return AUTH_ERROR_CODES.has(errorCode);
}
