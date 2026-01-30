/**
 * Unified Context Service
 * Single service for both Client and Case context files with reference system
 *
 * ERROR MESSAGE CONVENTION:
 * - Error messages in this service are internal (English) and intended for logging/debugging
 * - User-facing errors are thrown by resolvers and should be in Romanian
 * - Example: This service throws "Context file not found" (internal)
 *   The resolver catches and may rethrow as "Fișierul context nu a fost găsit" (user-facing)
 */

import { prisma, redis, Prisma } from '@legal-platform/database';
import type {
  ContextEntityType,
  ContextTier,
  ContextResult,
  ContextReferenceInfo,
  ContextDisplaySection,
  WordAddinContextResult,
  EmailReplyContextResult,
  EmailReplyContextOptions,
  ResolvedReference,
  AddCorrectionInput,
  UpdateCorrectionInput,
  ClientIdentitySection,
  CaseIdentitySection,
  ClientPeopleSection,
  CasePeopleSection,
  DocumentsSection,
  CommunicationsSection,
  ThreadRef,
  EmailRef,
  UserCorrection,
  ContextSectionId,
  IdentitySection,
  PeopleSection,
} from '@legal-platform/types';
import { aiClient, getModelForFeature } from './ai-client.service';
import type Anthropic from '@anthropic-ai/sdk';
import { createHash, randomUUID } from 'crypto';
import { addHours } from 'date-fns';
import logger from '../utils/logger';
import { countTokens } from '../utils/token-counter';

// ============================================================================
// JSON Helpers
// ============================================================================

// Helper to safely convert to Prisma JSON value
function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  // JSON.parse(JSON.stringify()) ensures the value is JSON-serializable
  // and strips any non-serializable properties
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ============================================================================
// DB Correction Helpers
// ============================================================================
//
// MIGRATION COMPLETE (2026-01-29)
// --------------------------------
// The corrections system has fully migrated from JSON field to normalized table.
// All corrections are now read/written exclusively via the UserCorrection table.
//
// Remaining cleanup:
// - [PENDING] Drop userCorrections JSON column from ContextFile (next schema migration)
//
// ============================================================================

/**
 * Convert a database UserCorrection record to the service type.
 * Maps uppercase enum values to lowercase.
 */
function convertDbCorrection(dbCorrection: {
  id: string;
  sectionId: string;
  fieldPath: string | null;
  correctionType: 'OVERRIDE' | 'APPEND' | 'REMOVE' | 'NOTE';
  originalValue: string | null;
  correctedValue: string;
  reason: string | null;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
}): UserCorrection {
  return {
    id: dbCorrection.id,
    sectionId: dbCorrection.sectionId,
    fieldPath: dbCorrection.fieldPath ?? undefined,
    correctionType: dbCorrection.correctionType.toLowerCase() as
      | 'override'
      | 'append'
      | 'remove'
      | 'note',
    originalValue: dbCorrection.originalValue ?? undefined,
    correctedValue: dbCorrection.correctedValue,
    reason: dbCorrection.reason ?? undefined,
    createdAt: dbCorrection.createdAt.toISOString(),
    createdBy: dbCorrection.createdBy,
    isActive: dbCorrection.isActive,
  };
}

/**
 * Get corrections from the normalized UserCorrection table.
 * Migration complete - all corrections are now stored in the table.
 */
