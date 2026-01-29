/**
 * Case Context Resolvers
 * Phase 1: Context Viewer UI + Working Corrections
 *
 * GraphQL resolvers for viewing and correcting AI-generated case context.
 * Restricted to Partners only.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { caseContextFileService } from '../../services/case-context-file.service';
import { unifiedContextService } from '../../services/unified-context.service';
import {
  checkContextRateLimit,
  CONTEXT_RATE_LIMIT,
  CONTEXT_BATCH_RATE_LIMIT,
} from '../../middleware/rate-limit.middleware';
import type { ContextTier, ContextEntityType } from '@legal-platform/types';
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

/**
 * Verify user has access to a client (multi-tenancy check)
 */
async function verifyClientAccess(clientId: string, firmId: string): Promise<void> {
  const clientData = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firmId: true },
  });

  if (!clientData || clientData.firmId !== firmId) {
    throw new Error('Clientul nu a fost găsit sau accesul este interzis.');
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

  // ==========================================================================
  // Unified Context System Queries
  // ==========================================================================

  /**
   * Get unified context for a case (new system)
   */
  unifiedCaseContext: async (
    _: unknown,
    { caseId, tier }: { caseId: string; tier?: ContextTier },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    return unifiedContextService.getCaseContext(caseId, tier || 'full');
  },

  /**
   * Get unified context for a client (new system)
   */
  unifiedClientContext: async (
    _: unknown,
    { clientId, tier }: { clientId: string; tier?: ContextTier },
    context: Context
  ) => {
    requirePartner(context);
    await verifyClientAccess(clientId, context.user!.firmId);

    return unifiedContextService.getClientContext(clientId, tier || 'full');
  },

  /**
   * Get context for Word Add-in (combined client + case)
   */
  wordAddinContext: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    return unifiedContextService.getWordAddinContext(caseId, context.user!.firmId);
  },

  /**
   * Get context for email reply
   */
  emailReplyContext: async (
    _: unknown,
    {
      caseId,
      conversationId,
      targetActorId,
    }: { caseId: string; conversationId?: string; targetActorId?: string },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    return unifiedContextService.getEmailReplyContext(caseId, { conversationId, targetActorId });
  },

  /**
   * Resolve a reference ID to its source entity
   */
  resolveReference: async (_: unknown, { refId }: { refId: string }, context: Context) => {
    requirePartner(context);

    // Rate limiting: 60 requests per minute per user
    const rateLimitInfo = await checkContextRateLimit(context.user!.id, CONTEXT_RATE_LIMIT);
    if (rateLimitInfo.remaining <= 0) {
      const retryAfter = Math.max(0, rateLimitInfo.reset - Math.floor(Date.now() / 1000));
      throw new GraphQLError('Prea multe cereri. Vă rugăm să așteptați.', {
        extensions: {
          code: 'TOO_MANY_REQUESTS',
          retryAfter,
          reset: rateLimitInfo.reset,
        },
      });
    }

    // Validate refId format to prevent malformed requests
    const validRefIdRegex = /^(DOC|EMAIL|THR)-[A-Za-z0-9_-]{5}$/;
    if (!validRefIdRegex.test(refId)) {
      throw new Error('Invalid reference ID format');
    }

    const result = await unifiedContextService.resolveReference(refId, context.user!.firmId);
    return result;
  },

  /**
   * Resolve multiple reference IDs at once (batch)
   */
  resolveReferences: async (_: unknown, { refIds }: { refIds: string[] }, context: Context) => {
    requirePartner(context);

    // Rate limiting: 20 requests per minute per user (stricter for batch)
    const rateLimitInfo = await checkContextRateLimit(context.user!.id, CONTEXT_BATCH_RATE_LIMIT);
    if (rateLimitInfo.remaining <= 0) {
      const retryAfter = Math.max(0, rateLimitInfo.reset - Math.floor(Date.now() / 1000));
      throw new GraphQLError('Prea multe cereri. Vă rugăm să așteptați.', {
        extensions: {
          code: 'TOO_MANY_REQUESTS',
          retryAfter,
          reset: rateLimitInfo.reset,
        },
      });
    }

    const resultMap = await unifiedContextService.resolveReferences(refIds, context.user!.firmId);

    // Convert Map to array for GraphQL
    return Array.from(resultMap.values());
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
      caseContextFileService.refreshEmailThreadSummaries(caseId),
    ]);
    return true;
  },

  // ==========================================================================
  // Unified Context System Mutations
  // ==========================================================================

  /**
   * Add a correction using the unified context system
   */
  addUnifiedContextCorrection: async (
    _: unknown,
    {
      input,
    }: {
      input: {
        entityType: ContextEntityType;
        entityId: string;
        sectionId: string;
        fieldPath?: string;
        correctionType: 'override' | 'append' | 'remove' | 'note';
        originalValue?: string;
        correctedValue: string;
        reason?: string;
      };
    },
    context: Context
  ) => {
    requirePartner(context);

    // Verify access based on entity type
    if (input.entityType === 'CASE') {
      await verifyCaseAccess(input.entityId, context.user!.firmId);
    } else {
      await verifyClientAccess(input.entityId, context.user!.firmId);
    }

    logger.info('[CaseContext] Adding unified correction', {
      entityType: input.entityType,
      entityId: input.entityId,
      sectionId: input.sectionId,
      userId: context.user!.id,
    });

    return unifiedContextService.addCorrection(input, context.user!.id);
  },

  /**
   * Update a correction using the unified context system
   */
  updateUnifiedContextCorrection: async (
    _: unknown,
    {
      input,
    }: {
      input: { correctionId: string; correctedValue?: string; reason?: string; isActive?: boolean };
    },
    context: Context
  ) => {
    requirePartner(context);

    logger.info('[CaseContext] Updating unified correction', {
      correctionId: input.correctionId,
      userId: context.user!.id,
    });

    return unifiedContextService.updateCorrection(input);
  },

  /**
   * Delete a correction using the unified context system
   */
  deleteUnifiedContextCorrection: async (
    _: unknown,
    { correctionId }: { correctionId: string },
    context: Context
  ) => {
    requirePartner(context);

    logger.info('[CaseContext] Deleting unified correction', {
      correctionId,
      userId: context.user!.id,
    });

    return unifiedContextService.deleteCorrection(correctionId);
  },

  /**
   * Regenerate unified context for a case
   */
  regenerateUnifiedCaseContext: async (
    _: unknown,
    { caseId }: { caseId: string },
    context: Context
  ) => {
    requirePartner(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    logger.info('[CaseContext] Regenerating unified case context', {
      caseId,
      userId: context.user!.id,
    });

    await unifiedContextService.regenerate('CASE', caseId);
    return true;
  },

  /**
   * Regenerate unified context for a client
   */
  regenerateUnifiedClientContext: async (
    _: unknown,
    { clientId }: { clientId: string },
    context: Context
  ) => {
    requirePartner(context);
    await verifyClientAccess(clientId, context.user!.firmId);

    logger.info('[CaseContext] Regenerating unified client context', {
      clientId,
      userId: context.user!.id,
    });

    await unifiedContextService.regenerate('CLIENT', clientId);
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
