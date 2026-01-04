/**
 * Case Chapters GraphQL Resolvers
 * Case Timeline / History API
 *
 * Implements resolvers for case chapters and events including:
 * - Chapter queries with events
 * - Full-text search across timeline events
 * - Document template copying between cases
 *
 * Access Control:
 * - Partner/Associate: All cases in their firm
 * - AssociateJr: Only assigned cases
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { wordIntegrationService } from '../../services/word-integration.service';
import { r2StorageService } from '../../services/r2-storage.service';
import { sharePointService } from '../../services/sharepoint.service';
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
    accessToken?: string;
  };
}

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * Require authentication
 */
function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

/**
 * Check if user can access a case
 * - Partners and Associates can access all cases in their firm
 * - AssociateJr (Jr Associates) can only access cases they are assigned to
 */
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  // CRITICAL: First verify the case belongs to the user's firm (multi-tenancy isolation)
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  // Case must exist AND belong to user's firm
  if (!caseData || caseData.firmId !== user.firmId) return false;

  // Partners, Associates, and BusinessOwners can access all cases in their firm
  if (user.role === 'Partner' || user.role === 'Associate' || user.role === 'BusinessOwner') {
    return true;
  }

  // AssociateJr and Paralegal must be assigned to the case
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

/**
 * Get case ID from chapter ID
 */
async function getCaseIdFromChapter(chapterId: string): Promise<string | null> {
  const chapter = await prisma.caseChapter.findUnique({
    where: { id: chapterId },
    select: { caseId: true },
  });
  return chapter?.caseId || null;
}

/**
 * Check if user can access a document
 */