async function getCorrections(contextFileId: string): Promise<UserCorrection[]> {
  const tableCorrections = await prisma.userCorrection.findMany({
    where: { contextFileId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  return tableCorrections.map(convertDbCorrection);
}

// ============================================================================
// Constants
// ============================================================================

// Cache configuration
const CACHE_KEY_PREFIX = 'unified-context:';
const CORRECTION_CACHE_PREFIX = 'unified-context:correction:';
const CLIENT_CACHE_TTL = 24 * 60 * 60; // 24 hours - client data changes infrequently
const CASE_CACHE_TTL = 12 * 60 * 60; // 12 hours - cases change more often
const CORRECTION_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days - corrections are rarely updated
const CLIENT_VALIDITY_HOURS = 24;
const CASE_VALIDITY_HOURS = 12;

// Token budget constraints based on AI model context limits
const MAX_DOCUMENTS = 20; // ~500 tokens per doc summary = ~10k tokens max
const MAX_THREADS = 15; // ~200 tokens per thread = ~3k tokens max
const MAX_EMAILS = 10; // ~150 tokens per email = ~1.5k tokens max
const MAX_REFS_PER_REQUEST = 100; // DoS protection - limit batch resolution

// Parent snapshot size limits (for case context)
const MAX_SNAPSHOT_ADMINISTRATORS = 5; // Top 5 administrators
const MAX_SNAPSHOT_CONTACTS = 3; // Top 3 contacts (primary first)

// Content processing constraints
const MIN_CONTENT_PRESERVATION_RATIO = 0.7; // Ensure readable content after truncation
const SUMMARY_TRUNCATE_LENGTH = 100; // UI display constraint for summary previews

/**
 * Schema version for context files.
 * Increment this when making breaking changes to the context file structure.
 * Records with older schemaVersion will be lazily regenerated on next access.
 *
 * Version History:
 * - v1: Initial schema (2025-01)
 */
const CURRENT_SCHEMA_VERSION = 1;

// ============================================================================
// Reference ID Generation
// ============================================================================

function generateRefId(type: 'DOCUMENT' | 'EMAIL' | 'THREAD', sourceId: string): string {
  const prefix = { DOCUMENT: 'DOC', EMAIL: 'EMAIL', THREAD: 'THR' }[type];
  const hash = createHash('sha256').update(sourceId).digest('base64url').slice(0, 5);
  return `${prefix}-${hash}`;
}

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Sanitize entity ID for use in cache keys
 * Uses URL-safe base64 encoding to prevent any character collisions
 */
function sanitizeForCacheKey(value: string): string {
  // UUIDs don't contain special characters, but for safety use base64url encoding
  // This ensures no collision between different input strings
  return Buffer.from(value).toString('base64url');
}

/**
 * Generate a safe cache key for context
 */
function getCacheKey(entityType: ContextEntityType, entityId: string, tier: ContextTier): string {
  return `${CACHE_KEY_PREFIX}${entityType}:${sanitizeForCacheKey(entityId)}:${tier}`;
}

// ============================================================================
// Service Class
// ============================================================================

export class UnifiedContextService {
  // ==========================================================================
  // Main API
  // ==========================================================================

  /**
   * Get context file for a client
   */
  async getClientContext(
    clientId: string,
    tier: ContextTier = 'full',
    options?: { forceRefresh?: boolean }
  ): Promise<ContextResult | null> {
    return this.getContext('CLIENT', clientId, tier, options);
  }

  /**
   * Get context file for a case (includes embedded client context)
   */
  async getCaseContext(
    caseId: string,
    tier: ContextTier = 'full',
    options?: { forceRefresh?: boolean }
  ): Promise<ContextResult | null> {
    return this.getContext('CASE', caseId, tier, options);
  }

  /**
   * Get context for Word Add-in (full case + client)
   * @param caseId - The case ID to get context for
   * @param firmId - The firm ID for multi-tenancy validation
   */
  async getWordAddinContext(
    caseId: string,
    firmId: string
  ): Promise<WordAddinContextResult | null> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { clientId: true, firmId: true },
    });

    if (!caseData) return null;

    // Multi-tenancy check
    if (caseData.firmId !== firmId) {
      logger.warn('[UnifiedContext] Access denied: getWordAddinContext firmId mismatch', {
        caseId,
        requestedFirmId: firmId,
        actualFirmId: caseData.firmId,
      });
      return null;
    }

    const [caseContext, clientContext] = await Promise.all([
      this.getCaseContext(caseId, 'full'),
      this.getClientContext(caseData.clientId, 'full'),
    ]);

    if (!caseContext || !clientContext) return null;

    const combinedMarkdown = `# Context Client\n\n${clientContext.content}\n\n# Context Dosar\n\n${caseContext.content}`;
    const allRefs = [...clientContext.references, ...caseContext.references];

    return {
      caseId,
      clientId: caseData.clientId,
      contextMarkdown: combinedMarkdown,
      clientContext: clientContext.content,
      caseContext: caseContext.content,
      references: allRefs,
      tokenCount: clientContext.tokenCount + caseContext.tokenCount,
    };
  }

  /**
   * Get context for email reply
   */
  async getEmailReplyContext(
    caseId: string,
    options: EmailReplyContextOptions = {}
  ): Promise<EmailReplyContextResult | null> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { clientId: true },
    });
    if (!caseData) return null;

    const [caseContext, clientContext] = await Promise.all([
      this.getCaseContext(caseId, 'standard'),
      this.getClientContext(caseData.clientId, 'standard'),
    ]);

    if (!caseContext || !clientContext) return null;

    let threadContext: string | undefined;
    let actorContext: string | undefined;

    // Get thread context if requested
    if (options.conversationId) {
      threadContext = await this.getThreadContext(options.conversationId);
    }

    // Get actor-specific context if requested
    if (options.targetActorId) {
      actorContext = await this.getActorContext(caseId, options.targetActorId);
    }

    return {
      caseId,
      clientId: caseData.clientId,
      caseContext: caseContext.content,
      clientContext: clientContext.content,
      threadContext,
      actorContext,
      references: [...clientContext.references, ...caseContext.references],
      tokenCount: caseContext.tokenCount + clientContext.tokenCount,
    };
  }

  // ==========================================================================
  // Reference Resolution
  // ==========================================================================

  /**
   * Resolve a reference ID to its source entity
   * @param refId - The reference ID to resolve
   * @param firmId - The firm ID for multi-tenancy validation (required)
   */
  async resolveReference(refId: string, firmId: string): Promise<ResolvedReference | null> {
    const ref = await prisma.contextReference.findFirst({
      where: { refId },
      include: { contextFile: { select: { clientId: true, caseId: true, firmId: true } } },
    });

    if (!ref) return null;

    // Multi-tenancy check: always verify the reference belongs to the user's firm
    if (ref.contextFile.firmId !== firmId) {
      logger.warn('[UnifiedContext] Access denied: reference belongs to different firm', {
        refId,
        requestedFirmId: firmId,
        actualFirmId: ref.contextFile.firmId,
      });
      return null;
    }

    const entityDetails: ResolvedReference['entityDetails'] = {
      clientId: ref.contextFile.clientId ?? undefined,
      caseId: ref.contextFile.caseId ?? undefined,
    };

    // Fetch additional details based on source type
    // Log warning if source entity has been deleted
    let sourceDeleted = false;

    if (ref.sourceType === 'Document') {
      const doc = await prisma.document.findUnique({
        where: { id: ref.sourceId },
        select: { fileName: true, storagePath: true, sharePointItemId: true },
      });
      if (doc) {
        entityDetails.fileName = doc.fileName;
        entityDetails.storagePath = doc.storagePath ?? undefined;
        entityDetails.graphDriveItemId = doc.sharePointItemId ?? undefined;
      } else {
        sourceDeleted = true;
        logger.warn('[UnifiedContext] Reference source deleted', {
          refId,
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
        });
      }
    } else if (ref.sourceType === 'Email') {
      const email = await prisma.email.findUnique({
        where: { id: ref.sourceId },
        select: { graphMessageId: true, subject: true, from: true },
      });
      if (email) {
        entityDetails.graphMessageId = email.graphMessageId;
        entityDetails.subject = email.subject;
        // email.from is a Json object like { emailAddress: { name, address } }
        const fromObj = email.from as { emailAddress?: { name?: string; address?: string } } | null;
        entityDetails.from = fromObj?.emailAddress?.address || fromObj?.emailAddress?.name;
      } else {
        sourceDeleted = true;
        logger.warn('[UnifiedContext] Reference source deleted', {
          refId,
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
        });
      }
    } else if (ref.sourceType === 'ThreadSummary') {
      const thread = await prisma.threadSummary.findUnique({
        where: { id: ref.sourceId },
        select: { conversationId: true, messageCount: true },
      });
      if (thread) {
        entityDetails.conversationId = thread.conversationId;
        entityDetails.messageCount = thread.messageCount;
      } else {
        sourceDeleted = true;
        logger.warn('[UnifiedContext] Reference source deleted', {
          refId,
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
        });
      }
    }

    // Return null for deleted sources to prevent incomplete data
    if (sourceDeleted) {
      return null;
    }

    return {
      refId: ref.refId,
      refType: ref.refType as ContextReferenceInfo['refType'],
      sourceId: ref.sourceId,
      title: ref.title,
      summary: ref.summary ?? undefined,
      entityDetails,
    };
  }

  /**
   * Resolve multiple references at once
   * @param refIds - Array of reference IDs to resolve
   * @param firmId - Firm ID for multi-tenancy validation
   */
  async resolveReferences(
    refIds: string[],
    firmId: string
  ): Promise<Map<string, ResolvedReference>> {
    // Validate input is an array
    if (!Array.isArray(refIds)) {
      throw new Error('refIds must be an array');
    }

    // Filter out invalid entries and log warning
    const validRefIds = refIds.filter((id) => {
      if (!id || typeof id !== 'string') {
        logger.warn('[UnifiedContext] Invalid refId filtered out', { invalidValue: id });
        return false;
      }
      return true;
    });

    if (validRefIds.length === 0) return new Map();

    // DoS protection: limit the number of references that can be resolved at once
    if (validRefIds.length > MAX_REFS_PER_REQUEST) {
      throw new Error(`Cannot resolve more than ${MAX_REFS_PER_REQUEST} references at once`);
    }

    // Single query to get all references (with firmId filter for security + performance)
    const validRefs = await prisma.contextReference.findMany({
      where: {
        refId: { in: validRefIds },
        contextFile: { firmId },
      },
      include: { contextFile: { select: { clientId: true, caseId: true, firmId: true } } },
    });

    // Batch fetch source entities by type to avoid N+1 queries
    const docIds = validRefs.filter((r) => r.sourceType === 'Document').map((r) => r.sourceId);
    const emailIds = validRefs.filter((r) => r.sourceType === 'Email').map((r) => r.sourceId);
    const threadIds = validRefs
      .filter((r) => r.sourceType === 'ThreadSummary')
      .map((r) => r.sourceId);

    // Batch fetch source entities by type
    const docs =
      docIds.length > 0
        ? await prisma.document.findMany({
            where: { id: { in: docIds } },
            select: { id: true, fileName: true, storagePath: true, sharePointItemId: true },
          })
        : [];

    const emails =
      emailIds.length > 0
        ? await prisma.email.findMany({
            where: { id: { in: emailIds } },
            select: { id: true, graphMessageId: true, subject: true, from: true },
          })
        : [];

    const threads =
      threadIds.length > 0
        ? await prisma.threadSummary.findMany({
            where: { id: { in: threadIds } },
            select: { id: true, conversationId: true, messageCount: true },
          })
        : [];

    // Create lookup maps with explicit types
    type DocType = {
      id: string;
      fileName: string;
      storagePath: string | null;
      sharePointItemId: string | null;
    };
    type EmailType = { id: string; graphMessageId: string; subject: string; from: unknown };
    type ThreadType = { id: string; conversationId: string; messageCount: number };

    const docMap = new Map<string, DocType>(docs.map((d) => [d.id, d as DocType]));
    const emailMap = new Map<string, EmailType>(emails.map((e) => [e.id, e as EmailType]));
    const threadMap = new Map<string, ThreadType>(threads.map((t) => [t.id, t as ThreadType]));

    // Build results
    const results = new Map<string, ResolvedReference>();
    for (const ref of validRefs) {
      const entityDetails: ResolvedReference['entityDetails'] = {
        clientId: ref.contextFile.clientId ?? undefined,
        caseId: ref.contextFile.caseId ?? undefined,
      };

      if (ref.sourceType === 'Document') {
        const doc = docMap.get(ref.sourceId);
        if (doc) {
          entityDetails.fileName = doc.fileName;
          entityDetails.storagePath = doc.storagePath ?? undefined;
          entityDetails.graphDriveItemId = doc.sharePointItemId ?? undefined;
        }
      } else if (ref.sourceType === 'Email') {
        const email = emailMap.get(ref.sourceId);
        if (email) {
          entityDetails.graphMessageId = email.graphMessageId;
          entityDetails.subject = email.subject;
          const fromObj = email.from as {
            emailAddress?: { name?: string; address?: string };
          } | null;
          entityDetails.from = fromObj?.emailAddress?.address || fromObj?.emailAddress?.name;
        }
      } else if (ref.sourceType === 'ThreadSummary') {
        const thread = threadMap.get(ref.sourceId);
        if (thread) {
          entityDetails.conversationId = thread.conversationId;
          entityDetails.messageCount = thread.messageCount;
        }
      }

      results.set(ref.refId, {
        refId: ref.refId,
        refType: ref.refType as ContextReferenceInfo['refType'],
        sourceId: ref.sourceId,
        title: ref.title,
        summary: ref.summary ?? undefined,
        entityDetails,
      });
    }

    return results;
  }

  // ==========================================================================
  // User Corrections
  // ==========================================================================

  /**
   * Add a user correction
   * Writes to the normalized UserCorrection table (primary storage).
   * Also updates the JSON field for backwards compatibility during migration.
   */
  async addCorrection(input: AddCorrectionInput, userId: string): Promise<UserCorrection> {
    const contextFile = await this.getOrCreateContextFile(input.entityType, input.entityId);
    if (!contextFile) throw new Error('Context file not found');

    // Write to normalized table (primary storage)
    const dbCorrection = await prisma.userCorrection.create({
      data: {
        contextFileId: contextFile.id,
        sectionId: input.sectionId,
        fieldPath: input.fieldPath ?? null,
        correctionType: input.correctionType.toUpperCase() as
          | 'OVERRIDE'
          | 'APPEND'
          | 'REMOVE'
          | 'NOTE',
        originalValue: input.originalValue ?? null,
        correctedValue: input.correctedValue,
        reason: input.reason ?? null,
        createdBy: userId,
        isActive: true,
      },
    });

    // Convert to service type
    const correction = convertDbCorrection(dbCorrection);

    // Cache correction ID → contextFileId mapping for fast lookup
    await this.setCache(
      `${CORRECTION_CACHE_PREFIX}${correction.id}`,
      contextFile.id,
      CORRECTION_CACHE_TTL
    );

    // Update metadata only (no JSON write - avoids race condition)
    await prisma.contextFile.update({
      where: { id: contextFile.id },
      data: {
        lastCorrectedBy: userId,
        correctionsAppliedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache(input.entityType, input.entityId);

    return correction;
  }

  /**
   * Update a correction
   */
  async updateCorrection(input: UpdateCorrectionInput): Promise<UserCorrection | null> {
    const dbCorrection = await prisma.userCorrection.findUnique({
      where: { id: input.correctionId },
      include: { contextFile: { select: { clientId: true, caseId: true } } },
    });

    if (!dbCorrection) return null;

    const updated = await prisma.userCorrection.update({
      where: { id: input.correctionId },
      data: {
        ...(input.correctedValue !== undefined && { correctedValue: input.correctedValue }),
        ...(input.reason !== undefined && { reason: input.reason }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    // Invalidate cache
    const entityType = dbCorrection.contextFile.clientId ? 'CLIENT' : 'CASE';
    const entityId = (dbCorrection.contextFile.clientId ?? dbCorrection.contextFile.caseId)!;
    await this.invalidateCache(entityType as ContextEntityType, entityId);

    return convertDbCorrection(updated);
  }

  /**
   * Delete a correction
   */
  async deleteCorrection(correctionId: string): Promise<boolean> {
    // Try to find context file from cache first (O(1) lookup)
    const targetFile = await this.findContextFileByCorrection(correctionId);
    if (!targetFile) return false;

    // Delete from normalized table
    const deleteResult = await prisma.userCorrection.deleteMany({
      where: { id: correctionId },
    });

    if (deleteResult.count === 0) {
      logger.warn('[UnifiedContext] Correction not found for deletion', {
        correctionId,
        contextFileId: targetFile.id,
      });
      return false;
    }

    // Clear correction cache
    await this.deleteCache(`${CORRECTION_CACHE_PREFIX}${correctionId}`);

    // Invalidate cache
    const entityType = targetFile.clientId ? 'CLIENT' : 'CASE';
    const entityId = (targetFile.clientId ?? targetFile.caseId)!;
    await this.invalidateCache(entityType as ContextEntityType, entityId);

    return true;
  }

  /**
   * Find context file by correction ID using cache-first approach
   */
  private async findContextFileByCorrection(
    correctionId: string
  ): Promise<Awaited<ReturnType<typeof prisma.contextFile.findUnique>> | null> {
    // 1. Try cache first (O(1) lookup)
    try {
      const cachedFileId = await redis.get(`${CORRECTION_CACHE_PREFIX}${correctionId}`);
      if (cachedFileId) {
        const file = await prisma.contextFile.findUnique({ where: { id: cachedFileId } });
        if (file) {
          // Verify the correction still exists
          const tableCorrection = await prisma.userCorrection.findUnique({
            where: { id: correctionId },
          });
          if (tableCorrection) {
            return file;
          }
        }
        // Cache was stale, clear it
        await this.deleteCache(`${CORRECTION_CACHE_PREFIX}${correctionId}`);
      }
    } catch {
      // Cache error, fall through to DB lookup
    }

    // 2. Look up from UserCorrection table (indexed)
    const tableCorrection = await prisma.userCorrection.findUnique({
      where: { id: correctionId },
      select: { contextFileId: true },
    });

    if (tableCorrection) {
      const file = await prisma.contextFile.findUnique({
        where: { id: tableCorrection.contextFileId },
      });
      if (file) {
        // Cache this mapping for future lookups
        await this.setCache(
          `${CORRECTION_CACHE_PREFIX}${correctionId}`,
          file.id,
          CORRECTION_CACHE_TTL
        );
        return file;
      }
    }

    return null;
  }

  // ==========================================================================
  // Regeneration & Invalidation
  // ==========================================================================

  /**
   * Force regeneration of context file
   */
  async regenerate(entityType: ContextEntityType, entityId: string): Promise<ContextResult | null> {
    await this.invalidateCache(entityType, entityId);

    // Delete existing context file to force full regeneration
    if (entityType === 'CLIENT') {
      await prisma.contextFile.deleteMany({ where: { clientId: entityId } });
    } else {
      await prisma.contextFile.deleteMany({ where: { caseId: entityId } });
    }

    return this.getContext(entityType, entityId, 'full', { forceRefresh: true });
  }

  /**
   * Invalidate context (marks as expired)
   */
  async invalidate(entityType: ContextEntityType, entityId: string): Promise<void> {
    await this.invalidateCache(entityType, entityId);

    const where = entityType === 'CLIENT' ? { clientId: entityId } : { caseId: entityId };
    await prisma.contextFile.updateMany({
      where,
      data: { validUntil: new Date() }, // Expire immediately
    });
  }

  /**
   * Regenerate only specific sections of a context file.
   * Preserves unchanged sections from existing file.
   * Skips AI compression if content didn't actually change.
   *
   * @param entityType - CLIENT or CASE
   * @param entityId - The entity ID
   * @param sections - Array of sections to rebuild
   * @returns Updated context result or null if entity not found
   */
  async regenerateSections(
    entityType: ContextEntityType,
    entityId: string,
    sections: ContextSectionId[]
  ): Promise<ContextResult | null> {
    const startTime = Date.now();

    // Get existing context file
    const existing = await this.getContextFile(entityType, entityId);

    // If no existing file or all sections requested, do full regeneration
    if (!existing || sections.length === 4) {
      logger.info('[UnifiedContext] Full regeneration (no existing or all sections)', {
        entityType,
        entityId,
        reason: !existing ? 'no_existing_file' : 'all_sections_requested',
      });
      return this.regenerate(entityType, entityId);
    }

    // Parse existing sections with fallback
    let identity = existing.identity as unknown as IdentitySection;
    let people = existing.people as unknown as PeopleSection;
    let documents = existing.documents as unknown as DocumentsSection;
    let communications = existing.communications as unknown as CommunicationsSection;

    // Track what we rebuilt for logging
    const rebuiltSections: ContextSectionId[] = [];

    if (entityType === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { id: entityId },
        include: { firm: { select: { id: true } } },
      });

      if (!client) {
        logger.warn('[UnifiedContext] Client not found for incremental rebuild', { entityId });
        return null;
      }

      if (sections.includes('identity')) {
        identity = this.buildClientIdentity(client);
        rebuiltSections.push('identity');
      }
      if (sections.includes('people')) {
        people = this.buildClientPeople(client);
        rebuiltSections.push('people');
      }
      if (sections.includes('documents')) {
        documents = await this.buildClientDocuments(entityId, client.firmId);
        rebuiltSections.push('documents');
      }
      if (sections.includes('communications')) {
        communications = await this.buildClientCommunications(entityId, client.firmId);
        rebuiltSections.push('communications');
      }

      // Get corrections and apply
      const corrections = await getCorrections(existing.id);
      const corrected = this.applyCorrections(
        identity,
        people,
        documents,
        communications,
        corrections
      );

      // Render markdown
      const contentFull = this.renderClientMarkdown(
        corrected.identity as ClientIdentitySection,
        corrected.people as ClientPeopleSection,
        corrected.documents,
        corrected.communications
      );

      // Check if content actually changed
      const contentChanged = contentFull !== existing.contentFull;

      let contentStandard = existing.contentStandard;
      let contentCritical = existing.contentCritical;
      let tokensStandard = existing.tokensStandard;
      let tokensCritical = existing.tokensCritical;

      if (contentChanged) {
        // Only compress if content changed
        const compressionResults = await Promise.allSettled([
          this.compressContext(contentFull, 400, client.firmId),
          this.compressContext(contentFull, 100, client.firmId),
        ]);

        contentStandard =
          compressionResults[0].status === 'fulfilled'
            ? compressionResults[0].value
            : this.smartTruncate(contentFull, 400 * 4);

        contentCritical =
          compressionResults[1].status === 'fulfilled'
            ? compressionResults[1].value
            : this.smartTruncate(contentFull, 100 * 4);

        tokensStandard = countTokens(contentStandard);
        tokensCritical = countTokens(contentCritical);
      }

      const tokensFull = countTokens(contentFull);

      // Update context file
      const contextFile = await prisma.contextFile.update({
        where: { id: existing.id },
        data: {
          identity: toJsonValue(identity),
          people: toJsonValue(people),
          documents: toJsonValue(documents),
          communications: toJsonValue(communications),
          contentFull,
          contentStandard,
          contentCritical,
          tokensFull,
          tokensStandard,
          tokensCritical,
          version: { increment: 1 },
          generatedAt: new Date(),
          validUntil: addHours(new Date(), CLIENT_VALIDITY_HOURS),
        },
      });

      // Regenerate references if documents or communications changed
      if (sections.includes('documents') || sections.includes('communications')) {
        await this.generateReferences(contextFile.id, documents, communications);
      }

      // Invalidate cache
      await this.invalidateCache('CLIENT', entityId);

      logger.info('[UnifiedContext] Incremental client regeneration', {
        clientId: entityId,
        sectionsRequested: sections,
        sectionsRebuilt: rebuiltSections,
        contentChanged,
        compressionSkipped: !contentChanged,
        tokensFull,
        duration: Date.now() - startTime,
      });

      return this.getContext('CLIENT', entityId, 'full');
    } else {
      // CASE entity type
      const caseData = await prisma.case.findUnique({
        where: { id: entityId },
        include: {
          client: true,
          actors: true,
          teamMembers: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, role: true } },
            },
          },
          chapters: { where: { isStale: false }, orderBy: { startDate: 'desc' }, take: 1 },
        },
      });

      if (!caseData) {
        logger.warn('[UnifiedContext] Case not found for incremental rebuild', { entityId });
        return null;
      }

      if (sections.includes('identity')) {
        identity = this.buildCaseIdentity(caseData);
        rebuiltSections.push('identity');
      }
      if (sections.includes('people')) {
        people = this.buildCasePeople(caseData);
        rebuiltSections.push('people');
      }
      if (sections.includes('documents')) {
        documents = await this.buildCaseDocuments(entityId);
        rebuiltSections.push('documents');
      }
      if (sections.includes('communications')) {
        communications = await this.buildCaseCommunications(entityId, caseData.firmId);
        rebuiltSections.push('communications');
      }

      // Get parent client context snapshot
      const clientIdentity = this.buildClientIdentity(caseData.client);
      const clientPeople = this.buildClientPeopleSnapshot(caseData.client);
      const parentContextSnapshot = { ...clientIdentity, people: clientPeople };

      // Get corrections and apply
      const corrections = await getCorrections(existing.id);
      const corrected = this.applyCorrections(
        identity,
        people,
        documents,
        communications,
        corrections
      );

      // Render markdown
      const contentFull = this.renderCaseMarkdown(
        corrected.identity as CaseIdentitySection,
        corrected.people as CasePeopleSection,
        corrected.documents,
        corrected.communications,
        parentContextSnapshot
      );

      // Check if content actually changed
      const contentChanged = contentFull !== existing.contentFull;

      let contentStandard = existing.contentStandard;
      let contentCritical = existing.contentCritical;
      let tokensStandard = existing.tokensStandard;
      let tokensCritical = existing.tokensCritical;

      if (contentChanged) {
        const compressionResults = await Promise.allSettled([
          this.compressContext(contentFull, 400, caseData.firmId),
          this.compressContext(contentFull, 100, caseData.firmId),
        ]);

        contentStandard =
          compressionResults[0].status === 'fulfilled'
            ? compressionResults[0].value
            : this.smartTruncate(contentFull, 400 * 4);

        contentCritical =
          compressionResults[1].status === 'fulfilled'
            ? compressionResults[1].value
            : this.smartTruncate(contentFull, 100 * 4);

        tokensStandard = countTokens(contentStandard);
        tokensCritical = countTokens(contentCritical);
      }

      const tokensFull = countTokens(contentFull);

      // Update context file
      const contextFile = await prisma.contextFile.update({
        where: { id: existing.id },
        data: {
          identity: toJsonValue(identity),
          people: toJsonValue(people),
          documents: toJsonValue(documents),
          communications: toJsonValue(communications),
          parentContextSnapshot: toJsonValue(parentContextSnapshot),
          contentFull,
          contentStandard,
          contentCritical,
          tokensFull,
          tokensStandard,
          tokensCritical,
          version: { increment: 1 },
          generatedAt: new Date(),
          validUntil: addHours(new Date(), CASE_VALIDITY_HOURS),
        },
      });

      // Regenerate references if documents or communications changed
      if (sections.includes('documents') || sections.includes('communications')) {
        await this.generateReferences(contextFile.id, documents, communications);
      }

      // Invalidate cache
      await this.invalidateCache('CASE', entityId);

      logger.info('[UnifiedContext] Incremental case regeneration', {
        caseId: entityId,
        sectionsRequested: sections,
        sectionsRebuilt: rebuiltSections,
        contentChanged,
        compressionSkipped: !contentChanged,
        tokensFull,
        duration: Date.now() - startTime,
      });

      return this.getContext('CASE', entityId, 'full');
    }
  }

  // ==========================================================================
  // Internal: Get Context
  // ==========================================================================

  private async getContext(
    entityType: ContextEntityType,
    entityId: string,
    tier: ContextTier,
    options?: { forceRefresh?: boolean }
  ): Promise<ContextResult | null> {
    const cacheKey = getCacheKey(entityType, entityId, tier);

    // Try cache first (unless force refresh)
    if (!options?.forceRefresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch {
        // Cache miss
      }
    }

    // Get or generate context file
    let contextFile = await this.getContextFile(entityType, entityId);

    // Regenerate if: no file, expired, force refresh, or schema version mismatch
    const needsRegeneration =
      !contextFile ||
      new Date(contextFile.validUntil) < new Date() ||
      options?.forceRefresh ||
      (contextFile.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION;

    if (needsRegeneration) {
      if (contextFile && (contextFile.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION) {
        logger.info('[UnifiedContext] Regenerating due to schema version mismatch', {
          entityType,
          entityId,
          currentSchemaVersion: CURRENT_SCHEMA_VERSION,
          fileSchemaVersion: contextFile.schemaVersion ?? 1,
        });
      }
      contextFile = await this.generateContextFile(entityType, entityId);
    }

    if (!contextFile) return null;

    // Get references and merged corrections in parallel
    const [refs, mergedCorrections] = await Promise.all([
      prisma.contextReference.findMany({
        where: { contextFileId: contextFile.id },
        select: { refId: true, refType: true, title: true, summary: true },
      }),
      getCorrections(contextFile.id),
    ]);

    // Extract section data from context file JSON fields
    const identity = contextFile.identity as unknown as IdentitySection;
    const people = contextFile.people as unknown as PeopleSection;
    const documents = contextFile.documents as unknown as DocumentsSection;
    const communications = contextFile.communications as unknown as CommunicationsSection;

    // Build display sections for UI tabs
    const sections = this.buildDisplaySections(
      entityType,
      identity,
      people,
      documents,
      communications,
      contextFile.contentFull
    );

    const result: ContextResult = {
      entityType,
      entityId,
      tier,
      content: this.getContentForTier(contextFile, tier),
      tokenCount: this.getTokenCountForTier(contextFile, tier),
      sections,
      references: refs.map((r) => ({
        refId: r.refId,
        refType: r.refType as ContextReferenceInfo['refType'],
        title: r.title,
        summary: r.summary ?? undefined,
      })),
      corrections: mergedCorrections,
      version: contextFile.version,
      generatedAt: contextFile.generatedAt.toISOString(),
      validUntil: contextFile.validUntil.toISOString(),
    };

    // Cache result
    const ttl = entityType === 'CLIENT' ? CLIENT_CACHE_TTL : CASE_CACHE_TTL;
    await this.setCache(cacheKey, JSON.stringify(result), ttl);

    return result;
  }

  private getContentForTier(
    contextFile: { contentCritical: string; contentStandard: string; contentFull: string },
    tier: ContextTier
  ): string {
    switch (tier) {
      case 'critical':
        return contextFile.contentCritical;
      case 'standard':
        return contextFile.contentStandard;
      case 'full':
        return contextFile.contentFull;
    }
  }

  private getTokenCountForTier(
    contextFile: { tokensCritical: number; tokensStandard: number; tokensFull: number },
    tier: ContextTier
  ): number {
    switch (tier) {
      case 'critical':
        return contextFile.tokensCritical;
      case 'standard':
        return contextFile.tokensStandard;
      case 'full':
        return contextFile.tokensFull;
    }
  }

  // ==========================================================================
  // Internal: Context File Operations
  // ==========================================================================

  private async getContextFile(entityType: ContextEntityType, entityId: string) {
    const where = entityType === 'CLIENT' ? { clientId: entityId } : { caseId: entityId };
    return prisma.contextFile.findFirst({ where });
  }

  private async getOrCreateContextFile(entityType: ContextEntityType, entityId: string) {
    let contextFile = await this.getContextFile(entityType, entityId);
    if (!contextFile) {
      contextFile = await this.generateContextFile(entityType, entityId);
    }
    return contextFile;
  }

  // ==========================================================================
  // Internal: Generate Context File
  // ==========================================================================

  private async generateContextFile(entityType: ContextEntityType, entityId: string) {
    const startTime = Date.now();

    if (entityType === 'CLIENT') {
      return this.generateClientContextFile(entityId, startTime);
    } else {
      return this.generateCaseContextFile(entityId, startTime);
    }
  }

  private async generateClientContextFile(clientId: string, startTime: number) {
    // Fetch client data
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { firm: { select: { id: true } } },
    });

    if (!client) return null;

    // Build sections
    const identity = this.buildClientIdentity(client);
    const people = this.buildClientPeople(client);
    const documents = await this.buildClientDocuments(clientId, client.firmId);
    const communications = await this.buildClientCommunications(clientId, client.firmId);

    // Get existing corrections from both JSON field and normalized table
    const existingFile = await this.getContextFile('CLIENT', clientId);
    const corrections = existingFile ? await getCorrections(existingFile.id) : [];

    // Apply corrections to sections before rendering
    const {
      identity: correctedIdentity,
      people: correctedPeople,
      documents: correctedDocs,
      communications: correctedComms,
    } = this.applyCorrections(identity, people, documents, communications, corrections);

    // Render tiers with corrected data
    const contentFull = this.renderClientMarkdown(
      correctedIdentity,
      correctedPeople,
      correctedDocs,
      correctedComms
    );
    // Parallelize compression calls with resilient error handling
    const compressionResults = await Promise.allSettled([
      this.compressContext(contentFull, 400, client.firmId),
      this.compressContext(contentFull, 100, client.firmId),
    ]);

    const contentStandard =
      compressionResults[0].status === 'fulfilled'
        ? compressionResults[0].value
        : this.smartTruncate(contentFull, 400 * 4);

    const contentCritical =
      compressionResults[1].status === 'fulfilled'
        ? compressionResults[1].value
        : this.smartTruncate(contentFull, 100 * 4);

    // Log any compression failures
    compressionResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        logger.warn('[UnifiedContext] Client compression failed for tier', {
          tier: i === 0 ? 'standard' : 'critical',
          clientId,
          error: result.reason?.message || String(result.reason),
        });
      }
    });

    // Estimate tokens
    const tokensFull = countTokens(contentFull);
    const tokensStandard = countTokens(contentStandard);
    const tokensCritical = countTokens(contentCritical);

    // Upsert context file
    const contextFile = await prisma.contextFile.upsert({
      where: { clientId },
      create: {
        firmId: client.firmId,
        entityType: 'CLIENT',
        clientId,
        identity: toJsonValue(identity),
        people: toJsonValue(people),
        documents: toJsonValue(documents),
        communications: toJsonValue(communications),
        contentCritical,
        contentStandard,
        contentFull,
        tokensCritical,
        tokensStandard,
        tokensFull,
        version: 1,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        generatedAt: new Date(),
        validUntil: addHours(new Date(), CLIENT_VALIDITY_HOURS),
      },
      update: {
        identity: toJsonValue(identity),
        people: toJsonValue(people),
        documents: toJsonValue(documents),
        communications: toJsonValue(communications),
        contentCritical,
        contentStandard,
        contentFull,
        tokensCritical,
        tokensStandard,
        tokensFull,
        version: { increment: 1 },
        schemaVersion: CURRENT_SCHEMA_VERSION,
        generatedAt: new Date(),
        validUntil: addHours(new Date(), CLIENT_VALIDITY_HOURS),
      },
    });

    // Generate references
    await this.generateReferences(contextFile.id, documents, communications);

    logger.info('[UnifiedContext] Generated client context', {
      clientId,
      tokensFull,
      tokensStandard,
      tokensCritical,
      duration: Date.now() - startTime,
    });

    return contextFile;
  }

  private async generateCaseContextFile(caseId: string, startTime: number) {
    // Fetch case data with relations
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        actors: true,
        teamMembers: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
        chapters: { where: { isStale: false }, orderBy: { startDate: 'desc' }, take: 1 },
      },
    });

    if (!caseData) return null;

    // Build sections
    const identity = this.buildCaseIdentity(caseData);
    const people = this.buildCasePeople(caseData);
    const documents = await this.buildCaseDocuments(caseId);
    const communications = await this.buildCaseCommunications(caseId, caseData.firmId);

    // Get parent client context snapshot (limited for token efficiency)
    const clientIdentity = this.buildClientIdentity(caseData.client);
    const clientPeople = this.buildClientPeopleSnapshot(caseData.client);
    const parentContextSnapshot = { ...clientIdentity, people: clientPeople };

    // Get existing corrections from both JSON field and normalized table
    const existingFile = await this.getContextFile('CASE', caseId);
    const corrections = existingFile ? await getCorrections(existingFile.id) : [];

    // Apply corrections to sections before rendering
    const {
      identity: correctedIdentity,
      people: correctedPeople,
      documents: correctedDocs,
      communications: correctedComms,
    } = this.applyCorrections(identity, people, documents, communications, corrections);

    // Render tiers with corrected data
    const contentFull = this.renderCaseMarkdown(
      correctedIdentity,
      correctedPeople,
      correctedDocs,
      correctedComms,
      parentContextSnapshot
    );
    // Parallelize compression calls with resilient error handling
    const compressionResults = await Promise.allSettled([
      this.compressContext(contentFull, 400, caseData.firmId),
      this.compressContext(contentFull, 100, caseData.firmId),
    ]);

    const contentStandard =
      compressionResults[0].status === 'fulfilled'
        ? compressionResults[0].value
        : this.smartTruncate(contentFull, 400 * 4);

    const contentCritical =
      compressionResults[1].status === 'fulfilled'
        ? compressionResults[1].value
        : this.smartTruncate(contentFull, 100 * 4);

    // Log any compression failures
    compressionResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        logger.warn('[UnifiedContext] Case compression failed for tier', {
          tier: i === 0 ? 'standard' : 'critical',
          caseId,
          error: result.reason?.message || String(result.reason),
        });
      }
    });

    // Estimate tokens
    const tokensFull = countTokens(contentFull);
    const tokensStandard = countTokens(contentStandard);
    const tokensCritical = countTokens(contentCritical);

    // Upsert context file
    const contextFile = await prisma.contextFile.upsert({
      where: { caseId },
      create: {
        firmId: caseData.firmId,
        entityType: 'CASE',
        caseId,
        identity: toJsonValue(identity),
        people: toJsonValue(people),
        documents: toJsonValue(documents),
        communications: toJsonValue(communications),
        parentContextSnapshot: toJsonValue(parentContextSnapshot),
        contentCritical,
        contentStandard,
        contentFull,
        tokensCritical,
        tokensStandard,
        tokensFull,
        version: 1,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        generatedAt: new Date(),
        validUntil: addHours(new Date(), CASE_VALIDITY_HOURS),
      },
      update: {
        identity: toJsonValue(identity),
        people: toJsonValue(people),
        documents: toJsonValue(documents),
        communications: toJsonValue(communications),
        parentContextSnapshot: toJsonValue(parentContextSnapshot),
        contentCritical,
        contentStandard,
        contentFull,
        tokensCritical,
        tokensStandard,
        tokensFull,
        version: { increment: 1 },
        schemaVersion: CURRENT_SCHEMA_VERSION,
        generatedAt: new Date(),
        validUntil: addHours(new Date(), CASE_VALIDITY_HOURS),
      },
    });

    // Generate references
    await this.generateReferences(contextFile.id, documents, communications);

    logger.info('[UnifiedContext] Generated case context', {
      caseId,
      tokensFull,
      tokensStandard,
      tokensCritical,
      duration: Date.now() - startTime,
    });

    return contextFile;
  }

  // ==========================================================================
  // Section Builders - Client
  // ==========================================================================

  private buildClientIdentity(client: {
    id: string;
    name: string;
    clientType: string | null;
    companyType: string | null;
    cui: string | null;
    registrationNumber: string | null;
    address: string | null;
    contactInfo: unknown;
  }): ClientIdentitySection {
    const contactInfo = (client.contactInfo as { phone?: string; email?: string }) || {};
    return {
      entityType: 'CLIENT',
      id: client.id,
      name: client.name,
      // Explicit type mapping: 'Individual' -> 'individual', otherwise 'company' (default)
      type:
        client.clientType === 'Individual'
          ? 'individual'
          : client.clientType === 'Company'
            ? 'company'
            : 'company',
      companyType: client.companyType ?? undefined,
      cui: client.cui ?? undefined,
      registrationNumber: client.registrationNumber ?? undefined,
      address: client.address ?? undefined,
      phone: contactInfo.phone ?? undefined,
      email: contactInfo.email ?? undefined,
    };
  }

  private buildClientPeople(client: {
    administrators: unknown;
    contacts: unknown;
  }): ClientPeopleSection {
    const admins = this.parseJsonArray(client.administrators, 'client.administrators');
    const contacts = this.parseJsonArray(client.contacts, 'client.contacts');

    // Helper to convert contact record to PersonEntry
    const toPersonEntry = (c: Record<string, unknown>, forcePrimary?: boolean) => ({
      id: c.id as string | undefined,
      name: (c.name || c.nume) as string,
      role: (c.role || c.functie || 'Contact') as string,
      email: c.email as string | undefined,
      phone: (c.phone || c.telefon) as string | undefined,
      isPrimary: forcePrimary ?? (c.isPrimary as boolean | undefined),
    });

    // Find primary contact or use first contact as fallback
    const primaryRaw = contacts.find((c: Record<string, unknown>) => c.isPrimary) as
      | Record<string, unknown>
      | undefined;
    const firstContact = contacts[0] as Record<string, unknown> | undefined;
    const primaryContact = primaryRaw
      ? toPersonEntry(primaryRaw, true)
      : firstContact
        ? toPersonEntry(firstContact)
        : undefined;

    return {
      entityType: 'CLIENT' as const,
      administrators: admins.map((a: Record<string, unknown>) => ({
        id: a.id as string | undefined,
        name: (a.name || a.nume) as string,
        role: (a.role || a.functie || 'Administrator') as string,
        email: a.email as string | undefined,
        phone: (a.phone || a.telefon) as string | undefined,
      })),
      contacts: contacts.map((c: Record<string, unknown>) => toPersonEntry(c)),
      primaryContact,
    };
  }

  /**
   * Build a limited snapshot of client people for case context.
   * Limits administrators and contacts to reduce token usage in nested context.
   */
  private buildClientPeopleSnapshot(client: {
    administrators: unknown;
    contacts: unknown;
  }): ClientPeopleSection {
    const fullPeople = this.buildClientPeople(client);

    // Limit administrators to top N
    const limitedAdmins = fullPeople.administrators.slice(0, MAX_SNAPSHOT_ADMINISTRATORS);

    // Sort contacts: primary first, then by name; limit to top N
    const sortedContacts = [...fullPeople.contacts].sort((a, b) => {
      // Primary contact first
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      // Then alphabetically by name
      return (a.name || '').localeCompare(b.name || '');
    });
    const limitedContacts = sortedContacts.slice(0, MAX_SNAPSHOT_CONTACTS);

    return {
      entityType: 'CLIENT' as const,
      administrators: limitedAdmins,
      contacts: limitedContacts,
      primaryContact: fullPeople.primaryContact,
    };
  }

  private async buildClientDocuments(clientId: string, firmId: string): Promise<DocumentsSection> {
    // Get documents that belong to this client but are not linked to any case
    // Using Prisma's relation filter instead of two queries for better performance
    const whereClause = {
      clientId,
      firmId,
      caseLinks: { none: {} }, // NOT EXISTS (SELECT 1 FROM case_documents WHERE ...)
    };

    const [docs, totalCount] = await Promise.all([
      prisma.document.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: MAX_DOCUMENTS,
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          fileType: true,
          extractedContent: true,
          userDescription: true,
          extractionStatus: true,
          sourceType: true,
        },
      }),
      prisma.document.count({ where: whereClause }),
    ]);

    if (docs.length > 0 && totalCount > MAX_DOCUMENTS) {
      logger.debug('[UnifiedContext] Client documents truncated', {
        clientId,
        fetched: docs.length,
        total: totalCount,
        max: MAX_DOCUMENTS,
      });
    }

    return {
      items: docs.map((d) => ({
        refId: generateRefId('DOCUMENT', d.id),
        sourceId: d.id,
        fileName: d.fileName,
        uploadedAt: d.createdAt.toISOString(),
        documentType: d.fileType ?? undefined,
        summary:
          d.userDescription || (d.extractedContent ? d.extractedContent.slice(0, 200) : undefined),
        isScan: d.extractionStatus === 'NONE' || d.extractionStatus === 'FAILED',
        source: this.mapSourceType(d.sourceType),
      })),
      totalCount,
      hasMore: totalCount > MAX_DOCUMENTS,
    };
  }

  private mapSourceType(
    sourceType: string | null
  ): 'uploaded' | 'generated' | 'received' | 'sharepoint' {
    switch (sourceType) {
      case 'AI_GENERATED':
        return 'generated';
      case 'EMAIL_ATTACHMENT':
        return 'received';
      case 'SHAREPOINT':
        return 'sharepoint';
      default:
        return 'uploaded';
    }
  }

  private async buildClientCommunications(
    clientId: string,
    firmId: string
  ): Promise<CommunicationsSection> {
    // Get threads NOT linked to any case
    const threads = await prisma.threadSummary.findMany({
      where: { firmId, caseId: null },
      orderBy: { lastAnalyzedAt: 'desc' },
      take: MAX_THREADS,
    });

    if (threads.length > 0 && threads.length >= MAX_THREADS) {
      logger.debug('[UnifiedContext] Client threads truncated', {
        clientId,
        fetched: threads.length,
        max: MAX_THREADS,
      });
    }

    // Fetch subjects for each thread from emails
    const conversationIds = threads.map((t) => t.conversationId);
    const subjectMap = await this.getThreadSubjects(conversationIds);

    const threadRefs: ThreadRef[] = threads.map((t) => ({
      refId: generateRefId('THREAD', t.id),
      sourceId: t.id, // Actual ThreadSummary ID for resolution
      conversationId: t.conversationId,
      subject: subjectMap.get(t.conversationId) || t.conversationId,
      participants: this.parseStringArray(t.participants, 'clientThread.participants'),
      lastMessageDate: t.lastAnalyzedAt.toISOString(),
      messageCount: t.messageCount,
      overview: t.overview ?? undefined,
      keyPoints: this.parseStringArray(t.keyPoints, 'clientThread.keyPoints'),
      actionItems: this.parseStringArray(t.actionItems, 'clientThread.actionItems'),
      sentiment: t.sentiment ?? undefined,
      isUrgent: t.sentiment === 'urgent',
      hasUnread: false,
    }));

    // Get important individual emails (not in threads, or flagged as important)
    const emailRefs = await this.buildImportantEmails(firmId, undefined, conversationIds);

    return {
      overview: this.generateCommunicationsOverview(threadRefs),
      threads: threadRefs,
      emails: emailRefs,
      totalThreads: threadRefs.length,
      unreadCount: 0,
      urgentCount: threadRefs.filter((t) => t.isUrgent).length,
      pendingActions: [],
    };
  }

  // ==========================================================================
  // Section Builders - Case
  // ==========================================================================

  private buildCaseIdentity(caseData: {
    id: string;
    caseNumber: string;
    title: string;
    type: string;
    status: string;
    metadata: unknown;
    value: { toNumber: () => number } | null;
    openedDate: Date;
    closedDate: Date | null;
    description: string;
    keywords: string[];
    chapters?: Array<{ phase: string; title: string }>;
  }): CaseIdentitySection {
    const currentPhase = caseData.chapters?.[0];
    const metadata = caseData.metadata as Record<string, unknown> | null;

    return {
      entityType: 'CASE' as const,
      id: caseData.id,
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      type: caseData.type,
      typeLabel: caseData.type, // Would map to Romanian label
      status: caseData.status,
      statusLabel: caseData.status, // Would map to Romanian label
      court: (metadata?.court as string) ?? undefined,
      phase: currentPhase?.phase ?? undefined,
      phaseLabel: currentPhase?.title ?? undefined,
      value: caseData.value ? caseData.value.toNumber() : undefined,
      openedDate: caseData.openedDate.toISOString(),
      closedDate: caseData.closedDate?.toISOString(),
      summary: caseData.description ?? undefined,
      keywords: caseData.keywords ?? [],
    };
  }

  private buildCasePeople(caseData: {
    actors: Array<{
      id: string;
      name: string;
      role: string;
      customRoleCode: string | null;
      organization: string | null;
      email: string | null;
      emailDomains: string[];
      phone: string | null;
      address: string | null;
      communicationNotes: string | null;
      preferredTone: string | null;
    }>;
    teamMembers: Array<{
      userId: string;
      role: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        role: string;
      };
    }>;
  }): CasePeopleSection {
    return {
      entityType: 'CASE' as const,
      actors: caseData.actors.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        roleLabel: a.customRoleCode || a.role, // Would map to Romanian
        organization: a.organization ?? undefined,
        email: a.email ?? undefined,
        emailDomains: a.emailDomains ?? [],
        phone: a.phone ?? undefined,
        address: a.address ?? undefined,
        communicationNotes: a.communicationNotes ?? undefined,
        preferredTone: a.preferredTone ?? undefined,
        isClient: a.role === 'CLIENT',
      })),
      team: caseData.teamMembers.map((tm) => ({
        userId: tm.userId,
        name: [tm.user.firstName, tm.user.lastName].filter(Boolean).join(' ') || 'Unknown',
        userRole: tm.user.role,
        caseRole: tm.role,
        caseRoleLabel: tm.role, // Would map to Romanian
      })),
    };
  }

  private async buildCaseDocuments(caseId: string): Promise<DocumentsSection> {
    const caseDocs = await prisma.caseDocument.findMany({
      where: { caseId },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            createdAt: true,
            fileType: true,
            extractedContent: true,
            userDescription: true,
            extractionStatus: true,
            sourceType: true,
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
      take: MAX_DOCUMENTS,
    });

    const totalCount = await prisma.caseDocument.count({ where: { caseId } });

    if (caseDocs.length > 0 && totalCount > MAX_DOCUMENTS) {
      logger.debug('[UnifiedContext] Case documents truncated', {
        caseId,
        fetched: caseDocs.length,
        total: totalCount,
        max: MAX_DOCUMENTS,
      });
    }

    return {
      items: caseDocs.map((cd) => ({
        refId: generateRefId('DOCUMENT', cd.document.id),
        sourceId: cd.document.id,
        fileName: cd.document.fileName,
        uploadedAt: cd.document.createdAt.toISOString(),
        documentType: cd.document.fileType ?? undefined,
        summary:
          cd.document.userDescription ||
          (cd.document.extractedContent ? cd.document.extractedContent.slice(0, 200) : undefined),
        isScan:
          cd.document.extractionStatus === 'NONE' || cd.document.extractionStatus === 'FAILED',
        source: this.mapSourceType(cd.document.sourceType),
      })),
      totalCount,
      hasMore: totalCount > MAX_DOCUMENTS,
    };
  }

  private async buildCaseCommunications(
    caseId: string,
    firmId: string
  ): Promise<CommunicationsSection> {
    const threads = await prisma.threadSummary.findMany({
      where: { caseId, firmId },
      orderBy: { lastAnalyzedAt: 'desc' },
      take: MAX_THREADS,
    });

    if (threads.length > 0 && threads.length >= MAX_THREADS) {
      logger.debug('[UnifiedContext] Case threads truncated', {
        caseId,
        fetched: threads.length,
        max: MAX_THREADS,
      });
    }

    // Fetch subjects for each thread from emails
    const conversationIds = threads.map((t) => t.conversationId);
    const subjectMap = await this.getThreadSubjects(conversationIds);

    const threadRefs: ThreadRef[] = threads.map((t) => ({
      refId: generateRefId('THREAD', t.id),
      sourceId: t.id, // Actual ThreadSummary ID for resolution
      conversationId: t.conversationId,
      subject: subjectMap.get(t.conversationId) || t.conversationId,
      participants: this.parseStringArray(t.participants, 'caseThread.participants'),
      lastMessageDate: t.lastAnalyzedAt.toISOString(),
      messageCount: t.messageCount,
      overview: t.overview ?? undefined,
      keyPoints: this.parseStringArray(t.keyPoints, 'caseThread.keyPoints'),
      actionItems: this.parseStringArray(t.actionItems, 'caseThread.actionItems'),
      sentiment: t.sentiment ?? undefined,
      isUrgent: t.sentiment === 'urgent',
      hasUnread: false,
    }));

    // Get important individual emails for this case
    const emailRefs = await this.buildImportantEmails(firmId, caseId, conversationIds);

    // Get pending tasks as pending actions
    const tasks = await prisma.task.findMany({
      where: { caseId, status: { in: ['Pending', 'InProgress'] } },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { id: true, title: true, dueDate: true, type: true },
    });

    const pendingActions = tasks.map((t) => ({
      id: t.id,
      type: this.mapTaskTypeToActionType(t.type),
      description: t.title,
      dueDate: t.dueDate?.toISOString(),
    }));

    return {
      overview: this.generateCommunicationsOverview(threadRefs),
      threads: threadRefs,
      emails: emailRefs,
      totalThreads: threads.length,
      unreadCount: 0,
      urgentCount: threadRefs.filter((t) => t.isUrgent).length,
      pendingActions,
    };
  }

  // ==========================================================================
  // Markdown Rendering
  // ==========================================================================

  private renderClientMarkdown(
    identity: ClientIdentitySection,
    people: ClientPeopleSection,
    documents: DocumentsSection,
    communications: CommunicationsSection
  ): string {
    const lines: string[] = [];

    // Identity
    lines.push(`## Client: ${identity.name}`);
    if (identity.type === 'company') {
      lines.push(`Tip: ${identity.companyType || 'Companie'}`);
      if (identity.cui) lines.push(`CUI: ${identity.cui}`);
      if (identity.registrationNumber)
        lines.push(`Nr. Înregistrare: ${identity.registrationNumber}`);
    }
    if (identity.address) lines.push(`Adresă: ${identity.address}`);
    if (identity.phone) lines.push(`Telefon: ${identity.phone}`);
    if (identity.email) lines.push(`Email: ${identity.email}`);
    lines.push('');

    // People
    if (people.administrators.length > 0) {
      lines.push('### Administratori');
      people.administrators.forEach((a) => {
        lines.push(`- ${a.name} (${a.role})${a.email ? ` - ${a.email}` : ''}`);
      });
      lines.push('');
    }

    if (people.contacts.length > 0) {
      lines.push('### Contacte');
      people.contacts.forEach((c) => {
        const primary = c.isPrimary ? ' [Principal]' : '';
        lines.push(`- ${c.name} (${c.role})${primary}${c.email ? ` - ${c.email}` : ''}`);
      });
      lines.push('');
    }

    // Documents
    if (documents.items.length > 0) {
      lines.push('### Documente');
      documents.items.forEach((d) => {
        const scanTag = d.isScan ? ' [SCAN]' : '';
        lines.push(`- [${d.refId}] ${d.fileName}${scanTag}`);
        if (d.summary) lines.push(`  ${d.summary.slice(0, SUMMARY_TRUNCATE_LENGTH)}...`);
      });
      if (documents.hasMore)
        lines.push(`  ... și încă ${documents.totalCount - documents.items.length} documente`);
      lines.push('');
    }

    // Communications
    if (communications.threads.length > 0) {
      lines.push('### Comunicări');
      if (communications.overview) lines.push(communications.overview);
      lines.push('');
      lines.push('**Thread-uri recente:**');
      communications.threads.slice(0, 5).forEach((t) => {
        const urgent = t.isUrgent ? ' [URGENT]' : '';
        lines.push(`- [${t.refId}] ${t.subject}${urgent} (${t.messageCount} mesaje)`);
        if (t.overview) lines.push(`  ${t.overview}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  private renderCaseMarkdown(
    identity: CaseIdentitySection,
    people: CasePeopleSection,
    documents: DocumentsSection,
    communications: CommunicationsSection,
    clientSnapshot: ClientIdentitySection & { people: ClientPeopleSection }
  ): string {
    const lines: string[] = [];

    // Case Identity
    lines.push(`## Dosar: ${identity.title}`);
    lines.push(
      `Nr: ${identity.caseNumber} | Tip: ${identity.typeLabel} | Status: ${identity.statusLabel}`
    );
    if (identity.court) lines.push(`Instanță: ${identity.court}`);
    if (identity.phase) lines.push(`Fază: ${identity.phaseLabel}`);
    if (identity.value) lines.push(`Valoare: ${identity.value.toLocaleString('ro-RO')} RON`);
    if (identity.summary) lines.push(`\n${identity.summary}`);
    lines.push('');

    // Client Reference
    lines.push(`### Client: ${clientSnapshot.name}`);
    if (clientSnapshot.type === 'company' && clientSnapshot.cui) {
      lines.push(`CUI: ${clientSnapshot.cui}`);
    }
    lines.push('');

    // Actors
    if (people.actors.length > 0) {
      lines.push('### Părți');
      people.actors.forEach((a) => {
        const org = a.organization ? ` (${a.organization})` : '';
        lines.push(`- **${a.roleLabel}**: ${a.name}${org}`);
        if (a.email) lines.push(`  Email: ${a.email}`);
        if (a.communicationNotes) lines.push(`  Note: ${a.communicationNotes}`);
        if (a.preferredTone) lines.push(`  Ton preferat: ${a.preferredTone}`);
      });
      lines.push('');
    }

    // Team
    if (people.team.length > 0) {
      lines.push('### Echipă');
      people.team.forEach((t) => {
        lines.push(`- ${t.name} (${t.caseRoleLabel})`);
      });
      lines.push('');
    }

    // Documents
    if (documents.items.length > 0) {
      lines.push('### Documente');
      documents.items.forEach((d) => {
        const scanTag = d.isScan ? ' [SCAN]' : '';
        lines.push(`- [${d.refId}] ${d.fileName}${scanTag}`);
        if (d.summary) lines.push(`  ${d.summary.slice(0, SUMMARY_TRUNCATE_LENGTH)}...`);
      });
      if (documents.hasMore)
        lines.push(`  ... și încă ${documents.totalCount - documents.items.length} documente`);
      lines.push('');
    }

    // Communications
    if (communications.threads.length > 0) {
      lines.push('### Comunicări');
      if (communications.overview) lines.push(communications.overview);
      lines.push('');
      communications.threads.slice(0, 5).forEach((t) => {
        const urgent = t.isUrgent ? ' [URGENT]' : '';
        lines.push(`- [${t.refId}] ${t.subject}${urgent}`);
        if (t.overview) lines.push(`  ${t.overview}`);
        if (t.actionItems && t.actionItems.length > 0) {
          lines.push(`  Acțiuni: ${t.actionItems.join(', ')}`);
        }
      });
      lines.push('');
    }

    // Pending Actions
    if (communications.pendingActions.length > 0) {
      lines.push('### Acțiuni în așteptare');
      communications.pendingActions.forEach((a) => {
        const due = a.dueDate
          ? ` (termen: ${new Date(a.dueDate).toLocaleDateString('ro-RO')})`
          : '';
        lines.push(`- ${a.description}${due}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // Section Building for UI Display
  // ==========================================================================

  /**
   * Build display sections for UI tabs.
   * Maps internal JSON sections to displayable ContextSection objects.
   * Also parses TERMENE/ATENȚIE from contentFull for the deadlines tab.
   */
  private buildDisplaySections(
    entityType: ContextEntityType,
    identity: IdentitySection,
    people: PeopleSection,
    documents: DocumentsSection,
    communications: CommunicationsSection,
    contentFull: string
  ): ContextDisplaySection[] {
    const sections: ContextDisplaySection[] = [];

    // 1. Profil (Identity)
    const identityContent = this.renderIdentitySectionMarkdown(entityType, identity);
    sections.push({
      id: 'identity',
      title: 'Profil',
      content: identityContent,
      tokenCount: countTokens(identityContent),
    });

    // 2. Persoane (People)
    const peopleContent = this.renderPeopleSectionMarkdown(entityType, people);
    sections.push({
      id: 'people',
      title: 'Persoane',
      content: peopleContent,
      tokenCount: countTokens(peopleContent),
    });

    // 3. Documente
    const docsContent = this.renderDocumentsSectionMarkdown(documents);
    sections.push({
      id: 'documents',
      title: 'Documente',
      content: docsContent,
      tokenCount: countTokens(docsContent),
    });

    // 4. Comunicare
    const commsContent = this.renderCommunicationsSectionMarkdown(communications);
    sections.push({
      id: 'communications',
      title: 'Comunicare',
      content: commsContent,
      tokenCount: countTokens(commsContent),
    });

    // 5. Termene (deadlines + warnings - parsed from contentFull)
    const termeneContent = this.parseTermeneSectionFromMarkdown(contentFull);
    sections.push({
      id: 'termene',
      title: 'Termene',
      content: termeneContent,
      tokenCount: countTokens(termeneContent),
    });

    return sections;
  }

  /**
   * Render identity section as markdown for display
   */
  private renderIdentitySectionMarkdown(
    entityType: ContextEntityType,
    identity: IdentitySection
  ): string {
    const lines: string[] = [];

    if (entityType === 'CLIENT') {
      const client = identity as ClientIdentitySection;
      lines.push(`**Nume:** ${client.name}`);
      lines.push(
        `**Tip:** ${client.type === 'company' ? client.companyType || 'Companie' : 'Persoană fizică'}`
      );
      if (client.cui) lines.push(`**CUI:** ${client.cui}`);
      if (client.registrationNumber)
        lines.push(`**Nr. Înregistrare:** ${client.registrationNumber}`);
      if (client.address) lines.push(`**Adresă:** ${client.address}`);
      if (client.phone) lines.push(`**Telefon:** ${client.phone}`);
      if (client.email) lines.push(`**Email:** ${client.email}`);
    } else {
      const caseIdentity = identity as CaseIdentitySection;
      lines.push(`**Titlu:** ${caseIdentity.title}`);
      lines.push(`**Nr. Dosar:** ${caseIdentity.caseNumber}`);
      lines.push(`**Tip:** ${caseIdentity.typeLabel}`);
      lines.push(`**Status:** ${caseIdentity.statusLabel}`);
      if (caseIdentity.court) lines.push(`**Instanță:** ${caseIdentity.court}`);
      if (caseIdentity.phase) lines.push(`**Fază:** ${caseIdentity.phaseLabel}`);
      if (caseIdentity.value)
        lines.push(`**Valoare:** ${caseIdentity.value.toLocaleString('ro-RO')} RON`);
      lines.push(`**Deschis:** ${new Date(caseIdentity.openedDate).toLocaleDateString('ro-RO')}`);
      if (caseIdentity.closedDate) {
        lines.push(`**Închis:** ${new Date(caseIdentity.closedDate).toLocaleDateString('ro-RO')}`);
      }
      if (caseIdentity.summary) {
        lines.push('');
        lines.push(`**Rezumat:** ${caseIdentity.summary}`);
      }
      if (caseIdentity.keywords && caseIdentity.keywords.length > 0) {
        lines.push(`**Cuvinte cheie:** ${caseIdentity.keywords.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render people section as markdown for display
   */
  private renderPeopleSectionMarkdown(
    entityType: ContextEntityType,
    people: PeopleSection
  ): string {
    const lines: string[] = [];

    if (entityType === 'CLIENT') {
      const clientPeople = people as ClientPeopleSection;

      if (clientPeople.administrators.length > 0) {
        lines.push('### Administratori');
        clientPeople.administrators.forEach((a) => {
          lines.push(
            `- **${a.name}** (${a.roleLabel || a.role})${a.email ? ` - ${a.email}` : ''}${a.phone ? ` - ${a.phone}` : ''}`
          );
        });
        lines.push('');
      }

      if (clientPeople.contacts.length > 0) {
        lines.push('### Contacte');
        clientPeople.contacts.forEach((c) => {
          const primary = c.isPrimary ? ' [Principal]' : '';
          lines.push(
            `- **${c.name}** (${c.roleLabel || c.role})${primary}${c.email ? ` - ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}`
          );
        });
        lines.push('');
      }

      if (clientPeople.administrators.length === 0 && clientPeople.contacts.length === 0) {
        lines.push('Nu există date despre persoane.');
      }
    } else {
      const casePeople = people as CasePeopleSection;

      if (casePeople.actors.length > 0) {
        lines.push('### Părți');
        casePeople.actors.forEach((a) => {
          const org = a.organization ? ` (${a.organization})` : '';
          const client = a.isClient ? ' [CLIENT]' : '';
          lines.push(`- **${a.roleLabel}:** ${a.name}${org}${client}`);
          if (a.email) lines.push(`  Email: ${a.email}`);
          if (a.phone) lines.push(`  Telefon: ${a.phone}`);
          if (a.communicationNotes) lines.push(`  Note comunicare: ${a.communicationNotes}`);
          if (a.preferredTone) lines.push(`  Ton preferat: ${a.preferredTone}`);
        });
        lines.push('');
      }

      if (casePeople.team.length > 0) {
        lines.push('### Echipă');
        casePeople.team.forEach((t) => {
          lines.push(`- **${t.name}** (${t.caseRoleLabel})`);
        });
        lines.push('');
      }

      if (casePeople.actors.length === 0 && casePeople.team.length === 0) {
        lines.push('Nu există date despre persoane.');
      }
    }

    return lines.join('\n').trim();
  }

  /**
   * Render documents section as markdown for display
   */
  private renderDocumentsSectionMarkdown(documents: DocumentsSection): string {
    if (documents.items.length === 0) {
      return 'Nu există documente.';
    }

    const lines: string[] = [];
    documents.items.forEach((d) => {
      const scanTag = d.isScan ? ' [SCAN]' : '';
      const type = d.documentType ? ` (${d.documentType})` : '';
      lines.push(`- **${d.fileName}**${type}${scanTag}`);
      if (d.summary) lines.push(`  ${d.summary}`);
    });

    if (documents.hasMore) {
      lines.push('');
      lines.push(`_...și încă ${documents.totalCount - documents.items.length} documente_`);
    }

    return lines.join('\n');
  }

  /**
   * Render communications section as markdown for display
   */
  private renderCommunicationsSectionMarkdown(communications: CommunicationsSection): string {
    const lines: string[] = [];

    // Overview
    if (communications.overview) {
      lines.push(communications.overview);
      lines.push('');
    }

    // Stats
    if (communications.unreadCount > 0 || communications.urgentCount > 0) {
      const stats: string[] = [];
      if (communications.unreadCount > 0) stats.push(`${communications.unreadCount} necitite`);
      if (communications.urgentCount > 0) stats.push(`${communications.urgentCount} urgente`);
      lines.push(`**Status:** ${stats.join(', ')}`);
      lines.push('');
    }

    // Threads
    if (communications.threads.length > 0) {
      lines.push('### Thread-uri recente');
      communications.threads.slice(0, 5).forEach((t) => {
        const urgent = t.isUrgent ? ' [URGENT]' : '';
        const unread = t.hasUnread ? ' [NOU]' : '';
        lines.push(`- **${t.subject}**${urgent}${unread} (${t.messageCount} mesaje)`);
        if (t.overview) lines.push(`  ${t.overview}`);
        if (t.actionItems && t.actionItems.length > 0) {
          lines.push(`  Acțiuni: ${t.actionItems.join(', ')}`);
        }
      });
      lines.push('');
    }

    // Pending actions
    if (communications.pendingActions.length > 0) {
      lines.push('### Acțiuni în așteptare');
      communications.pendingActions.forEach((a) => {
        const due = a.dueDate
          ? ` (termen: ${new Date(a.dueDate).toLocaleDateString('ro-RO')})`
          : '';
        lines.push(`- ${a.description}${due}`);
      });
      lines.push('');
    }

    if (lines.length === 0) {
      return 'Nu există comunicări.';
    }

    return lines.join('\n').trim();
  }

  /**
   * Parse TERMENE and ATENȚIE sections from full markdown content.
   * These contain deadlines, warnings, and actionable items.
   */
  private parseTermeneSectionFromMarkdown(contentFull: string): string {
    const lines: string[] = [];

    // Look for TERMENE section
    const termeneMatch = contentFull.match(/##\s*TERMENE\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
    if (termeneMatch) {
      lines.push('### Termene');
      lines.push(termeneMatch[1].trim());
      lines.push('');
    }

    // Look for ATENȚIE/ATENTIE section (warnings)
    const atentieMatch = contentFull.match(/##\s*ATEN[ȚT]IE\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
    if (atentieMatch) {
      lines.push('### Atenționări');
      lines.push(atentieMatch[1].trim());
      lines.push('');
    }

    // If no explicit sections found, show empty state
    if (lines.length === 0) {
      return 'Nu există termene sau atenționări active.';
    }

    return lines.join('\n').trim();
  }

  // ==========================================================================
  // Corrections Application
  // ==========================================================================

  /**
   * Apply user corrections to section data before rendering markdown.
   * Supports: override, append, remove, and note correction types.
   */
  private applyCorrections<
    I extends ClientIdentitySection | CaseIdentitySection,
    P extends ClientPeopleSection | CasePeopleSection,
  >(
    identity: I,
    people: P,
    documents: DocumentsSection,
    communications: CommunicationsSection,
    corrections: UserCorrection[]
  ): {
    identity: I;
    people: P;
    documents: DocumentsSection;
    communications: CommunicationsSection;
  } {
    // Deep clone to avoid mutations
    const appliedIdentity = structuredClone(identity);
    const appliedPeople = structuredClone(people);
    const appliedDocuments = structuredClone(documents);
    const appliedCommunications = structuredClone(communications);

    // Only process active corrections
    const activeCorrections = corrections.filter((c) => c.isActive);

    for (const correction of activeCorrections) {
      try {
        switch (correction.sectionId) {
          case 'identity':
            this.applyCorrectionToIdentity(appliedIdentity, correction);
            break;
          case 'people':
            this.applyCorrectionToPeople(appliedPeople, correction);
            break;
          case 'documents':
            this.applyCorrectionToDocuments(appliedDocuments, correction);
            break;
          case 'communications':
            this.applyCorrectionToCommunications(appliedCommunications, correction);
            break;
          default:
            logger.warn('[UnifiedContext] Unknown correction sectionId', {
              correctionId: correction.id,
              sectionId: correction.sectionId,
            });
        }
      } catch (error) {
        logger.error('[UnifiedContext] Failed to apply correction', {
          correctionId: correction.id,
          sectionId: correction.sectionId,
          fieldPath: correction.fieldPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      identity: appliedIdentity,
      people: appliedPeople,
      documents: appliedDocuments,
      communications: appliedCommunications,
    };
  }

  /**
   * Apply correction to identity section fields
   */
  private applyCorrectionToIdentity(
    identity: ClientIdentitySection | CaseIdentitySection,
    correction: UserCorrection
  ): void {
    if (!correction.fieldPath) return;

    const record = identity as unknown as Record<string, unknown>;
    const field = correction.fieldPath;

    switch (correction.correctionType) {
      case 'override':
        if (field in record) {
          record[field] = correction.correctedValue;
        }
        break;
      case 'note':
        // Notes are appended as a special field for AI context
        if (!record._notes) record._notes = [];
        (record._notes as string[]).push(`[${field}] ${correction.correctedValue}`);
        break;
      // 'append' and 'remove' don't make sense for simple identity fields
    }
  }

  /**
   * Apply correction to people section (arrays of contacts, administrators, actors, team)
   */
  private applyCorrectionToPeople(
    people: ClientPeopleSection | CasePeopleSection,
    correction: UserCorrection
  ): void {
    if (!correction.fieldPath) return;

    // Parse fieldPath like "contacts[0]", "contacts[id-123]", "administrators[0].email"
    const match = correction.fieldPath.match(/^(\w+)(?:\[([^\]]+)\])?(?:\.(\w+))?$/);
    if (!match) return;

    const [, arrayName, indexOrId, subField] = match;
    const record = people as unknown as Record<string, unknown>;
    const array = record[arrayName];

    if (!Array.isArray(array)) return;

    // Find the target item
    let targetIndex = -1;
    if (indexOrId !== undefined) {
      // Try as numeric index first
      const numIndex = parseInt(indexOrId, 10);
      if (!isNaN(numIndex) && numIndex >= 0 && numIndex < array.length) {
        targetIndex = numIndex;
      } else {
        // Try as ID
        targetIndex = array.findIndex((item: Record<string, unknown>) => item.id === indexOrId);
      }
    }

    switch (correction.correctionType) {
      case 'override':
        if (targetIndex >= 0 && subField) {
          // Override a specific field on an item
          (array[targetIndex] as Record<string, unknown>)[subField] = correction.correctedValue;
        } else if (targetIndex >= 0) {
          // Replace entire item with parsed JSON or use as name
          try {
            array[targetIndex] = JSON.parse(correction.correctedValue);
          } catch {
            (array[targetIndex] as Record<string, unknown>).name = correction.correctedValue;
          }
        }
        break;
      case 'append':
        // Add a new item to the array
        try {
          const newItem = JSON.parse(correction.correctedValue);
          array.push(newItem);
        } catch {
          // If not valid JSON, create a minimal person entry
          array.push({ name: correction.correctedValue, role: 'Contact' });
        }
        break;
      case 'remove':
        if (targetIndex >= 0) {
          array.splice(targetIndex, 1);
        }
        break;
      case 'note':
        if (targetIndex >= 0) {
          const item = array[targetIndex] as Record<string, unknown>;
          if (!item._notes) item._notes = [];
          (item._notes as string[]).push(correction.correctedValue);
        }
        break;
    }
  }

  /**
   * Apply correction to documents section
   */
  private applyCorrectionToDocuments(
    documents: DocumentsSection,
    correction: UserCorrection
  ): void {
    if (!correction.fieldPath) return;

    // Parse fieldPath like "items[DOC-abc12]", "items[0].summary"
    const match = correction.fieldPath.match(/^items\[([^\]]+)\](?:\.(\w+))?$/);
    if (!match) return;

    const [, indexOrRefId, subField] = match;
    const items = documents.items;

    // Find the target item
    let targetIndex = -1;
    const numIndex = parseInt(indexOrRefId, 10);
    if (!isNaN(numIndex) && numIndex >= 0 && numIndex < items.length) {
      targetIndex = numIndex;
    } else {
      // Try as refId
      targetIndex = items.findIndex((item) => item.refId === indexOrRefId);
    }

    switch (correction.correctionType) {
      case 'override':
        if (targetIndex >= 0 && subField) {
          (items[targetIndex] as unknown as Record<string, unknown>)[subField] =
            correction.correctedValue;
        }
        break;
      case 'remove':
        if (targetIndex >= 0) {
          items.splice(targetIndex, 1);
          documents.totalCount = Math.max(0, documents.totalCount - 1);
        }
        break;
      case 'note':
        if (targetIndex >= 0) {
          // Add note to summary
          const item = items[targetIndex];
          item.summary = item.summary
            ? `${item.summary}\n[Note: ${correction.correctedValue}]`
            : `[Note: ${correction.correctedValue}]`;
        }
        break;
    }
  }

  /**
   * Apply correction to communications section
   */
  private applyCorrectionToCommunications(
    communications: CommunicationsSection,
    correction: UserCorrection
  ): void {
    if (!correction.fieldPath) return;

    // Handle "overview" field
    if (correction.fieldPath === 'overview') {
      if (correction.correctionType === 'override') {
        communications.overview = correction.correctedValue;
      } else if (correction.correctionType === 'note') {
        communications.overview += `\n[Note: ${correction.correctedValue}]`;
      }
      return;
    }

    // Handle "threads[THR-xyz]" or "emails[EMAIL-abc]"
    const threadMatch = correction.fieldPath.match(/^threads\[([^\]]+)\](?:\.(\w+))?$/);
    const emailMatch = correction.fieldPath.match(/^emails\[([^\]]+)\](?:\.(\w+))?$/);

    if (threadMatch) {
      const [, indexOrRefId, subField] = threadMatch;
      this.applyCorrectionToArray(communications.threads, indexOrRefId, subField, correction);
    } else if (emailMatch) {
      const [, indexOrRefId, subField] = emailMatch;
      this.applyCorrectionToArray(communications.emails, indexOrRefId, subField, correction);
    }
  }

  /**
   * Helper to apply correction to an array (threads or emails)
   */
  private applyCorrectionToArray<T extends { refId: string }>(
    array: T[],
    indexOrRefId: string,
    subField: string | undefined,
    correction: UserCorrection
  ): void {
    let targetIndex = -1;
    const numIndex = parseInt(indexOrRefId, 10);
    if (!isNaN(numIndex) && numIndex >= 0 && numIndex < array.length) {
      targetIndex = numIndex;
    } else {
      targetIndex = array.findIndex((item) => item.refId === indexOrRefId);
    }

    switch (correction.correctionType) {
      case 'override':
        if (targetIndex >= 0 && subField) {
          (array[targetIndex] as unknown as Record<string, unknown>)[subField] =
            correction.correctedValue;
        }
        break;
      case 'remove':
        if (targetIndex >= 0) {
          array.splice(targetIndex, 1);
        }
        break;
      case 'note':
        if (targetIndex >= 0) {
          const item = array[targetIndex] as unknown as Record<string, unknown>;
          if (!item._notes) item._notes = [];
          (item._notes as string[]).push(correction.correctedValue);
        }
        break;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private parseJsonArray(value: unknown, context?: string): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          logger.warn('[UnifiedContext] parseJsonArray: parsed value is not an array', {
            context,
            valueType: typeof parsed,
          });
          return [];
        }
        return parsed;
      } catch (error) {
        logger.error('[UnifiedContext] parseJsonArray: JSON parse failed', {
          context,
          error: error instanceof Error ? error.message : String(error),
          valuePreview: typeof value === 'string' ? value.slice(0, 100) : undefined,
        });
        return [];
      }
    }
    return [];
  }

  private parseStringArray(value: unknown, context?: string): string[] {
    const arr = this.parseJsonArray(value, context);
    return arr.filter((item): item is string => typeof item === 'string');
  }

  private generateCommunicationsOverview(threads: ThreadRef[]): string {
    if (threads.length === 0) return 'Nu există comunicări recente.';

    const urgent = threads.filter((t) => t.isUrgent).length;
    const total = threads.length;

    let overview = `${total} conversații active.`;
    if (urgent > 0) overview += ` ${urgent} necesită atenție urgentă.`;

    return overview;
  }

  /**
   * Build important emails for context
   * Fetches recent/important emails that provide additional context
   */
  private async buildImportantEmails(
    firmId: string,
    caseId: string | undefined,
    excludeConversationIds: string[]
  ): Promise<EmailRef[]> {
    // Get important emails (high importance flag or recent)
    const emails = await prisma.email.findMany({
      where: {
        firmId,
        caseId: caseId ?? null,
        // Exclude emails that are part of threads we already have
        conversationId:
          excludeConversationIds.length > 0 ? { notIn: excludeConversationIds } : undefined,
      },
      orderBy: [{ importance: 'desc' }, { receivedDateTime: 'desc' }],
      take: MAX_EMAILS,
      select: {
        id: true,
        subject: true,
        from: true,
        receivedDateTime: true,
        bodyPreview: true,
        hasAttachments: true,
        importance: true,
      },
    });

    if (emails.length > 0 && emails.length >= MAX_EMAILS) {
      logger.debug('[UnifiedContext] Emails truncated', {
        caseId,
        fetched: emails.length,
        max: MAX_EMAILS,
      });
    }

    return emails.map((e) => {
      // Parse 'from' field safely
      const fromObj = e.from as { emailAddress?: { name?: string; address?: string } } | null;
      const fromStr = fromObj?.emailAddress?.address || fromObj?.emailAddress?.name || 'Unknown';

      return {
        refId: generateRefId('EMAIL', e.id),
        sourceId: e.id,
        subject: e.subject || '(No subject)',
        from: fromStr,
        receivedAt: e.receivedDateTime.toISOString(),
        bodyPreview: e.bodyPreview ?? undefined,
        hasAttachments: e.hasAttachments ?? false,
        isImportant: e.importance === 'high',
      };
    });
  }

  /**
   * Fetch thread subjects from emails in a single query
   */
  private async getThreadSubjects(conversationIds: string[]): Promise<Map<string, string>> {
    if (conversationIds.length === 0) return new Map();

    // Get the first email's subject for each conversation
    const emails = await prisma.email.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { receivedDateTime: 'asc' },
      distinct: ['conversationId'],
      select: { conversationId: true, subject: true },
    });

    const subjectMap = new Map<string, string>();
    for (const email of emails) {
      if (email.subject) {
        subjectMap.set(email.conversationId, email.subject);
      }
    }
    return subjectMap;
  }

  /**
   * Map task type to pending action type
   */
  private mapTaskTypeToActionType(
    taskType: string | null
  ): 'reply' | 'review' | 'sign' | 'submit' | 'other' {
    if (!taskType) return 'other';

    const typeMap: Record<string, 'reply' | 'review' | 'sign' | 'submit' | 'other'> = {
      // Reply-related
      email_reply: 'reply',
      respond: 'reply',
      reply: 'reply',
      // Review-related
      review: 'review',
      document_review: 'review',
      contract_review: 'review',
      analyze: 'review',
      // Sign-related
      sign: 'sign',
      signature: 'sign',
      sign_document: 'sign',
      // Submit-related
      submit: 'submit',
      file: 'submit',
      filing: 'submit',
      submission: 'submit',
      deadline: 'submit',
    };

    const lowerType = taskType.toLowerCase();
    return typeMap[lowerType] || 'other';
  }

  private async compressContext(
    content: string,
    targetTokens: number,
    firmId: string
  ): Promise<string> {
    // Timeout for AI compression (30 seconds)
    const COMPRESSION_TIMEOUT_MS = 30000;

    if (content.length / 4 <= targetTokens * 1.2) {
      return content; // Already small enough
    }

    try {
      const model = await getModelForFeature(firmId, 'context_compression');

      // Create compression promise
      const compressionPromise = aiClient.chat(
        [
          {
            role: 'user',
            content: `Comprimă următorul context legal la aproximativ ${targetTokens} de tokeni, păstrând informațiile esențiale:\n\n${content}`,
          },
        ],
        {
          firmId,
          feature: 'context_compression',
          entityType: 'firm',
          entityId: firmId,
        },
        {
          model: model || 'claude-haiku-4-5-20251001',
          maxTokens: targetTokens * 5,
        }
      );

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Compression timeout')), COMPRESSION_TIMEOUT_MS)
      );

      // Race compression against timeout
      const response = await Promise.race([compressionPromise, timeoutPromise]);

      // Extract text content from response blocks
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      // Use smart truncation with 20% buffer if AI returns empty content
      return textContent || this.smartTruncate(content, Math.ceil(targetTokens * 4 * 1.2));
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Compression timeout';
      logger.warn('[UnifiedContext] Compression failed, using smart truncation', {
        error: error instanceof Error ? error.message : String(error),
        targetTokens,
        isTimeout,
      });
      // Use smart truncation with token-aware validation
      const truncated = this.smartTruncate(content, Math.ceil(targetTokens * 4 * 1.2));

      // Validate actual token count and re-truncate if needed
      const actualTokens = countTokens(truncated);
      if (actualTokens > targetTokens * 1.3) {
        // Over budget by >30%, apply stricter truncation
        logger.warn(
          '[UnifiedContext] Fallback exceeded token budget, applying stricter truncation',
          {
            actualTokens,
            targetTokens,
          }
        );
        return this.smartTruncate(truncated, Math.ceil(targetTokens * 3)); // Tighter char estimate
      }
      return truncated;
    }
  }

  /**
   * Smart truncation that preserves markdown structure
   * Truncates at paragraph/line boundaries rather than mid-word
   */
  private smartTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // Try to truncate at the last complete paragraph before maxChars
    const truncated = content.slice(0, maxChars);

    // Find the last double newline (paragraph break) within the truncated content
    const lastParagraphBreak = truncated.lastIndexOf('\n\n');
    if (lastParagraphBreak > maxChars * MIN_CONTENT_PRESERVATION_RATIO) {
      // Only use paragraph break if we preserve at least 70% of content
      return truncated.slice(0, lastParagraphBreak) + '\n\n[...]';
    }

    // Otherwise, find the last single newline (line break)
    const lastLineBreak = truncated.lastIndexOf('\n');
    if (lastLineBreak > maxChars * 0.8) {
      // Only use line break if we preserve at least 80% of content
      return truncated.slice(0, lastLineBreak) + '\n[...]';
    }

    // Finally, find the last word boundary (space)
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.9) {
      return truncated.slice(0, lastSpace) + ' [...]';
    }

    // Worst case: just truncate at maxChars
    return truncated + '[...]';
  }

  private async generateReferences(
    contextFileId: string,
    documents: DocumentsSection,
    communications: CommunicationsSection
  ): Promise<void> {
    const refs: Prisma.ContextReferenceCreateManyInput[] = [];

    // Document references
    documents.items.forEach((d) => {
      refs.push({
        id: randomUUID(),
        contextFileId,
        refId: d.refId,
        refType: 'DOCUMENT',
        sourceId: d.sourceId,
        sourceType: 'Document',
        title: d.fileName,
        summary: d.summary ?? null,
        sourceDate: new Date(d.uploadedAt),
        metadata: toJsonValue({ documentType: d.documentType, isScan: d.isScan }),
      });
    });

    // Thread references
    communications.threads.forEach((t) => {
      refs.push({
        id: randomUUID(),
        contextFileId,
        refId: t.refId,
        refType: 'THREAD',
        sourceId: t.sourceId, // Actual ThreadSummary ID for resolution
        sourceType: 'ThreadSummary',
        title: t.subject,
        summary: t.overview ?? null,
        sourceDate: new Date(t.lastMessageDate),
        metadata: toJsonValue({
          conversationId: t.conversationId,
          participants: t.participants,
          messageCount: t.messageCount,
        }),
      });
    });

    // Email references
    communications.emails.forEach((e) => {
      refs.push({
        id: randomUUID(),
        contextFileId,
        refId: e.refId,
        refType: 'EMAIL',
        sourceId: e.sourceId,
        sourceType: 'Email',
        title: e.subject,
        summary: e.bodyPreview ?? null,
        sourceDate: new Date(e.receivedAt),
        metadata: toJsonValue({
          from: e.from,
          hasAttachments: e.hasAttachments,
          isImportant: e.isImportant,
        }),
      });
    });

    // Use transaction to ensure atomicity - delete old refs and create new ones together
    if (refs.length > 0) {
      await prisma.$transaction([
        prisma.contextReference.deleteMany({ where: { contextFileId } }),
        prisma.contextReference.createMany({ data: refs }),
      ]);
    } else {
      // No new refs, just delete old ones
      await prisma.contextReference.deleteMany({ where: { contextFileId } });
    }
  }

  /**
   * Set a value in Redis cache with TTL and logging on failure
   */
  private async setCache(key: string, value: string, ttl: number): Promise<void> {
    try {
      await redis.setex(key, ttl, value);
    } catch (error) {
      logger.warn('[UnifiedContext] Cache write failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Delete a key from Redis cache with logging on failure
   */
  private async deleteCache(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn('[UnifiedContext] Cache delete failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async invalidateCache(entityType: ContextEntityType, entityId: string): Promise<void> {
    const keys = [
      getCacheKey(entityType, entityId, 'critical'),
      getCacheKey(entityType, entityId, 'standard'),
      getCacheKey(entityType, entityId, 'full'),
    ];

    for (const key of keys) {
      await this.deleteCache(key);
    }
  }

  private async getThreadContext(conversationId: string): Promise<string | undefined> {
    const emails = await prisma.email.findMany({
      where: { conversationId },
      orderBy: { receivedDateTime: 'asc' },
      select: { from: true, subject: true, bodyPreview: true, receivedDateTime: true },
    });

    if (emails.length === 0) return undefined;

    return emails
      .map((e) => {
        // Parse 'from' JSON field safely
        const fromObj = e.from as { emailAddress?: { name?: string; address?: string } } | null;
        const fromStr = fromObj?.emailAddress?.address || fromObj?.emailAddress?.name || 'Unknown';
        return `[${new Date(e.receivedDateTime).toLocaleDateString('ro-RO')}] ${fromStr}: ${e.bodyPreview || ''}`;
      })
      .join('\n\n');
  }

  private async getActorContext(caseId: string, actorId: string): Promise<string | undefined> {
    const actor = await prisma.caseActor.findUnique({ where: { id: actorId } });
    if (!actor) return undefined;

    const lines = [`**${actor.name}** (${actor.role})`];
    if (actor.organization) lines.push(`Organizație: ${actor.organization}`);
    if (actor.communicationNotes) lines.push(`Note comunicare: ${actor.communicationNotes}`);
    if (actor.preferredTone) lines.push(`Ton preferat: ${actor.preferredTone}`);

    return lines.join('\n');
  }
}

// Export singleton
export const unifiedContextService = new UnifiedContextService();
