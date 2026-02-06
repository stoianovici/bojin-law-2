/**
 * Word AI Validation Middleware
 * Phase 1.2: Input Validation with Zod Schemas
 *
 * Provides validation schemas and middleware for all Word AI endpoints.
 * Prevents oversized requests, malformed input, and potential ReDoS attacks.
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ============================================================================
// Constants - Input Limits (configurable via environment variables)
// ============================================================================

/**
 * Parse environment variable as integer with default fallback.
 * @param envVar - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 */
function parseIntEnv(envVar: string, defaultValue: number): number {
  const value = process.env[envVar];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/** Maximum document name length (bytes) */
const MAX_DOCUMENT_NAME_LENGTH = parseIntEnv('WORD_AI_MAX_DOCUMENT_NAME_LENGTH', 200);

/** Maximum prompt length (bytes) - ~50KB default */
const MAX_PROMPT_LENGTH = parseIntEnv('WORD_AI_MAX_PROMPT_LENGTH', 50 * 1024);

/** Maximum existing content length (bytes) - ~500KB default */
const MAX_EXISTING_CONTENT_LENGTH = parseIntEnv('WORD_AI_MAX_EXISTING_CONTENT_LENGTH', 500 * 1024);

/** Maximum text length for analysis (bytes) - ~100KB default */
const MAX_TEXT_LENGTH = parseIntEnv('WORD_AI_MAX_TEXT_LENGTH', 100 * 1024);

/** Maximum instruction length (bytes) - ~10KB default */
const MAX_INSTRUCTION_LENGTH = parseIntEnv('WORD_AI_MAX_INSTRUCTION_LENGTH', 10 * 1024);

/** Maximum required sections for validation */
const MAX_REQUIRED_SECTIONS = parseIntEnv('WORD_AI_MAX_REQUIRED_SECTIONS', 50);

/** Maximum length per section name */
const MAX_SECTION_NAME_LENGTH = parseIntEnv('WORD_AI_MAX_SECTION_NAME_LENGTH', 100);

/** Maximum body size hint (bytes) - 5MB default */
export const MAX_BODY_SIZE = parseIntEnv('WORD_AI_MAX_BODY_SIZE', 5 * 1024 * 1024);

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Edit request schema - for conversational document editing
 */
export const EditRequestSchema = z.object({
  context: z.object({
    type: z.enum(['selection', 'document']),
    selectedText: z.string().max(MAX_TEXT_LENGTH).optional(),
    documentContent: z.string().max(MAX_EXISTING_CONTENT_LENGTH).optional(),
    cursorPosition: z.number().int().nonnegative().optional(),
  }),
  conversation: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_TEXT_LENGTH),
      })
    )
    .max(20), // Limit conversation history to 20 turns
  prompt: z.string().min(1, 'Prompt is required').max(MAX_INSTRUCTION_LENGTH),
});

/**
 * Draft request schema - for document generation
 */
export const DraftRequestSchema = z.object({
  contextType: z.enum(['case', 'client', 'internal']).default('case'),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  documentName: z
    .string()
    .min(1, 'Document name is required')
    .max(
      MAX_DOCUMENT_NAME_LENGTH,
      `Document name too long (max ${MAX_DOCUMENT_NAME_LENGTH} chars)`
    ),
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(MAX_PROMPT_LENGTH, `Prompt too long (max ${MAX_PROMPT_LENGTH} bytes)`),
  existingContent: z
    .string()
    .max(
      MAX_EXISTING_CONTENT_LENGTH,
      `Existing content too long (max ${MAX_EXISTING_CONTENT_LENGTH} bytes)`
    )
    .optional(),
  enableWebSearch: z.boolean().default(false),
  useTwoPhaseResearch: z.boolean().default(false),
  useMultiAgent: z.boolean().default(false),
  sourceTypes: z
    .array(z.enum(['legislation', 'jurisprudence', 'doctrine', 'comparative']))
    .optional(),
  researchDepth: z.enum(['quick', 'standard', 'deep']).optional(),
  includeOoxml: z.boolean().default(true),
  premiumMode: z.boolean().default(false),
});

/**
 * Suggest request schema - for AI suggestions
 */
