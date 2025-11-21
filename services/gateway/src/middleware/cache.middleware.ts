/**
 * Cache Middleware for Graph API Responses
 * Story 2.5 - Task 15: Implement Graph Response Caching Layer
 *
 * Caches GET requests to Graph API using Redis.
 * Automatically invalidates cache on POST/PUT/DELETE operations.
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '@legal-platform/database';
import logger from '../utils/logger';
import type Redis from 'ioredis';

// Redis client from shared database package
const redisClient: Redis = redis;

/**
 * Cache TTL configuration based on resource type (in seconds)
 * Story 2.5 - Task 15 requirements
 */
const CACHE_TTL_CONFIG = {
  USER_PROFILE: parseInt(process.env.GRAPH_CACHE_TTL_USER_PROFILE || '3600', 10), // 1 hour
  CALENDAR: parseInt(process.env.GRAPH_CACHE_TTL_CALENDAR || '300', 10), // 5 minutes
  FILES: parseInt(process.env.GRAPH_CACHE_TTL_FILES || '900', 10), // 15 minutes
  EMAILS: parseInt(process.env.GRAPH_CACHE_TTL_EMAILS || '60', 10), // 1 minute
  DEFAULT: 300, // 5 minutes default
};

/**
 * Determine cache TTL based on request URL
 * @param url - Request URL
 * @returns TTL in seconds
 */
function getCacheTTL(url: string): number {
  if (
    url.includes('/users') ||
    (url.includes('/me') &&
      !url.includes('/messages') &&
      !url.includes('/calendar') &&
      !url.includes('/drive'))
  ) {
    return CACHE_TTL_CONFIG.USER_PROFILE;
  }

  if (url.includes('/calendar') || url.includes('/events')) {
    return CACHE_TTL_CONFIG.CALENDAR;
  }

  if (url.includes('/drive') || url.includes('/items')) {
    return CACHE_TTL_CONFIG.FILES;
  }

  if (url.includes('/messages')) {
    return CACHE_TTL_CONFIG.EMAILS;
  }

  return CACHE_TTL_CONFIG.DEFAULT;
}

/**
 * Generate cache key from request URL and user ID
 * @param url - Request URL
 * @param userId - User ID from session
 * @returns Cache key
 */
function generateCacheKey(url: string, userId: string): string {
  // Remove query string for consistent caching
  const urlWithoutQuery = url.split('?')[0];
  return `graph:${userId}:${urlWithoutQuery}`;
}

/**
 * Generate invalidation pattern for cache keys
 * @param url - Request URL
 * @param userId - User ID from session
 * @returns Glob pattern for cache keys to invalidate
 */
function generateInvalidationPattern(url: string, userId: string): string {
  // Invalidate all related cache entries
  // For example, if updating /users/me, invalidate all /users/me/* entries
  const urlWithoutQuery = url.split('?')[0];
  const segments = urlWithoutQuery.split('/').filter(Boolean);

  // Build pattern to match all cache entries for this resource
  // e.g., "graph:{userId}:/graph/users/me*"
  const resourcePath = '/' + segments.slice(0, segments.length).join('/');
  return `graph:${userId}:${resourcePath}*`;
}

/**
 * Cache middleware for Graph API GET requests
 * Caches responses and serves from cache on subsequent requests
 */
