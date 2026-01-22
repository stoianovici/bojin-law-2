/**
 * Document Management GraphQL Resolvers
 * Story 2.8.4: Cross-Case Document Linking
 * Story 2.9: Document Storage with OneDrive Integration
 * Story 2.11.1: Business Owner Role
 *
 * Implements all queries, mutations, and field resolvers for document management
 * with cross-case linking support and OneDrive integration
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { oneDriveService } from '../../services/onedrive.service';
import { sharePointService, SharePointItem } from '../../services/sharepoint.service';
import { r2StorageService } from '../../services/r2-storage.service';
import { thumbnailService } from '../../services/thumbnail.service';
import { caseSummaryService } from '../../services/case-summary.service';
import { activityEventService } from '../../services/activity-event.service';
import { wordIntegrationService } from '../../services/word-integration.service';
import { firmTemplateService } from '../../services/firm-template.service';
import { queueThumbnailJob } from '../../workers/thumbnail-generation.worker';
import { queueContentExtractionJob } from '../../workers/content-extraction.worker';
import { isSupportedFormat } from '../../services/content-extraction.service';
import { createSourceCaseDataLoader } from '../dataloaders/document.dataloaders';
import { caseNotificationService } from '../../services/case-notification.service';
import { activityEmitter } from '../../services/activity-emitter.service';
import logger from '../../utils/logger';
import { requireAuth } from '../utils/auth';
import { isFullAccessRole, getAccessibleClientIds } from '../utils/access-control';

// Extended Context type that includes accessToken for OneDrive operations
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner' | 'Admin';
    email: string;
    accessToken?: string; // Story 5.1: MS access token for email/OneDrive operations
  };
  accessToken?: string; // Deprecated: use context.user.accessToken instead
}

// Helper to check if user can access a case
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  if (!caseData || caseData.firmId !== user.firmId) return false;

  // Full-access roles (Partner, Associate, BusinessOwner) can access all cases in their firm
  if (isFullAccessRole(user.role)) return true;

  // Assignment-based roles (AssociateJr, Paralegal) must be assigned to the case
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

// Helper to check if user has access to a client's documents
async function canAccessClientDocuments(clientId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  // Verify client belongs to user's firm
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firmId: true },
  });

  if (!client || client.firmId !== user.firmId) return false;

  // Full-access roles (Partner, Associate, BusinessOwner) can access all client documents
  if (isFullAccessRole(user.role)) return true;

  // Assignment-based roles: check direct client assignment
  const clientAssignment = await prisma.clientTeam.findUnique({
    where: {
      clientId_userId: { clientId, userId: user.id },
    },
  });

  if (clientAssignment) return true;

  // Also check implicit access via case assignment
  const caseAssignment = await prisma.caseTeam.findFirst({
    where: {
      userId: user.id,
      case: { clientId },
    },
  });

  return !!caseAssignment;
}

// Helper to check if user can access a document
async function canAccessDocument(documentId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { clientId: true, firmId: true },
  });

  if (!document || document.firmId !== user.firmId) return false;

  return canAccessClientDocuments(document.clientId, user);
}

/**
 * Build a Prisma where clause for document privacy filtering based on user role.
 *
 * Full-access roles (Partner, Associate, BusinessOwner):
 * - Sees own private documents
 * - Sees all public documents from any user
 *
 * Assignment-based roles (AssociateJr, Paralegal):
 * - Sees own private documents
 * - Sees public documents only (case/client access enforced elsewhere)
 *
 * @param userId - The current user's ID
 * @param userRole - The current user's role
 * @returns Prisma where clause for document privacy
 */
function buildDocumentPrivacyFilter(userId: string, userRole: string): object {
  // Full-access roles see their own documents (private or public)
  // plus all public documents from others
  if (isFullAccessRole(userRole)) {
    return {
      OR: [
        { uploadedBy: userId }, // Own documents (private or public)
        { isPrivate: false }, // Public documents from others
      ],
    };
  }

  // Assignment-based roles see all public documents (case/client access enforced elsewhere)
  return {
    isPrivate: false,
  };
}

// Helper to create document audit log
async function createDocumentAuditLog(
  tx: any,
  data: {
    documentId?: string | null;
    userId: string;
    action:
      | 'Uploaded'
      | 'LinkedToCase'
      | 'UnlinkedFromCase'
      | 'PermanentlyDeleted'
      | 'MetadataUpdated';
    caseId?: string | null;
    details: Record<string, unknown>;
    firmId: string;
  }
) {
  await tx.documentAuditLog.create({
    data: {
      documentId: data.documentId,
      userId: data.userId,
      action: data.action,
      caseId: data.caseId,
      details: data.details,
      firmId: data.firmId,
      timestamp: new Date(),
    },
  });
}

// OPS-045: Helper to safely resolve user or return placeholder for deleted users
// This prevents GraphQL errors when a user has been deleted but their ID is still referenced
async function getDeletedUserPlaceholder(userId: string): Promise<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}> {
  return {
    id: userId,
    firstName: 'Utilizator',
    lastName: 'Șters',
    email: 'deleted@system',
  };
}

// ============================================================================
// Simplified Document Status Transition Validation
// ============================================================================

type DocumentStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'FINAL';

// Simplified 3-status flow:
// DRAFT -> READY_FOR_REVIEW: Team member marks as ready
// READY_FOR_REVIEW -> FINAL: Supervisor approves
// READY_FOR_REVIEW -> DRAFT: Author resumes editing
// FINAL is terminal (no transitions out)
const ALLOWED_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ['READY_FOR_REVIEW'],
  READY_FOR_REVIEW: ['FINAL', 'DRAFT'],
  FINAL: [],
};

/**
 * Validates if a document status transition is allowed
 * @param from Current document status
 * @param to Desired new status
 * @returns true if transition is valid, false otherwise
 */
function isValidStatusTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  // Same status is always "valid" (no-op)
  if (from === to) return true;

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[from];
  return allowedTransitions?.includes(to) ?? false;
}

/**
 * Returns a user-friendly error message for invalid status transitions
 */
function getInvalidTransitionMessage(from: DocumentStatus, to: DocumentStatus): string {
  const statusLabels: Record<DocumentStatus, string> = {
    DRAFT: 'Ciornă',
    READY_FOR_REVIEW: 'Pregătit pentru revizuire',
    FINAL: 'Final',
  };

  return (
    `Nu se poate schimba starea de la "${statusLabels[from]}" la "${statusLabels[to]}". ` +
    `Tranziții permise din "${statusLabels[from]}": ${
      ALLOWED_STATUS_TRANSITIONS[from]?.map((s) => statusLabels[s]).join(', ') || 'niciuna'
    }`
  );
}

