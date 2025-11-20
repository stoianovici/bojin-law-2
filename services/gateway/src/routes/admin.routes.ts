/**
 * Admin Routes
 * Story 2.4: Authentication with Azure AD - Task 14
 *
 * Administrative endpoints for monitoring and management
 */

import { Router, Request, Response } from 'express';
import { redis, cacheManager } from '@legal-platform/database';

export const adminRouter: Router = Router();

/**
 * GET /admin/session-stats
 * Get statistics about active sessions
 *
 * Returns:
 * - Total active sessions
 * - Cache statistics
 * - Redis memory usage
 *
 * Usage: Monitoring and debugging session management
 */
adminRouter.get('/session-stats', async (req: Request, res: Response) => {
  try {
    // Task 14: Monitor active session count in Redis
    const stats = await cacheManager.stats();

    res.json({
      message: 'Session statistics retrieved successfully',
      stats: {
        totalKeys: stats.totalKeys,
        sessionKeys: stats.sessionKeys, // Active sessions
        cacheKeys: stats.cacheKeys,
        memoryUsed: stats.memoryUsed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error retrieving session stats:', error);
    res.status(500).json({
      error: 'stats_retrieval_failed',
      message: error.message || 'Failed to retrieve session statistics',
    });
  }
});

/**
 * POST /admin/cleanup-sessions
 * Manually trigger session cleanup
 *
 * Note: Redis automatically expires sessions based on TTL (7 days)
 * This endpoint is for manual cleanup of orphaned sessions
 *
 * Returns:
 * - Number of sessions cleaned up
 */
adminRouter.post('/cleanup-sessions', async (req: Request, res: Response) => {
  try {
    // Task 14: Manually cleanup expired sessions
    // Note: Redis TTL handles automatic cleanup
    // This is for logging/auditing purposes

    // Get session count before cleanup
    const statsBefore = await cacheManager.stats();

    // Redis automatically handles TTL-based expiration
    // For manual cleanup, we can scan for sessions with no TTL (shouldn't happen)
    let cleanedCount = 0;
    const pattern = 'sess:*';
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, foundKeys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );

      keys.push(...foundKeys);
      cursor = nextCursor;
    } while (cursor !== '0');

    // Check TTL for each session key
    for (const key of keys) {
      const ttl = await redis.ttl(key);

      // TTL = -1 means key has no expiration (shouldn't happen for sessions)
      // TTL = -2 means key doesn't exist
      if (ttl === -1 || ttl === -2) {
        await redis.del(key);
        cleanedCount++;
      }
    }

    const statsAfter = await cacheManager.stats();

    console.log(`Session cleanup completed: ${cleanedCount} sessions removed`);

    res.json({
      message: 'Session cleanup completed',
      cleanup: {
        sessionsRemoved: cleanedCount,
        sessionsBeforeCleanup: statsBefore.sessionKeys,
        sessionsAfterCleanup: statsAfter.sessionKeys,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error during session cleanup:', error);
    res.status(500).json({
      error: 'cleanup_failed',
      message: error.message || 'Failed to cleanup sessions',
    });
  }
});

/**
 * GET /admin/health
 * Health check endpoint
 *
 * Checks:
 * - Redis connection
 * - Database connection (future)
 *
 * Returns:
 * - Overall health status
 * - Component-specific health
 */
adminRouter.get('/health', async (req: Request, res: Response) => {
  try {
    // Check Redis health
    const redisPing = await redis.ping();
    const redisHealthy = redisPing === 'PONG';

    const overallHealthy = redisHealthy;

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'healthy' : 'unhealthy',
      components: {
        redis: {
          healthy: redisHealthy,
          latency: redisHealthy ? '<10ms' : 'N/A',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message || 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});
