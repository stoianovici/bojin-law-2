/**
 * Email Drafting Routes
 * Story 5.3: AI-Powered Email Drafting
 *
 * API routes for email draft generation, refinement, and inline suggestions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { emailDraftingService, EmailTone, RecipientType } from '../services/email-drafting.service';
import { draftRefinementService } from '../services/draft-refinement.service';
import { emailContextAggregatorService } from '../services/email-context-aggregator.service';
import logger from '../lib/logger';

const router: Router = Router();

// Rate limiting map for draft generation (per user per hour)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_HOUR = parseInt(process.env.DRAFT_RATE_LIMIT_PER_HOUR || '50', 10);

// ============================================================================
// Request Validation Schemas
// ============================================================================

const generateDraftSchema = z.object({
  originalEmail: z.object({
    id: z.string(),
    graphMessageId: z.string(),
    subject: z.string(),
    bodyContent: z.string(),
    bodyContentType: z.string(),
    from: z.object({
      name: z.string().optional(),
      address: z.string(),
    }),
    toRecipients: z.array(
      z.object({
        name: z.string().optional(),
        address: z.string(),
      })
    ),
    ccRecipients: z
      .array(
        z.object({
          name: z.string().optional(),
          address: z.string(),
        })
      )
      .optional()
      .default([]),
    receivedDateTime: z.string().transform((s) => new Date(s)),
    sentDateTime: z.string().transform((s) => new Date(s)),
    hasAttachments: z.boolean(),
  }),
  caseId: z.string().nullable().optional(),
  tone: z.enum(['Formal', 'Professional', 'Brief', 'Detailed']).optional().default('Professional'),
  recipientType: z
    .enum(['Client', 'OpposingCounsel', 'Court', 'ThirdParty', 'Internal'])
    .optional()
    .default('Client'),
  firmId: z.string(),
  userId: z.string(),
});

const refineDraftSchema = z.object({
  draftId: z.string(),
  currentBody: z.string(),
  instruction: z.string(),
  caseId: z.string().nullable().optional(),
  firmId: z.string(),
  userId: z.string(),
});

const inlineSuggestionSchema = z.object({
  partialText: z.string(),
  context: z.object({
    originalEmailSubject: z.string(),
    originalEmailBody: z.string(),
    recipientType: z.string(),
    tone: z.string(),
    caseTitle: z.string().optional(),
  }),
  firmId: z.string(),
  userId: z.string(),
});

// ============================================================================
// Middleware
// ============================================================================

/**
 * Service-to-service authentication middleware
 */
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
 * Rate limiting middleware for draft generation
 * Implements per-user rate limiting to prevent abuse
 */
function rateLimitDraftGeneration(req: Request, res: Response, next: NextFunction) {
  const userId = req.body.userId;
  if (!userId) {
    return next();
  }

  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const userLimit = rateLimitMap.get(userId);

  // Clean up and check rate limit
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + hourMs });
    return next();
  }

  if (userLimit.count >= RATE_LIMIT_PER_HOUR) {
    const minutesRemaining = Math.ceil((userLimit.resetAt - now) / 60000);
    logger.warn('Rate limit exceeded for draft generation', { userId, count: userLimit.count });
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${RATE_LIMIT_PER_HOUR} drafts per hour. Try again in ${minutesRemaining} minutes.`,
      retryAfter: minutesRemaining * 60,
    });
  }

  userLimit.count++;
  next();
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/email-drafting/generate
 * Generate a single email draft with specified tone
 */
router.post(
  '/generate',
  authenticateService,
  rateLimitDraftGeneration,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = generateDraftSchema.parse(req.body);

      logger.info('Generating email draft', {
        emailId: body.originalEmail.id,
        tone: body.tone,
        recipientType: body.recipientType,
        userId: body.userId,
      });

      // Get case context if caseId provided
      let caseContext;
      if (body.caseId) {
        try {
          caseContext = await emailContextAggregatorService.aggregateCaseContext(
            body.caseId,
            body.originalEmail.id,
            body.firmId
          );
        } catch (error) {
          logger.warn('Failed to get case context, proceeding without it', {
            caseId: body.caseId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Get thread history (empty for now - would need to query email thread)
      const threadHistory: any[] = [];

      const result = await emailDraftingService.generateEmailDraft({
        originalEmail: body.originalEmail,
        caseContext,
        threadHistory,
        tone: body.tone as EmailTone,
        recipientType: body.recipientType as RecipientType,
        firmId: body.firmId,
        userId: body.userId,
      });

      res.json(result);
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
 * POST /api/email-drafting/generate-multiple
 * Generate multiple drafts with different tones in parallel
 */
router.post(
  '/generate-multiple',
  authenticateService,
  rateLimitDraftGeneration,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = generateDraftSchema.parse(req.body);

      logger.info('Generating multiple email drafts', {
        emailId: body.originalEmail.id,
        recipientType: body.recipientType,
        userId: body.userId,
      });

      // Get case context if caseId provided
      let caseContext;
      if (body.caseId) {
        try {
          caseContext = await emailContextAggregatorService.aggregateCaseContext(
            body.caseId,
            body.originalEmail.id,
            body.firmId
          );
        } catch (error) {
          logger.warn('Failed to get case context, proceeding without it', {
            caseId: body.caseId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Get thread history (empty for now)
      const threadHistory: any[] = [];

      const result = await emailDraftingService.generateMultipleDrafts({
        originalEmail: body.originalEmail,
        caseContext,
        threadHistory,
        recipientType: body.recipientType as RecipientType,
        firmId: body.firmId,
        userId: body.userId,
      });

      res.json(result);
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
 * POST /api/email-drafting/refine
 * Refine an existing draft based on user instruction
 */
router.post(
  '/refine',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refineDraftSchema.parse(req.body);

      logger.info('Refining email draft', {
        draftId: body.draftId,
        instructionLength: body.instruction.length,
        userId: body.userId,
      });

      // Get case context if available
      let caseContext;
      if (body.caseId) {
        try {
          caseContext = await emailContextAggregatorService.aggregateCaseContext(
            body.caseId,
            '', // No specific email ID needed for refinement
            body.firmId
          );
        } catch (error) {
          logger.warn('Failed to get case context for refinement', {
            caseId: body.caseId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const result = await draftRefinementService.refineDraft({
        draftId: body.draftId,
        currentBody: body.currentBody,
        instruction: body.instruction,
        caseContext,
        firmId: body.firmId,
        userId: body.userId,
      });

      res.json(result);
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
 * POST /api/email-drafting/inline-suggestion
 * Get inline AI suggestion while editing a draft
 */
router.post(
  '/inline-suggestion',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = inlineSuggestionSchema.parse(req.body);

      logger.debug('Getting inline suggestion', {
        textLength: body.partialText.length,
        userId: body.userId,
      });

      const result = await draftRefinementService.getInlineSuggestions(
        body.partialText,
        body.context,
        body.firmId,
        body.userId
      );

      if (!result) {
        return res.json(null);
      }

      res.json(result);
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
 * GET /api/email-drafting/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'email-drafting',
    rateLimitPerHour: RATE_LIMIT_PER_HOUR,
    activeUsers: rateLimitMap.size,
  });
});

export default router;
