/**
 * Document Generation Routes
 * Story 3.3: Intelligent Document Drafting
 *
 * REST API endpoints for document generation and language explanation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  DocumentType,
  ClaudeModel,
  AIOperationType,
  LanguageExplanation,
} from '@legal-platform/types';
import { documentGenerationService } from '../services/document-generation.service';
import { createClaudeModel, AICallbackHandler } from '../lib/langchain/client';
import { tokenTracker } from '../services/token-tracker.service';
import logger from '../lib/logger';
import { config } from '../config';

const router = Router();

// Request validation schemas
const generateDocumentSchema = z.object({
  caseId: z.string().uuid(),
  prompt: z.string().min(10).max(10000),
  documentType: z.enum(['Contract', 'Motion', 'Letter', 'Memo', 'Pleading', 'Other'] as const),
  templateId: z.string().uuid().optional(),
  includeContext: z.boolean().optional().default(true),
  userId: z.string().uuid(),
  firmId: z.string().uuid(),
});

const explainLanguageSchema = z.object({
  documentId: z.string().uuid(),
  selectedText: z.string().min(1).max(5000),
  documentContext: z.string().max(10000).optional(),
  firmId: z.string().uuid(),
  userId: z.string().uuid(),
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

// System prompt for language explanation
const EXPLANATION_SYSTEM_PROMPT = `You are an expert legal language analyst specializing in Romanian law.
Your role is to explain legal language choices in documents clearly and professionally.

When explaining language, provide:
1. A clear explanation of what the selected text means
2. The legal basis or reasoning behind the language choice
3. Alternative phrasings that could be used (if applicable)

Keep explanations concise but thorough. Use Romanian legal terminology where appropriate.
Always maintain a professional, educational tone.`;

const EXPLANATION_HUMAN_PROMPT = `Please explain the following text from a legal document:

Selected Text:
"{selectedText}"

{contextSection}

Provide:
1. A clear explanation of what this language means
2. The legal basis or reasoning for using this language
3. 2-3 alternative phrasings (if applicable)

Format your response as JSON with the following structure:
{{
  "explanation": "Your explanation here",
  "legalBasis": "Legal reasoning here",
  "alternatives": ["alternative 1", "alternative 2"]
}}`;

/**
 * POST /api/ai/documents/generate
 * Generate a new document using AI
 */
router.post(
  '/generate',
  authenticateService,
  validate(generateDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof generateDocumentSchema>;

      // Validate input
      const validation = documentGenerationService.validateInput(body);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.errors,
        });
      }

      // Generate the document
      const result = await documentGenerationService.generateDocument(body);

      res.json(result);
    } catch (error) {
      logger.error('Document generation endpoint error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * POST /api/ai/explain
 * Explain language choice in a document
 */
router.post(
  '/explain',
  authenticateService,
  validate(explainLanguageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const body = req.body as z.infer<typeof explainLanguageSchema>;

      logger.info('Language explanation requested', {
        requestId,
        documentId: body.documentId,
        selectionLength: body.selectedText.length,
      });

      // Build context section
      const contextSection = body.documentContext
        ? `Document Context:\n${body.documentContext}`
        : '';

      // Create prompt template
      const systemPrompt = SystemMessagePromptTemplate.fromTemplate(EXPLANATION_SYSTEM_PROMPT);
      const humanPrompt = HumanMessagePromptTemplate.fromTemplate(EXPLANATION_HUMAN_PROMPT);
      const chatPrompt = ChatPromptTemplate.fromMessages([systemPrompt, humanPrompt]);

      // Create callback handler for metrics
      const callbackHandler = new AICallbackHandler();

      // Use Haiku model for explanations (simpler task, faster response)
      const model = createClaudeModel(ClaudeModel.Haiku, {
        maxTokens: 1024,
        callbacks: [callbackHandler],
      });

      // Create the chain
      const chain = chatPrompt.pipe(model).pipe(new StringOutputParser());

      // Generate explanation
      const responseText = await chain.invoke({
        selectedText: body.selectedText,
        contextSection,
      });

      // Parse the response
      let explanation: LanguageExplanation;
      try {
        // Try to parse JSON response
        const parsed = JSON.parse(responseText);
        explanation = {
          selection: body.selectedText,
          explanation: parsed.explanation || responseText,
          legalBasis: parsed.legalBasis || undefined,
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [],
        };
      } catch {
        // If JSON parsing fails, use raw response
        explanation = {
          selection: body.selectedText,
          explanation: responseText,
          legalBasis: undefined,
          alternatives: [],
        };
      }

      const metrics = callbackHandler.getMetrics();
      const latencyMs = Date.now() - startTime;

      // Track token usage
      await tokenTracker.recordUsage({
        userId: body.userId,
        firmId: body.firmId,
        operationType: AIOperationType.TextGeneration,
        modelUsed: config.claude.models.haiku,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        latencyMs,
        cached: false,
      });

      logger.info('Language explanation completed', {
        requestId,
        latencyMs,
        tokensUsed: metrics.inputTokens + metrics.outputTokens,
      });

      res.json({
        ...explanation,
        requestId,
        latencyMs,
        tokensUsed: metrics.inputTokens + metrics.outputTokens,
      });
    } catch (error) {
      logger.error('Language explanation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /api/ai/documents/types
 * Get available document types
 */
router.get('/types', (_req: Request, res: Response) => {
  const documentTypes: { value: DocumentType; label: string; description: string }[] = [
    { value: 'Contract', label: 'Contract', description: 'Contracte și acorduri' },
    { value: 'Motion', label: 'Motion', description: 'Cereri către instanță' },
    { value: 'Letter', label: 'Letter', description: 'Corespondență juridică' },
    { value: 'Memo', label: 'Memo', description: 'Memorandumuri juridice' },
    { value: 'Pleading', label: 'Pleading', description: 'Cereri de chemare în judecată' },
    { value: 'Other', label: 'Other', description: 'Alte documente' },
  ];

  res.json(documentTypes);
});

export { router as documentGenerationRoutes };
