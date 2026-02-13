/**
 * Jurisprudence Research Resolvers
 *
 * GraphQL resolvers for the Jurisprudence Research Agent.
 * Provides AI-powered Romanian jurisprudence research with proper citation formatting.
 */

import { randomUUID } from 'crypto';
import { runJurisprudenceResearch } from '../../services/jurisprudence-agent.service';
import { checkJurisprudenceRateLimit } from '../../services/jurisprudence-agent-tools.handlers';
import {
  JurisprudenceAgentContext,
  JURISPRUDENCE_CONSTRAINTS,
} from '../../services/jurisprudence-agent.types';
import { prisma } from '@legal-platform/database';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

interface JurisprudenceResearchInput {
  topic: string;
  context?: string;
  caseId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function requireAuth(context: Context): { userId: string; firmId: string } {
  if (!context.user?.id || !context.user?.firmId) {
    throw new Error('Authentication required');
  }
  return { userId: context.user.id, firmId: context.user.firmId };
}

/**
 * Validate authentication and verify firm exists in database.
 * This prevents access with stale/invalid firmId tokens.
 */
async function requireAuthWithFirmValidation(
  context: Context
): Promise<{ userId: string; firmId: string }> {
  if (!context.user?.id || !context.user?.firmId) {
    throw new Error('Authentication required');
  }

  const firm = await prisma.firm.findUnique({
    where: { id: context.user.firmId },
    select: { id: true },
  });

  if (!firm) {
    throw new Error('Firma nu a fost găsită');
  }

  return { userId: context.user.id, firmId: context.user.firmId };
}

/**
 * Map DecisionType to GraphQL enum format.
 */
function mapDecisionType(type: string): string {
  switch (type) {
    case 'decizie':
      return 'DECIZIE';
    case 'sentință':
      return 'SENTINTA';
    case 'încheiere':
      return 'INCHEIERE';
    default:
      return 'DECIZIE';
  }
}

/**
 * Sanitize error messages for client consumption.
 * Removes internal details while preserving user-friendly messages.
 */
function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Known user-facing error patterns (Romanian, safe to return)
  const safePatterns = [
    /^Ai atins limita/,
    /^Subiectul cercetării/,
    /^Serviciul de căutare temporar/,
    /^Firma nu a fost găsită/,
    /^Authentication required/,
    /^Agentul nu a trimis/,
    /^Validare/,
    /caractere$/,
  ];

  for (const pattern of safePatterns) {
    if (pattern.test(message)) {
      return message;
    }
  }

  // Check for internal/technical errors that should be sanitized
  const internalPatterns = [
    /redis/i,
    /database/i,
    /connection/i,
    /timeout/i,
    /ECONNREFUSED/,
    /ETIMEDOUT/,
    /socket/i,
    /prisma/i,
  ];

  for (const pattern of internalPatterns) {
    if (pattern.test(message)) {
      logger.error('[JurisprudenceResolver] Sanitized internal error', {
        originalError: message,
      });
      return 'A apărut o eroare internă. Te rugăm să încerci din nou.';
    }
  }

  // Return original message if it doesn't match internal patterns
  // but truncate very long messages
  return message.length > 200 ? message.slice(0, 200) + '...' : message;
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const jurisprudenceQueries = {
  /**
   * Check rate limit status for jurisprudence research.
   */
  jurisprudenceRateLimit: async (_: unknown, __: unknown, context: Context) => {
    const { userId } = requireAuth(context);

    const rateLimitInfo = await checkJurisprudenceRateLimit(userId);

    return {
      allowed: rateLimitInfo.allowed,
      remaining: rateLimitInfo.remaining,
      resetAt: rateLimitInfo.resetAt.toISOString(),
    };
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const jurisprudenceMutations = {
  /**
   * Run jurisprudence research on a legal topic.
   */
  runJurisprudenceResearch: async (
    _: unknown,
    args: { input: JurisprudenceResearchInput },
    context: Context
  ) => {
    const { userId, firmId } = await requireAuthWithFirmValidation(context);
    const correlationId = randomUUID();

    const { topic, context: researchContext, caseId } = args.input;

    // Validate topic (min and max length)
    const trimmedTopic = topic?.trim() || '';
    if (trimmedTopic.length < 10) {
      throw new Error('Subiectul cercetării trebuie să aibă minim 10 caractere');
    }
    if (trimmedTopic.length > JURISPRUDENCE_CONSTRAINTS.MAX_TOPIC_LENGTH) {
      throw new Error(
        `Subiectul cercetării este prea lung (maxim ${JURISPRUDENCE_CONSTRAINTS.MAX_TOPIC_LENGTH} caractere)`
      );
    }

    logger.info('[JurisprudenceResolver] Starting research', {
      correlationId,
      userId,
      topic: topic.slice(0, 100),
      hasCaseId: !!caseId,
    });

    // Build agent context
    const agentContext: JurisprudenceAgentContext = {
      userId,
      firmId,
      correlationId,
      caseId: caseId || undefined,
    };

    try {
      // Run the research
      const result = await runJurisprudenceResearch(topic, researchContext, agentContext);

      // Transform result to GraphQL format
      if (result.success && result.output) {
        return {
          success: true,
          output: {
            topic: result.output.topic,
            generatedAt: result.output.generatedAt,
            summary: result.output.summary,
            citations: result.output.citations.map((c) => ({
              id: c.id,
              decisionType: mapDecisionType(c.decisionType),
              decisionNumber: c.decisionNumber,
              court: c.court,
              courtFull: c.courtFull,
              section: c.section,
              date: c.date,
              dateFormatted: c.dateFormatted,
              url: c.url,
              caseNumber: c.caseNumber,
              summary: c.summary,
              relevance: c.relevance,
              officialGazette: c.officialGazette,
              verified: c.verified ?? false,
            })),
            analysis: result.output.analysis,
            gaps: result.output.gaps,
            metadata: result.output.metadata,
          },
          error: null,
          durationMs: result.durationMs,
          tokenUsage: result.tokenUsage,
          costEur: result.costEur,
        };
      }

      return {
        success: false,
        output: null,
        error: sanitizeErrorMessage(result.error),
        durationMs: result.durationMs,
        tokenUsage: result.tokenUsage,
        costEur: result.costEur,
      };
    } catch (error) {
      const rawErrorMessage = error instanceof Error ? error.message : String(error);
      const sanitizedError = sanitizeErrorMessage(error);

      logger.error('[JurisprudenceResolver] Research failed', {
        correlationId,
        userId,
        error: rawErrorMessage, // Log full error for debugging
      });

      return {
        success: false,
        output: null,
        error: sanitizedError, // Return sanitized error to client
        durationMs: 0,
        tokenUsage: { input: 0, output: 0, total: 0 },
        costEur: 0,
      };
    }
  },
};

// ============================================================================
// Combined Resolvers Export
// ============================================================================

export const jurisprudenceResolvers = {
  Query: jurisprudenceQueries,
  Mutation: jurisprudenceMutations,
};