export const SuggestRequestSchema = z
  .object({
    documentId: z.string().optional(),
    selectedText: z
      .string()
      .max(MAX_TEXT_LENGTH, `Selected text too long (max ${MAX_TEXT_LENGTH} bytes)`)
      .optional(),
    cursorContext: z
      .string()
      .max(MAX_TEXT_LENGTH, `Cursor context too long (max ${MAX_TEXT_LENGTH} bytes)`)
      .optional(),
    suggestionType: z.enum(['completion', 'alternative', 'precedent']).default('completion'),
    caseId: z.string().uuid().optional(),
    customInstructions: z
      .string()
      .max(MAX_INSTRUCTION_LENGTH, `Instructions too long (max ${MAX_INSTRUCTION_LENGTH} bytes)`)
      .optional(),
    premiumMode: z.boolean().default(false),
  })
  .refine((data) => data.selectedText || data.cursorContext, {
    message: 'Either selectedText or cursorContext is required',
  });

/**
 * Explain request schema - for text explanation
 */
export const ExplainRequestSchema = z.object({
  documentId: z.string().optional(),
  selectedText: z
    .string()
    .min(1, 'Selected text is required')
    .max(MAX_TEXT_LENGTH, `Selected text too long (max ${MAX_TEXT_LENGTH} bytes)`),
  caseId: z.string().uuid().optional(),
  customInstructions: z
    .string()
    .max(MAX_INSTRUCTION_LENGTH, `Instructions too long (max ${MAX_INSTRUCTION_LENGTH} bytes)`)
    .optional(),
  premiumMode: z.boolean().default(false),
});

/**
 * Improve request schema - for text improvement
 */
export const ImproveRequestSchema = z.object({
  documentId: z.string().optional(),
  selectedText: z
    .string()
    .min(1, 'Selected text is required')
    .max(MAX_TEXT_LENGTH, `Selected text too long (max ${MAX_TEXT_LENGTH} bytes)`),
  improvementType: z
    .enum(['clarity', 'formality', 'brevity', 'legal_precision'])
    .default('clarity'),
  caseId: z.string().uuid().optional(),
  customInstructions: z
    .string()
    .max(MAX_INSTRUCTION_LENGTH, `Instructions too long (max ${MAX_INSTRUCTION_LENGTH} bytes)`)
    .optional(),
  premiumMode: z.boolean().default(false),
});

/**
 * Court filing validation schema - for validating required sections
 */
export const ValidateRequestSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(
      MAX_EXISTING_CONTENT_LENGTH,
      `Content too long (max ${MAX_EXISTING_CONTENT_LENGTH} bytes)`
    ),
  requiredSections: z
    .array(
      z
        .string()
        .max(
          MAX_SECTION_NAME_LENGTH,
          `Section name too long (max ${MAX_SECTION_NAME_LENGTH} chars)`
        )
    )
    .max(MAX_REQUIRED_SECTIONS, `Too many sections (max ${MAX_REQUIRED_SECTIONS})`),
});

/**
 * OOXML conversion request schema
 */
export const OoxmlRequestSchema = z
  .object({
    html: z
      .string()
      .max(MAX_EXISTING_CONTENT_LENGTH, `HTML too long (max ${MAX_EXISTING_CONTENT_LENGTH} bytes)`)
      .optional(),
    markdown: z
      .string()
      .max(
        MAX_EXISTING_CONTENT_LENGTH,
        `Markdown too long (max ${MAX_EXISTING_CONTENT_LENGTH} bytes)`
      )
      .optional(),
    includeTableOfContents: z.boolean().optional(),
    title: z.string().max(MAX_DOCUMENT_NAME_LENGTH).optional(),
    subtitle: z.string().max(MAX_DOCUMENT_NAME_LENGTH).optional(),
  })
  .refine((data) => data.html || data.markdown, {
    message: 'Either html or markdown is required',
  });

/**
 * Court filing generation request schema
 */
export const CourtFilingGenerateRequestSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  contextType: z.enum(['case', 'client', 'internal']).default('case'),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  instructions: z
    .string()
    .max(MAX_INSTRUCTION_LENGTH, `Instructions too long (max ${MAX_INSTRUCTION_LENGTH} bytes)`)
    .optional(),
  includeOoxml: z.boolean().default(true),
  templateMetadata: z
    .object({
      name: z.string().max(200),
      cpcArticles: z.array(z.string().max(50)).max(20),
      partyLabels: z.object({
        party1: z.string().max(100),
        party2: z.string().max(100),
        party3: z.string().max(100).optional(),
      }),
      requiredSections: z.array(z.string().max(MAX_SECTION_NAME_LENGTH)).max(MAX_REQUIRED_SECTIONS),
      formCategory: z.enum(['A', 'B', 'C']),
      category: z.string().max(100).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),
});

/**
 * Contract analysis request schema
 */
