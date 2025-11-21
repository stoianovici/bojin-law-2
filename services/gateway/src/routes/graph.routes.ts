/**
 * Microsoft Graph API Routes
 * Story 2.5: Microsoft Graph API Integration Foundation (Task 7)
 *
 * REST endpoints for Microsoft Graph API operations.
 * All routes include rate limiting middleware to prevent quota exhaustion.
 *
 * Rate Limits:
 * - App-level: 10,000 requests per 10 minutes
 * - Per-user: 100 requests per minute
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { Router as ExpressRouter } from 'express';
import { GraphService } from '../services/graph.service';
import { combinedGraphRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import {
  graphCacheMiddleware,
  graphCacheInvalidationMiddleware,
} from '../middleware/cache.middleware';

const router: ExpressRouter = Router();
const graphService = new GraphService();

/**
 * Authentication middleware to extract access token from session
 * All Graph API routes require authenticated user with valid access token
 */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as any;

  if (!session?.userId || !session?.accessToken) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Store access token in res.locals for route handlers
  res.locals.accessToken = session.accessToken;
  res.locals.userId = session.userId;

  next();
}

// Apply middleware to all Graph API routes
// Order: Rate limiting → Authentication → Caching → Cache invalidation
router.use(combinedGraphRateLimitMiddleware);
router.use(requireAuth);
router.use(graphCacheMiddleware); // Cache GET requests
router.use(graphCacheInvalidationMiddleware); // Invalidate cache on POST/PUT/DELETE

// ============================================================================
// User Profile Endpoints
// ============================================================================

/**
 * GET /graph/users/me
 * Get current user's profile from Microsoft Graph
 *
 * Requires: User.Read delegated permission
 * Rate limited: Yes
 */
router.get('/users/me', async (req: Request, res: Response) => {
  try {
    const accessToken = res.locals.accessToken as string;

    const profile = await graphService.getUserProfile(accessToken);

    res.json({
      data: profile,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching user profile:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to fetch user profile',
    });
  }
});

/**
 * GET /graph/users/:userId
 * Get user profile by ID from Microsoft Graph
 *
 * Requires: User.Read.All application permission or User.ReadBasic.All delegated permission
 * Rate limited: Yes
 */
router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const accessToken = res.locals.accessToken as string;

    if (!userId) {
      res.status(400).json({
        error: 'bad_request',
        message: 'userId parameter is required',
      });
      return;
    }

    const profile = await graphService.getUserById(userId, accessToken);

    res.json({
      data: profile,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching user by ID:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to fetch user profile',
    });
  }
});

// ============================================================================
// Email / Messages Endpoints
// ============================================================================

/**
 * GET /graph/messages
 * List user's email messages
 *
 * Query params:
 * - top: Number of messages to retrieve (default: 10, max: 100)
 *
 * Requires: Mail.Read delegated permission
 * Rate limited: Yes
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const accessToken = res.locals.accessToken as string;
    const top = Math.min(parseInt(req.query.top as string, 10) || 10, 100);

    const messages = await graphService.listMessages(accessToken, top);

    res.json({
      data: messages,
      count: messages.length,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error listing messages:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to list messages',
    });
  }
});

/**
 * GET /graph/messages/:messageId
 * Get specific email message by ID
 *
 * Requires: Mail.Read delegated permission
 * Rate limited: Yes
 */
router.get('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const accessToken = res.locals.accessToken as string;

    if (!messageId) {
      res.status(400).json({
        error: 'bad_request',
        message: 'messageId parameter is required',
      });
      return;
    }

    const message = await graphService.getMessageById(accessToken, messageId);

    res.json({
      data: message,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching message:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to fetch message',
    });
  }
});

/**
 * POST /graph/messages/send
 * Send email on behalf of authenticated user
 *
 * Body:
 * - subject: Email subject
 * - body: { contentType: 'Text' | 'HTML', content: string }
 * - toRecipients: Array<{ emailAddress: { address: string } }>
 *
 * Requires: Mail.Send delegated permission
 * Rate limited: Yes
 */
router.post('/messages/send', async (req: Request, res: Response) => {
  try {
    const accessToken = res.locals.accessToken as string;
    const { subject, body, toRecipients } = req.body;

    // Validate required fields
    if (!subject || !body || !toRecipients || !Array.isArray(toRecipients)) {
      res.status(400).json({
        error: 'bad_request',
        message: 'subject, body, and toRecipients are required',
      });
      return;
    }

    if (!body.contentType || !body.content) {
      res.status(400).json({
        error: 'bad_request',
        message: 'body must contain contentType and content',
      });
      return;
    }

    if (toRecipients.length === 0) {
      res.status(400).json({
        error: 'bad_request',
        message: 'toRecipients must contain at least one recipient',
      });
      return;
    }

    await graphService.sendMail(accessToken, {
      subject,
      body,
      toRecipients,
    });

    res.status(202).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error sending email:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to send email',
    });
  }
});