async function canAccessDocument(documentId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { firmId: true },
  });

  if (!document || document.firmId !== user.firmId) return false;

  // Get cases linked to this document
  const caseLinks = await prisma.caseDocument.findMany({
    where: { documentId },
    select: { caseId: true },
  });

  // User needs access to at least one of the linked cases
  for (const link of caseLinks) {
    if (await canAccessCase(link.caseId, user)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const caseChaptersQueryResolvers = {
  /**
   * Get chapters for a case ordered by sortOrder
   */
  caseChapters: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const user = requireAuth(context);

    if (!(await canAccessCase(caseId, user))) {
      throw new GraphQLError('Not authorized to access this case', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const chapters = await prisma.caseChapter.findMany({
      where: { caseId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    return chapters.map((chapter) => ({
      ...chapter,
      eventCount: chapter._count.events,
    }));
  },

  /**
   * Get events for a chapter with pagination
   */
  caseChapterEvents: async (
    _: unknown,
    { chapterId, limit = 50, offset = 0 }: { chapterId: string; limit?: number; offset?: number },
    context: Context
  ) => {
    const user = requireAuth(context);

    // Verify user can access the parent case
    const caseId = await getCaseIdFromChapter(chapterId);
    if (!caseId) {
      throw new GraphQLError('Chapter not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (!(await canAccessCase(caseId, user))) {
      throw new GraphQLError('Not authorized to access this case', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const events = await prisma.caseChapterEvent.findMany({
      where: { chapterId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return events;
  },

  /**
   * Full-text search across case timeline events
   * Searches event title, summary, and linked document content
   */
  searchCaseHistory: async (
    _: unknown,
    { caseId, query }: { caseId: string; query: string },
    context: Context
  ) => {
    const user = requireAuth(context);

    if (!(await canAccessCase(caseId, user))) {
      throw new GraphQLError('Not authorized to access this case', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (query.length < 2) {
      throw new GraphQLError('Search query must be at least 2 characters', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Use PostgreSQL full-text search on event title and summary
    const searchResults = await prisma.$queryRaw<
      Array<{
        id: string;
        chapter_id: string;
        event_type: string;
        title: string;
        summary: string;
        occurred_at: Date;
        metadata: any;
        sort_order: number;
        created_at: Date;
        snippet: string;
        rank: number;
      }>
    >`
      SELECT
        e.id,
        e.chapter_id,
        e.event_type,
        e.title,
        e.summary,
        e.occurred_at,
        e.metadata,
        e.sort_order,
        e.created_at,
        ts_headline('romanian', e.title || ' ' || e.summary, plainto_tsquery('romanian', ${query}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
        ) as snippet,
        ts_rank(
          to_tsvector('romanian', e.title || ' ' || e.summary),
          plainto_tsquery('romanian', ${query})
        ) as rank
      FROM case_chapter_events e
      JOIN case_chapters c ON e.chapter_id = c.id
      WHERE c.case_id = ${caseId}::uuid
        AND (
          to_tsvector('romanian', e.title || ' ' || e.summary) @@ plainto_tsquery('romanian', ${query})
          OR e.title ILIKE '%' || ${query} || '%'
          OR e.summary ILIKE '%' || ${query} || '%'
        )
      ORDER BY rank DESC, e.occurred_at DESC
      LIMIT 50
    `;

    // Group results by chapter
    const chapterIds = [...new Set(searchResults.map((r) => r.chapter_id))];
    const chapters = await prisma.caseChapter.findMany({
      where: { id: { in: chapterIds } },
    });
    const chapterMap = new Map(chapters.map((c) => [c.id, c]));

    // Transform results
    const results = searchResults.map((result) => ({
      event: {
        id: result.id,
        chapterId: result.chapter_id,
        eventType: result.event_type,
        title: result.title,
        summary: result.summary,
        occurredAt: result.occurred_at,
        metadata: result.metadata,
        sortOrder: result.sort_order,
        createdAt: result.created_at,
      },
      chapter: chapterMap.get(result.chapter_id),
      snippet: result.snippet,
      rank: result.rank,
    }));

    return results;
  },

  /**
   * Quick check if case has any chapters
   */
  hasChapters: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const user = requireAuth(context);

    if (!(await canAccessCase(caseId, user))) {
      throw new GraphQLError('Not authorized to access this case', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const count = await prisma.caseChapter.count({
      where: { caseId },
    });

    return count > 0;
  },

  /**
   * Get raw activities for a case (fallback before AI chapter generation)
   * Returns emails, documents, and tasks sorted chronologically
   */
  caseRawActivities: async (
    _: unknown,
    { caseId, limit = 100, offset = 0 }: { caseId: string; limit?: number; offset?: number },
    context: Context
  ) => {
    const user = requireAuth(context);

    if (!(await canAccessCase(caseId, user))) {
      throw new GraphQLError('Not authorized to access this case', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Fetch emails linked to the case (via EmailCaseLink for multi-case support)
    const emailLinks = await prisma.emailCaseLink.findMany({
      where: { caseId },
      include: {
        email: {
          select: {
            id: true,
            subject: true,
            receivedDateTime: true,
            from: true, // JSON: { name?, address }
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });
    const emails = emailLinks.map((link) => link.email);

    // Fetch documents linked to the case
    // Include originalAttachment -> email to get the actual email received date for promoted attachments
    const caseDocuments = await prisma.caseDocument.findMany({
      where: { caseId },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            updatedAt: true,
            sharePointLastModified: true,
            fileType: true,
            // Get the email attachment this doc was promoted from (if any)
            emailAttachments: {
              select: {
                email: {
                  select: {
                    receivedDateTime: true,
                  },
                },
              },
              take: 1, // Only need one
            },
          },
        },
        // Also check the CaseDocument's originalAttachment link
        originalAttachment: {
          select: {
            email: {
              select: {
                receivedDateTime: true,
              },
            },
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    // Fetch tasks for the case
    const tasks = await prisma.task.findMany({
      where: { caseId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Combine and sort all activities by date
    type RawActivity = {
      id: string;
      type: 'Email' | 'Document' | 'Task';
      title: string;
      occurredAt: Date;
      metadata: {
        documentId?: string;
        emailId?: string;
        taskId?: string;
        context?: string;
      };
    };

    const activities: RawActivity[] = [
      ...emails.map((email) => {
        // Parse sender from JSON field
        const fromData = email.from as { name?: string; address?: string } | null;
        const senderContext = fromData?.name || fromData?.address || undefined;
        return {
          id: email.id,
          type: 'Email' as const,
          title: email.subject || '(Fără subiect)',
          occurredAt: email.receivedDateTime,
          metadata: {
            emailId: email.id,
            context: senderContext,
          },
        };
      }),
      ...caseDocuments.map((cd) => {
        // Priority for document date:
        // 1. Email received date from originalAttachment (CaseDocument was promoted from attachment)
        // 2. Email received date from document's emailAttachments relation
        // 3. SharePoint last modified (for non-email docs)
        // 4. DB updatedAt (final fallback)
        const emailDateFromCaseDoc = cd.originalAttachment?.email?.receivedDateTime;
        const emailDateFromDoc = cd.document.emailAttachments?.[0]?.email?.receivedDateTime;
        const occurredAt =
          emailDateFromCaseDoc ||
          emailDateFromDoc ||
          cd.document.sharePointLastModified ||
          cd.document.updatedAt;

        return {
          id: cd.document.id,
          type: 'Document' as const,
          title: cd.document.fileName,
          occurredAt,
          metadata: {
            documentId: cd.document.id,
            context: cd.document.fileType || undefined,
          },
        };
      }),
      ...tasks.map((task) => ({
        id: task.id,
        type: 'Task' as const,
        title: task.title,
        occurredAt: task.createdAt,
        metadata: {
          taskId: task.id,
          context: task.status,
        },
      })),
    ];

    // Sort by date descending (most recent first)
    activities.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    // Apply pagination
    return activities.slice(offset, offset + limit);
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const caseChaptersMutationResolvers = {
  /**
   * Copy a document as a template to another case
   * Creates a new document in the target case based on the source document
   */
  copyDocumentAsTemplate: async (
    _: unknown,
    { documentId, targetCaseId }: { documentId: string; targetCaseId: string },
    context: Context
  ) => {
    const user = requireAuth(context);
    const accessToken = user.accessToken;

    // Verify user can access the source document
    if (!(await canAccessDocument(documentId, user))) {
      throw new GraphQLError('Not authorized to access source document', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Verify user can access the target case
    if (!(await canAccessCase(targetCaseId, user))) {
      throw new GraphQLError('Not authorized to access target case', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Get source document with case information
    const sourceDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        caseLinks: {
          include: { case: { select: { caseNumber: true } } },
          take: 1,
        },
      },
    });

    if (!sourceDocument) {
      throw new GraphQLError('Source document not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Get target case info
    const targetCase = await prisma.case.findUnique({
      where: { id: targetCaseId },
      select: { caseNumber: true, clientId: true },
    });

    if (!targetCase) {
      throw new GraphQLError('Target case not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    try {
      // Download source document content from R2 storage
      let fileContent: Buffer;
      try {
        fileContent = await r2StorageService.downloadDocument(sourceDocument.storagePath);
      } catch (error) {
        logger.error('Failed to download source document from R2', {
          documentId,
          storagePath: sourceDocument.storagePath,
          error,
        });
        throw new GraphQLError('Failed to retrieve source document content', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Generate new file name with template indicator
      const timestamp = new Date().toISOString().split('T')[0];
      const templateFileName = `[Template] ${sourceDocument.fileName}`;

      // Create new storage path for copied document
      const newStoragePath = `/${user.firmId}/clients/${targetCase.clientId}/documents/${crypto.randomUUID()}-${templateFileName}`;

      // Upload to R2
      await r2StorageService.uploadDocument(newStoragePath, fileContent, sourceDocument.fileType);

      // Create new document record
      const newDocument = await prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            clientId: targetCase.clientId,
            firmId: user.firmId,
            fileName: templateFileName,
            fileType: sourceDocument.fileType,
            fileSize: sourceDocument.fileSize,
            storagePath: newStoragePath,
            uploadedBy: user.id,
            status: 'DRAFT',
            sourceType: 'UPLOAD',
            metadata: {
              copiedFrom: documentId,
              copiedAt: new Date().toISOString(),
              originalFileName: sourceDocument.fileName,
            },
          },
        });

        // Link to target case
        await tx.caseDocument.create({
          data: {
            caseId: targetCaseId,
            documentId: created.id,
            linkedBy: user.id,
            firmId: user.firmId,
            isOriginal: true,
          },
        });

        // Create audit log
        await tx.documentAuditLog.create({
          data: {
            documentId: created.id,
            userId: user.id,
            action: 'Uploaded',
            caseId: targetCaseId,
            details: {
              copiedFromDocumentId: documentId,
              sourceFileName: sourceDocument.fileName,
              action: 'template_copy',
            },
            firmId: user.firmId,
            timestamp: new Date(),
          },
        });

        return created;
      });

      // Generate Word URL if access token is available
      let wordUrl: string | null = null;
      let webUrl: string | null = null;

      if (accessToken) {
        try {
          // Upload to SharePoint for Word editing
          const spResult = await sharePointService.uploadDocument(
            accessToken,
            targetCase.caseNumber,
            templateFileName,
            fileContent,
            sourceDocument.fileType
          );

          // Update document with SharePoint info
          await prisma.document.update({
            where: { id: newDocument.id },
            data: {
              sharePointItemId: spResult.id,
              sharePointPath: spResult.parentPath + '/' + spResult.name,
              sharePointLastModified: new Date(spResult.lastModifiedDateTime),
            },
          });

          webUrl = spResult.webUrl;
          wordUrl = `ms-word:ofe|u|${spResult.webUrl}`;

          logger.info('Document copied and uploaded to SharePoint', {
            sourceDocumentId: documentId,
            newDocumentId: newDocument.id,
            targetCaseId,
            sharePointItemId: spResult.id,
          });
        } catch (spError) {
          // Log but don't fail - document is still created, just without Word URL
          logger.error('Failed to upload copied document to SharePoint', {
            newDocumentId: newDocument.id,
            error: spError,
          });
        }
      }

      return {
        documentId: newDocument.id,
        wordUrl,
        webUrl,
        success: true,
      };
    } catch (error) {
      logger.error('Failed to copy document as template', {
        sourceDocumentId: documentId,
        targetCaseId,
        error,
      });

      if (error instanceof GraphQLError) {
        throw error;
      }

      throw new GraphQLError('Failed to copy document', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

export const caseChapterEventFieldResolvers = {
  CaseChapterEvent: {
    /**
     * Parse metadata.documentIds and fetch document info
     */
    attachedDocuments: async (parent: { metadata: any }, _: unknown, context: Context) => {
      const metadata = parent.metadata as Record<string, any>;
      const documentIds = metadata?.documentIds as string[] | undefined;

      if (!documentIds || documentIds.length === 0) {
        return [];
      }

      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          firmId: context.user?.firmId,
        },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          uploadedAt: true,
          status: true,
          thumbnailSmallUrl: true,
        },
      });

      return documents;
    },

    /**
     * Parse metadata.emailIds and fetch email info
     */
    attachedEmails: async (parent: { metadata: any }, _: unknown, context: Context) => {
      const metadata = parent.metadata as Record<string, any>;
      const emailIds = metadata?.emailIds as string[] | undefined;

      if (!emailIds || emailIds.length === 0) {
        return [];
      }

      const emails = await prisma.email.findMany({
        where: {
          id: { in: emailIds },
          firmId: context.user?.firmId,
        },
        select: {
          id: true,
          subject: true,
          from: true,
          receivedDateTime: true,
          bodyPreview: true,
        },
      });

      return emails;
    },
  },
};

export const caseChapterFieldResolvers = {
  CaseChapter: {
    /**
     * Return events for the chapter
     */
    events: async (parent: { id: string }) => {
      const events = await prisma.caseChapterEvent.findMany({
        where: { chapterId: parent.id },
        orderBy: { occurredAt: 'desc' },
      });
      return events;
    },

    /**
     * Count of events in chapter
     */
    eventCount: async (parent: { id: string }) => {
      const count = await prisma.caseChapterEvent.count({
        where: { chapterId: parent.id },
      });
      return count;
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const caseChaptersResolvers = {
  Query: caseChaptersQueryResolvers,
  Mutation: caseChaptersMutationResolvers,
  ...caseChapterEventFieldResolvers,
  ...caseChapterFieldResolvers,
};

export default caseChaptersResolvers;
