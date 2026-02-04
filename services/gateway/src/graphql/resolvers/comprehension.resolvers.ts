/**
 * Case Comprehension Resolvers
 *
 * GraphQL resolvers for the Case Comprehension system.
 * Handles viewing, generating, and correcting AI-generated case understanding.
 */

import { prisma } from '@legal-platform/database';
import { DataMap } from '@legal-platform/types';
import { createHash } from 'crypto';
import {
  comprehensionAgentService,
  ComprehensionResult,
} from '../../services/comprehension-agent.service';
import { checkComprehensionGenerationRateLimit } from '../../middleware/rate-limit.middleware';
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
    hasOperationalOversight?: boolean;
  };
}

interface AddComprehensionCorrectionInput {
  caseId: string;
  anchorText: string;
  correctionType: 'OVERRIDE' | 'APPEND' | 'REMOVE' | 'NOTE';
  correctedValue: string;
  reason?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Require at least Associate role
 */
function requireAssociateOrAbove(context: Context): void {
  if (!context.user?.firmId) {
    throw new Error('Authentication required');
  }
  // Associates and above can access comprehension
  const allowedRoles = ['Partner', 'Associate', 'BusinessOwner'];
  if (!allowedRoles.includes(context.user.role)) {
    throw new Error('Acces interzis. Doar asociații și partenerii pot accesa contextul.');
  }
}

/**
 * Require full access (Partner, BusinessOwner, or operational oversight) for modifications
 */
function requireFullAccess(context: Context): void {
  if (!context.user?.firmId) {
    throw new Error('Authentication required');
  }
  if (
    context.user.role !== 'Partner' &&
    context.user.role !== 'BusinessOwner' &&
    !context.user.hasOperationalOversight
  ) {
    throw new Error('Acces interzis. Doar partenerii pot modifica contextul.');
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
 * Get comprehension ID for a case, creating a placeholder if needed
 */
async function getComprehensionId(caseId: string): Promise<string> {
  const comprehension = await prisma.caseComprehension.findUnique({
    where: { caseId },
    select: { id: true },
  });

  if (!comprehension) {
    throw new Error('Comprehension not found for this case. Generate it first.');
  }

  return comprehension.id;
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const comprehensionQueryResolvers = {
  /**
   * Get comprehension for a case (generates if missing)
   */
  caseComprehension: async (
    _: unknown,
    { caseId, tier }: { caseId: string; tier?: 'FULL' | 'STANDARD' | 'CRITICAL' },
    context: Context
  ) => {
    requireAssociateOrAbove(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    logger.debug('[Comprehension] Getting case comprehension', { caseId, tier });

    // First check if comprehension exists
    const existing = await prisma.caseComprehension.findUnique({
      where: { caseId },
      include: {
        corrections: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!existing) {
      logger.info('[Comprehension] No comprehension found, returning null', { caseId });
      return null;
    }

    return {
      id: existing.id,
      caseId: existing.caseId,
      currentPicture: existing.currentPicture,
      contentStandard: existing.contentStandard,
      contentCritical: existing.contentCritical,
      dataMap: existing.dataMap,
      tokensFull: existing.tokensFull,
      tokensStandard: existing.tokensStandard,
      tokensCritical: existing.tokensCritical,
      version: existing.version,
      generatedAt: existing.generatedAt,
      validUntil: existing.validUntil,
      isStale: existing.isStale,
      corrections: existing.corrections,
    };
  },

  /**
   * Get comprehension agent runs for a case (for debugging/audit)
   */
  comprehensionAgentRuns: async (
    _: unknown,
    { caseId, limit }: { caseId: string; limit?: number },
    context: Context
  ) => {
    requireFullAccess(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    return prisma.comprehensionAgentRun.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      take: limit || 10,
    });
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const comprehensionMutationResolvers = {
  /**
   * Trigger comprehension regeneration
   */
  generateCaseComprehension: async (
    _: unknown,
    { caseId }: { caseId: string },
    context: Context
  ) => {
    requireAssociateOrAbove(context);
    await verifyCaseAccess(caseId, context.user!.firmId);

    // Rate limit: 5 generations per user per hour (protects against expensive Sonnet calls)
    const rateLimitResult = await checkComprehensionGenerationRateLimit(context.user!.id);
    if (!rateLimitResult.allowed) {
      throw new Error(
        `Limită de generare depășită. Încercați din nou în ${Math.ceil(rateLimitResult.retryAfter / 60)} minute.`
      );
    }

    logger.info('[Comprehension] Generating comprehension', {
      caseId,
      userId: context.user!.id,
      rateLimitRemaining: rateLimitResult.remaining,
    });

    const result = await comprehensionAgentService.generate(
      caseId,
      context.user!.firmId,
      context.user!.id,
      {
        mode: 'refresh',
        triggeredBy: 'manual',
      }
    );

    // Re-fetch with corrections to return complete data
    const comprehension = await prisma.caseComprehension.findUnique({
      where: { caseId },
      include: {
        corrections: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return comprehension;
  },

  /**
   * Add a correction to comprehension
   */
  addComprehensionCorrection: async (
    _: unknown,
    { input }: { input: AddComprehensionCorrectionInput },
    context: Context
  ) => {
    requireFullAccess(context);
    await verifyCaseAccess(input.caseId, context.user!.firmId);

    // Validate input lengths
    if (!input.anchorText?.trim()) {
      throw new Error('Textul de ancorare este obligatoriu.');
    }
    if (input.anchorText.length > 500) {
      throw new Error('Textul de ancorare nu poate depăși 500 de caractere.');
    }
    if (!input.correctedValue?.trim()) {
      throw new Error('Valoarea corectată este obligatorie.');
    }
    if (input.correctedValue.length > 10000) {
      throw new Error('Valoarea corectată nu poate depăși 10.000 de caractere.');
    }
    if (input.reason && input.reason.length > 1000) {
      throw new Error('Motivul nu poate depăși 1.000 de caractere.');
    }

    logger.info('[Comprehension] Adding correction', {
      caseId: input.caseId,
      correctionType: input.correctionType,
      userId: context.user!.id,
    });

    const comprehensionId = await getComprehensionId(input.caseId);

    // Create hash for anchor text (for matching after regeneration)
    const anchorHash = createHash('sha256').update(input.anchorText).digest('hex').slice(0, 64);

    // Map GraphQL enum to Prisma enum
    const correctionTypeMap: Record<string, 'OVERRIDE' | 'APPEND' | 'REMOVE' | 'NOTE'> = {
      OVERRIDE: 'OVERRIDE',
      APPEND: 'APPEND',
      REMOVE: 'REMOVE',
      NOTE: 'NOTE',
    };

    const correction = await prisma.comprehensionCorrection.create({
      data: {
        comprehensionId,
        anchorText: input.anchorText,
        anchorHash,
        correctionType: correctionTypeMap[input.correctionType],
        correctedValue: input.correctedValue,
        reason: input.reason,
        createdBy: context.user!.id,
      },
    });

    // Trigger immediate regeneration when correction is added
    // Pass correctionIds so the agent knows to skip anchor matching for this correction
    // (anchor text was from old content, won't match in newly generated content)
    const { comprehensionTriggerService } = await import(
      '../../services/comprehension-trigger.service'
    );
    comprehensionTriggerService
      .handleEvent(input.caseId, 'correction_added', context.user!.firmId, {
        userId: context.user!.id,
        correctionIds: [correction.id],
      })
      .catch(() => {});

    return correction;
  },

  /**
   * Toggle correction active state
   */
  updateComprehensionCorrection: async (
    _: unknown,
    { id, isActive }: { id: string; isActive: boolean },
    context: Context
  ) => {
    requireFullAccess(context);

    // Verify correction belongs to user's firm
    const correction = await prisma.comprehensionCorrection.findUnique({
      where: { id },
      include: {
        comprehension: {
          select: { firmId: true },
        },
      },
    });

    if (!correction || correction.comprehension.firmId !== context.user!.firmId) {
      throw new Error('Correction not found or access denied.');
    }

    logger.info('[Comprehension] Updating correction', {
      correctionId: id,
      isActive,
      userId: context.user!.id,
    });

    return prisma.comprehensionCorrection.update({
      where: { id },
      data: { isActive },
    });
  },

  /**
   * Delete a correction
   */
  deleteComprehensionCorrection: async (_: unknown, { id }: { id: string }, context: Context) => {
    requireFullAccess(context);

    // Verify correction belongs to user's firm
    const correction = await prisma.comprehensionCorrection.findUnique({
      where: { id },
      include: {
        comprehension: {
          select: { firmId: true },
        },
      },
    });

    if (!correction || correction.comprehension.firmId !== context.user!.firmId) {
      throw new Error('Correction not found or access denied.');
    }

    logger.info('[Comprehension] Soft-deleting correction', {
      correctionId: id,
      userId: context.user!.id,
    });

    // Soft delete: set isActive to false instead of hard delete
    await prisma.comprehensionCorrection.update({
      where: { id },
      data: { isActive: false },
    });
    return true;
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

export const comprehensionFieldResolvers = {
  CaseComprehension: {
    corrections: async (parent: { id: string; corrections?: unknown[] }) => {
      // Use already-fetched corrections if available (prevents N+1 query)
      if (parent.corrections) {
        return parent.corrections;
      }
      // Fallback fetch for direct type resolution
      return prisma.comprehensionCorrection.findMany({
        where: { comprehensionId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
    dataMap: (parent: { dataMap: unknown }) => {
      // Ensure dataMap is properly structured
      const dataMap = parent.dataMap as DataMap | null;
      return dataMap || { sources: [] };
    },
  },
  DataMap: {
    sources: (parent: DataMap) => {
      return parent.sources || [];
    },
  },
  ComprehensionCorrection: {
    createdAt: (parent: { createdAt: Date | string }) => {
      return parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt;
    },
    appliedAt: (parent: { appliedAt: Date | string | null }) => {
      if (!parent.appliedAt) return null;
      return parent.appliedAt instanceof Date ? parent.appliedAt.toISOString() : parent.appliedAt;
    },
  },
  ComprehensionAgentRun: {
    startedAt: (parent: { startedAt: Date | string | null }) => {
      if (!parent.startedAt) return null;
      return parent.startedAt instanceof Date ? parent.startedAt.toISOString() : parent.startedAt;
    },
    completedAt: (parent: { completedAt: Date | string | null }) => {
      if (!parent.completedAt) return null;
      return parent.completedAt instanceof Date
        ? parent.completedAt.toISOString()
        : parent.completedAt;
    },
    createdAt: (parent: { createdAt: Date | string }) => {
      return parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt;
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const comprehensionResolvers = {
  Query: comprehensionQueryResolvers,
  Mutation: comprehensionMutationResolvers,
  ...comprehensionFieldResolvers,
};
