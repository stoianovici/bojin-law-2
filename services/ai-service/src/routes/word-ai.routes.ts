/**
 * Word AI Routes
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * REST API endpoints for Word add-in AI features
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { wordAIService } from '../services/word-ai.service';
import logger from '../lib/logger';

const router = Router();

// Request validation schemas
const suggestionRequestSchema = z.object({
  documentId: z.string().uuid(),
  selectedText: z.string().max(5000),
  cursorContext: z.string().max(2000),
  suggestionType: z.enum(['completion', 'alternative', 'precedent']),
});

const explainRequestSchema = z.object({
  documentId: z.string().uuid(),
  selectedText: z.string().min(1).max(3000),
});

const improveRequestSchema = z.object({
  documentId: z.string().uuid(),
  selectedText: z.string().min(1).max(3000),
  improvementType: z.enum(['clarity', 'formality', 'brevity', 'legal_precision']),
});

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

/**
 * POST /api/ai/word/suggest
 * Get AI suggestions for Word add-in
 *
 * Request body:
 * - documentId: Document UUID
 * - selectedText: Currently selected text
 * - cursorContext: Text before cursor (for context)
 * - suggestionType: 'completion' | 'alternative' | 'precedent'
 *
 * Response:
 * - suggestions: Array of WordAISuggestion
 * - processingTimeMs: Processing time in milliseconds
 */
router.post(
  '/suggest',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = suggestionRequestSchema.parse(req.body);

      logger.info('Word AI suggest endpoint called', {
        documentId: body.documentId,
        suggestionType: body.suggestionType,
      });

      const response = await wordAIService.getSuggestions({
        documentId: body.documentId,
        selectedText: body.selectedText,
        cursorContext: body.cursorContext,
        suggestionType: body.suggestionType,
      });

      res.json(response);
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
 * POST /api/ai/word/explain
 * Explain selected legal text in plain language
 *
 * Request body:
 * - documentId: Document UUID
 * - selectedText: Text to explain
 *
 * Response:
 * - explanation: Plain language explanation
 * - legalBasis: Relevant legal principles
 * - sourceReferences: Array of legal code references
 * - processingTimeMs: Processing time in milliseconds
 */
router.post(
  '/explain',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = explainRequestSchema.parse(req.body);

      logger.info('Word AI explain endpoint called', {
        documentId: body.documentId,
        textLength: body.selectedText.length,
      });

      const response = await wordAIService.explainText({
        documentId: body.documentId,
        selectedText: body.selectedText,
      });

      res.json(response);
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
 * POST /api/ai/word/improve
 * Improve selected text with specified improvement type
 *
 * Request body:
 * - documentId: Document UUID
 * - selectedText: Text to improve
 * - improvementType: 'clarity' | 'formality' | 'brevity' | 'legal_precision'
 *
 * Response:
 * - original: Original text
 * - improved: Improved text
 * - explanation: What was changed
 * - processingTimeMs: Processing time in milliseconds
 */
router.post(
  '/improve',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = improveRequestSchema.parse(req.body);

      logger.info('Word AI improve endpoint called', {
        documentId: body.documentId,
        improvementType: body.improvementType,
      });

      const response = await wordAIService.improveText({
        documentId: body.documentId,
        selectedText: body.selectedText,
        improvementType: body.improvementType,
      });

      res.json(response);
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
 * GET /api/ai/word/health
 * Health check for Word AI service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'word-ai',
    timestamp: new Date().toISOString(),
  });
});

export { router as wordAIRoutes };
