/**
 * Document Drafting GraphQL Resolvers
 * Story 3.3: Intelligent Document Drafting
 *
 * Implements resolvers for AI-powered document generation, clause suggestions,
 * template recommendations, and quality metrics tracking
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import type { DocumentType } from '@legal-platform/types';
import logger from '../../utils/logger';
import { aiClient } from '../../services/ai-client.service';
import {
  aiFeatureConfigService,
  type AIFeatureKey,
} from '../../services/ai-feature-config.service';
import { caseContextService } from '../../services/case-context.service';
import crypto from 'crypto';
import { requireAuth, type Context } from '../utils/auth';

// Rate limiting configuration
const RATE_LIMIT = {
  maxGenerationsPerHour: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// In-memory rate limiting (should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// AI Service base URL (kept for clauseSuggestions and other endpoints)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4003';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || '';

// Document type-specific system prompts
const DOCUMENT_TYPE_PROMPTS: Record<DocumentType, string> = {
  Contract: `You are an expert legal document drafter specializing in contract law.
Create precise, enforceable contract language with clear terms and conditions.
Include standard contract sections: parties, recitals, definitions, terms, conditions, signatures.
Use clear Romanian legal terminology where appropriate.`,

  Motion: `You are an expert legal document drafter specializing in court motions.
Create persuasive, well-structured legal arguments with proper citations.
Follow standard motion format: caption, introduction, facts, legal argument, conclusion, prayer for relief.
Reference relevant Romanian procedural law.`,

  Letter: `You are an expert legal document drafter specializing in professional legal correspondence.
Create clear, professional letters with appropriate tone and legal precision.
Include proper salutation, body paragraphs, and formal closing.
Maintain client confidentiality and professional standards.`,

  Memo: `You are an expert legal document drafter specializing in legal memoranda.
Create thorough legal analysis with clear organization and citations.
Follow standard memo format: heading, question presented, brief answer, facts, discussion, conclusion.
Provide balanced analysis of legal issues.`,

  Pleading: `You are an expert legal document drafter specializing in court pleadings.
Create well-structured pleadings that meet court requirements.
Include proper caption, numbered paragraphs, and signature block.
Follow Romanian civil procedure requirements.`,

  Other: `You are an expert legal document drafter.
Create professional, well-organized legal documents.
Ensure clarity, precision, and appropriate legal terminology.
Adapt format to the specific document requirements.`,
};

// Base system prompt for document generation
const DOCUMENT_GENERATION_SYSTEM_PROMPT = `You are an AI assistant for a Romanian law firm, specializing in legal document drafting.

IMPORTANT: Generate all documents in Romanian (limba română) unless the user explicitly requests English.

Key Guidelines:
1. Generate complete, professional legal documents in Romanian
2. Use appropriate Romanian legal terminology (e.g., "reclamant", "pârât", "instanță", "cerere", "hotărâre")
3. Structure documents logically with clear sections
4. Include all necessary legal formalities
5. Reference relevant Romanian law where appropriate (e.g., Codul Civil, Codul de Procedură Civilă)
6. Maintain a formal, professional tone
7. Ensure clarity and precision in all language

CRITICAL - Use provided case context:
- Use the EXACT client name, CUI, registration number (Nr. Reg. Com.), and address from the context
- Include administrator names and roles when identifying the client in contracts
- Reference case parties (Părți) by their full details including organization and role
- Use the case number and reference numbers provided
- Incorporate relevant information from the case summary and keywords`;

// Helper function to require Associate or Partner role
function requireDocumentGenerationRole(user: Context['user']) {
  if (!user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (user.role !== 'Partner' && user.role !== 'Associate') {
    throw new GraphQLError('Document generation requires Associate or Partner role', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return user;
}

// Helper to check rate limit
function checkRateLimit(userId: string): void {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return;
  }

  if (userLimit.count >= RATE_LIMIT.maxGenerationsPerHour) {
    throw new GraphQLError(
      `Rate limit exceeded. Maximum ${RATE_LIMIT.maxGenerationsPerHour} document generations per hour.`,
      { extensions: { code: 'RATE_LIMITED' } }
    );
  }

  userLimit.count++;
}

// Helper to check case access
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  if (!caseData || caseData.firmId !== user.firmId) return false;

  if (user.role === 'Partner' || user.role === 'BusinessOwner') return true;

  const assignment = await prisma.caseTeam.findUnique({
    where: {
      caseId_userId: {
        caseId,
        userId: user.id,
      },
    },
  });

  return !!assignment;
}

// Helper to call AI service
async function callAIService(endpoint: string, method: string, body?: unknown): Promise<unknown> {
  const url = `${AI_SERVICE_URL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('AI service call failed', {
      endpoint,
      status: response.status,
      error: errorText,
    });
    throw new GraphQLError(`AI service error: ${response.statusText}`, {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }

  return response.json();
}

export const documentDraftingResolvers = {
  Query: {
    /**
     * Find similar documents from the firm library
     */
    findSimilarDocuments: async (
      _: unknown,
      args: { caseId: string; documentType: DocumentType; limit?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      try {
        const result = await callAIService('/api/ai/documents/similar', 'POST', {
          caseId: args.caseId,
          documentType: args.documentType,
          limit: args.limit || 5,
          firmId: user.firmId,
        });

        return result;
      } catch (error) {
        logger.error('Find similar documents failed', {
          caseId: args.caseId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },

    /**
     * Suggest templates for a document type
     * NOTE: Template library has been removed. Returns empty array.
     */
    suggestTemplates: async (
      _: unknown,
      args: { caseId: string; documentType: DocumentType },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Template library has been removed - return empty array
      return [];
    },

    /**
     * Get a specific template by ID
     * NOTE: Template library has been removed. Always returns null.
     */
    getTemplate: async (_: unknown, args: { id: string }, context: Context) => {
      requireAuth(context);

      // Template library has been removed - return null
      return null;
    },

    /**
     * Search templates by name or category
     * NOTE: Template library has been removed. Returns empty array.
     */
    searchTemplates: async (
      _: unknown,
      args: { query: string; limit?: number },
      context: Context
    ) => {
      requireAuth(context);

      // Template library has been removed - return empty array
      return [];
    },

    /**
     * Get quality metrics summary
     */
    documentQualityMetrics: async (
      _: unknown,
      args: { startDate: Date; endDate: Date; documentType?: DocumentType },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Query DocumentDraftMetrics (to be created in Task 15)
      // For now, return mock data
      return {
        averageEditPercentage: 25.5,
        averageTimeToFinalize: 45,
        averageUserRating: 4.2,
        totalDocuments: 0,
        byDocumentType: [],
      };
    },

    /**
     * Get clause suggestions for current text
     */
    clauseSuggestions: async (
      _: unknown,
      args: { currentText: string; documentType: DocumentType; cursorPosition: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      try {
        const result = (await callAIService('/api/ai/suggestions/sync', 'POST', {
          documentId: 'temp', // Sync suggestions don't require a document ID
          documentType: args.documentType,
          currentText: args.currentText,
          cursorPosition: args.cursorPosition,
          firmId: user.firmId,
          userId: user.id,
        })) as { suggestions: unknown[] };

        return result.suggestions || [];
      } catch (error) {
        logger.error('Clause suggestions failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
  },

  Mutation: {
    /**
     * Generate a document using AI
     * OPS-248: Uses aiClient.complete() for usage tracking in AI Ops dashboard
     */
    generateDocumentWithAI: async (
      _: unknown,
      args: {
        input: {
          caseId: string;
          prompt: string;
          documentType: DocumentType;
          templateId?: string;
          includeContext?: boolean;
        };
      },
      context: Context
    ) => {
      const user = requireDocumentGenerationRole(context.user);
      const startTime = Date.now();
      const requestId = crypto.randomUUID();

      // Check if feature is enabled
      const featureEnabled = await aiFeatureConfigService.isFeatureEnabled(
        user.firmId,
        'document_drafting' as AIFeatureKey
      );
      if (!featureEnabled) {
        throw new GraphQLError('Document drafting feature is disabled for this firm', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check case access
      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check rate limit
      checkRateLimit(user.id);

      logger.info('Document generation requested', {
        requestId,
        userId: user.id,
        caseId: args.input.caseId,
        documentType: args.input.documentType,
      });

      try {
        // Get comprehensive case context using three-tier context system
        let caseContext = '';
        if (args.input.includeContext !== false) {
          try {
            const operationContext = await caseContextService.getContextForOperation(
              args.input.caseId,
              'document.draft'
            );
            caseContext = '\n\n' + caseContextService.formatForPrompt(operationContext);
            logger.debug('Document drafting context built', {
              caseId: args.input.caseId,
              tokenEstimate: operationContext.tokenEstimate,
            });
          } catch (contextError) {
            // Fall back to minimal context if service fails
            logger.warn('Failed to get full case context, using minimal', {
              caseId: args.input.caseId,
              error: contextError instanceof Error ? contextError.message : String(contextError),
            });
            const caseData = await prisma.case.findUnique({
              where: { id: args.input.caseId },
              include: { client: { select: { name: true } } },
            });
            if (caseData) {
              caseContext = `\n\nCase Context:
- Case: ${caseData.title} (${caseData.caseNumber || 'N/A'})
- Client: ${caseData.client?.name || 'Client necunoscut'}`;
            }
          }
        }

        // NOTE: Template library has been removed. templateId input is ignored.

        // Build system prompt
        const documentTypeInstructions = DOCUMENT_TYPE_PROMPTS[args.input.documentType];
        const systemPrompt = `${DOCUMENT_GENERATION_SYSTEM_PROMPT}

${documentTypeInstructions}${caseContext}`;

        // Build user prompt
        const userPrompt = `Please draft the following document:

Document Type: ${args.input.documentType}
User Request: ${args.input.prompt}

Generate a complete, professional document that fulfills this request.
The document should be ready for review with minimal editing required.`;

        // Get feature config for model selection
        const featureConfig = await aiFeatureConfigService.getFeatureConfig(
          user.firmId,
          'document_drafting' as AIFeatureKey
        );

        // Call Claude via aiClient for usage tracking (OPS-248)
        const aiResponse = await aiClient.complete(
          userPrompt,
          {
            feature: 'document_drafting',
            userId: user.id,
            firmId: user.firmId,
            entityType: 'case',
            entityId: args.input.caseId,
          },
          {
            model: featureConfig.model || 'claude-sonnet-4-20250514', // Default to Sonnet for quality
            maxTokens: 4096,
            system: systemPrompt,
          }
        );

        const generationTimeMs = Date.now() - startTime;

        // Generate suggested title
        const titlePrefix: Record<DocumentType, string> = {
          Contract: 'Contract',
          Motion: 'Cerere',
          Letter: 'Scrisoare',
          Memo: 'Memorandum',
          Pleading: 'Cerere de chemare în judecată',
          Other: 'Document',
        };
        const today = new Date().toLocaleDateString('ro-RO');
        const suggestedTitle = `${titlePrefix[args.input.documentType]} - ${today}`;

        logger.info('Document generation completed', {
          requestId,
          generationTimeMs,
          tokensUsed: aiResponse.inputTokens + aiResponse.outputTokens,
          contentLength: aiResponse.content.length,
        });

        return {
          id: requestId,
          title: suggestedTitle,
          content: aiResponse.content,
          suggestedTitle,
          templateUsed: null, // Template library has been removed
          precedentsReferenced: [], // Simplified: no precedent lookup in gateway version
          tokensUsed: aiResponse.inputTokens + aiResponse.outputTokens,
          generationTimeMs,
        };
      } catch (error) {
        logger.error('Document generation failed', {
          requestId,
          userId: user.id,
          caseId: args.input.caseId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    /**
     * Explain language choice in a document
     */
    explainLanguageChoice: async (
      _: unknown,
      args: { documentId: string; selectedText: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (args.selectedText.length < 1 || args.selectedText.length > 5000) {
        throw new GraphQLError('Selected text must be between 1 and 5000 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        const result = (await callAIService('/api/ai/explain', 'POST', {
          documentId: args.documentId,
          selectedText: args.selectedText,
          firmId: user.firmId,
          userId: user.id,
        })) as {
          selection: string;
          explanation: string;
          legalBasis?: string;
          alternatives: string[];
        };

        return result;
      } catch (error) {
        logger.error('Language explanation failed', {
          documentId: args.documentId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    /**
     * Record document draft metrics
     */
    recordDraftMetrics: async (
      _: unknown,
      args: {
        documentId: string;
        initialContent: string;
        finalContent: string;
        userRating?: number;
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Calculate metrics
      const initialWordCount = countWords(args.initialContent);
      const finalWordCount = countWords(args.finalContent);
      const { charactersAdded, charactersRemoved } = calculateChanges(
        args.initialContent,
        args.finalContent
      );

      const totalChanges = charactersAdded + charactersRemoved;
      const editPercentage =
        args.initialContent.length > 0 ? (totalChanges / args.initialContent.length) * 100 : 0;

      // Create metrics record (table to be created in Task 15)
      // For now, log the metrics
      logger.info('Document draft metrics recorded', {
        documentId: args.documentId,
        userId: user.id,
        initialWordCount,
        finalWordCount,
        charactersAdded,
        charactersRemoved,
        editPercentage: Math.round(editPercentage * 100) / 100,
        userRating: args.userRating,
      });

      // Return the metrics
      return {
        id: args.documentId, // Using documentId as metrics ID for now
        documentId: args.documentId,
        initialWordCount,
        finalWordCount,
        charactersAdded,
        charactersRemoved,
        editPercentage: Math.round(editPercentage * 100) / 100,
        timeToFinalizeMinutes: null,
        userRating: args.userRating || null,
        createdAt: new Date(),
      };
    },
  },

  // Subscription stubs (would need WebSocket server setup)
  Subscription: {
    clauseSuggestions: {
      subscribe: () => {
        throw new GraphQLError('Subscriptions not yet implemented', {
          extensions: { code: 'NOT_IMPLEMENTED' },
        });
      },
    },
  },
};

// Helper function to count words
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

// Helper function to calculate character changes
function calculateChanges(
  original: string,
  final: string
): { charactersAdded: number; charactersRemoved: number } {
  const originalLength = original.length;
  const finalLength = final.length;

  // Simple calculation - in production would use diff algorithm
  if (finalLength >= originalLength) {
    return {
      charactersAdded: finalLength - originalLength,
      charactersRemoved: 0,
    };
  } else {
    return {
      charactersAdded: 0,
      charactersRemoved: originalLength - finalLength,
    };
  }
}

export default documentDraftingResolvers;
