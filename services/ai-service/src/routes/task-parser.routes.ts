/**
 * Task Parser REST API Routes
 * Story 4.1: Natural Language Task Parser
 *
 * API for parsing natural language task input
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { taskParser } from '../services/task-parser.service';
import { taskClarification, ClarificationContext } from '../services/task-clarification.service';

const router: Router = Router();

// Request validation schemas
const parseTaskRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  language: z.enum(['ro', 'en', 'auto']).optional(),
  context: z
    .object({
      userId: z.string().uuid(),
      firmId: z.string().uuid(),
      activeCaseIds: z.array(z.string().uuid()).optional(),
      teamMemberNames: z.array(z.string()).optional(),
      recentTaskPatterns: z.array(z.string()).optional(),
    })
    .optional(),
});

const clarifyRequestSchema = z.object({
  parseId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: z.string().min(1).max(500),
  parsedResult: z.any(), // The current parsed result to update
  context: z
    .object({
      activeCases: z
        .array(
          z.object({
            id: z.string().uuid(),
            caseNumber: z.string(),
            title: z.string(),
            clientName: z.string(),
          })
        )
        .optional(),
      teamMembers: z
        .array(
          z.object({
            id: z.string().uuid(),
            name: z.string(),
            role: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
});

// Service-to-service authentication middleware
function authenticateService(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  // In production, validate JWT token
  // For now, check for a service API key
  const serviceApiKey = process.env.AI_SERVICE_API_KEY;
  if (serviceApiKey && token !== serviceApiKey) {
    return res.status(403).json({ error: 'Invalid service token' });
  }

  next();
}

// Validation middleware
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
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
 * POST /api/ai/parse-task
 * Parse natural language task input
 */
router.post(
  '/parse-task',
  authenticateService,
  validate(parseTaskRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof parseTaskRequestSchema>;

      // Parse the task input
      const result = await taskParser.parseTaskInput(
        {
          text: body.text,
          language: body.language,
          context: body.context,
        },
        body.context
      );

      // Detect additional clarifications if needed
      if (body.context) {
        const clarificationContext: ClarificationContext = {
          activeCases: [], // Would be fetched from database
          teamMembers: body.context.teamMemberNames?.map((name, i) => ({
            id: `temp-${i}`,
            name,
            role: 'Team Member',
          })),
        };

        const additionalClarifications = taskClarification.detectAmbiguities(
          result,
          clarificationContext
        );

        // Merge clarifications (avoid duplicates)
        const existingIds = new Set(result.clarificationsNeeded.map((q) => q.id));
        for (const q of additionalClarifications) {
          if (!existingIds.has(q.id)) {
            result.clarificationsNeeded.push(q);
          }
        }

        // Update isComplete based on clarifications
        result.isComplete =
          result.clarificationsNeeded.length === 0 && result.overallConfidence >= 0.5;
      }

      res.json(result);
    } catch (error) {
      console.error('Task parsing error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/parse-task/clarify
 * Answer clarification question and update parsed result
 */
router.post(
  '/parse-task/clarify',
  authenticateService,
  validate(clarifyRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof clarifyRequestSchema>;

      // Apply the clarification to the parsed result
      const updatedResult = taskClarification.applyClarification(
        body.parsedResult,
        body.questionId,
        body.answer,
        body.context
      );

      res.json(updatedResult);
    } catch (error) {
      console.error('Clarification error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/parse-task/resolve-assignee
 * Resolve assignee name to user ID
 */
router.post(
  '/parse-task/resolve-assignee',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assigneeName, teamMembers } = req.body as {
        assigneeName: string;
        teamMembers: Array<{ id: string; name: string }>;
      };

      const result = await taskParser.resolveAssignee(assigneeName, teamMembers);
      res.json(result);
    } catch (error) {
      console.error('Resolve assignee error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/parse-task/resolve-case
 * Resolve case reference to case ID
 */
router.post(
  '/parse-task/resolve-case',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseReference, activeCases } = req.body as {
        caseReference: string;
        activeCases: Array<{ id: string; caseNumber: string; title: string; clientName: string }>;
      };

      const result = await taskParser.resolveCaseReference(caseReference, activeCases);
      res.json(result);
    } catch (error) {
      console.error('Resolve case error:', error);
      next(error);
    }
  }
);

export default router;
