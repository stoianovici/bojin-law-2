/**
 * Case Context Resolvers
 * Phase 1: Context Viewer UI + Working Corrections
 *
 * GraphQL resolvers for viewing and correcting AI-generated case context.
 * Restricted to Partners only.
 */

import { prisma } from '@legal-platform/database';
import { caseContextFileService } from '../../services/case-context-file.service';
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

interface AddCorrectionInput {
  caseId: string;
  sectionId: string;
  fieldPath?: string;
  correctionType: 'override' | 'append' | 'remove' | 'note';
  originalValue?: string;
  correctedValue: string;
  reason?: string;
}

interface UpdateCorrectionInput {
  correctionId: string;
  caseId: string;
  correctedValue?: string;
  reason?: string;
  isActive?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if user is a Partner (admin role)
 */
function requirePartner(context: Context): void {
  if (!context.user?.firmId) {
    throw new Error('Authentication required');
  }
  // Partners and BusinessOwners can manage context
  if (context.user.role !== 'Partner' && context.user.role !== 'BusinessOwner') {
    throw new Error('Acces interzis. Doar partenerii pot vizualiza și edita contextul AI.');
  }
}

/**
 * Verify user has access to a case (multi-tenancy check)
 */
async function verifyCaseAccess(caseId: string, firmId: string): Promise<void> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  if (!caseData || caseData.firmId !== firmId) {
    throw new Error('Dosarul nu a fost găsit sau accesul este interzis.');
  }
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const caseContextQueryResolvers = {
  /**
   * Get the AI context file for a case
   */
  caseContextFile: async (
    _: unknown,
    { caseId, profileCode }: { caseId: string; profileCode?: string },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    const contextFile = await caseContextFileService.getContextFile(
      caseId,
      profileCode || 'word_addin'
    );

    if (!contextFile) {
      logger.warn('[CaseContext] Context file not found', { caseId, profileCode });
      return null;
    }

    // Map sections to GraphQL type (sectionId -> id)
    return {
      ...contextFile,
      sections: contextFile.sections.map((s) => ({
        id: s.sectionId,
        title: s.title,
        content: s.content,
        tokenCount: s.tokenCount,
      })),
    };
  },

  /**
   * Get all corrections for a case
   */
  caseContextCorrections: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    return caseContextFileService.getCorrections(caseId);
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const caseContextMutationResolvers = {
  /**
   * Add a correction to case context
   */
  addCaseContextCorrection: async (
    _: unknown,
    { input }: { input: AddCorrectionInput },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(input.caseId, context.user!.firmId);

    logger.info('[CaseContext] Adding correction', {
      caseId: input.caseId,
      sectionId: input.sectionId,
      correctionType: input.correctionType,
      userId: context.user!.id,
    });

    return caseContextFileService.addCorrection(input.caseId, context.user!.id, {
      sectionId: input.sectionId,
      fieldPath: input.fieldPath,
      correctionType: input.correctionType,
      correctedValue: input.correctedValue,
      reason: input.reason,
    });
  },

  /**
   * Update an existing correction
   */
  updateCaseContextCorrection: async (
    _: unknown,
    { input }: { input: UpdateCorrectionInput },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(input.caseId, context.user!.firmId);

    logger.info('[CaseContext] Updating correction', {
      caseId: input.caseId,
      correctionId: input.correctionId,
      userId: context.user!.id,
    });

    return caseContextFileService.updateCorrection(input.caseId, input.correctionId, {
      correctedValue: input.correctedValue,
      reason: input.reason,
      isActive: input.isActive,
    });
  },

  /**
   * Delete a correction
   */
  deleteCaseContextCorrection: async (
    _: unknown,
    { caseId, correctionId }: { caseId: string; correctionId: string },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    logger.info('[CaseContext] Deleting correction', {
      caseId,
      correctionId,
      userId: context.user!.id,
    });

    return caseContextFileService.deleteCorrection(caseId, correctionId);
  },

  /**
   * Regenerate case context by invalidating cache and refreshing all context data
   */
  regenerateCaseContext: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    logger.info('[CaseContext] Regenerating context', {
      caseId,
      userId: context.user!.id,
    });

    // First, generate thread summaries for emails that don't have them
    // This ensures email context is available for the context rebuild
    const threadSummariesGenerated =
      await caseContextFileService.generateCaseThreadSummaries(caseId);
    if (threadSummariesGenerated > 0) {
      logger.info('[CaseContext] Generated thread summaries', {
        caseId,
        count: threadSummariesGenerated,
      });
    }

    // Invalidate cache and refresh all context data in parallel
    await Promise.all([
      caseContextFileService.invalidateCache(caseId),
      caseContextFileService.refreshClientContext(caseId),
      caseContextFileService.refreshHealthIndicators(caseId),
    ]);
    return true;
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

export const caseContextFieldResolvers = {
  CaseContextFile: {
    // Ensure sections are always returned as an array
    sections: (parent: { sections?: unknown[] }) => {
      return parent.sections || [];
    },
    // Ensure corrections are always returned as an array
    corrections: (parent: { corrections?: unknown[] }) => {
      return parent.corrections || [];
    },
  },
  ContextSection: {
    // Map sectionId to id for GraphQL
    id: (parent: { id?: string; sectionId?: string }) => {
      return parent.id || parent.sectionId;
    },
  },
  UserCorrection: {
    // Ensure dates are strings
    createdAt: (parent: { createdAt: string | Date }) => {
      return parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt;
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const caseContextResolvers = {
  Query: caseContextQueryResolvers,
  Mutation: caseContextMutationResolvers,
  ...caseContextFieldResolvers,
};
