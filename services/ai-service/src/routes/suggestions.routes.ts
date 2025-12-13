/**
 * Suggestions Routes
 * Story 3.3: Intelligent Document Drafting
 *
 * SSE endpoint for real-time clause suggestions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  ClauseSuggestionRequest,
  SSEClauseSuggestionEvent,
  DocumentType,
} from '@legal-platform/types';
import { clauseSuggestionService } from '../services/clause-suggestion.service';
import logger from '../lib/logger';

const router: Router = Router();

// Request validation schemas
const suggestionRequestSchema = z.object({
  documentId: z.string().uuid(),
  documentType: z.enum(['Contract', 'Motion', 'Letter', 'Memo', 'Pleading', 'Other'] as const),
  currentText: z.string().max(10000),
  cursorPosition: z.number().int().min(0),
  firmId: z.string().uuid(),
  userId: z.string().uuid(),
});

// Active SSE connections
const activeConnections = new Map<string, Response>();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Service-to-service authentication middleware
function authenticateService(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  const serviceApiKey = process.env.AI_SERVICE_API_KEY;
  if (serviceApiKey && token !== serviceApiKey) {
    return res.status(403).json({ error: 'Invalid service token' });
  }

  next();
}

// Validation middleware for query params
function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

/**
 * Send SSE event to client
 */
function sendSSEEvent(res: Response, event: SSEClauseSuggestionEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * GET /api/ai/suggestions/stream
 * Server-Sent Events endpoint for real-time clause suggestions
 */
router.get('/stream', authenticateService, async (req: Request, res: Response) => {
  const connectionId = uuidv4();
  const documentId = req.query.documentId as string;
  const userId = req.query.userId as string;
  const firmId = req.query.firmId as string;

  // Validate required params
  if (!documentId || !userId || !firmId) {
    return res.status(400).json({
      error: 'Missing required query parameters: documentId, userId, firmId',
    });
  }

  logger.info('SSE connection established', {
    connectionId,
    documentId,
    userId,
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Store connection
  const connectionKey = `${documentId}-${userId}`;
  activeConnections.set(connectionKey, res);

  // Send initial connection event
  sendSSEEvent(res, {
    type: 'heartbeat',
    timestamp: Date.now(),
  });

  // Set up heartbeat
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      sendSSEEvent(res, {
        type: 'heartbeat',
        timestamp: Date.now(),
      });
    }
  }, HEARTBEAT_INTERVAL);

  // Handle connection close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    activeConnections.delete(connectionKey);
    clauseSuggestionService.cancelPending(documentId, userId);
    logger.info('SSE connection closed', { connectionId, documentId });
  });

  // Handle errors
  res.on('error', (error) => {
    clearInterval(heartbeatInterval);
    activeConnections.delete(connectionKey);
    logger.error('SSE connection error', {
      connectionId,
      error: error.message,
    });
  });
});

/**
 * POST /api/ai/suggestions/request
 * Request suggestions for current text (will be sent via SSE)
 */
router.post(
  '/request',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const body = suggestionRequestSchema.parse(req.body);
      const connectionKey = `${body.documentId}-${body.userId}`;
      const connection = activeConnections.get(connectionKey);

      // If no active SSE connection, return suggestions directly
      if (!connection) {
        const suggestions = await clauseSuggestionService.getSuggestions(
          body as ClauseSuggestionRequest
        );
        return res.json({ suggestions });
      }

      // Request suggestions via debounced method
      const suggestions = await clauseSuggestionService.getDebouncedSuggestions(
        body as ClauseSuggestionRequest
      );

      // Send suggestions via SSE
      for (const suggestion of suggestions) {
        sendSSEEvent(connection, {
          type: 'suggestion',
          data: suggestion,
          timestamp: Date.now(),
        });
      }

      res.json({ status: 'suggestions_sent', count: suggestions.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      next(error);
    }
  }
);

/**
 * POST /api/ai/suggestions/sync
 * Get suggestions synchronously (without SSE)
 */
router.post(
  '/sync',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = suggestionRequestSchema.parse(req.body);
      const suggestions = await clauseSuggestionService.getSuggestions(
        body as ClauseSuggestionRequest
      );
      res.json({ suggestions });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/ai/suggestions/connection
 * Close SSE connection for a document/user
 */
router.delete('/connection', authenticateService, async (req: Request, res: Response) => {
  const documentId = req.query.documentId as string;
  const userId = req.query.userId as string;

  if (!documentId || !userId) {
    return res.status(400).json({
      error: 'Missing required query parameters: documentId, userId',
    });
  }

  const connectionKey = `${documentId}-${userId}`;
  const connection = activeConnections.get(connectionKey);

  if (connection) {
    // Send close event
    sendSSEEvent(connection, {
      type: 'error',
      error: 'Connection closed by request',
      timestamp: Date.now(),
    });

    // End the response
    connection.end();
    activeConnections.delete(connectionKey);

    // Cancel pending suggestions
    clauseSuggestionService.cancelPending(documentId, userId);

    logger.info('SSE connection closed by request', { documentId, userId });
  }

  res.json({ status: 'connection_closed' });
});

/**
 * GET /api/ai/suggestions/status
 * Get status of active connections
 */
router.get('/status', authenticateService, (_req: Request, res: Response) => {
  res.json({
    activeConnections: activeConnections.size,
    connectionIds: Array.from(activeConnections.keys()),
  });
});

export { router as suggestionsRoutes };
