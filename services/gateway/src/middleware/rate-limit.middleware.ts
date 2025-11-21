/**
 * Rate Limiting Middleware
 * Story 2.4.1: Partner User Management (SEC-003)
 * Story 2.5: Microsoft Graph API Integration Foundation (Task 6)
 *
 * Implements rate limiting for:
 * - Authentication-protected endpoints (prevent brute force)
 * - Microsoft Graph API calls (prevent quota exhaustion)
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { redis } from '@legal-platform/database';

/**
 * Rate limiter for user management read operations (GET requests)
 * Allows 30 requests per minute per IP
 *
 * Applied to:
 * - GET /api/users/pending
 * - GET /api/users/active
 */
export const userManagementReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'too_many_requests',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use IP address as identifier
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
});

/**
 * Rate limiter for user management write operations (POST/PATCH requests)
 * Allows 10 requests per minute per IP
 *
 * Applied to:
 * - POST /api/users/:id/activate
 * - POST /api/users/:id/deactivate
 * - PATCH /api/users/:id/role
 */
export const userManagementWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: 'too_many_requests',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 * Allows 5 login attempts per 15 minutes per IP
 *
 * Applied to authentication/login endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: {
    error: 'too_many_requests',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// ============================================================================
// Microsoft Graph API Rate Limiting (Story 2.5 - Task 6)
// ============================================================================

/**
 * Rate limit configuration for Microsoft Graph API
 */
export interface GraphRateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Key prefix for Redis keys
   */
  keyPrefix: string;

  /**
   * Whether to track per-user limits
   */
  perUser?: boolean;
}

/**
 * Default app-level rate limit configuration
 * Matches Microsoft Graph API limits: 10,000 requests per 10 minutes
 */
export const DEFAULT_GRAPH_APP_RATE_LIMIT: GraphRateLimitConfig = {
  maxRequests: parseInt(process.env.GRAPH_API_RATE_LIMIT_REQUESTS || '10000', 10),
  windowSeconds: parseInt(process.env.GRAPH_API_RATE_LIMIT_WINDOW || '600', 10), // 10 minutes
  keyPrefix: 'rate:graph:app',
  perUser: false,
};

/**
 * Default per-user rate limit configuration
 * Secondary protection: 100 requests per minute per user
 */
export const DEFAULT_GRAPH_USER_RATE_LIMIT: GraphRateLimitConfig = {
  maxRequests: parseInt(process.env.GRAPH_API_PER_USER_RATE_LIMIT || '100', 10),
  windowSeconds: 60, // 1 minute
  keyPrefix: 'rate:graph:user',
  perUser: true,
};

/**
 * Rate limit info returned in headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
}

/**
 * Check rate limit using sliding window algorithm with Redis
 *
 * @param key - Redis key for this rate limit
 * @param config - Rate limit configuration
 * @returns Rate limit info
 */
export async function checkGraphRateLimit(
  key: string,
  config: GraphRateLimitConfig
): Promise<RateLimitInfo> {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  // Redis key for sorted set storing request timestamps
  const redisKey = `${config.keyPrefix}:${key}`;

  try {
    // Start Redis transaction
    const multi = redis.multi();

    // Remove old requests outside the sliding window
    multi.zremrangebyscore(redisKey, 0, windowStart);

    // Count requests in current window
    multi.zcard(redisKey);

    // Add current request timestamp
    multi.zadd(redisKey, now, `${now}`);

    // Set key expiration (cleanup)
    multi.expire(redisKey, config.windowSeconds);

    // Execute transaction
    const results = await multi.exec();

    // Extract count from results (index 1 is zcard result)
    const count = (results?.[1]?.[1] as number) || 0;

    // Calculate remaining requests
    const remaining = Math.max(0, config.maxRequests - count - 1); // -1 for current request

    // Calculate reset time (end of current window)
    const reset = Math.ceil((now + windowMs) / 1000);

    return {
      limit: config.maxRequests,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('[Graph Rate Limit] Redis error:', error);

    // On Redis failure, allow request (fail-open) but log error
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: Math.ceil((now + config.windowSeconds * 1000) / 1000),
    };
  }
}

/**
 * Create Graph API rate limiting middleware
 *
 * @param config - Rate limit configuration
 * @returns Express middleware function
 */
export function createGraphRateLimitMiddleware(
  config: GraphRateLimitConfig = DEFAULT_GRAPH_APP_RATE_LIMIT
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determine rate limit key
      let key: string;

      if (config.perUser) {
        // Per-user rate limiting
        const userId = (req.session as any)?.userId;

        if (!userId) {
          // No user session - skip per-user rate limiting
          return next();
        }

        key = userId;
      } else {
        // App-level rate limiting (all requests)
        key = 'global';
      }

      // Check rate limit
      const rateLimitInfo = await checkGraphRateLimit(key, config);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
      res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset.toString());

      // Check if rate limit exceeded
      if (rateLimitInfo.remaining <= 0) {
        // Calculate Retry-After in seconds
        const retryAfter = rateLimitInfo.reset - Math.floor(Date.now() / 1000);

        res.setHeader('Retry-After', retryAfter.toString());

        // Log rate limit violation
        console.warn('[Graph Rate Limit] Limit exceeded', {
          key,
          limit: rateLimitInfo.limit,
          reset: rateLimitInfo.reset,
          retryAfter,
          ip: req.ip,
          path: req.path,
        });

        // Return 429 Too Many Requests
        res.status(429).json({
          error: 'rate_limit_exceeded',
          message: 'Too many requests to Microsoft Graph API. Please wait and try again.',
          retryAfter,
          reset: rateLimitInfo.reset,
        });

        return;
      }

      // Rate limit not exceeded - continue
      next();
    } catch (error) {
      console.error('[Graph Rate Limit] Middleware error:', error);

      // On error, fail-open (allow request) to avoid blocking legitimate traffic
      next();
    }
  };
}

/**
 * App-level Graph API rate limiting middleware
 * 10,000 requests per 10 minutes for the entire app
 */
export const graphAppRateLimitMiddleware = createGraphRateLimitMiddleware(
  DEFAULT_GRAPH_APP_RATE_LIMIT
);

/**
 * Per-user Graph API rate limiting middleware
 * 100 requests per minute per user
 */
export const graphUserRateLimitMiddleware = createGraphRateLimitMiddleware(
  DEFAULT_GRAPH_USER_RATE_LIMIT
);

/**
 * Combined Graph API rate limiting middleware
 * Applies both app-level and per-user limits
 */
export function combinedGraphRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Apply app-level limit first
  graphAppRateLimitMiddleware(req, res, (err?: any) => {
    if (err) {
      return next(err);
    }

    // If app-level limit passed, apply per-user limit
    if (!res.headersSent) {
      graphUserRateLimitMiddleware(req, res, next);
    }
  });
}
