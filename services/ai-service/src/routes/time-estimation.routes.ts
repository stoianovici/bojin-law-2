/**
 * Time Estimation REST API Routes
 * Story 4.3: Time Estimation & Manual Time Logging
 *
 * API for AI-powered task time estimation
 * AC: 1 - Estimated time field required on task creation (AI can suggest based on similar past tasks)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { timeEstimationService } from '../services/time-estimation.service';
import type { TaskType, TimeEstimationRequest } from '@legal-platform/types';

const router = Router();

// Valid task types matching the TaskType union
const TASK_TYPES = ['Research', 'DocumentCreation', 'DocumentRetrieval', 'CourtDate', 'Meeting', 'BusinessTrip'] as const;

// Request validation schema
const estimateTimeRequestSchema = z.object({
  taskType: z.enum(TASK_TYPES),
  taskTitle: z.string().min(1).max(500),
  taskDescription: z.string().max(2000).optional(),
  caseType: z.enum(['Civil', 'Criminal', 'Family', 'Corporate', 'RealEstate', 'Immigration', 'Employment', 'Intellectual', 'Tax', 'Administrative', 'Other']).optional(),
  firmId: z.string().uuid(),
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
 * POST /api/ai/estimate-time
 * Estimate task duration using AI and historical data
 * AC: 1 - AI can suggest based on similar past tasks
 */
router.post(
  '/estimate-time',
  authenticateService,
  validate(estimateTimeRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body: TimeEstimationRequest = {
        taskType: String(req.body.taskType),
        taskTitle: String(req.body.taskTitle),
        taskDescription: req.body.taskDescription ? String(req.body.taskDescription) : undefined,
        caseType: req.body.caseType ? String(req.body.caseType) : undefined,
        firmId: String(req.body.firmId),
      };

      // Call time estimation service
      const result = await timeEstimationService.estimateTaskDuration(body);

      res.json(result);
    } catch (error) {
      console.error('Time estimation error:', error);
      next(error);
    }
  }
);

export default router;