export const ContractAnalysisRequestSchema = z.object({
  documentContent: z
    .string()
    .min(1, 'Document content is required')
    .max(
      MAX_EXISTING_CONTENT_LENGTH,
      `Content too long (max ${MAX_EXISTING_CONTENT_LENGTH} bytes)`
    ),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  premiumMode: z.literal(true), // Always true for contract analysis
});

/**
 * Draft from template request schema
 */
export const DraftFromTemplateRequestSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  caseId: z.string().uuid('Invalid case ID'),
  customInstructions: z
    .string()
    .max(MAX_INSTRUCTION_LENGTH, `Instructions too long (max ${MAX_INSTRUCTION_LENGTH} bytes)`)
    .optional(),
  placeholderValues: z.record(z.string().max(1000)).optional(),
});

// ============================================================================
// Types (inferred from schemas)
// ============================================================================

export type DraftRequest = z.infer<typeof DraftRequestSchema>;
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
export type ImproveRequest = z.infer<typeof ImproveRequestSchema>;
export type ValidateRequest = z.infer<typeof ValidateRequestSchema>;
export type OoxmlRequest = z.infer<typeof OoxmlRequestSchema>;
export type CourtFilingGenerateRequest = z.infer<typeof CourtFilingGenerateRequestSchema>;
export type ContractAnalysisRequest = z.infer<typeof ContractAnalysisRequestSchema>;
export type DraftFromTemplateRequest = z.infer<typeof DraftFromTemplateRequestSchema>;

// ============================================================================
// Validation Middleware Factory
// ============================================================================

/**
 * Create validation middleware for a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.body
 *
 * @example
 * router.post('/draft', validateBody(DraftRequestSchema), handler)
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check content length first (before parsing)
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      logger.warn('Request body too large', {
        path: req.path,
        contentLength,
        maxSize: MAX_BODY_SIZE,
      });
      return res.status(413).json({
        error: 'payload_too_large',
        message: `Request body too large (max ${MAX_BODY_SIZE / 1024 / 1024}MB)`,
      });
    }

    // Parse and validate
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));

      logger.warn('Request validation failed', {
        path: req.path,
        errors,
      });

      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: errors,
      });
    }

    // Replace body with validated/coerced data
    req.body = result.data;
    next();
  };
}

// ============================================================================
// Content Safety Checks
// ============================================================================

/**
 * Check if content is safe to process with regex.
 * Prevents ReDoS by checking content length before regex operations.
 *
 * @param content - Content to check
 * @param maxLength - Maximum allowed length (default 100KB)
 * @returns true if safe to process
 */
export function isContentSafeForRegex(content: string, maxLength = MAX_TEXT_LENGTH): boolean {
  if (!content) return true;
  return content.length <= maxLength;
}

/**
 * Middleware to check content safety before regex operations.
 */
export function requireSafeContent(field: string, maxLength = MAX_TEXT_LENGTH) {
  return (req: Request, res: Response, next: NextFunction) => {
    const content = req.body?.[field];

    if (content && !isContentSafeForRegex(content, maxLength)) {
      logger.warn('Content too large for regex processing', {
        path: req.path,
        field,
        contentLength: content.length,
        maxLength,
      });

      return res.status(413).json({
        error: 'content_too_large',
        message: `${field} too large for processing (max ${maxLength} bytes)`,
      });
    }

    next();
  };
}

// ============================================================================
// Express Body Parser Configuration
// ============================================================================

/**
 * Get express.json() options with size limit.
 * Use this when configuring the router:
 *
 * @example
 * import express from 'express';
 * import { getJsonParserOptions } from './middleware/word-ai-validation.middleware';
 * router.use(express.json(getJsonParserOptions()));
 */
export function getJsonParserOptions() {
  return {
    limit: `${MAX_BODY_SIZE / 1024 / 1024}mb`,
  };
}

export default {
  // Schemas
  DraftRequestSchema,
  SuggestRequestSchema,
  ExplainRequestSchema,
  ImproveRequestSchema,
  ValidateRequestSchema,
  OoxmlRequestSchema,
  CourtFilingGenerateRequestSchema,
  ContractAnalysisRequestSchema,
  DraftFromTemplateRequestSchema,

  // Middleware
  validateBody,
  requireSafeContent,
  isContentSafeForRegex,
  getJsonParserOptions,

  // Constants
  MAX_BODY_SIZE,
  MAX_DOCUMENT_NAME_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_EXISTING_CONTENT_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_INSTRUCTION_LENGTH,
};
