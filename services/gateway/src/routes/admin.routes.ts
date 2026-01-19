/**
 * Admin Routes
 * Story 2.4: Authentication with Azure AD - Task 14
 *
 * Administrative endpoints for monitoring and management
 */

import { Router, Request, Response } from 'express';
import { redis, cacheManager, prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import { contactMatcherService } from '../services/contact-matcher';

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
      const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

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

/**
 * POST /admin/fix-orphaned-emails
 * Fix orphaned emails after case deletion
 *
 * This endpoint:
 * 1. Finds emails with Classified state but no case/client
 * 2. Matches sender to client → routes to ClientInbox
 * 3. Backfills clientId on emails with caseId but no clientId
 */
adminRouter.post('/fix-orphaned-emails', async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Starting orphaned email fix...');

    const stats = {
      orphanedTotal: 0,
      matchedToClient: 0,
      resetToPending: 0,
      clientIdBackfilled: 0,
      errors: 0,
    };

    // Part 1: Fix truly orphaned emails (Classified but no case or client)
    const orphanedEmails = await prisma.email.findMany({
      where: {
        classificationState: EmailClassificationState.Classified,
        caseId: null,
        clientId: null,
      },
      select: {
        id: true,
        from: true,
        firmId: true,
        subject: true,
      },
    });

    stats.orphanedTotal = orphanedEmails.length;
    console.log(`[Admin] Found ${orphanedEmails.length} orphaned emails`);

    for (const email of orphanedEmails) {
      try {
        const fromAddress = (email.from as { address?: string })?.address;

        if (!fromAddress) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              classificationState: EmailClassificationState.Pending,
              classifiedAt: new Date(),
              classifiedBy: 'orphan-fix-api',
            },
          });
          stats.resetToPending++;
          continue;
        }

        const match = await contactMatcherService.findContactMatch(fromAddress, email.firmId);

        if (match.certainty !== 'NONE' && match.clientId) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              clientId: match.clientId,
              classificationState: EmailClassificationState.ClientInbox,
              classifiedAt: new Date(),
              classifiedBy: 'orphan-fix-api',
            },
          });
          stats.matchedToClient++;
        } else {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              classificationState: EmailClassificationState.Pending,
              classifiedAt: new Date(),
              classifiedBy: 'orphan-fix-api',
            },
          });
          stats.resetToPending++;
        }
      } catch (err) {
        stats.errors++;
        console.error(`[Admin] Error processing orphaned email ${email.id}:`, err);
      }
    }

    // Part 2: Backfill clientId on emails with caseId but no clientId
    const emailsNeedingClientId = await prisma.email.findMany({
      where: {
        classificationState: EmailClassificationState.Classified,
        caseId: { not: null },
        clientId: null,
      },
      select: {
        id: true,
        caseId: true,
      },
    });

    console.log(`[Admin] Found ${emailsNeedingClientId.length} emails needing clientId backfill`);

    const uniqueCaseIds = [...new Set(emailsNeedingClientId.map((e) => e.caseId!))];
    const cases = await prisma.case.findMany({
      where: { id: { in: uniqueCaseIds } },
      select: { id: true, clientId: true },
    });

    const caseClientMap = new Map<string, string>();
    for (const c of cases) {
      caseClientMap.set(c.id, c.clientId);
    }

    for (const email of emailsNeedingClientId) {
      const clientId = caseClientMap.get(email.caseId!);

      if (clientId) {
        try {
          await prisma.email.update({
            where: { id: email.id },
            data: { clientId },
          });
          stats.clientIdBackfilled++;
        } catch (err) {
          stats.errors++;
          console.error(`[Admin] Error backfilling clientId for email ${email.id}:`, err);
        }
      }
    }

    console.log('[Admin] Orphaned email fix complete:', stats);

    res.json({
      message: 'Orphaned email fix completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Admin] Error fixing orphaned emails:', error);
    res.status(500).json({
      error: 'fix_failed',
      message: error.message || 'Failed to fix orphaned emails',
    });
  }
});