export const documentResolvers = {
  Query: {
    // Get all documents for a client
    clientDocuments: async (
      _: any,
      args: {
        clientId: string;
        excludeCaseId?: string;
        search?: string;
        fileTypes?: string[];
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessClientDocuments(args.clientId, user))) {
        throw new GraphQLError('Not authorized to access client documents', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const where: any = {
        clientId: args.clientId,
        firmId: user.firmId,
        // Privacy filter: users only see documents they have access to
        ...buildDocumentPrivacyFilter(user.id, user.role),
      };

      // Exclude documents already linked to a case
      if (args.excludeCaseId) {
        const linkedDocIds = await prisma.caseDocument.findMany({
          where: { caseId: args.excludeCaseId },
          select: { documentId: true },
        });
        where.id = { notIn: linkedDocIds.map((d) => d.documentId) };
      }

      // Search filter - wrap in AND to combine with privacy OR
      if (args.search) {
        where.AND = [
          {
            OR: [
              { fileName: { contains: args.search, mode: 'insensitive' } },
              { metadata: { path: ['description'], string_contains: args.search } },
            ],
          },
        ];
      }

      // File type filter
      if (args.fileTypes && args.fileTypes.length > 0) {
        where.fileType = { in: args.fileTypes };
      }

      return prisma.document.findMany({
        where,
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });
    },

    // Get documents grouped by source case
    clientDocumentsGroupedByCase: async (
      _: any,
      args: {
        clientId: string;
        excludeCaseId?: string;
        search?: string;
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessClientDocuments(args.clientId, user))) {
        throw new GraphQLError('Not authorized to access client documents', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all documents for the client
      const where: any = {
        clientId: args.clientId,
        firmId: user.firmId,
        // Privacy filter: users only see documents they have access to
        ...buildDocumentPrivacyFilter(user.id, user.role),
      };

      // Exclude documents already linked to a case
      if (args.excludeCaseId) {
        const linkedDocIds = await prisma.caseDocument.findMany({
          where: { caseId: args.excludeCaseId },
          select: { documentId: true },
        });
        if (linkedDocIds.length > 0) {
          where.id = { notIn: linkedDocIds.map((d) => d.documentId) };
        }
      }

      // Search filter - wrap in AND to combine with privacy OR
      if (args.search) {
        where.AND = [{ OR: [{ fileName: { contains: args.search, mode: 'insensitive' } }] }];
      }

      const documents = await prisma.document.findMany({
        where,
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            where: { isOriginal: true },
            include: {
              case: true,
              linker: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      // Group documents by their original case
      const groupedByCaseId = new Map<string, typeof documents>();
      const documentsWithoutCase: typeof documents = [];

      for (const doc of documents) {
        const originalLink = doc.caseLinks.find((link) => link.isOriginal);
        if (originalLink) {
          const caseId = originalLink.caseId;
          if (!groupedByCaseId.has(caseId)) {
            groupedByCaseId.set(caseId, []);
          }
          groupedByCaseId.get(caseId)!.push(doc);
        } else {
          documentsWithoutCase.push(doc);
        }
      }

      // Get case details for grouped documents
      const caseIds = Array.from(groupedByCaseId.keys());
      const cases = await prisma.case.findMany({
        where: { id: { in: caseIds } },
      });

      const result = cases.map((caseData) => ({
        case: caseData,
        documents: groupedByCaseId.get(caseData.id) || [],
        documentCount: groupedByCaseId.get(caseData.id)?.length || 0,
      }));

      // Add documents without a case (uploaded directly to client)
      if (documentsWithoutCase.length > 0) {
        result.push({
          case: null as any, // Will be handled in UI as "Client Documents"
          documents: documentsWithoutCase,
          documentCount: documentsWithoutCase.length,
        });
      }

      return result.filter((g) => g.documents.length > 0);
    },

    // Get documents for a case
    caseDocuments: async (
      _: any,
      args: { caseId: string; excludeMapaAssigned?: boolean },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Build where clause - exclude mapa-assigned documents by default
      const where: any = { caseId: args.caseId };
      if (args.excludeMapaAssigned !== false) {
        where.mapaSlots = { none: {} };
      }

      const caseLinks = await prisma.caseDocument.findMany({
        where,
        include: {
          document: {
            include: {
              uploader: true,
              client: true,
            },
          },
          linker: true,
        },
        orderBy: { linkedAt: 'desc' },
      });

      // Deduplicate documents by fileName + fileSize (forwarded emails create duplicates)
      const seenDocs = new Map<string, (typeof caseLinks)[0]>();
      const uniqueCaseLinks: typeof caseLinks = [];

      for (const link of caseLinks) {
        const dedupKey = `${link.document.fileName}:${link.document.fileSize}`;
        const existing = seenDocs.get(dedupKey);

        if (!existing) {
          // First occurrence - keep it
          seenDocs.set(dedupKey, link);
          uniqueCaseLinks.push(link);
        } else if (link.isOriginal && !existing.isOriginal) {
          // Prefer original over non-original
          seenDocs.set(dedupKey, link);
          const idx = uniqueCaseLinks.indexOf(existing);
          if (idx !== -1) uniqueCaseLinks[idx] = link;
        } else if (link.linkedAt < existing.linkedAt) {
          // Prefer older (first uploaded) document
          seenDocs.set(dedupKey, link);
          const idx = uniqueCaseLinks.indexOf(existing);
          if (idx !== -1) uniqueCaseLinks[idx] = link;
        }
        // Otherwise skip this duplicate
      }

      // For imported documents, find the original case
      const result = await Promise.all(
        uniqueCaseLinks.map(async (link) => {
          let sourceCase = null;
          let receivedAt = link.linkedAt; // Default to linkedAt

          if (!link.isOriginal) {
            // Find the original case for this document
            const originalLink = await prisma.caseDocument.findFirst({
              where: {
                documentId: link.documentId,
                isOriginal: true,
              },
              include: {
                case: true,
              },
            });
            sourceCase = originalLink?.case || null;
          }

          // Get the original email date if this document came from an email attachment
          // Look up via EmailAttachment.documentId (more reliable than promotedFromAttachment flag)
          const attachment = await prisma.emailAttachment.findFirst({
            where: { documentId: link.documentId },
            include: {
              email: {
                select: { receivedDateTime: true },
              },
            },
          });
          if (attachment?.email?.receivedDateTime) {
            receivedAt = attachment.email.receivedDateTime;
          }

          return {
            id: link.id,
            document: link.document,
            // OPS-045: Return placeholder if linker user was deleted
            linkedBy: link.linker || (await getDeletedUserPlaceholder(link.linkedBy)),
            linkedAt: link.linkedAt,
            isOriginal: link.isOriginal,
            sourceCase,
            // OPS-171: Promotion tracking
            promotedFromAttachment: link.promotedFromAttachment || false,
            originalAttachmentId: link.originalAttachmentId || null,
            receivedAt,
          };
        })
      );

      return result;
    },

    // Get client inbox documents (not assigned to any case)
    clientInboxDocuments: async (_: any, args: { clientId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessClientDocuments(args.clientId, user))) {
        throw new GraphQLError('Not authorized to access client documents', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find CaseDocument records where caseId is NULL but clientId matches
      const clientLinks = await prisma.caseDocument.findMany({
        where: {
          caseId: null,
          clientId: args.clientId,
          firmId: user.firmId,
          document: buildDocumentPrivacyFilter(user.id, user.role),
        },
        include: {
          document: {
            include: {
              uploader: true,
              client: true,
            },
          },
          linker: true,
        },
        orderBy: { linkedAt: 'desc' },
      });

      // Deduplicate documents by fileName + fileSize
      const seenDocs = new Map<string, (typeof clientLinks)[0]>();
      const uniqueLinks: typeof clientLinks = [];

      for (const link of clientLinks) {
        const dedupKey = `${link.document.fileName}:${link.document.fileSize}`;
        const existing = seenDocs.get(dedupKey);

        if (!existing) {
          seenDocs.set(dedupKey, link);
          uniqueLinks.push(link);
        } else if (link.linkedAt < existing.linkedAt) {
          // Prefer older (first synced) document
          seenDocs.set(dedupKey, link);
          const idx = uniqueLinks.indexOf(existing);
          if (idx !== -1) uniqueLinks[idx] = link;
        }
      }

      // Transform to CaseDocumentWithContext format
      const result = await Promise.all(
        uniqueLinks.map(async (link) => {
          let receivedAt = link.linkedAt;

          // Get the original email date if this document came from an email attachment
          const attachment = await prisma.emailAttachment.findFirst({
            where: { documentId: link.documentId },
            include: {
              email: {
                select: { receivedDateTime: true },
              },
            },
          });
          if (attachment?.email?.receivedDateTime) {
            receivedAt = attachment.email.receivedDateTime;
          }

          return {
            id: link.id,
            document: link.document,
            linkedBy: link.linker || (await getDeletedUserPlaceholder(link.linkedBy)),
            linkedAt: link.linkedAt,
            isOriginal: link.isOriginal,
            sourceCase: null, // No source case for client inbox documents
            promotedFromAttachment: link.promotedFromAttachment || false,
            originalAttachmentId: link.originalAttachmentId || null,
            receivedAt,
          };
        })
      );

      return result;
    },

    // Get single document
    document: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.id, user))) {
        return null;
      }

      return prisma.document.findUnique({
        where: { id: args.id },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
      });
    },

    // Get document audit history
    documentAuditHistory: async (
      _: any,
      args: { documentId: string; limit?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized to view document history', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return prisma.documentAuditLog.findMany({
        where: { documentId: args.documentId },
        include: {
          user: true,
        },
        orderBy: { timestamp: 'desc' },
        take: args.limit || 50,
      });
    },

    // OPS-176: Get document versions for version history drawer
    documentVersions: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized to view document versions', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return prisma.documentVersion.findMany({
        where: { documentId: args.documentId },
        include: {
          creator: true,
        },
        orderBy: { versionNumber: 'desc' },
      });
    },

    // Get document thumbnail (Story 2.9 AC5, OPS-109)
    getDocumentThumbnail: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if file type supports thumbnails
      if (!thumbnailService.canGenerateThumbnail(document.fileType)) {
        return null;
      }

      const accessToken = context.accessToken || context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required for thumbnail generation', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // OPS-109: Try SharePoint first (all firm users can access)
      if (document.sharePointItemId) {
        try {
          const thumbnails = await sharePointService.getThumbnails(
            accessToken,
            document.sharePointItemId
          );

          // Prefer large thumbnail, fall back to medium or small
          const url = thumbnails.large || thumbnails.medium || thumbnails.small;
          if (url) {
            logger.debug('Using SharePoint thumbnail', {
              documentId: args.documentId,
              sharePointItemId: document.sharePointItemId,
            });
            return { url, source: 'sharepoint' };
          }
        } catch (error) {
          logger.warn('SharePoint thumbnail failed, trying OneDrive fallback', {
            documentId: args.documentId,
            sharePointItemId: document.sharePointItemId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Fall through to OneDrive
        }
      }

      // For OneDrive documents, use OneDrive thumbnail endpoint
      if (document.oneDriveId) {
        const result = await thumbnailService.generateThumbnail(
          args.documentId,
          document.fileType,
          {
            oneDriveId: document.oneDriveId,
            accessToken,
          }
        );

        return result ? { url: result.url, source: result.source } : null;
      }

      // For local files without cloud storage, thumbnail generation would
      // require fetching the file from storage - return null for now
      // This could be enhanced to support local storage thumbnails
      return null;
    },

    // Get document preview URL (OPS-087, OPS-109, OPS-183)
    documentPreviewUrl: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // OPS-183: Auto-sync from SharePoint before returning preview URL
      // This lazily syncs Word edits when user previews the document
      let syncResult: { synced: boolean; newVersionNumber?: number } | null = null;
      if (document.sharePointItemId && context.user?.accessToken) {
        try {
          const result = await wordIntegrationService.syncFromSharePointIfChanged(
            args.documentId,
            context.user.accessToken,
            user.id
          );
          if (result.synced) {
            syncResult = {
              synced: true,
              newVersionNumber: result.newVersion,
            };
            logger.info('OPS-183: Document synced from SharePoint on preview access', {
              documentId: args.documentId,
              newVersionNumber: result.newVersion,
            });
          }
        } catch (error) {
          // Log but don't fail preview - sync is opportunistic
          logger.warn('OPS-183: SharePoint sync check failed, continuing with preview', {
            documentId: args.documentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // File types that can be previewed directly in browser (PDFs, images, and text)
      const browserPreviewableTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'text/csv',
        'text/html',
        'text/css',
        'text/javascript',
        'application/json',
      ];

      // Office document types that can be previewed via Office Online
      const officeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/msword', // .doc
        'application/vnd.ms-excel', // .xls
        'application/vnd.ms-powerpoint', // .ppt
      ];

      // OPS-109: Try SharePoint first (all firm users can access)
      if (document.sharePointItemId && context.user?.accessToken) {
        try {
          const previewInfo = await sharePointService.getPreviewUrl(
            context.user.accessToken,
            document.sharePointItemId,
            document.fileType
          );

          if (previewInfo) {
            logger.debug('Using SharePoint preview URL', {
              documentId: args.documentId,
              sharePointItemId: document.sharePointItemId,
              source: previewInfo.source,
              syncResult: syncResult ? 'synced' : 'none',
            });
            return {
              url: previewInfo.url,
              source: previewInfo.source,
              expiresAt: previewInfo.expiresAt,
              syncResult: syncResult, // OPS-183: Include sync result
            };
          }
        } catch (error) {
          logger.warn('SharePoint preview failed, trying OneDrive fallback', {
            documentId: args.documentId,
            sharePointItemId: document.sharePointItemId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Fall through to OneDrive fallback
        }
      }

      // Try OneDrive preview (legacy documents - only works for uploader)
      // OPS-092: Use context.user?.accessToken - the MS access token is stored in user context
      // OPS-104: Pass oneDriveUserId for cross-user document access
      if (document.oneDriveId && context.user?.accessToken) {
        try {
          const previewInfo = await oneDriveService.getPreviewUrl(
            context.user.accessToken,
            document.oneDriveId,
            document.fileType,
            document.oneDriveUserId ?? undefined // OPS-104: Cross-user access
          );

          if (previewInfo) {
            return {
              url: previewInfo.url,
              source: previewInfo.source,
              expiresAt: previewInfo.expiresAt,
              syncResult: syncResult, // OPS-183: Include sync result
            };
          }
        } catch (error) {
          // OPS-092: Log and fall through to R2 fallback instead of propagating error
          logger.warn('OneDrive preview failed, falling back to R2', {
            documentId: args.documentId,
            oneDriveId: document.oneDriveId,
            oneDriveUserId: document.oneDriveUserId, // OPS-104: Log owner ID for debugging
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Fall through to R2 fallback below
        }
      }

      // Fallback to R2 for documents without cloud storage
      if (document.storagePath) {
        const presignedUrl = await r2StorageService.getPresignedUrl(document.storagePath);
        if (presignedUrl) {
          // For browser-previewable types (PDF, images), return direct URL
          if (browserPreviewableTypes.includes(document.fileType)) {
            logger.debug('Using R2 presigned URL for document preview', {
              documentId: args.documentId,
              fileType: document.fileType,
            });
            return {
              url: presignedUrl.url,
              source: 'r2',
              expiresAt: presignedUrl.expiresAt,
              syncResult: syncResult, // OPS-183: Include sync result
            };
          }

          // For Office documents, use Office Online viewer with R2 presigned URL
          if (officeTypes.includes(document.fileType)) {
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(presignedUrl.url)}`;
            logger.debug('Using Office Online viewer with R2 URL for document preview', {
              documentId: args.documentId,
              fileType: document.fileType,
            });
            return {
              url: officeViewerUrl,
              source: 'office365-r2',
              expiresAt: presignedUrl.expiresAt,
              syncResult: syncResult, // OPS-183: Include sync result
            };
          }
        }
      }

      // OPS-109: Enhanced debug logging for preview troubleshooting
      logger.warn('Preview not available for document', {
        documentId: args.documentId,
        fileType: document.fileType,
        hasSharePointItemId: !!document.sharePointItemId,
        sharePointItemId: document.sharePointItemId,
        hasOneDriveId: !!document.oneDriveId,
        oneDriveId: document.oneDriveId,
        hasStoragePath: !!document.storagePath,
        storagePath: document.storagePath,
        hasAccessToken: !!context.user?.accessToken,
      });
      return null;
    },

    // OPS-109: Get text content for text file preview (proxied to avoid CORS)
    documentTextContent: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only allow text file types
      const textTypes = [
        'text/plain',
        'text/csv',
        'text/html',
        'text/css',
        'text/javascript',
        'application/json',
      ];

      if (!textTypes.includes(document.fileType)) {
        throw new GraphQLError('Document is not a text file', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Try SharePoint first
      if (document.sharePointItemId && context.user?.accessToken) {
        try {
          const downloadUrl = await sharePointService.getDownloadUrl(
            context.user.accessToken,
            document.sharePointItemId
          );

          if (downloadUrl) {
            // Fetch the content from SharePoint
            const response = await fetch(downloadUrl);
            if (response.ok) {
              const content = await response.text();
              logger.debug('Fetched text content from SharePoint', {
                documentId: args.documentId,
                size: content.length,
              });
              return {
                content,
                mimeType: document.fileType,
                size: content.length,
              };
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch text content from SharePoint', {
            documentId: args.documentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Try OneDrive fallback
      if (document.oneDriveId && context.user?.accessToken) {
        try {
          const downloadLink = await oneDriveService.getDocumentDownloadLink(
            context.user.accessToken,
            document.oneDriveId,
            document.oneDriveUserId ?? undefined
          );

          if (downloadLink?.url) {
            const downloadUrl = downloadLink.url;
            const response = await fetch(downloadUrl);
            if (response.ok) {
              const content = await response.text();
              logger.debug('Fetched text content from OneDrive', {
                documentId: args.documentId,
                size: content.length,
              });
              return {
                content,
                mimeType: document.fileType,
                size: content.length,
              };
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch text content from OneDrive', {
            documentId: args.documentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // R2 fallback
      if (document.storagePath) {
        try {
          const presignedUrl = await r2StorageService.getPresignedUrl(document.storagePath);
          if (presignedUrl) {
            const response = await fetch(presignedUrl.url);
            if (response.ok) {
              const content = await response.text();
              logger.debug('Fetched text content from R2', {
                documentId: args.documentId,
                size: content.length,
              });
              return {
                content,
                mimeType: document.fileType,
                size: content.length,
              };
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch text content from R2', {
            documentId: args.documentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      throw new GraphQLError('Could not retrieve text content', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    },

    // OPS-107: Grid view query with pagination
    // OPS-173: Added sourceTypes and includePromotedAttachments filters
    caseDocumentsGrid: async (
      _: any,
      args: {
        caseId: string;
        first?: number;
        after?: string;
        fileTypes?: string[];
        sourceTypes?: ('UPLOAD' | 'EMAIL_ATTACHMENT' | 'AI_GENERATED' | 'TEMPLATE')[];
        includePromotedAttachments?: boolean;
        sortBy?: 'LINKED_AT' | 'UPLOADED_AT' | 'FILE_NAME' | 'FILE_SIZE' | 'FILE_TYPE';
        sortDirection?: 'ASC' | 'DESC';
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const limit = Math.min(args.first || 20, 100); // Cap at 100
      const sortDirection = args.sortDirection === 'ASC' ? 'asc' : 'desc';

      // Build sort order based on sortBy
      let orderBy: any = { linkedAt: sortDirection };
      switch (args.sortBy) {
        case 'UPLOADED_AT':
          orderBy = { document: { uploadedAt: sortDirection } };
          break;
        case 'FILE_NAME':
          orderBy = { document: { fileName: sortDirection } };
          break;
        case 'FILE_SIZE':
          orderBy = { document: { fileSize: sortDirection } };
          break;
        case 'FILE_TYPE':
          orderBy = { document: { fileType: sortDirection } };
          break;
        case 'LINKED_AT':
        default:
          orderBy = { linkedAt: sortDirection };
      }

      // Build where clause
      const where: any = { caseId: args.caseId };

      // File type filter with wildcard support (e.g., 'image/*')
      if (args.fileTypes && args.fileTypes.length > 0) {
        const exactTypes: string[] = [];
        const wildcardPrefixes: string[] = [];

        for (const type of args.fileTypes) {
          if (type.endsWith('/*')) {
            wildcardPrefixes.push(type.replace('/*', '/'));
          } else {
            exactTypes.push(type);
          }
        }

        const typeConditions: any[] = [];
        if (exactTypes.length > 0) {
          typeConditions.push({ document: { fileType: { in: exactTypes } } });
        }
        for (const prefix of wildcardPrefixes) {
          typeConditions.push({ document: { fileType: { startsWith: prefix } } });
        }

        if (typeConditions.length > 0) {
          where.OR = typeConditions;
        }
      }

      // OPS-173: Source type filter for document separation tabs
      // "Documente de lucru" tab: UPLOAD, AI_GENERATED, TEMPLATE sources OR promoted attachments
      // "Corespondență" tab: EMAIL_ATTACHMENT sources that are NOT promoted
      if (args.sourceTypes && args.sourceTypes.length > 0) {
        if (args.includePromotedAttachments) {
          // Working docs tab: include specified source types OR promoted attachments
          where.OR = [
            ...(where.OR || []),
            { document: { sourceType: { in: args.sourceTypes } } },
            { promotedFromAttachment: true },
          ];
        } else {
          // Correspondence tab: filter by source type AND exclude promoted attachments
          where.document = {
            ...where.document,
            sourceType: { in: args.sourceTypes },
          };
          where.promotedFromAttachment = false;
        }
      }

      // Cursor-based pagination
      let cursor: { caseId_documentId: { caseId: string; documentId: string } } | undefined;
      if (args.after) {
        try {
          const decoded = Buffer.from(args.after, 'base64').toString('utf-8');
          const [caseId, documentId] = decoded.split(':');
          cursor = { caseId_documentId: { caseId, documentId } };
        } catch {
          // Invalid cursor, ignore
        }
      }

      // Get total count
      const totalCount = await prisma.caseDocument.count({ where });

      // Fetch documents with pagination
      const caseLinks = await prisma.caseDocument.findMany({
        where,
        include: {
          document: {
            include: {
              uploader: true,
              client: true,
            },
          },
          linker: true,
        },
        orderBy,
        take: limit + 1, // Get one extra to check for next page
        cursor,
        skip: cursor ? 1 : 0, // Skip the cursor item itself
      });

      const hasNextPage = caseLinks.length > limit;
      const edges = caseLinks.slice(0, limit);

      // OPS-131: Use DataLoader to batch source case lookups (eliminates N+1)
      const sourceCaseLoader = createSourceCaseDataLoader();

      // Build edges with cursors
      const resultEdges = await Promise.all(
        edges.map(async (link) => {
          // OPS-131: DataLoader batches all source case lookups into a single query
          const sourceCase = !link.isOriginal ? await sourceCaseLoader.load(link.documentId) : null;

          // OPS-114: Use permanent thumbnail URLs from database (no API call needed)
          // Thumbnails are pre-generated and stored in R2 with CDN access
          const cursorValue = Buffer.from(`${link.caseId}:${link.documentId}`).toString('base64');

          return {
            cursor: cursorValue,
            node: {
              id: link.id,
              document: {
                ...link.document,
                // OPS-114: Return permanent R2 URLs from database
                thumbnailSmall: link.document.thumbnailSmallUrl || null,
                thumbnailMedium: link.document.thumbnailMediumUrl || null,
                thumbnailLarge: link.document.thumbnailLargeUrl || null,
                thumbnailStatus: link.document.thumbnailStatus,
              },
              linkedBy: link.linker || (await getDeletedUserPlaceholder(link.linkedBy)),
              linkedAt: link.linkedAt,
              isOriginal: link.isOriginal,
              sourceCase,
              // OPS-171: Promotion tracking
              promotedFromAttachment: link.promotedFromAttachment || false,
              originalAttachmentId: link.originalAttachmentId || null,
            },
          };
        })
      );

      return {
        edges: resultEdges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!args.after,
          startCursor: resultEdges[0]?.cursor || null,
          endCursor: resultEdges[resultEdges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    // Simplified Review Queue - Get documents pending review by current user (supervisor)
    documentsForReview: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      // Only supervisors can access review queue
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        throw new GraphQLError('Only supervisors can access the review queue', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find cases where current user is on the team as Partner or SeniorAssociate (supervisor role)
      const supervisedCases = await prisma.caseTeam.findMany({
        where: {
          userId: user.id,
          role: { in: ['Partner', 'SeniorAssociate'] },
          case: { firmId: user.firmId },
        },
        select: { caseId: true },
      });

      const supervisedCaseIds = supervisedCases.map((ct) => ct.caseId);

      if (supervisedCaseIds.length === 0) {
        return [];
      }

      // Find documents in supervised cases with DRAFT or READY_FOR_REVIEW status
      const documents = await prisma.document.findMany({
        where: {
          firmId: user.firmId,
          status: { in: ['DRAFT', 'READY_FOR_REVIEW'] },
          caseLinks: {
            some: {
              caseId: { in: supervisedCaseIds },
            },
          },
          // Exclude documents uploaded by the supervisor themselves
          uploadedBy: { not: user.id },
        },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            where: { caseId: { in: supervisedCaseIds } },
            include: {
              case: {
                include: {
                  client: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' }, // Most recently updated first
      });

      // Transform to DocumentForReview format (simplified - no submittedBy/submittedAt fields)
      return documents
        .filter((doc) => doc.caseLinks.length > 0)
        .map((doc) => ({
          id: doc.id,
          document: {
            ...doc,
            thumbnailSmall: doc.thumbnailSmallUrl || null,
            thumbnailMedium: doc.thumbnailMediumUrl || null,
            thumbnailLarge: doc.thumbnailLargeUrl || null,
          },
          case: doc.caseLinks[0].case,
        }));
    },

    // Simplified Review Queue - Get count of documents pending review
    documentsForReviewCount: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      // Only supervisors can access review queue
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        return 0;
      }

      // Find cases where current user is on the team as Partner or SeniorAssociate (supervisor role)
      const supervisedCases = await prisma.caseTeam.findMany({
        where: {
          userId: user.id,
          role: { in: ['Partner', 'SeniorAssociate'] },
          case: { firmId: user.firmId },
        },
        select: { caseId: true },
      });

      const supervisedCaseIds = supervisedCases.map((ct) => ct.caseId);

      if (supervisedCaseIds.length === 0) {
        return 0;
      }

      // Count documents in supervised cases with DRAFT or READY_FOR_REVIEW status
      return prisma.document.count({
        where: {
          firmId: user.firmId,
          status: { in: ['DRAFT', 'READY_FOR_REVIEW'] },
          caseLinks: {
            some: {
              caseId: { in: supervisedCaseIds },
            },
          },
          uploadedBy: { not: user.id },
        },
      });
    },

    // Get OneDrive storage quota
    storageQuota: async (_: any, _args: any, context: Context) => {
      const user = requireAuth(context);

      if (!user.accessToken) {
        // Return null if no Microsoft connection - UI will handle gracefully
        return null;
      }

      try {
        const quota = await oneDriveService.getStorageQuota(user.accessToken);
        return quota;
      } catch (error) {
        logger.warn('Failed to fetch storage quota', { error, userId: user.id });
        return null;
      }
    },

    // Get document counts for all cases (for sidebar display)
    caseDocumentCounts: async (_: any, _args: any, context: Context) => {
      const user = requireAuth(context);

      // Get all cases user has access to with their document counts
      const casesWithCounts = await prisma.case.findMany({
        where: {
          firmId: user.firmId,
          // For non-partners, only show cases they're assigned to
          ...(user.role !== 'Partner' && user.role !== 'BusinessOwner'
            ? {
                teamMembers: {
                  some: { userId: user.id },
                },
              }
            : {}),
        },
        select: {
          id: true,
          _count: {
            select: {
              documents: true, // Count from case_documents junction table
            },
          },
        },
      });

      return casesWithCounts.map((c) => ({
        caseId: c.id,
        documentCount: c._count.documents,
      }));
    },

    // Get clients that have documents in their inbox (not assigned to any case)
    clientsWithInboxDocuments: async (_: any, _args: any, context: Context) => {
      const user = requireAuth(context);

      // Find all CaseDocument records where caseId is NULL (client inbox documents)
      // Group by client and count documents
      const clientInboxDocs = await prisma.caseDocument.groupBy({
        by: ['clientId'],
        where: {
          caseId: null,
          clientId: { not: null },
          firmId: user.firmId,
          document: buildDocumentPrivacyFilter(user.id, user.role),
        },
        _count: {
          documentId: true,
        },
      });

      if (clientInboxDocs.length === 0) {
        return [];
      }

      // Get client names for the clients with inbox documents
      let clientIds = clientInboxDocs
        .map((c) => c.clientId)
        .filter((id): id is string => id !== null);

      // Filter by role-based access (assignment-based roles only see assigned clients)
      const accessibleClientIds = await getAccessibleClientIds(user.id, user.firmId, user.role);
      if (accessibleClientIds !== 'all') {
        clientIds = clientIds.filter((id) => accessibleClientIds.includes(id));
      }

      if (clientIds.length === 0) {
        return [];
      }

      const clients = await prisma.client.findMany({
        where: {
          id: { in: clientIds },
          firmId: user.firmId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const clientNameMap = new Map(clients.map((c) => [c.id, c.name]));

      return clientInboxDocs
        .filter((c) => c.clientId !== null && clientNameMap.has(c.clientId))
        .map((c) => ({
          clientId: c.clientId!,
          clientName: clientNameMap.get(c.clientId!) || 'Client necunoscut',
          inboxDocumentCount: c._count.documentId,
        }))
        .sort((a, b) => a.clientName.localeCompare(b.clientName, 'ro'));
    },

    // Get recent documents from cases the user has access to (for dashboard)
    myRecentDocuments: async (_: any, args: { limit?: number }, context: Context) => {
      const user = requireAuth(context);
      const limit = args.limit || 5;

      // For assignment-based roles (AssociateJr, Paralegal), get documents from assigned cases only
      // For full-access roles, get documents from all cases in the firm
      let caseFilter: any;

      if (isFullAccessRole(user.role)) {
        // Full-access roles can see documents from all cases in the firm
        caseFilter = { firmId: user.firmId };
      } else {
        // Assignment-based roles can only see documents from cases they're assigned to
        const assignments = await prisma.caseTeam.findMany({
          where: { userId: user.id },
          select: { caseId: true },
        });
        const assignedCaseIds = assignments.map((a) => a.caseId);

        if (assignedCaseIds.length === 0) {
          return []; // No assigned cases, no documents to show
        }

        caseFilter = { id: { in: assignedCaseIds } };
      }

      // Get recent documents linked to accessible cases
      const recentDocuments = await prisma.caseDocument.findMany({
        where: {
          caseId: { not: null },
          case: caseFilter,
          document: {
            firmId: user.firmId,
            ...buildDocumentPrivacyFilter(user.id, user.role),
          },
        },
        include: {
          document: true,
          case: {
            include: {
              client: true,
            },
          },
        },
        orderBy: { document: { uploadedAt: 'desc' } },
        take: limit,
        distinct: ['documentId'], // Avoid showing same document from multiple case links
      });

      return recentDocuments
        .filter((link) => link.case !== null)
        .map((link) => ({
          id: link.document.id,
          fileName: link.document.fileName,
          fileType: link.document.fileType,
          uploadedAt: link.document.uploadedAt,
          case: link.case,
        }));
    },
  },

  Mutation: {
    // Upload a new document (supports both case-level and client inbox uploads)
    uploadDocument: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);
      const { caseId, clientId } = args.input;

      // Validate: must provide either caseId or clientId
      if (!caseId && !clientId) {
        throw new GraphQLError('Must provide either caseId or clientId', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      let targetClientId: string;
      let targetCaseId: string | null = caseId || null;

      if (caseId) {
        // Case-level upload: verify access to case and get client
        if (!(await canAccessCase(caseId, user))) {
          throw new GraphQLError('Not authorized to upload to this case', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        const caseData = await prisma.case.findUnique({
          where: { id: caseId },
          select: { clientId: true, firmId: true },
        });

        if (!caseData) {
          throw new GraphQLError('Case not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        targetClientId = caseData.clientId;
      } else {
        // Client inbox upload: verify client exists and user has access
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, firmId: true },
        });

        if (!client || client.firmId !== user.firmId) {
          throw new GraphQLError('Client not found or not accessible', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        targetClientId = clientId;
      }

      // Create document in transaction
      const document = await prisma.$transaction(async (tx) => {
        // Create the document (owned by client)
        const newDocument = await tx.document.create({
          data: {
            clientId: targetClientId,
            firmId: user.firmId,
            fileName: args.input.fileName,
            fileType: args.input.fileType,
            fileSize: args.input.fileSize,
            storagePath: args.input.storagePath,
            uploadedBy: user.id,
            uploadedAt: new Date(),
            metadata: args.input.metadata || {},
          },
          include: {
            uploader: true,
            client: true,
          },
        });

        // Create case-document link (caseId can be null for client inbox)
        await tx.caseDocument.create({
          data: {
            caseId: targetCaseId,
            clientId: targetCaseId ? null : targetClientId, // Set clientId for inbox docs
            documentId: newDocument.id,
            linkedBy: user.id,
            linkedAt: new Date(),
            isOriginal: true,
            firmId: user.firmId,
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: newDocument.id,
          userId: user.id,
          action: 'Uploaded',
          caseId: targetCaseId,
          details: {
            fileName: newDocument.fileName,
            fileType: newDocument.fileType,
            fileSize: newDocument.fileSize,
            clientInbox: !targetCaseId,
          },
          firmId: user.firmId,
        });

        return newDocument;
      });

      // OPS-047: Mark summary stale (only for case-level uploads)
      if (targetCaseId) {
        caseSummaryService.markSummaryStale(targetCaseId).catch(() => {});
      }

      // OPS-116: Emit document uploaded event
      activityEventService
        .emit({
          userId: user.id,
          firmId: user.firmId,
          eventType: 'DOCUMENT_UPLOADED',
          entityType: 'DOCUMENT',
          entityId: document.id,
          entityTitle: document.fileName,
          metadata: {
            caseId: targetCaseId,
            clientId: targetClientId,
            clientInbox: !targetCaseId,
            fileType: document.fileType,
            fileSize: document.fileSize,
          },
        })
        .catch((err) => logger.error('Failed to emit document uploaded event:', err));

      // Emit activity to team chat (fire and forget)
      activityEmitter
        .emitDocumentUploaded(user.firmId, user.name || user.email, {
          id: document.id,
          name: document.fileName,
        })
        .catch((err) => console.error('[ActivityEmitter] Document upload event failed:', err));

      // Notify case lead + partners about new document (only for case-level uploads)
      if (targetCaseId) {
        const caseForNotification = await prisma.case.findUnique({
          where: { id: targetCaseId },
          select: { title: true },
        });
        if (caseForNotification) {
          await caseNotificationService.notifyNewDocumentUploaded({
            caseId: targetCaseId,
            caseName: caseForNotification.title,
            actorId: user.id,
            actorName: user.name || user.email,
            firmId: user.firmId,
          });
        }
      }

      // Fetch with all relations
      return prisma.document.findUnique({
        where: { id: document.id },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
      });
    },

    // Link existing documents to a case
    linkDocumentsToCase: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      const { caseId, documentIds } = args.input;

      // Verify user has access to the target case
      if (!(await canAccessCase(caseId, user))) {
        throw new GraphQLError('Not authorized to link documents to this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get case to verify client
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { clientId: true, firmId: true },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify all documents exist, belong to same client, and are accessible
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          firmId: user.firmId,
        },
      });

      if (documents.length !== documentIds.length) {
        throw new GraphQLError('One or more documents not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify all documents belong to the same client as the case
      const wrongClientDocs = documents.filter((d) => d.clientId !== caseData.clientId);
      if (wrongClientDocs.length > 0) {
        throw new GraphQLError('All documents must belong to the same client as the case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check for existing links (prevent duplicates)
      const existingLinks = await prisma.caseDocument.findMany({
        where: {
          caseId,
          documentId: { in: documentIds },
        },
        select: { documentId: true },
      });

      const existingDocIds = new Set(existingLinks.map((l) => l.documentId));
      const newDocIds = documentIds.filter((id: string) => !existingDocIds.has(id));

      if (newDocIds.length === 0) {
        throw new GraphQLError('All documents are already linked to this case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Create links in transaction
      await prisma.$transaction(async (tx) => {
        for (const documentId of newDocIds) {
          await tx.caseDocument.create({
            data: {
              caseId,
              documentId,
              linkedBy: user.id,
              linkedAt: new Date(),
              isOriginal: false, // Imported, not uploaded
              firmId: user.firmId,
            },
          });

          // Create audit log for each link
          const doc = documents.find((d) => d.id === documentId);
          await createDocumentAuditLog(tx, {
            documentId,
            userId: user.id,
            action: 'LinkedToCase',
            caseId,
            details: {
              fileName: doc?.fileName,
            },
            firmId: user.firmId,
          });
        }
      });

      // OPS-047: Mark summary stale for linked documents
      caseSummaryService.markSummaryStale(caseId).catch(() => {});

      // Return linked documents
      return prisma.document.findMany({
        where: { id: { in: newDocIds } },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
      });
    },

    // Unlink document from case (soft delete)
    unlinkDocumentFromCase: async (
      _: any,
      args: { caseId: string; documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Verify user has access to the case
      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find the link
      const link = await prisma.caseDocument.findUnique({
        where: {
          caseId_documentId: {
            caseId: args.caseId,
            documentId: args.documentId,
          },
        },
        include: {
          document: true,
        },
      });

      if (!link) {
        throw new GraphQLError('Document is not linked to this case', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Delete link in transaction
      await prisma.$transaction(async (tx) => {
        await tx.caseDocument.delete({
          where: {
            caseId_documentId: {
              caseId: args.caseId,
              documentId: args.documentId,
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: args.documentId,
          userId: user.id,
          action: 'UnlinkedFromCase',
          caseId: args.caseId,
          details: {
            fileName: link.document.fileName,
            wasOriginal: link.isOriginal,
          },
          firmId: user.firmId,
        });
      });

      // OPS-047: Mark summary stale
      caseSummaryService.markSummaryStale(args.caseId).catch(() => {});

      return true;
    },

    // Permanently delete document (Partners only)
    permanentlyDeleteDocument: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners and BusinessOwners can permanently delete documents
      // Story 2.11.1: Added BusinessOwner role support
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError(
          'Only Partners and BusinessOwners can permanently delete documents',
          {
            extensions: { code: 'FORBIDDEN' },
          }
        );
      }

      // Get document with all links
      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        include: {
          caseLinks: true,
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify document belongs to user's firm
      if (document.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const affectedCaseCount = document.caseLinks.length;

      // Delete in transaction
      await prisma.$transaction(async (tx) => {
        // First, create audit log before deleting (so we have the document info)
        await createDocumentAuditLog(tx, {
          documentId: null, // Will be null after delete
          userId: user.id,
          action: 'PermanentlyDeleted',
          caseId: null,
          details: {
            deletedDocumentId: args.documentId,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            storagePath: document.storagePath,
            affectedCaseCount,
            affectedCaseIds: document.caseLinks.map((l) => l.caseId),
          },
          firmId: user.firmId,
        });

        // Delete all case links (cascade should handle this, but be explicit)
        await tx.caseDocument.deleteMany({
          where: { documentId: args.documentId },
        });

        // Delete the document
        await tx.document.delete({
          where: { id: args.documentId },
        });

        // TODO: Delete file from storage (S3/Azure)
        // This should be handled by a storage service
        // For now, log the path for manual cleanup if needed
        logger.info('Document deleted - storage path requires cleanup', {
          documentId: args.documentId,
          storagePath: document.storagePath,
        });
      });

      // OPS-047: Mark all affected cases as stale
      for (const link of document.caseLinks) {
        caseSummaryService.markSummaryStale(link.caseId).catch(() => {});
      }

      return true;
    },

    // Bulk delete all documents for a case (Admin cleanup)
    bulkDeleteCaseDocuments: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners and BusinessOwners can bulk delete
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners and BusinessOwners can bulk delete documents', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case exists and belongs to user's firm
      const caseData = await prisma.case.findUnique({
        where: { id: args.caseId },
        select: { firmId: true },
      });

      if (!caseData || caseData.firmId !== user.firmId) {
        throw new GraphQLError('Case not found or not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all CaseDocuments for this case with oneDriveIds for cleanup
      const caseDocuments = await prisma.caseDocument.findMany({
        where: { caseId: args.caseId },
        select: {
          documentId: true,
          document: {
            select: { oneDriveId: true },
          },
        },
      });

      const documentIds = caseDocuments.map((cd) => cd.documentId);
      const oneDriveIds = caseDocuments
        .map((cd) => cd.document.oneDriveId)
        .filter((id): id is string => id !== null);

      logger.info('Bulk delete starting', {
        caseId: args.caseId,
        documentCount: documentIds.length,
        oneDriveCount: oneDriveIds.length,
        userId: user.id,
      });

      if (documentIds.length === 0) {
        return {
          caseDocumentsDeleted: 0,
          attachmentReferencesCleared: 0,
          documentsDeleted: 0,
          oneDriveFilesDeleted: 0,
          success: true,
        };
      }

      // Perform deletion in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Clear EmailAttachment.documentId references
        const attachmentsCleared = await tx.emailAttachment.updateMany({
          where: { documentId: { in: documentIds } },
          data: { documentId: null },
        });

        // 2. Delete CaseDocument links
        const caseDocsDeleted = await tx.caseDocument.deleteMany({
          where: { caseId: args.caseId },
        });

        // 3. Delete Document records
        const docsDeleted = await tx.document.deleteMany({
          where: { id: { in: documentIds } },
        });

        return {
          caseDocumentsDeleted: caseDocsDeleted.count,
          attachmentReferencesCleared: attachmentsCleared.count,
          documentsDeleted: docsDeleted.count,
        };
      });

      // Delete files from OneDrive (after DB transaction succeeds)
      let oneDriveFilesDeleted = 0;
      if (context.accessToken && oneDriveIds.length > 0) {
        for (const oneDriveId of oneDriveIds) {
          try {
            await oneDriveService.deleteFile(context.accessToken, oneDriveId);
            oneDriveFilesDeleted++;
          } catch (deleteError) {
            logger.warn('Failed to delete file from OneDrive', {
              oneDriveId,
              error: deleteError instanceof Error ? deleteError.message : String(deleteError),
            });
            // Continue deleting other files even if one fails
          }
        }
      }

      logger.info('Bulk delete completed', {
        caseId: args.caseId,
        ...result,
        oneDriveFilesDeleted,
        userId: user.id,
      });

      // OPS-047: Mark case summary as stale after bulk delete
      caseSummaryService.markSummaryStale(args.caseId).catch(() => {});

      return {
        ...result,
        oneDriveFilesDeleted,
        success: true,
      };
    },

    // Update document metadata
    updateDocumentMetadata: async (
      _: any,
      args: { documentId: string; input: any },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Update metadata
      const currentMetadata = (document.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...currentMetadata,
        ...args.input,
      };

      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: args.documentId },
          data: {
            metadata: newMetadata,
          },
          include: {
            uploader: true,
            client: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: args.documentId,
          userId: user.id,
          action: 'MetadataUpdated',
          caseId: null,
          details: {
            previousMetadata: currentMetadata,
            newMetadata,
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      return updated;
    },

    // OPS-162: Rename document
    renameDocument: async (
      _: any,
      args: { documentId: string; newFileName: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate new file name
      const newFileName = args.newFileName.trim();
      if (!newFileName) {
        throw new GraphQLError('File name cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: args.documentId },
          data: {
            fileName: newFileName,
          },
          include: {
            uploader: true,
            client: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: args.documentId,
          userId: user.id,
          action: 'MetadataUpdated',
          caseId: null,
          details: {
            previousFileName: document.fileName,
            newFileName,
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      logger.info('Document renamed', {
        documentId: args.documentId,
        previousName: document.fileName,
        newName: newFileName,
        userId: user.id,
      });

      return updated;
    },

    // Story 2.9: OneDrive integration mutations

    // Upload document with file content to OneDrive
    uploadDocumentToOneDrive: async (
      _: any,
      args: {
        input: {
          caseId: string;
          fileName: string;
          fileType: string;
          fileContent: string;
          title?: string;
          description?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Verify user has access to the case
      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized to upload to this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get case to extract client and case number
      const caseData = await prisma.case.findUnique({
        where: { id: args.input.caseId },
        select: { clientId: true, firmId: true, caseNumber: true },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Decode base64 file content
      const fileBuffer = Buffer.from(args.input.fileContent, 'base64');
      const fileSize = fileBuffer.length;

      // Get user's access token from context
      const accessToken = context.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required for OneDrive upload', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Upload to OneDrive
      const oneDriveFile = await oneDriveService.uploadDocumentToOneDrive(accessToken, fileBuffer, {
        caseId: args.input.caseId,
        caseNumber: caseData.caseNumber,
        fileName: args.input.fileName,
        fileType: args.input.fileType,
        fileSize: fileSize,
        description: args.input.description,
      });

      // OPS-104: Share the file with the organization so other firm members can access it
      // This creates a view-only sharing link scoped to the organization
      await oneDriveService.shareWithOrganization(accessToken, oneDriveFile.id);

      // OPS-104: Get uploader's Azure AD ID for cross-user document access
      const uploader = await prisma.user.findUnique({
        where: { id: user.id },
        select: { azureAdId: true },
      });

      // Create document in database
      const document = await prisma.$transaction(async (tx) => {
        // Create the document (owned by client)
        const newDocument = await tx.document.create({
          data: {
            clientId: caseData.clientId,
            firmId: user.firmId,
            fileName: args.input.fileName,
            fileType: args.input.fileType,
            fileSize: fileSize,
            storagePath: oneDriveFile.parentPath + '/' + oneDriveFile.name,
            uploadedBy: user.id,
            uploadedAt: new Date(),
            oneDriveId: oneDriveFile.id,
            oneDrivePath: oneDriveFile.parentPath + '/' + oneDriveFile.name,
            oneDriveUserId: uploader?.azureAdId || null, // OPS-104: Store owner's MS Graph user ID
            status: 'DRAFT',
            metadata: {
              title: args.input.title || args.input.fileName,
              description: args.input.description || '',
              oneDriveWebUrl: oneDriveFile.webUrl,
            },
          },
        });

        // Create case-document link
        await tx.caseDocument.create({
          data: {
            caseId: args.input.caseId,
            documentId: newDocument.id,
            linkedBy: user.id,
            linkedAt: new Date(),
            isOriginal: true,
            firmId: user.firmId,
          },
        });

        // Create initial version
        await tx.documentVersion.create({
          data: {
            documentId: newDocument.id,
            versionNumber: 1,
            oneDriveVersionId: oneDriveFile.id,
            changesSummary: 'Initial upload',
            createdBy: user.id,
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: newDocument.id,
          userId: user.id,
          action: 'Uploaded',
          caseId: args.input.caseId,
          details: {
            fileName: newDocument.fileName,
            fileType: newDocument.fileType,
            fileSize: newDocument.fileSize,
            oneDriveId: oneDriveFile.id,
            uploadMethod: 'OneDrive',
          },
          firmId: user.firmId,
        });

        return newDocument;
      });

      // OPS-114: Queue thumbnail generation for OneDrive upload
      queueThumbnailJob({
        documentId: document.id,
        accessToken,
        triggeredBy: 'upload',
      }).catch((err) => {
        logger.warn('Failed to queue thumbnail job', {
          documentId: document.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });

      // OPS-116: Emit document uploaded event
      activityEventService
        .emit({
          userId: user.id,
          firmId: user.firmId,
          eventType: 'DOCUMENT_UPLOADED',
          entityType: 'DOCUMENT',
          entityId: document.id,
          entityTitle: document.fileName,
          metadata: {
            caseId: args.input.caseId,
            fileType: document.fileType,
            fileSize: document.fileSize,
            uploadMethod: 'OneDrive',
          },
        })
        .catch((err) => logger.error('Failed to emit document uploaded event:', err));

      // Fetch with all relations
      return prisma.document.findUnique({
        where: { id: document.id },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    },

    // OPS-108: Upload document to SharePoint firm storage
    uploadDocumentToSharePoint: async (
      _: any,
      args: {
        input: {
          caseId: string;
          fileName: string;
          fileType: string;
          fileContent: string;
          title?: string;
          description?: string;
          processWithAI?: boolean;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Verify user has access to the case
      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized to upload to this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get case to extract client and case number
      const caseData = await prisma.case.findUnique({
        where: { id: args.input.caseId },
        select: { clientId: true, firmId: true, caseNumber: true },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Decode base64 file content
      const fileBuffer = Buffer.from(args.input.fileContent, 'base64');
      const fileSize = fileBuffer.length;

      // Get user's access token from context
      const accessToken = context.accessToken || context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required for SharePoint upload', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Upload to SharePoint
      const spItem = await sharePointService.uploadDocument(
        accessToken,
        caseData.caseNumber,
        args.input.fileName,
        fileBuffer,
        args.input.fileType
      );

      logger.info('Document uploaded to SharePoint', {
        caseId: args.input.caseId,
        caseNumber: caseData.caseNumber,
        fileName: args.input.fileName,
        sharePointId: spItem.id,
        webUrl: spItem.webUrl,
      });

      // Create document in database
      const document = await prisma.$transaction(async (tx) => {
        // Determine extraction status based on processWithAI flag and file type support
        const processWithAI = args.input.processWithAI === true;
        const supportsExtraction = isSupportedFormat(args.input.fileType);
        const extractionStatus = processWithAI
          ? supportsExtraction
            ? 'PENDING'
            : 'UNSUPPORTED'
          : 'NONE';

        // Create the document (owned by client)
        const newDocument = await tx.document.create({
          data: {
            clientId: caseData.clientId,
            firmId: user.firmId,
            fileName: args.input.fileName,
            fileType: args.input.fileType,
            fileSize: fileSize,
            storagePath: spItem.parentPath + '/' + spItem.name,
            uploadedBy: user.id,
            uploadedAt: new Date(),
            // OPS-108: SharePoint fields
            sharePointItemId: spItem.id,
            sharePointPath: spItem.webUrl,
            // Don't set OneDrive fields for SharePoint uploads
            oneDriveId: null,
            oneDrivePath: null,
            oneDriveUserId: null,
            status: 'DRAFT',
            // Content extraction fields
            processWithAI,
            extractionStatus,
            metadata: {
              title: args.input.title || args.input.fileName,
              description: args.input.description || '',
              sharePointWebUrl: spItem.webUrl,
            },
          },
        });

        // Create case-document link
        await tx.caseDocument.create({
          data: {
            caseId: args.input.caseId,
            documentId: newDocument.id,
            linkedBy: user.id,
            linkedAt: new Date(),
            isOriginal: true,
            firmId: user.firmId,
          },
        });

        // Create initial version
        await tx.documentVersion.create({
          data: {
            documentId: newDocument.id,
            versionNumber: 1,
            oneDriveVersionId: null, // SharePoint doesn't use this field
            changesSummary: 'Initial upload to SharePoint',
            createdBy: user.id,
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: newDocument.id,
          userId: user.id,
          action: 'Uploaded',
          caseId: args.input.caseId,
          details: {
            fileName: newDocument.fileName,
            fileType: newDocument.fileType,
            fileSize: newDocument.fileSize,
            sharePointItemId: spItem.id,
            uploadMethod: 'SharePoint',
          },
          firmId: user.firmId,
        });

        return newDocument;
      });

      // OPS-047: Mark summary stale
      caseSummaryService.markSummaryStale(args.input.caseId).catch(() => {});

      // OPS-114: Queue thumbnail generation for SharePoint upload
      queueThumbnailJob({
        documentId: document.id,
        accessToken,
        triggeredBy: 'upload',
      }).catch((err) => {
        logger.warn('Failed to queue thumbnail job', {
          documentId: document.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });

      // Queue content extraction if processWithAI is enabled
      if (args.input.processWithAI && document.extractionStatus === 'PENDING') {
        queueContentExtractionJob({
          documentId: document.id,
          fileBufferBase64: args.input.fileContent,
          accessToken,
          triggeredBy: 'upload',
        }).catch((err) => {
          logger.warn('Failed to queue content extraction job', {
            documentId: document.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
      }

      // OPS-116: Emit document uploaded event
      activityEventService
        .emit({
          userId: user.id,
          firmId: user.firmId,
          eventType: 'DOCUMENT_UPLOADED',
          entityType: 'DOCUMENT',
          entityId: document.id,
          entityTitle: document.fileName,
          metadata: {
            caseId: args.input.caseId,
            fileType: document.fileType,
            fileSize: document.fileSize,
            uploadMethod: 'SharePoint',
          },
        })
        .catch((err) => logger.error('Failed to emit document uploaded event:', err));

      // Fetch with all relations
      return prisma.document.findUnique({
        where: { id: document.id },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    },

    // Get temporary download URL for a document (OPS-109: SharePoint support)
    getDocumentDownloadUrl: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const accessToken = context.accessToken || context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // OPS-109: Try SharePoint first (all firm users can access)
      if (document.sharePointItemId) {
        try {
          const downloadUrl = await sharePointService.getDownloadUrl(
            accessToken,
            document.sharePointItemId
          );

          logger.debug('Using SharePoint download URL', {
            documentId: args.documentId,
            sharePointItemId: document.sharePointItemId,
          });

          return {
            url: downloadUrl,
            expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
          };
        } catch (error) {
          logger.warn('SharePoint download failed, trying OneDrive fallback', {
            documentId: args.documentId,
            sharePointItemId: document.sharePointItemId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Fall through to OneDrive
        }
      }

      // Fall back to OneDrive (legacy documents)
      if (!document.oneDriveId) {
        throw new GraphQLError('Document is not stored in cloud storage', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const downloadInfo = await oneDriveService.getDocumentDownloadLink(
        accessToken,
        document.oneDriveId
      );

      return {
        url: downloadInfo.url,
        expirationDateTime: downloadInfo.expirationDateTime,
      };
    },

    // Sync document from OneDrive
    syncDocumentFromOneDrive: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!document.oneDriveId) {
        throw new GraphQLError('Document is not stored in OneDrive', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const accessToken = context.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const syncResult = await oneDriveService.syncDocumentFromOneDrive(
        accessToken,
        document.oneDriveId,
        args.documentId,
        user.id
      );

      const updatedDocument = await prisma.document.findUnique({
        where: { id: args.documentId },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });

      return {
        updated: syncResult.updated,
        newVersionNumber: syncResult.newVersionNumber,
        document: updatedDocument,
      };
    },

    // OPS-104: Share a single document with the organization
    shareDocumentWithOrganization: async (
      _: any,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!document.oneDriveId) {
        throw new GraphQLError('Document is not stored in OneDrive', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const accessToken = context.accessToken || context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const sharingResult = await oneDriveService.shareWithOrganization(
        accessToken,
        document.oneDriveId
      );

      return {
        success: !!sharingResult,
        document,
        sharingLinkUrl: sharingResult?.webUrl || null,
      };
    },

    // OPS-104: Batch share all documents for a case with the organization
    batchShareCaseDocuments: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners and BusinessOwners can batch share
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners and BusinessOwners can batch share documents', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case exists and belongs to user's firm
      const caseData = await prisma.case.findUnique({
        where: { id: args.caseId },
        select: { firmId: true },
      });

      if (!caseData || caseData.firmId !== user.firmId) {
        throw new GraphQLError('Case not found or not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const accessToken = context.accessToken || context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get all documents for this case that have OneDrive IDs
      const caseDocuments = await prisma.caseDocument.findMany({
        where: { caseId: args.caseId },
        include: {
          document: true,
        },
      });

      const oneDriveDocuments = caseDocuments
        .filter((cd) => cd.document.oneDriveId)
        .map((cd) => cd.document);

      let shared = 0;
      let failed = 0;
      const skipped = caseDocuments.length - oneDriveDocuments.length;

      for (const doc of oneDriveDocuments) {
        try {
          const result = await oneDriveService.shareWithOrganization(accessToken, doc.oneDriveId!);
          if (result) {
            shared++;
          } else {
            failed++;
          }
        } catch (error) {
          logger.warn('Failed to share document with organization', {
            documentId: doc.id,
            oneDriveId: doc.oneDriveId,
            error: error instanceof Error ? error.message : String(error),
          });
          failed++;
        }
      }

      logger.info('Batch share completed', {
        caseId: args.caseId,
        total: caseDocuments.length,
        shared,
        failed,
        skipped,
        userId: user.id,
      });

      return {
        total: caseDocuments.length,
        shared,
        failed,
        skipped,
        success: failed === 0,
      };
    },

    // Update document status
    // OPS-172: Extended with IN_REVIEW and CHANGES_REQUESTED states
    updateDocumentStatus: async (
      _: any,
      args: { documentId: string; input: { status: DocumentStatus } },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        include: {
          caseLinks: true,
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // OPS-172: Validate status transition
      const currentStatus = document.status as DocumentStatus;
      const newStatus = args.input.status;

      if (!isValidStatusTransition(currentStatus, newStatus)) {
        throw new GraphQLError(getInvalidTransitionMessage(currentStatus, newStatus), {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: args.documentId },
          data: {
            status: newStatus,
          },
          include: {
            uploader: true,
            client: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: args.documentId,
          userId: user.id,
          action: 'MetadataUpdated',
          caseId: document.caseLinks[0]?.caseId || null,
          details: {
            previousStatus: currentStatus,
            newStatus: newStatus,
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      return updated;
    },

    // OPS-175: Promote email attachment to working document
    promoteAttachmentToDocument: async (
      _: any,
      args: { input: { caseDocumentId: string; targetFolderId?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { caseDocumentId, targetFolderId } = args.input;

      // 1. Get the original case document with all related data
      const originalCaseDoc = await prisma.caseDocument.findUnique({
        where: { id: caseDocumentId },
        include: {
          document: true,
          case: true,
        },
      });

      if (!originalCaseDoc) {
        return {
          success: false,
          error: 'Documentul nu a fost găsit',
          document: null,
          caseDocument: null,
        };
      }

      // Check user has access to this case
      if (!(await canAccessCase(originalCaseDoc.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // 2. Validate: Must be an email attachment
      if (originalCaseDoc.document.sourceType !== 'EMAIL_ATTACHMENT') {
        return {
          success: false,
          error: 'Doar atașamentele email pot fi promovate',
          document: null,
          caseDocument: null,
        };
      }

      // 3. Check if already promoted
      const existingPromotion = await prisma.caseDocument.findFirst({
        where: {
          originalAttachmentId: originalCaseDoc.document.id,
          promotedFromAttachment: true,
        },
      });

      if (existingPromotion) {
        return {
          success: false,
          error: 'Acest atașament a fost deja promovat',
          document: null,
          caseDocument: null,
        };
      }

      // 4. Get access token for SharePoint operations
      const accessToken = context.accessToken || context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required for document promotion', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // 5. Copy file in SharePoint to working documents folder
      let newSharePointItem: { id: string; webUrl: string; parentPath: string } | null = null;

      if (originalCaseDoc.document.sharePointItemId) {
        try {
          const workingPath = `Cases/${originalCaseDoc.case.caseNumber}/Documents/Working`;
          newSharePointItem = await sharePointService.copyFile(
            accessToken,
            originalCaseDoc.document.sharePointItemId,
            workingPath,
            originalCaseDoc.document.fileName
          );
        } catch (error) {
          logger.error('Failed to copy file in SharePoint for promotion', {
            caseDocumentId,
            sharePointItemId: originalCaseDoc.document.sharePointItemId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return {
            success: false,
            error: 'Eroare la copierea fișierului în SharePoint',
            document: null,
            caseDocument: null,
          };
        }
      } else {
        // Document not in SharePoint - this shouldn't happen for email attachments
        // but handle gracefully
        logger.warn('Promoting attachment without SharePoint storage', {
          caseDocumentId,
          documentId: originalCaseDoc.document.id,
        });
      }

      // 6. Create new Document and CaseDocument in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the new working document
        const newDocument = await tx.document.create({
          data: {
            clientId: originalCaseDoc.document.clientId,
            firmId: user.firmId,
            fileName: originalCaseDoc.document.fileName,
            fileType: originalCaseDoc.document.fileType,
            fileSize: originalCaseDoc.document.fileSize,
            storagePath: newSharePointItem?.parentPath
              ? `${newSharePointItem.parentPath}/${originalCaseDoc.document.fileName}`
              : originalCaseDoc.document.storagePath,
            uploadedBy: user.id,
            uploadedAt: new Date(),
            sourceType: 'EMAIL_ATTACHMENT', // Retains origin info
            status: 'DRAFT',
            sharePointItemId: newSharePointItem?.id || null,
            sharePointPath: newSharePointItem?.webUrl || null,
            metadata: {
              originalAttachmentId: originalCaseDoc.document.id,
              promotedAt: new Date().toISOString(),
              promotedBy: user.id,
              originalEmailId: (originalCaseDoc.document.metadata as Record<string, any>)?.emailId,
            },
          },
        });

        // Create case-document link with promotion tracking
        const newCaseDocument = await tx.caseDocument.create({
          data: {
            caseId: originalCaseDoc.caseId,
            documentId: newDocument.id,
            linkedBy: user.id,
            linkedAt: new Date(),
            isOriginal: true,
            firmId: user.firmId,
            folderId: targetFolderId || null,
            promotedFromAttachment: true,
            originalAttachmentId: originalCaseDoc.document.id,
          },
          include: {
            document: {
              include: {
                uploader: true,
                client: true,
              },
            },
            linker: true,
          },
        });

        // Create initial version
        await tx.documentVersion.create({
          data: {
            documentId: newDocument.id,
            versionNumber: 1,
            createdBy: user.id,
            changesSummary: 'Versiune inițială (promovat din atașament email)',
          },
        });

        // Update original attachment's metadata to indicate it was promoted
        await tx.document.update({
          where: { id: originalCaseDoc.document.id },
          data: {
            metadata: {
              ...(originalCaseDoc.document.metadata as Record<string, any>),
              promotedToDocumentId: newDocument.id,
              promotedAt: new Date().toISOString(),
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId: newDocument.id,
          userId: user.id,
          action: 'Uploaded',
          caseId: originalCaseDoc.caseId,
          details: {
            fileName: newDocument.fileName,
            fileType: newDocument.fileType,
            fileSize: newDocument.fileSize,
            uploadMethod: 'PromotedFromAttachment',
            originalAttachmentId: originalCaseDoc.document.id,
          },
          firmId: user.firmId,
        });

        return { newDocument, newCaseDocument };
      });

      // Emit activity event
      activityEventService
        .emit({
          userId: user.id,
          firmId: user.firmId,
          eventType: 'DOCUMENT_UPLOADED',
          entityType: 'DOCUMENT',
          entityId: result.newDocument.id,
          entityTitle: result.newDocument.fileName,
          metadata: {
            caseId: originalCaseDoc.caseId,
            fileType: result.newDocument.fileType,
            fileSize: result.newDocument.fileSize,
            uploadMethod: 'PromotedFromAttachment',
          },
        })
        .catch((err) => logger.error('Failed to emit document promoted event:', err));

      // Mark case summary as stale
      caseSummaryService.markSummaryStale(originalCaseDoc.caseId).catch(() => {});

      logger.info('Attachment promoted to working document', {
        originalCaseDocumentId: caseDocumentId,
        originalDocumentId: originalCaseDoc.document.id,
        newDocumentId: result.newDocument.id,
        caseId: originalCaseDoc.caseId,
        userId: user.id,
      });

      // Fetch the complete document with all relations
      const fullDocument = await prisma.document.findUnique({
        where: { id: result.newDocument.id },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });

      return {
        success: true,
        document: fullDocument,
        caseDocument: {
          id: result.newCaseDocument.id,
          document: result.newCaseDocument.document,
          linkedBy: result.newCaseDocument.linker,
          linkedAt: result.newCaseDocument.linkedAt,
          isOriginal: result.newCaseDocument.isOriginal,
          sourceCase: null,
          promotedFromAttachment: result.newCaseDocument.promotedFromAttachment,
          originalAttachmentId: result.newCaseDocument.originalAttachmentId,
        },
        error: null,
      };
    },

    // ==========================================================================
    // Content Extraction for AI
    // ==========================================================================

    // Enable or disable AI processing for a document
    setDocumentProcessWithAI: async (
      _: any,
      args: { documentId: string; processWithAI: boolean },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Verify user has access to the document
      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Not authorized to access this document', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          extractionStatus: true,
          processWithAI: true,
          sharePointItemId: true,
          oneDriveId: true,
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // If enabling AI processing
      if (args.processWithAI && !document.processWithAI) {
        const supportsExtraction = isSupportedFormat(document.fileType);

        if (!supportsExtraction) {
          // Mark as unsupported
          return prisma.document.update({
            where: { id: args.documentId },
            data: {
              processWithAI: true,
              extractionStatus: 'UNSUPPORTED',
              extractionError: `File type ${document.fileType} does not support text extraction`,
            },
            include: {
              uploader: true,
              client: true,
              caseLinks: {
                include: {
                  case: true,
                  linker: true,
                },
              },
              versions: {
                orderBy: { versionNumber: 'desc' },
              },
            },
          });
        }

        // If already completed, don't re-extract
        if (document.extractionStatus === 'COMPLETED') {
          return prisma.document.update({
            where: { id: args.documentId },
            data: { processWithAI: true },
            include: {
              uploader: true,
              client: true,
              caseLinks: {
                include: {
                  case: true,
                  linker: true,
                },
              },
              versions: {
                orderBy: { versionNumber: 'desc' },
              },
            },
          });
        }

        // Queue extraction job - need access token to download from SharePoint
        const accessToken = context.accessToken || context.user?.accessToken;

        // Update status to pending and queue job
        const updatedDoc = await prisma.document.update({
          where: { id: args.documentId },
          data: {
            processWithAI: true,
            extractionStatus: 'PENDING',
            extractionError: null,
          },
          include: {
            uploader: true,
            client: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        });

        // Queue the extraction job
        queueContentExtractionJob({
          documentId: args.documentId,
          accessToken,
          triggeredBy: 'manual',
        }).catch((err) => {
          logger.warn('Failed to queue content extraction job', {
            documentId: args.documentId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });

        return updatedDoc;
      }

      // If disabling AI processing
      if (!args.processWithAI && document.processWithAI) {
        return prisma.document.update({
          where: { id: args.documentId },
          data: {
            processWithAI: false,
            extractedContent: null,
            extractedContentUpdatedAt: null,
            extractionStatus: 'NONE',
            extractionError: null,
          },
          include: {
            uploader: true,
            client: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        });
      }

      // No change needed
      return prisma.document.findUnique({
        where: { id: args.documentId },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    },

    // ==========================================================================
    // Simplified Review Workflow Mutations
    // ==========================================================================

    // Mark a document as ready for review (team member action)
    markReadyForReview: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);
      const { documentId } = args;

      // 1. Validate document exists and user has access
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: {
            include: { case: true },
          },
          uploader: true,
          client: true,
        },
      });

      if (!document) {
        throw new GraphQLError('Documentul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (document.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // 2. Validate user is the document author
      if (document.uploadedBy !== user.id) {
        throw new GraphQLError('Doar autorul documentului poate să îl trimită pentru revizuire', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // 3. Validate document is in DRAFT status
      if (document.status !== 'DRAFT') {
        throw new GraphQLError(
          'Documentul trebuie să fie în starea DRAFT pentru a fi trimis la revizuire',
          {
            extensions: { code: 'BAD_REQUEST' },
          }
        );
      }

      // 4. Update document status
      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: documentId },
          data: {
            status: 'READY_FOR_REVIEW',
            submittedAt: new Date(),
          },
          include: {
            uploader: true,
            client: true,
            reviewer: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId,
          userId: user.id,
          action: 'MetadataUpdated',
          caseId: document.caseLinks[0]?.caseId || null,
          details: {
            action: 'MARKED_READY_FOR_REVIEW',
            previousStatus: 'DRAFT',
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      logger.info('Document marked ready for review', {
        documentId,
        markedBy: user.id,
      });

      // TODO: Send notification to supervisor (derived from case team)

      return updated;
    },

    // Mark a document as final (supervisor action)
    markFinal: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);
      const { documentId } = args;

      // 1. Validate document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: {
            include: { case: true },
          },
          uploader: true,
          client: true,
        },
      });

      if (!document) {
        throw new GraphQLError('Documentul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (document.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // 2. Validate document is in READY_FOR_REVIEW status
      if (document.status !== 'READY_FOR_REVIEW') {
        throw new GraphQLError(
          'Documentul trebuie să fie în starea READY_FOR_REVIEW pentru a fi marcat final',
          {
            extensions: { code: 'BAD_REQUEST' },
          }
        );
      }

      // 3. Validate user is a supervisor (Partner or SeniorAssociate on the case team)
      const caseId = document.caseLinks[0]?.caseId;
      if (!caseId) {
        throw new GraphQLError('Documentul nu este asociat cu un dosar', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      const isSupervisor = await prisma.caseTeam.findFirst({
        where: {
          caseId,
          userId: user.id,
          role: { in: ['Partner', 'SeniorAssociate'] },
        },
      });

      // Also allow Partners/BusinessOwners to mark any document final in their firm
      const hasElevatedRole = user.role === 'Partner' || user.role === 'BusinessOwner';

      if (!isSupervisor && !hasElevatedRole) {
        throw new GraphQLError('Doar supervizorii pot marca documentul ca final', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // 4. Update document status
      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: documentId },
          data: {
            status: 'FINAL',
          },
          include: {
            uploader: true,
            client: true,
            reviewer: true,
            caseLinks: {
              include: {
                case: true,
                linker: true,
              },
            },
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        });

        // Create audit log
        await createDocumentAuditLog(tx, {
          documentId,
          userId: user.id,
          action: 'MetadataUpdated',
          caseId,
          details: {
            action: 'MARKED_FINAL',
            previousStatus: 'READY_FOR_REVIEW',
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      logger.info('Document marked final', {
        documentId,
        markedBy: user.id,
        caseId,
      });

      // TODO: Send notification to document author

      return updated;
    },

    // Create a blank Word document and open it for editing
    createBlankDocument: async (
      _: any,
      args: {
        input: {
          caseId?: string;
          clientId?: string;
          fileName: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      try {
        // Validate that either caseId or clientId is provided (but not both or neither)
        if (!args.input.caseId && !args.input.clientId) {
          return {
            success: false,
            error: 'Trebuie să specificați fie caseId, fie clientId',
          };
        }

        if (args.input.caseId && args.input.clientId) {
          return {
            success: false,
            error: 'Specificați doar caseId sau clientId, nu ambele',
          };
        }

        let clientId: string;
        let caseNumber: string | null = null;
        let clientName: string;
        let targetCaseId: string | null = null;

        if (args.input.caseId) {
          // Case-level document creation
          if (!(await canAccessCase(args.input.caseId, user))) {
            return {
              success: false,
              error: 'Nu aveți acces la acest dosar',
            };
          }

          const caseData = await prisma.case.findUnique({
            where: { id: args.input.caseId },
            select: {
              clientId: true,
              firmId: true,
              caseNumber: true,
              client: { select: { name: true } },
            },
          });

          if (!caseData) {
            return {
              success: false,
              error: 'Dosarul nu a fost găsit',
            };
          }

          clientId = caseData.clientId;
          caseNumber = caseData.caseNumber;
          clientName = caseData.client.name;
          targetCaseId = args.input.caseId;
        } else {
          // Client inbox document creation
          if (!(await canAccessClientDocuments(args.input.clientId!, user))) {
            return {
              success: false,
              error: 'Nu aveți acces la documentele acestui client',
            };
          }

          const clientData = await prisma.client.findUnique({
            where: { id: args.input.clientId },
            select: { id: true, firmId: true, name: true },
          });

          if (!clientData) {
            return {
              success: false,
              error: 'Clientul nu a fost găsit',
            };
          }

          if (clientData.firmId !== user.firmId) {
            return {
              success: false,
              error: 'Clientul nu aparține firmei dumneavoastră',
            };
          }

          clientId = clientData.id;
          clientName = clientData.name;
        }

        // Get access token
        const accessToken = context.accessToken || context.user?.accessToken;
        if (!accessToken) {
          return {
            success: false,
            error: 'Token de acces necesar pentru crearea documentului',
          };
        }

        // Ensure filename has .docx extension
        let fileName = args.input.fileName.trim();
        if (!fileName.toLowerCase().endsWith('.docx')) {
          fileName = fileName + '.docx';
        }

        let spItem: SharePointItem;
        let fileSize: number;
        const fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        // Check if firm has a master template
        const hasTemplate = await firmTemplateService.hasTemplate(user.firmId);

        // Helper function to create blank document content
        const createBlankDocContent = async () => {
          const { Document, Packer, Paragraph, TextRun } = await import('docx');
          const blankDoc = new Document({
            creator: 'Legal Platform',
            title: fileName.replace('.docx', ''),
            description: 'Document creat din Legal Platform',
            sections: [
              {
                properties: {},
                children: [
                  new Paragraph({
                    children: [new TextRun('')],
                  }),
                ],
              },
            ],
          });
          return await Packer.toBuffer(blankDoc);
        };

        // Upload to appropriate folder based on case vs client inbox
        if (caseNumber) {
          // Case-level document
          if (hasTemplate) {
            // Copy from template
            const templateDriveItemId = await firmTemplateService.getTemplateDriveItemId(
              user.firmId
            );
            if (templateDriveItemId) {
              const destPath = `Cases/${caseNumber}/Documents`;
              spItem = await sharePointService.copyFile(
                accessToken,
                templateDriveItemId,
                destPath,
                fileName
              );
              fileSize = spItem.size || 0;
              logger.info('Document created from template', {
                caseId: targetCaseId,
                caseNumber,
                fileName,
                templateDriveItemId,
                sharePointId: spItem.id,
              });
            } else {
              // Fallback: create blank document
              const fileBuffer = await createBlankDocContent();
              fileSize = fileBuffer.length;
              spItem = await sharePointService.uploadDocument(
                accessToken,
                caseNumber,
                fileName,
                fileBuffer,
                fileType
              );
              logger.info('Blank document created in SharePoint (template fallback)', {
                caseId: targetCaseId,
                caseNumber,
                fileName,
                sharePointId: spItem.id,
              });
            }
          } else {
            // No template - create blank document
            const fileBuffer = await createBlankDocContent();
            fileSize = fileBuffer.length;
            spItem = await sharePointService.uploadDocument(
              accessToken,
              caseNumber,
              fileName,
              fileBuffer,
              fileType
            );
            logger.info('Blank document created in SharePoint', {
              caseId: targetCaseId,
              caseNumber,
              fileName,
              sharePointId: spItem.id,
            });
          }
        } else {
          // Client inbox document - store in Clients/{ClientName}/Documents/
          if (hasTemplate) {
            const templateDriveItemId = await firmTemplateService.getTemplateDriveItemId(
              user.firmId
            );
            if (templateDriveItemId) {
              const destPath = `Clients/${sharePointService.sanitizeFolderName(clientName)}/Documents`;
              spItem = await sharePointService.copyFile(
                accessToken,
                templateDriveItemId,
                destPath,
                fileName
              );
              fileSize = spItem.size || 0;
              logger.info('Document created from template (client inbox)', {
                clientId,
                clientName,
                fileName,
                templateDriveItemId,
                sharePointId: spItem.id,
              });
            } else {
              const fileBuffer = await createBlankDocContent();
              fileSize = fileBuffer.length;
              spItem = await sharePointService.uploadDocumentToClientFolder(
                accessToken,
                clientName,
                fileName,
                fileBuffer,
                fileType
              );
              logger.info(
                'Blank document created in SharePoint client folder (template fallback)',
                {
                  clientId,
                  clientName,
                  fileName,
                  sharePointId: spItem.id,
                }
              );
            }
          } else {
            const fileBuffer = await createBlankDocContent();
            fileSize = fileBuffer.length;
            spItem = await sharePointService.uploadDocumentToClientFolder(
              accessToken,
              clientName,
              fileName,
              fileBuffer,
              fileType
            );
            logger.info('Blank document created in SharePoint client folder', {
              clientId,
              clientName,
              fileName,
              sharePointId: spItem.id,
            });
          }
        }

        // Create document in database
        const document = await prisma.$transaction(async (tx) => {
          // Create the document
          const newDocument = await tx.document.create({
            data: {
              clientId,
              firmId: user.firmId,
              fileName,
              fileType,
              fileSize,
              storagePath: spItem.parentPath + '/' + spItem.name,
              uploadedBy: user.id,
              uploadedAt: new Date(),
              sharePointItemId: spItem.id,
              sharePointPath: spItem.webUrl,
              sharePointLastModified: new Date(spItem.lastModifiedDateTime),
              status: 'DRAFT',
              sourceType: 'UPLOAD',
              metadata: {
                title: fileName,
                description: hasTemplate
                  ? 'Document creat din template firmă'
                  : 'Document creat din aplicație',
                createdFromTemplate: hasTemplate,
                sharePointWebUrl: spItem.webUrl,
                isClientInbox: !targetCaseId,
              },
            },
          });

          // Create case-document link (supports both case-level and client inbox)
          await tx.caseDocument.create({
            data: {
              caseId: targetCaseId, // null for client inbox
              clientId: targetCaseId ? undefined : clientId, // set only for client inbox
              documentId: newDocument.id,
              linkedBy: user.id,
              linkedAt: new Date(),
              isOriginal: true,
              firmId: user.firmId,
            },
          });

          // Create initial version
          await tx.documentVersion.create({
            data: {
              documentId: newDocument.id,
              versionNumber: 1,
              changesSummary: 'Document nou creat',
              createdBy: user.id,
            },
          });

          // Create audit log
          await createDocumentAuditLog(tx, {
            documentId: newDocument.id,
            userId: user.id,
            action: 'Uploaded',
            caseId: targetCaseId,
            details: {
              fileName: newDocument.fileName,
              fileType: newDocument.fileType,
              fileSize: newDocument.fileSize,
              sharePointItemId: spItem.id,
              uploadMethod: 'CreateBlank',
              isClientInbox: !targetCaseId,
              clientId: !targetCaseId ? clientId : undefined,
            },
            firmId: user.firmId,
          });

          return newDocument;
        });

        // Open document in Word for editing
        const wordSession = await wordIntegrationService.openInWord(
          document.id,
          user.id,
          accessToken
        );

        // OPS-047: Mark summary stale (only for case-level documents)
        if (targetCaseId) {
          caseSummaryService.markSummaryStale(targetCaseId).catch(() => {});
        }

        // OPS-116: Emit document created event
        activityEventService
          .emit({
            userId: user.id,
            firmId: user.firmId,
            eventType: 'DOCUMENT_UPLOADED',
            entityType: 'DOCUMENT',
            entityId: document.id,
            entityTitle: document.fileName,
            metadata: {
              caseId: targetCaseId,
              clientId: !targetCaseId ? clientId : undefined,
              isClientInbox: !targetCaseId,
              fileType: document.fileType,
              fileSize: document.fileSize,
              createdMethod: hasTemplate ? 'template' : 'blank',
              createdFromTemplate: hasTemplate,
            },
          })
          .catch((err) => logger.error('Failed to emit document created event:', err));

        // Fetch document with relations for return
        const fullDocument = await prisma.document.findUnique({
          where: { id: document.id },
          include: {
            uploader: true,
            client: true,
          },
        });

        return {
          success: true,
          document: fullDocument,
          wordUrl: wordSession.wordUrl,
          webUrl: wordSession.webUrl,
          lockToken: wordSession.lockToken,
          lockExpiresAt: wordSession.expiresAt,
          error: null,
        };
      } catch (error: any) {
        // Extract error message from various error types (Error, ParsedGraphError, etc.)
        const errorMessage =
          error instanceof Error
            ? error.message
            : error?.message || error?.errorCode || 'Unknown error';

        logger.error('Failed to create blank document', {
          caseId: args.input.caseId,
          clientId: args.input.clientId,
          fileName: args.input.fileName,
          error: errorMessage,
          errorCode: error?.errorCode,
          statusCode: error?.statusCode,
        });

        return {
          success: false,
          error: errorMessage || 'Eroare la crearea documentului',
        };
      }
    },

    // =========================================================================
    // Privacy Actions (Private-by-Default)
    // =========================================================================

    /**
     * Make a private document public (visible to team).
     * Only the document uploader (Partner/BusinessOwner) can make their documents public.
     */
    markDocumentPublic: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners/BusinessOwners can make documents public
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners can make documents public', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify document exists and user uploaded it
      const document = await prisma.document.findFirst({
        where: {
          id: args.documentId,
          firmId: user.firmId,
          uploadedBy: user.id, // Must be own document
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found or you did not upload this document', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Already public - return as-is
      if (!document.isPrivate) {
        return document;
      }

      // Make public
      const updatedDocument = await prisma.document.update({
        where: { id: args.documentId },
        data: {
          isPrivate: false,
          markedPublicAt: new Date(),
          markedPublicBy: user.id,
        },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
      });

      logger.info('Document made public', {
        documentId: args.documentId,
        userId: user.id,
      });

      // Notify case teams that document was made public
      for (const caseLink of updatedDocument.caseLinks) {
        if (caseLink.case) {
          await caseNotificationService.notifyDocumentMadePublic({
            caseId: caseLink.caseId,
            caseName: caseLink.case.title,
            actorId: user.id,
            actorName: user.name || user.email,
          });
        }
      }

      return updatedDocument;
    },

    /**
     * Make a public document private (hidden from team).
     * Only the document uploader (Partner/BusinessOwner) can make their documents private.
     */
    markDocumentPrivate: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners/BusinessOwners can make documents private
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners can make documents private', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify document exists and user uploaded it
      const document = await prisma.document.findFirst({
        where: {
          id: args.documentId,
          firmId: user.firmId,
          uploadedBy: user.id, // Must be own document
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found or you did not upload this document', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Already private - return as-is
      if (document.isPrivate) {
        return document;
      }

      // Make private
      const updatedDocument = await prisma.document.update({
        where: { id: args.documentId },
        data: {
          isPrivate: true,
          markedPublicAt: null,
          markedPublicBy: null,
        },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            include: {
              case: true,
              linker: true,
            },
          },
        },
      });

      logger.info('Document made private', {
        documentId: args.documentId,
        userId: user.id,
      });

      return updatedDocument;
    },

    /**
     * Make a private email attachment public (visible to team).
     * Only the email owner (Partner/BusinessOwner) can make their attachments public.
     * Attachments can be made public independently of the parent email.
     */
    markAttachmentPublic: async (_: any, args: { attachmentId: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners/BusinessOwners can make attachments public
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners can make attachments public', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify attachment exists and user owns the email
      const attachment = await prisma.emailAttachment.findFirst({
        where: {
          id: args.attachmentId,
          email: {
            firmId: user.firmId,
            userId: user.id, // Must own the parent email
          },
        },
        include: { email: true },
      });

      if (!attachment) {
        throw new GraphQLError('Attachment not found or you do not own this attachment', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Already public - return as-is
      if (!attachment.isPrivate) {
        return attachment;
      }

      // Make public
      const updatedAttachment = await prisma.emailAttachment.update({
        where: { id: args.attachmentId },
        data: {
          isPrivate: false,
          markedPublicAt: new Date(),
          markedPublicBy: user.id,
        },
      });

      logger.info('Email attachment made public', {
        attachmentId: args.attachmentId,
        emailId: attachment.emailId,
        userId: user.id,
      });

      return updatedAttachment;
    },

    /**
     * Set a user-provided description for a document.
     * Useful for scanned documents or files with failed extraction.
     */
    setDocumentDescription: async (
      _: any,
      args: { documentId: string; description: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Verify document exists and user has access
      const document = await prisma.document.findFirst({
        where: {
          id: args.documentId,
          firmId: user.firmId,
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Update with description
      const updatedDocument = await prisma.document.update({
        where: { id: args.documentId },
        data: {
          userDescription: args.description,
          userDescriptionBy: user.id,
          userDescriptionAt: new Date(),
        },
        include: {
          descriptionUser: true,
          caseLinks: {
            select: { caseId: true },
          },
        },
      });

      // Invalidate case context documents for linked cases (import dynamically to avoid circular deps)
      const { caseContextDocumentService } = await import(
        '../../services/case-context-document.service'
      );
      const caseIds = updatedDocument.caseLinks
        .map((link) => link.caseId)
        .filter((id): id is string => id !== null);

      for (const caseId of caseIds) {
        await caseContextDocumentService.invalidate(caseId);
      }

      logger.info('Document description set', {
        documentId: args.documentId,
        userId: user.id,
        descriptionLength: args.description.length,
      });

      return {
        success: true,
        documentId: args.documentId,
        description: args.description,
        describedBy: updatedDocument.descriptionUser,
        describedAt: updatedDocument.userDescriptionAt,
      };
    },

    /**
     * Remove user description from a document.
     */
    removeDocumentDescription: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      // Verify document exists and user has access
      const document = await prisma.document.findFirst({
        where: {
          id: args.documentId,
          firmId: user.firmId,
        },
        select: {
          id: true,
          caseLinks: {
            select: { caseId: true },
          },
        },
      });

      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Clear description
      await prisma.document.update({
        where: { id: args.documentId },
        data: {
          userDescription: null,
          userDescriptionBy: null,
          userDescriptionAt: null,
        },
      });

      // Invalidate case context documents
      const { caseContextDocumentService } = await import(
        '../../services/case-context-document.service'
      );
      const caseIds = document.caseLinks
        .map((link) => link.caseId)
        .filter((id): id is string => id !== null);

      for (const caseId of caseIds) {
        await caseContextDocumentService.invalidate(caseId);
      }

      logger.info('Document description removed', {
        documentId: args.documentId,
        userId: user.id,
      });

      return true;
    },
  },

  // Field resolvers for Document type
  Document: {
    linkedCases: async (parent: any) => {
      const links = await prisma.caseDocument.findMany({
        where: { documentId: parent.id },
        include: {
          case: true,
          linker: true,
        },
      });

      return links.map((link) => ({
        caseId: link.caseId,
        case: link.case,
        linkedBy: link.linker,
        linkedAt: link.linkedAt,
        isOriginal: link.isOriginal,
        // OPS-171: Promotion tracking
        promotedFromAttachment: link.promotedFromAttachment || false,
      }));
    },

    originalCase: async (parent: any) => {
      const originalLink = await prisma.caseDocument.findFirst({
        where: {
          documentId: parent.id,
          isOriginal: true,
        },
        include: {
          case: true,
        },
      });

      return originalLink?.case || null;
    },

    uploadedBy: async (parent: any) => {
      if (parent.uploader) return parent.uploader;

      // OPS-045: Return placeholder if user was deleted
      const user = await prisma.user.findUnique({
        where: { id: parent.uploadedBy },
      });
      return user || (await getDeletedUserPlaceholder(parent.uploadedBy));
    },

    client: async (parent: any) => {
      if (parent.client) return parent.client;

      return prisma.client.findUnique({
        where: { id: parent.clientId },
      });
    },

    // Story 2.9: OneDrive field resolvers

    // Versions
    versions: async (parent: any) => {
      if (parent.versions) return parent.versions;

      return prisma.documentVersion.findMany({
        where: { documentId: parent.id },
        include: {
          creator: true,
        },
        orderBy: { versionNumber: 'desc' },
      });
    },

    // OPS-176: Version count for UI display (badge on cards)
    versionCount: async (parent: any) => {
      // If versions are already loaded, use their length
      if (parent.versions) return parent.versions.length;
      // If versionCount is already computed (e.g., from grid query), use it
      if (typeof parent._versionCount === 'number') return parent._versionCount;

      // Otherwise, count from database
      return prisma.documentVersion.count({
        where: { documentId: parent.id },
      });
    },

    // Download URL is computed via mutation, return null for field resolver
    // Clients should use getDocumentDownloadUrl mutation for fresh URLs
    downloadUrl: async () => {
      // Download URLs expire quickly, so we don't compute them eagerly
      // Use getDocumentDownloadUrl mutation instead
      return null;
    },

    // Thumbnail URL is computed via mutation, return null for field resolver
    thumbnailUrl: async () => {
      // Thumbnails require OneDrive access token
      // Use getDocumentThumbnail query instead if needed
      return null;
    },

    // OPS-107: Storage type computed from which IDs are present
    storageType: (parent: any) => {
      if (parent.sharePointItemId) {
        return 'SHAREPOINT';
      }
      if (parent.oneDriveId) {
        return 'ONEDRIVE';
      }
      if (parent.storagePath) {
        return 'R2';
      }
      // Default to R2 if no storage identifiers
      return 'R2';
    },

    // OPS-107: SharePoint fields (direct passthrough from DB)
    sharePointItemId: (parent: any) => parent.sharePointItemId || null,
    sharePointPath: (parent: any) => parent.sharePointPath || null,

    // OPS-114: Permanent thumbnail URLs from R2 (no auth required)
    // These are stored in the database after background generation
    thumbnailSmall: (parent: any) => parent.thumbnailSmallUrl || null,
    thumbnailMedium: (parent: any) => parent.thumbnailMediumUrl || null,
    thumbnailLarge: (parent: any) => parent.thumbnailLargeUrl || null,

    // OPS-114: Thumbnail generation status
    thumbnailStatus: (parent: any) => parent.thumbnailStatus || 'PENDING',

    // OPS-171: Source type - detect email attachments for older documents
    sourceType: async (parent: any) => {
      // If sourceType is already set to something other than UPLOAD, use it
      if (parent.sourceType && parent.sourceType !== 'UPLOAD') {
        return parent.sourceType;
      }

      // For UPLOAD or missing sourceType, check if this document came from an email attachment
      // This handles older documents created before sourceType was added
      const emailAttachment = await prisma.emailAttachment.findFirst({
        where: { documentId: parent.id },
        select: { id: true },
      });

      if (emailAttachment) {
        return 'EMAIL_ATTACHMENT';
      }

      return parent.sourceType || 'UPLOAD';
    },

    // OPS-171: Reviewer for document review workflow
    reviewer: async (parent: any) => {
      if (!parent.reviewerId) return null;
      if (parent.reviewer) return parent.reviewer;

      const user = await prisma.user.findUnique({
        where: { id: parent.reviewerId },
      });
      return user || (await getDeletedUserPlaceholder(parent.reviewerId));
    },

    // OPS-171: Submitted at timestamp for review workflow
    submittedAt: (parent: any) => parent.submittedAt || null,

    // Email attachment sender info - lookup from original email
    senderName: async (parent: any) => {
      // Only resolve for email attachments
      const sourceType = parent.sourceType;
      if (sourceType && sourceType !== 'EMAIL_ATTACHMENT' && sourceType !== 'UPLOAD') {
        return null;
      }

      // Find email attachment linked to this document
      const attachment = await prisma.emailAttachment.findFirst({
        where: { documentId: parent.id },
        include: {
          email: {
            select: {
              from: true,
            },
          },
        },
      });

      if (!attachment?.email?.from) return null;
      // The 'from' field is JSON with shape { name?: string, address: string }
      const from = attachment.email.from as { name?: string; address: string };
      return from.name || null;
    },

    senderEmail: async (parent: any) => {
      // Only resolve for email attachments
      const sourceType = parent.sourceType;
      if (sourceType && sourceType !== 'EMAIL_ATTACHMENT' && sourceType !== 'UPLOAD') {
        return null;
      }

      // Find email attachment linked to this document
      const attachment = await prisma.emailAttachment.findFirst({
        where: { documentId: parent.id },
        include: {
          email: {
            select: {
              from: true,
            },
          },
        },
      });

      if (!attachment?.email?.from) return null;
      // The 'from' field is JSON with shape { name?: string, address: string }
      const from = attachment.email.from as { name?: string; address: string };
      return from.address || null;
    },

    // User description fields for scans
    userDescriptionBy: async (parent: any) => {
      if (parent.descriptionUser) return parent.descriptionUser;
      if (!parent.userDescriptionBy) return null;

      const user = await prisma.user.findUnique({
        where: { id: parent.userDescriptionBy },
      });
      return user || (await getDeletedUserPlaceholder(parent.userDescriptionBy));
    },

    // Computed field: whether this document needs a user description
    needsDescription: (parent: any) => {
      // Needs description if:
      // - Extraction failed or not attempted (NONE, FAILED, UNSUPPORTED)
      // - AND no user description exists
      const needsExtraction =
        !parent.extractionStatus ||
        parent.extractionStatus === 'NONE' ||
        parent.extractionStatus === 'FAILED' ||
        parent.extractionStatus === 'UNSUPPORTED';

      return needsExtraction && !parent.userDescription;
    },
  },

  // Field resolvers for DocumentVersion type
  DocumentVersion: {
    createdBy: async (parent: any) => {
      if (parent.creator) return parent.creator;

      // OPS-045: Return placeholder if user was deleted
      const user = await prisma.user.findUnique({
        where: { id: parent.createdBy },
      });
      return user || (await getDeletedUserPlaceholder(parent.createdBy));
    },
  },

  // Field resolvers for DocumentAuditLog type
  DocumentAuditLog: {
    user: async (parent: any) => {
      if (parent.user) return parent.user;

      // OPS-045: Return placeholder if user was deleted
      const user = await prisma.user.findUnique({
        where: { id: parent.userId },
      });
      return user || (await getDeletedUserPlaceholder(parent.userId));
    },
  },
};

export default documentResolvers;