// ============================================================================
// OneDrive / Files Endpoints
// ============================================================================

/**
 * GET /graph/drive/root
 * Get user's OneDrive root folder
 *
 * Requires: Files.Read or Files.ReadWrite delegated permission
 * Rate limited: Yes
 */
router.get('/drive/root', async (req: Request, res: Response) => {
  try {
    const accessToken = res.locals.accessToken as string;

    const driveRoot = await graphService.getDriveRoot(accessToken);

    res.json({
      data: driveRoot,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching drive root:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to fetch drive root',
    });
  }
});

/**
 * GET /graph/drive/items/:itemId
 * Get OneDrive file/folder metadata by ID
 *
 * Requires: Files.Read or Files.ReadWrite delegated permission
 * Rate limited: Yes
 */
router.get('/drive/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const accessToken = res.locals.accessToken as string;

    if (!itemId) {
      res.status(400).json({
        error: 'bad_request',
        message: 'itemId parameter is required',
      });
      return;
    }

    const driveItem = await graphService.getDriveItem(accessToken, itemId);

    res.json({
      data: driveItem,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching drive item:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to fetch drive item',
    });
  }
});

// ============================================================================
// Calendar Endpoints
// ============================================================================

/**
 * GET /graph/calendar/events
 * List user's calendar events
 *
 * Query params:
 * - top: Number of events to retrieve (default: 10, max: 100)
 *
 * Requires: Calendars.Read delegated permission
 * Rate limited: Yes
 */
router.get('/calendar/events', async (req: Request, res: Response) => {
  try {
    const accessToken = res.locals.accessToken as string;
    const top = Math.min(parseInt(req.query.top as string, 10) || 10, 100);

    const events = await graphService.listCalendarEvents(accessToken, top);

    res.json({
      data: events,
      count: events.length,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error listing calendar events:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to list calendar events',
    });
  }
});

/**
 * GET /graph/calendar/events/:eventId
 * Get specific calendar event by ID
 *
 * Requires: Calendars.Read delegated permission
 * Rate limited: Yes
 */
router.get('/calendar/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const accessToken = res.locals.accessToken as string;

    if (!eventId) {
      res.status(400).json({
        error: 'bad_request',
        message: 'eventId parameter is required',
      });
      return;
    }

    const event = await graphService.getCalendarEventById(accessToken, eventId);

    res.json({
      data: event,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching calendar event:', error);

    res.status(error.statusCode || 500).json({
      error: error.code || 'internal_error',
      message: error.message || 'Failed to fetch calendar event',
    });
  }
});

// ============================================================================
// Admin Cache Management Endpoints
// ============================================================================

/**
 * POST /graph/admin/cache/invalidate
 * Manually invalidate cache for a specific user
 *
 * Body:
 * - userId: User ID to invalidate cache for
 * - pattern: Optional pattern to match (defaults to all user cache)
 *
 * Requires: Admin role
 * Rate limited: Yes
 *
 * Story 2.5 - Task 16: Manual cache invalidation endpoint
 */
router.post('/admin/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { userId, pattern } = req.body;

    // TODO: Add admin role check (requires role-based access control from future stories)
    // For now, any authenticated user can invalidate their own cache
    const requestingUserId = res.locals.userId as string;

    if (!userId) {
      res.status(400).json({
        error: 'bad_request',
        message: 'userId is required',
      });
      return;
    }

    // Only allow users to invalidate their own cache unless admin
    // TODO: Check if requesting user is admin
    const isAdmin = false; // Placeholder - implement admin check in future story

    if (!isAdmin && userId !== requestingUserId) {
      res.status(403).json({
        error: 'forbidden',
        message: 'You can only invalidate your own cache',
      });
      return;
    }

    const { invalidateUserCache } = await import('../middleware/cache.middleware');
    const keysDeleted = await invalidateUserCache(userId, pattern);

    res.json({
      success: true,
      message: 'Cache invalidated successfully',
      keysDeleted,
      userId,
      pattern: pattern || `graph:${userId}:*`,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error invalidating cache:', error);

    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to invalidate cache',
    });
  }
});

/**
 * GET /graph/admin/cache/stats
 * Get cache statistics for monitoring
 *
 * Requires: Admin role
 * Rate limited: Yes
 *
 * Story 2.5 - Task 16: Cache monitoring endpoint
 */
router.get('/admin/cache/stats', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check (requires role-based access control from future stories)
    const isAdmin = false; // Placeholder

    if (!isAdmin) {
      res.status(403).json({
        error: 'forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const { getCacheStats } = await import('../middleware/cache.middleware');
    const stats = await getCacheStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[Graph Routes] Error fetching cache stats:', error);

    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch cache stats',
    });
  }
});

export { router as graphRouter };
