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

// Rate limiting configuration
const RATE_LIMIT = {
  maxGenerationsPerHour: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// In-memory rate limiting (should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || '';

// Context type
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

// Helper function to check authorization
function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

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
async function callAIService(
  endpoint: string,
  method: string,
  body?: unknown
): Promise<unknown> {
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
        const result = await callAIService(
          '/api/ai/documents/similar',
          'POST',
          {
            caseId: args.caseId,
            documentType: args.documentType,
            limit: args.limit || 5,
            firmId: user.firmId,
          }
        );

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

      // Query template_library directly
      const templates = await prisma.templateLibrary.findMany({
        where: {
          category: {
            in: getTemplateCategories(args.documentType),
          },
        },
        orderBy: [
          { qualityScore: 'desc' },
          { usageCount: 'desc' },
        ],
        take: 10,
      });

      return templates.map((template) => ({
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: template.structure,
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : null,
      }));
    },

    /**
     * Get a specific template by ID
     */
    getTemplate: async (
      _: unknown,
      args: { id: string },
      context: Context
    ) => {
      requireAuth(context);

      const template = await prisma.templateLibrary.findUnique({
        where: { id: args.id },
      });

      if (!template) return null;

      return {
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: template.structure,
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : null,
      };
    },

    /**
     * Search templates by name or category
     */
    searchTemplates: async (
      _: unknown,
      args: { query: string; limit?: number },
      context: Context
    ) => {
      requireAuth(context);

      const templates = await prisma.templateLibrary.findMany({
        where: {
          OR: [
            { name: { contains: args.query, mode: 'insensitive' } },
            { category: { contains: args.query, mode: 'insensitive' } },
          ],
        },
        orderBy: [
          { qualityScore: 'desc' },
          { usageCount: 'desc' },
        ],
        take: args.limit || 10,
      });

      return templates.map((template) => ({
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: template.structure,
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : null,
      }));
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
        const result = await callAIService(
          '/api/ai/suggestions/sync',
          'POST',
          {
            documentId: 'temp', // Sync suggestions don't require a document ID
            documentType: args.documentType,
            currentText: args.currentText,
            cursorPosition: args.cursorPosition,
            firmId: user.firmId,
            userId: user.id,
          }
        ) as { suggestions: unknown[] };

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

      // Check case access
      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check rate limit
      checkRateLimit(user.id);

      logger.info('Document generation requested', {
        userId: user.id,
        caseId: args.input.caseId,
        documentType: args.input.documentType,
      });

      try {
        const result = await callAIService(
          '/api/ai/documents/generate',
          'POST',
          {
            caseId: args.input.caseId,
            prompt: args.input.prompt,
            documentType: args.input.documentType,
            templateId: args.input.templateId,
            includeContext: args.input.includeContext ?? true,
            userId: user.id,
            firmId: user.firmId,
          }
        ) as {
          id: string;
          title: string;
          content: string;
          suggestedTitle: string;
          templateUsed?: { id: string; name: string; category: string };
          precedentsReferenced: Array<{
            documentId: string;
            title: string;
            similarity: number;
            relevantSections: string[];
          }>;
          tokensUsed: number;
          generationTimeMs: number;
        };

        // Increment template usage if one was used
        if (args.input.templateId) {
          await prisma.templateLibrary.update({
            where: { id: args.input.templateId },
            data: { usageCount: { increment: 1 } },
          }).catch(() => {
            // Ignore if template not found
          });
        }

        return result;
      } catch (error) {
        logger.error('Document generation failed', {
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
        const result = await callAIService(
          '/api/ai/explain',
          'POST',
          {
            documentId: args.documentId,
            selectedText: args.selectedText,
            firmId: user.firmId,
            userId: user.id,
          }
        ) as {
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
      const editPercentage = args.initialContent.length > 0
        ? (totalChanges / args.initialContent.length) * 100
        : 0;

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

// Helper function to get template categories for a document type
function getTemplateCategories(documentType: DocumentType): string[] {
  const categoryMap: Record<DocumentType, string[]> = {
    Contract: ['Contract', 'Agreement', 'Acord'],
    Motion: ['Motion', 'Cerere'],
    Letter: ['Letter', 'Scrisoare', 'Notificare'],
    Memo: ['Memo', 'Memorandum'],
    Pleading: ['Pleading', 'Cerere de chemare'],
    Other: [],
  };
  return categoryMap[documentType] || [];
}

// Helper function to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
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
