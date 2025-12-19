/**
 * Case Summary Resolvers
 * OPS-048: AI Summary Generation Service
 *
 * GraphQL resolvers for case summaries with background generation support.
 */

import { prisma } from '@legal-platform/database';
import { caseSummaryService } from '../../services/case-summary.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const caseSummaryQueryResolvers = {
  /**
   * Get the cached AI summary for a case
   */
  caseSummary: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const firmId = context.user?.firmId;
    if (!firmId) {
      throw new Error('Authentication required');
    }

    // Verify user has access to this case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    if (!caseData || caseData.firmId !== firmId) {
      throw new Error('Case not found or access denied');
    }

    return caseSummaryService.getCaseSummary(caseId);
  },

  /**
   * Check if a case summary is stale
   */
  isCaseSummaryStale: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const firmId = context.user?.firmId;
    if (!firmId) {
      throw new Error('Authentication required');
    }

    const summary = await prisma.caseSummary.findUnique({
      where: { caseId },
      select: { isStale: true },
    });

    // No summary = needs generation = stale
    if (!summary) {
      return true;
    }

    return summary.isStale;
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const caseSummaryMutationResolvers = {
  /**
   * Trigger immediate summary generation for a case
   */
  triggerCaseSummaryGeneration: async (
    _: unknown,
    { caseId }: { caseId: string },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    if (!firmId) {
      throw new Error('Authentication required');
    }

    // Verify user has access to this case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    if (!caseData || caseData.firmId !== firmId) {
      throw new Error('Case not found or access denied');
    }

    try {
      await caseSummaryService.generateSummary(caseId, firmId);
      const summary = await caseSummaryService.getCaseSummary(caseId);

      return {
        success: true,
        message: 'Rezumatul a fost generat cu succes.',
        summary,
      };
    } catch (error) {
      console.error('[CaseSummary Resolver] Generation failed:', error);
      return {
        success: false,
        message: 'Nu s-a putut genera rezumatul. Vă rugăm încercați din nou.',
        summary: null,
      };
    }
  },

  /**
   * Mark a case summary as stale for background regeneration
   */
  markCaseSummaryStale: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const firmId = context.user?.firmId;
    if (!firmId) {
      throw new Error('Authentication required');
    }

    // Verify user has access to this case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    if (!caseData || caseData.firmId !== firmId) {
      throw new Error('Case not found or access denied');
    }

    await caseSummaryService.markSummaryStale(caseId);
    return true;
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

export const caseSummaryFieldResolvers = {
  CaseSummary: {
    keyDevelopments: (parent: { keyDevelopments: unknown }) => {
      // Ensure JSON array is returned as string array
      if (Array.isArray(parent.keyDevelopments)) {
        return parent.keyDevelopments;
      }
      return [];
    },
    openIssues: (parent: { openIssues: unknown }) => {
      // Ensure JSON array is returned as string array
      if (Array.isArray(parent.openIssues)) {
        return parent.openIssues;
      }
      return [];
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const caseSummaryResolvers = {
  Query: caseSummaryQueryResolvers,
  Mutation: caseSummaryMutationResolvers,
  ...caseSummaryFieldResolvers,
};
