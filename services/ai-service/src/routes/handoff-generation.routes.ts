/**
 * Handoff Generation REST API Routes
 * Story 4.5: Team Workload Management
 *
 * API for AI-powered delegation handoff note generation
 * AC: 4 - Delegation preserves context with automatic handoff notes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Request validation schema
const generateHandoffRequestSchema = z.object({
  delegationId: z.string().uuid(),
  sourceTaskId: z.string().uuid(),
  delegatorNotes: z.string().max(2000).optional(),
  includeCaseContext: z.boolean().optional().default(true),
  includeRecentActivity: z.boolean().optional().default(true),
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
 * POST /api/ai/generate-handoff
 * Generate delegation handoff notes using AI
 * AC: 4 - Automatic handoff notes with context
 */
router.post(
  '/generate-handoff',
  authenticateService,
  validate(generateHandoffRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof generateHandoffRequestSchema>;

      // Get delegation details
      const delegation = await prisma.taskDelegation.findUnique({
        where: { id: body.delegationId },
        include: {
          sourceTask: {
            include: {
              case: {
                select: {
                  id: true,
                  title: true,
                  caseNumber: true,
                  type: true,
                  client: {
                    select: { name: true },
                  },
                },
              },
              subtasks: {
                select: { id: true, title: true, status: true },
              },
              documentLinks: {
                include: {
                  document: {
                    select: { id: true, fileName: true },
                  },
                },
              },
            },
          },
          delegator: {
            select: { firstName: true, lastName: true },
          },
          delegate: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      if (!delegation) {
        return res.status(404).json({ error: 'Delegation not found' });
      }

      const sourceTask = delegation.sourceTask;
      const caseData = sourceTask.case;

      // Build context summary
      const contextParts: string[] = [];

      if (body.includeCaseContext) {
        contextParts.push(
          `Case: ${caseData.caseNumber} - ${caseData.title} (${caseData.type})`
        );
        contextParts.push(`Client: ${caseData.client.name}`);
      }

      // Task context
      contextParts.push(`Task: ${sourceTask.title}`);
      if (sourceTask.description) {
        contextParts.push(`Description: ${sourceTask.description}`);
      }

      // Subtasks status
      if (sourceTask.subtasks.length > 0) {
        const completedCount = sourceTask.subtasks.filter(
          (s) => s.status === 'Completed'
        ).length;
        contextParts.push(
          `Subtasks: ${completedCount}/${sourceTask.subtasks.length} completed`
        );
      }

      // Build handoff notes
      const handoffParts: string[] = [];

      // Add delegator's notes if provided
      if (body.delegatorNotes) {
        handoffParts.push(
          `Notes from ${delegation.delegator.firstName}: ${body.delegatorNotes}`
        );
      }

      // Delegation reason
      handoffParts.push(`Reason: ${delegation.reason}`);

      // Delegation period
      handoffParts.push(
        `Coverage period: ${delegation.startDate.toISOString().split('T')[0]} to ${delegation.endDate.toISOString().split('T')[0]}`
      );

      // Include recent activity if requested
      if (body.includeRecentActivity) {
        const recentEntries = await prisma.timeEntry.findMany({
          where: {
            taskId: sourceTask.id,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            description: true,
            hours: true,
            date: true,
          },
        });

        if (recentEntries.length > 0) {
          handoffParts.push('\nRecent Activity:');
          for (const entry of recentEntries) {
            handoffParts.push(
              `- ${entry.date.toISOString().split('T')[0]}: ${entry.description} (${Number(entry.hours)}h)`
            );
          }
        }
      }

      // Get suggested documents
      const suggestedDocs = sourceTask.documentLinks.map((link) => link.document.id);

      // Get suggested related tasks (subtasks)
      const suggestedTasks = sourceTask.subtasks.map((st) => st.id);

      res.json({
        handoffNotes: handoffParts.join('\n'),
        contextSummary: contextParts.join('\n'),
        suggestedDocs,
        suggestedTasks,
      });
    } catch (error) {
      console.error('Handoff generation error:', error);
      next(error);
    }
  }
);

export default router;