export async function graphCacheMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Check if user is authenticated (session.user is set by auth middleware)
  const session = req.session as any; // Use 'as any' for compatibility with existing routes
  if (!session || !session.userId) {
    return next();
  }

  const userId = session.userId;
  const cacheKey = generateCacheKey(req.path, userId);

  try {
    // Try to get cached response
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // Cache hit - return cached response
      const cachedResponse = JSON.parse(cachedData);

      logger.debug('[Cache Middleware] Cache HIT', {
        cacheKey,
        url: req.path,
        userId,
      });

      // Add cache headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `max-age=${getCacheTTL(req.path)}`);

      // Send response and return - don't call next()
      return res.status(200).json(cachedResponse) as any;
    }

    // Cache miss - continue to handler and cache the response
    logger.debug('[Cache Middleware] Cache MISS', {
      cacheKey,
      url: req.path,
      userId,
    });

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function (body: any): Response {
      // Cache the response (fire and forget)
      const ttl = getCacheTTL(req.path);

      redisClient
        .setex(cacheKey, ttl, JSON.stringify(body))
        .then(() => {
          logger.debug('[Cache Middleware] Response cached', {
            cacheKey,
            ttl,
            url: req.path,
          });
        })
        .catch((error: Error) => {
          logger.error('[Cache Middleware] Failed to cache response', {
            error: error.message,
            cacheKey,
          });
        });

      // Add cache headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `max-age=${ttl}`);

      // Call original res.json and return its result
      return originalJson(body) as Response;
    } as any;

    next();
  } catch (error: unknown) {
    logger.error('[Cache Middleware] Cache middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      cacheKey,
      url: req.path,
    });

    // On error, just continue without caching
    next();
  }
}

/**
 * Cache invalidation middleware for Graph API POST/PUT/DELETE requests
 * Invalidates cache entries related to the modified resource
 */
export async function graphCacheInvalidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only invalidate on non-GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Check if user is authenticated
  const session = req.session as any;
  if (!session || !session.userId) {
    return next();
  }

  const userId = session.userId;
  const invalidationPattern = generateInvalidationPattern(req.path, userId);

  try {
    // Store original response handlers
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Invalidate cache after successful response
    const invalidateCache = async () => {
      try {
        // Find all keys matching the pattern
        const keys = await redisClient.keys(invalidationPattern);

        if (keys.length > 0) {
          await redisClient.del(...keys);

          logger.info('[Cache Middleware] Cache invalidated', {
            pattern: invalidationPattern,
            keysDeleted: keys.length,
            method: req.method,
            url: req.path,
          });
        }
      } catch (error: unknown) {
        logger.error('[Cache Middleware] Failed to invalidate cache', {
          error: error instanceof Error ? error.message : 'Unknown error',
          pattern: invalidationPattern,
        });
      }
    };

    // Override res.json to invalidate after response
    res.json = function (body: any): Response {
      invalidateCache();
      return originalJson(body) as Response;
    } as any;

    // Override res.send to invalidate after response
    res.send = function (body: any): Response {
      invalidateCache();
      return originalSend(body) as Response;
    } as any;

    next();
  } catch (error: unknown) {
    logger.error('[Cache Middleware] Cache invalidation middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pattern: invalidationPattern,
    });

    // On error, just continue without invalidation
    next();
  }
}

/**
 * Manual cache invalidation for admin
 * Invalidates all cache entries for a specific user or pattern
 *
 * @param userId - User ID to invalidate cache for
 * @param pattern - Optional pattern to match (defaults to all user cache)
 */
export async function invalidateUserCache(userId: string, pattern?: string): Promise<number> {
  try {
    const invalidationPattern = pattern || `graph:${userId}:*`;

    const keys = await redisClient.keys(invalidationPattern);

    if (keys.length > 0) {
      await redisClient.del(...keys);

      logger.info('[Cache Middleware] Manual cache invalidation', {
        userId,
        pattern: invalidationPattern,
        keysDeleted: keys.length,
      });

      return keys.length;
    }

    return 0;
  } catch (error: unknown) {
    logger.error('[Cache Middleware] Manual cache invalidation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      pattern,
    });
    throw error;
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  dbSize?: number;
  info?: string;
}> {
  try {
    const dbSize = await redisClient.dbsize();
    const info = await redisClient.info('stats');

    return {
      connected: redisClient.status === 'ready',
      dbSize,
      info,
    };
  } catch (error: unknown) {
    logger.error('[Cache Middleware] Failed to get cache stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      connected: false,
    };
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 * Note: The Redis client is managed by @legal-platform/database package
 * This function is kept for backward compatibility but delegates to the shared client
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redisClient.status === 'ready') {
      await redisClient.quit();
      logger.info('[Cache Middleware] Redis connection closed');
    }
  } catch (error: unknown) {
    logger.error('[Cache Middleware] Error closing Redis connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
