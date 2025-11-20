/**
 * Rate Limiting Middleware
 * Story 2.4.1: Partner User Management (SEC-003)
 *
 * Implements rate limiting for authentication-protected endpoints
 * to prevent brute force attacks and API abuse
 */

import rateLimit from 'express-rate-limit';

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
