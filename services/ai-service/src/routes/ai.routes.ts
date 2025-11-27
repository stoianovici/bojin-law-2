/**
 * AI Service REST API Routes
 * Story 3.1: AI Service Infrastructure
 *
 * Internal API for AI operations with service-to-service authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AIOperationType, ClaudeModel, TaskComplexity } from '@legal-platform/types';
import { modelRouter } from '../services/model-router.service';
import { providerManager } from '../services/provider-manager.service';
import { tokenTracker, initializePrisma, TokenUsageInput } from '../services/token-tracker.service';
import { cacheService, initializeCachePrisma } from '../services/cache.service';
import { config } from '../config';

const router = Router();

// Request validation schemas
const generateRequestSchema = z.object({
  prompt: z.string().min(1).max(100000),
  systemPrompt: z.string().optional(),
  operationType: z.nativeEnum(AIOperationType),
  complexity: z.nativeEnum(TaskComplexity).optional(),
  modelOverride: z.nativeEnum(ClaudeModel).optional(),
  maxTokens: z.number().int().min(1).max(100000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  userId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  firmId: z.string().uuid(),
  useCache: z.boolean().optional().default(true),
});

const embedRequestSchema = z.object({
  text: z.string().min(1).max(100000),
  firmId: z.string().uuid(),
});

const usageRequestSchema = z.object({
  firmId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
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
 * POST /api/ai/generate
 * Generate text with auto model routing
 */
router.post(
  '/generate',
  authenticateService,
  validate(generateRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    try {
      const body = req.body as z.infer<typeof generateRequestSchema>;

      // Check cache first if enabled
      if (body.useCache) {
        const cacheResult = await cacheService.lookupByHash(body.prompt, body.firmId);
        if (cacheResult.found && cacheResult.entry) {
          const latencyMs = Date.now() - startTime;

          // Record cached usage
          await tokenTracker.recordUsage({
            userId: body.userId,
            caseId: body.caseId,
            firmId: body.firmId,
            operationType: body.operationType,
            modelUsed: cacheResult.entry.modelUsed,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs,
            cached: true,
          });

          return res.json({
            content: cacheResult.entry.response,
            modelUsed: cacheResult.entry.modelUsed,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costCents: 0,
            latencyMs,
            cached: true,
            cacheKey: cacheResult.entry.promptHash,
          });
        }
      }

      // Route to appropriate model
      const routingResult = modelRouter.selectModel({
        operationType: body.operationType,
        promptLength: body.prompt.length,
        complexity: body.complexity,
        modelOverride: body.modelOverride,
      });

      // Execute with provider manager (includes fallback)
      const response = await providerManager.execute({
        systemPrompt: body.systemPrompt,
        prompt: body.prompt,
        model: routingResult.model,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      });

      const latencyMs = Date.now() - startTime;

      // Calculate cost
      const costCents = tokenTracker.calculateCost(
        response.model,
        response.inputTokens,
        response.outputTokens
      );

      // Record usage
      const usageInput: TokenUsageInput = {
        userId: body.userId,
        caseId: body.caseId,
        firmId: body.firmId,
        operationType: body.operationType,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs,
        cached: false,
      };

      await tokenTracker.recordUsage(usageInput);

      // Store in cache
      if (body.useCache) {
        await cacheService.store({
          prompt: body.prompt,
          response: response.content,
          modelUsed: response.model,
          operationType: body.operationType,
          firmId: body.firmId,
        });
      }

      res.json({
        content: response.content,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
        costCents,
        latencyMs,
        cached: false,
        provider: response.provider,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ai/embed
 * Generate embeddings using Voyage AI
 */
router.post(
  '/embed',
  authenticateService,
  validate(embedRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof embedRequestSchema>;

      // In production, call Voyage AI
      // For now, return mock embedding
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);

      res.json({
        embedding: mockEmbedding,
        model: config.voyage.model,
        dimensions: 1536,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai/health
 * Service health check
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const providerHealth = await providerManager.getHealthStatus();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      providers: providerHealth,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/usage
 * Usage statistics
 */
router.get(
  '/usage',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = req.query.firmId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!firmId || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required query parameters: firmId, startDate, endDate',
        });
      }

      const stats = await tokenTracker.getUsageStats(firmId, {
        start: new Date(startDate),
        end: new Date(endDate),
      });

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ai/cache/invalidate
 * Invalidate cache entries
 */
router.post(
  '/cache/invalidate',
  authenticateService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firmId, operationType } = req.body;

      if (!firmId) {
        return res.status(400).json({ error: 'firmId is required' });
      }

      let count: number;
      if (operationType) {
        count = await cacheService.invalidateByOperationType(firmId, operationType);
      } else {
        count = await cacheService.invalidateByFirm(firmId);
      }

      res.json({ invalidated: count });
    } catch (error) {
      next(error);
    }
  }
);

export { router as aiRoutes };
