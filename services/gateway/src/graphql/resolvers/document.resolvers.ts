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
import { sharePointService } from '../../services/sharepoint.service';
import { r2StorageService } from '../../services/r2-storage.service';
import { thumbnailService } from '../../services/thumbnail.service';
import { caseSummaryService } from '../../services/case-summary.service';
import { activityEventService } from '../../services/activity-event.service';
import { wordIntegrationService } from '../../services/word-integration.service';
import { queueThumbnailJob } from '../../workers/thumbnail-generation.worker';
import { createSourceCaseDataLoader } from '../dataloaders/document.dataloaders';
import logger from '../../utils/logger';

// Extended Context type that includes accessToken for OneDrive operations
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
    accessToken?: string; // Story 5.1: MS access token for email/OneDrive operations
  };
  accessToken?: string; // Deprecated: use context.user.accessToken instead
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

// Helper to check if user can access a case
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  if (!caseData || caseData.firmId !== user.firmId) return false;

  // Partners and BusinessOwners can access all cases in their firm
  // Story 2.11.1: Added BusinessOwner role support
  if (user.role === 'Partner' || user.role === 'BusinessOwner') return true;

  // Non-partners must be assigned to the case
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

  // Partners and BusinessOwners can access all client documents
  // Story 2.11.1: Added BusinessOwner role support
  if (user.role === 'Partner' || user.role === 'BusinessOwner') return true;

  // Non-partners must be assigned to at least one case for this client
  const assignment = await prisma.caseTeam.findFirst({
    where: {
      userId: user.id,
      case: {
        clientId,
      },
    },
  });

  return !!assignment;
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
// OPS-172: Document Status Transition Validation
// ============================================================================

type DocumentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'PENDING'
  | 'FINAL'
  | 'ARCHIVED';

// Defines which status transitions are allowed
// DRAFT -> IN_REVIEW: Submit for supervisor review
// DRAFT -> ARCHIVED: Archive without review
// IN_REVIEW -> CHANGES_REQUESTED: Supervisor requests modifications
// IN_REVIEW -> FINAL: Supervisor approves
// IN_REVIEW -> DRAFT: Withdrawn from review
// CHANGES_REQUESTED -> DRAFT: Author addresses feedback
// CHANGES_REQUESTED -> IN_REVIEW: Resubmit after changes
// CHANGES_REQUESTED -> ARCHIVED: Abandon changes
// PENDING -> DRAFT/FINAL/ARCHIVED: Legacy processing states
// FINAL -> ARCHIVED: Archive finalized document
// ARCHIVED -> DRAFT: Restore to draft
const ALLOWED_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['CHANGES_REQUESTED', 'FINAL', 'DRAFT'],
  CHANGES_REQUESTED: ['DRAFT', 'IN_REVIEW', 'ARCHIVED'],
  PENDING: ['DRAFT', 'FINAL', 'ARCHIVED'],
  FINAL: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
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
    IN_REVIEW: 'În revizuire',
    CHANGES_REQUESTED: 'Modificări solicitate',
    PENDING: 'În așteptare',
    FINAL: 'Final',
    ARCHIVED: 'Arhivat',
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
      };

      // Exclude documents already linked to a case
      if (args.excludeCaseId) {
        const linkedDocIds = await prisma.caseDocument.findMany({
          where: { caseId: args.excludeCaseId },
          select: { documentId: true },
        });
        where.id = { notIn: linkedDocIds.map((d) => d.documentId) };
      }

      // Search filter
      if (args.search) {
        where.OR = [
          { fileName: { contains: args.search, mode: 'insensitive' } },
          { metadata: { path: ['description'], string_contains: args.search } },
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

      // Search filter
      if (args.search) {
        where.OR = [{ fileName: { contains: args.search, mode: 'insensitive' } }];
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
    caseDocuments: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to access this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const caseLinks = await prisma.caseDocument.findMany({
        where: { caseId: args.caseId },
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
      const seenDocs = new Map<string, typeof caseLinks[0]>();
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

    // OPS-174: Supervisor Review Queue - Get documents pending review by current user
    documentsForReview: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      // Only supervisors can access review queue
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        throw new GraphQLError('Only supervisors can access the review queue', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Note: We check for 'Associate' here because SENIOR_ASSOCIATE is stored as 'Associate'
      // in the database but with an additional flag. For now, we allow all Associates to
      // view reviews assigned to them, which is the correct behavior.

      // Find documents where current user is the reviewer and status is IN_REVIEW
      const documents = await prisma.document.findMany({
        where: {
          reviewerId: user.id,
          status: 'IN_REVIEW',
          firmId: user.firmId,
        },
        include: {
          uploader: true,
          client: true,
          caseLinks: {
            where: { isOriginal: true },
            include: {
              case: {
                include: {
                  client: true,
                },
              },
            },
            take: 1, // Only need the original case
          },
        },
        orderBy: { submittedAt: 'asc' }, // FIFO - oldest first
      });

      // Transform to DocumentForReview format
      return documents
        .filter((doc) => doc.caseLinks.length > 0) // Only documents linked to a case
        .map((doc) => ({
          id: doc.id,
          document: {
            ...doc,
            // Include thumbnail URLs from database
            thumbnailSmall: doc.thumbnailSmallUrl || null,
            thumbnailMedium: doc.thumbnailMediumUrl || null,
            thumbnailLarge: doc.thumbnailLargeUrl || null,
          },
          case: doc.caseLinks[0].case,
          submittedBy: doc.uploader,
          submittedAt: doc.submittedAt || doc.uploadedAt, // Fallback to uploadedAt if submittedAt null
        }));
    },

    // OPS-174: Supervisor Review Queue - Get count of documents pending review
    documentsForReviewCount: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      // Only supervisors can access review queue
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        // Return 0 for non-supervisors instead of error (for conditional UI)
        return 0;
      }

      // Count documents where current user is the reviewer and status is IN_REVIEW
      return prisma.document.count({
        where: {
          reviewerId: user.id,
          status: 'IN_REVIEW',
          firmId: user.firmId,
        },
      });
    },

    // OPS-177: Get list of supervisors for reviewer picker
    supervisors: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      // Get all users with supervisor roles in the firm
      // Partners can review anyone's work, Associates can be assigned as reviewers too
      const supervisors = await prisma.user.findMany({
        where: {
          firmId: user.firmId,
          role: {
            in: ['Partner', 'Associate'],
          },
          status: 'Active', // Only active users
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }], // Partners first, then alphabetical
      });

      // Transform to Supervisor type
      return supervisors.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        email: s.email,
        role: s.role,
        initials: `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase(),
      }));
    },

    // OPS-177: Preview review feedback email before sending
    previewReviewFeedbackEmail: async (
      _: any,
      args: {
        input: {
          documentId: string;
          recipientEmail: string;
          recipientName: string;
          feedback: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { documentId, recipientEmail, recipientName, feedback } = args.input;

      // Get document and case info
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: {
            include: { case: true },
            take: 1,
          },
        },
      });

      if (!document) {
        throw new GraphQLError('Documentul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const caseName = document.caseLinks[0]?.case?.title || 'Dosar necunoscut';

      // Get reviewer's full name from their user record
      const reviewerUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { firstName: true, lastName: true },
      });
      const fullReviewerName = reviewerUser
        ? `${reviewerUser.firstName} ${reviewerUser.lastName}`
        : user.email.split('@')[0];

      // Generate preview
      return {
        subject: `Modificări solicitate: ${document.fileName}`,
        body: `Bună ${recipientName},

${fullReviewerName} a revizuit documentul și solicită modificări:

Document: ${document.fileName}
Dosar: ${caseName}

Feedback:
${feedback}

---
Acest email a fost trimis automat din platforma Legal.`,
        to: recipientEmail,
        toName: recipientName,
      };
    },
  },

  Mutation: {
    // Upload a new document
    uploadDocument: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      // Verify user has access to the case
      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized to upload to this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get case to extract client
      const caseData = await prisma.case.findUnique({
        where: { id: args.input.caseId },
        select: { clientId: true, firmId: true },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Create document in transaction
      const document = await prisma.$transaction(async (tx) => {
        // Create the document (owned by client)
        const newDocument = await tx.document.create({
          data: {
            clientId: caseData.clientId,
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

        // Create case-document link with isOriginal=true
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
          },
          firmId: user.firmId,
        });

        return newDocument;
      });

      // OPS-047: Mark summary stale
      caseSummaryService.markSummaryStale(args.input.caseId).catch(() => {});

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
    // OPS-177: Review Workflow Mutations
    // ==========================================================================

    // Submit a document for supervisor review
    submitForReview: async (
      _: any,
      args: { input: { documentId: string; reviewerId: string; message?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { documentId, reviewerId, message } = args.input;

      // 1. Validate document exists and user has access
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: true,
          uploader: true,
        },
      });

      if (!document) {
        return { success: false, error: 'Documentul nu a fost găsit', document: null };
      }

      if (document.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!(await canAccessDocument(documentId, user))) {
        throw new GraphQLError('Not authorized to access this document', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // 2. Validate document is in submittable status
      if (!['DRAFT', 'CHANGES_REQUESTED'].includes(document.status)) {
        return {
          success: false,
          error: 'Documentul nu poate fi trimis pentru revizuire în starea curentă',
          document: null,
        };
      }

      // 3. Validate reviewer exists and is a supervisor
      const reviewer = await prisma.user.findUnique({
        where: { id: reviewerId },
      });

      if (!reviewer) {
        return { success: false, error: 'Supervizorul nu a fost găsit', document: null };
      }

      if (reviewer.firmId !== user.firmId) {
        return {
          success: false,
          error: 'Supervizorul nu face parte din firma dumneavoastră',
          document: null,
        };
      }

      if (!['Partner', 'Associate'].includes(reviewer.role)) {
        return {
          success: false,
          error: 'Doar partenerii sau asociații pot fi selectați ca revizuitori',
          document: null,
        };
      }

      // 4. Update document in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: documentId },
          data: {
            status: 'IN_REVIEW',
            reviewerId,
            submittedAt: new Date(),
            metadata: {
              ...(document.metadata as Record<string, any>),
              reviewSubmissionMessage: message || null,
              submittedBy: user.id,
              submittedByEmail: user.email,
              // Note: submittedByName needs to be fetched from DB since context doesn't have firstName/lastName
              submittedByName: user.email.split('@')[0], // Fallback to email prefix
            },
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
            action: 'SUBMITTED_FOR_REVIEW',
            reviewerId,
            reviewerEmail: reviewer.email,
            message: message || null,
            previousStatus: document.status,
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      logger.info('Document submitted for review', {
        documentId,
        reviewerId,
        submittedBy: user.id,
        previousStatus: document.status,
      });

      // TODO: Send notification to reviewer (future enhancement)

      return { success: true, document: updated, error: null };
    },

    // Make a review decision (approve or request changes)
    reviewDocument: async (
      _: any,
      args: {
        input: {
          documentId: string;
          decision: 'APPROVE' | 'REQUEST_CHANGES';
          comment?: string;
          assignToUserId?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { documentId, decision, comment, assignToUserId } = args.input;

      // 1. Validate document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: true,
          uploader: true,
        },
      });

      if (!document) {
        return { success: false, error: 'Documentul nu a fost găsit', document: null };
      }

      // 2. Validate document is in review
      if (document.status !== 'IN_REVIEW') {
        return {
          success: false,
          error: 'Documentul nu este în curs de revizuire',
          document: null,
        };
      }

      // 3. Validate current user is the assigned reviewer
      if (document.reviewerId !== user.id) {
        return {
          success: false,
          error: 'Nu sunteți revizuitorul desemnat pentru acest document',
          document: null,
        };
      }

      // 4. Validate comment is provided for changes request
      if (decision === 'REQUEST_CHANGES' && !comment?.trim()) {
        return {
          success: false,
          error: 'Comentariul este obligatoriu când solicitați modificări',
          document: null,
        };
      }

      // 5. Determine new status based on decision
      const newStatus: DocumentStatus = decision === 'APPROVE' ? 'FINAL' : 'CHANGES_REQUESTED';

      // 5.5. Validate assignToUserId if provided
      let assignedToUser: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      } | null = null;
      if (decision === 'REQUEST_CHANGES' && assignToUserId) {
        assignedToUser = await prisma.user.findFirst({
          where: {
            id: assignToUserId,
            firmId: user.firmId,
          },
          select: { id: true, email: true, firstName: true, lastName: true },
        });

        if (!assignedToUser) {
          return {
            success: false,
            error: 'Utilizatorul selectat nu a fost găsit',
            document: null,
          };
        }
      }

      // 6. Update document in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: documentId },
          data: {
            status: newStatus,
            // Clear reviewer if approved; if changes requested, keep original reviewer or assign to new user
            reviewerId: decision === 'APPROVE' ? null : document.reviewerId,
            metadata: {
              ...(document.metadata as Record<string, any>),
              lastReviewDecision: decision,
              lastReviewComment: comment || null,
              lastReviewedAt: new Date().toISOString(),
              lastReviewedBy: user.id,
              lastReviewedByName: user.email,
              // Track who should make the changes (original submitter or assigned user)
              ...(decision === 'REQUEST_CHANGES'
                ? {
                    changesAssignedTo:
                      assignToUserId || (document.metadata as Record<string, any>)?.submittedBy,
                    changesAssignedToName: assignToUserId
                      ? `${assignedToUser?.firstName || ''} ${assignedToUser?.lastName || ''}`.trim() ||
                        assignedToUser?.email
                      : (document.metadata as Record<string, any>)?.submittedByName,
                  }
                : {}),
            },
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
            action: decision === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED',
            decision,
            comment: comment || null,
            previousStatus: 'IN_REVIEW',
            newStatus,
            ...(assignToUserId ? { assignedToUserId: assignToUserId } : {}),
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      logger.info('Document review decision made', {
        documentId,
        decision,
        reviewerId: user.id,
        newStatus,
        ...(assignToUserId ? { assignedToUserId: assignToUserId } : {}),
      });

      // TODO: Send notification to document owner (future enhancement)

      return { success: true, document: updated, error: null };
    },

    // Withdraw a document from review (author can pull it back)
    withdrawFromReview: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);
      const { documentId } = args;

      // 1. Validate document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: true,
        },
      });

      if (!document) {
        return { success: false, error: 'Documentul nu a fost găsit', document: null };
      }

      // 2. Validate document is in review
      if (document.status !== 'IN_REVIEW') {
        return {
          success: false,
          error: 'Documentul nu este în curs de revizuire',
          document: null,
        };
      }

      // 3. Validate current user is the original submitter
      const metadata = document.metadata as Record<string, any>;
      if (metadata?.submittedBy !== user.id) {
        // Also allow partners/business owners to withdraw any document in their firm
        if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
          return {
            success: false,
            error: 'Doar persoana care a trimis documentul la revizuire poate să îl retragă',
            document: null,
          };
        }
      }

      // 4. Update document in transaction
      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: documentId },
          data: {
            status: 'DRAFT',
            reviewerId: null,
            submittedAt: null,
            metadata: {
              ...metadata,
              withdrawnAt: new Date().toISOString(),
              withdrawnBy: user.id,
            },
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
            action: 'WITHDRAWN_FROM_REVIEW',
            previousStatus: 'IN_REVIEW',
            previousReviewerId: document.reviewerId,
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      logger.info('Document withdrawn from review', {
        documentId,
        withdrawnBy: user.id,
        previousReviewerId: document.reviewerId,
      });

      return { success: true, document: updated, error: null };
    },

    // OPS-177: Send review feedback email
    sendReviewFeedbackEmail: async (
      _: any,
      args: {
        input: {
          documentId: string;
          recipientEmail: string;
          recipientName: string;
          feedback: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { documentId, recipientEmail, recipientName, feedback } = args.input;

      // Validate access token for email sending
      if (!context.user?.accessToken) {
        return {
          success: false,
          error: 'Token de acces lipsă pentru trimiterea email-ului',
        };
      }

      // Get document and case info
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          caseLinks: {
            include: { case: true },
            take: 1,
          },
        },
      });

      if (!document) {
        return { success: false, error: 'Documentul nu a fost găsit' };
      }

      const caseName = document.caseLinks[0]?.case?.title || 'Dosar necunoscut';
      const caseId = document.caseLinks[0]?.caseId;

      // Get reviewer's full name
      const reviewerUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { firstName: true, lastName: true },
      });
      const fullReviewerName = reviewerUser
        ? `${reviewerUser.firstName} ${reviewerUser.lastName}`
        : user.email.split('@')[0];

      // Build document URL
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const documentUrl = caseId
        ? `${baseUrl}/cases/${caseId}/documents?preview=${documentId}`
        : `${baseUrl}/documents?preview=${documentId}`;

      // Import and call the email service
      const { sendReviewFeedbackEmail } = await import('../../services/email.service');

      try {
        const success = await sendReviewFeedbackEmail(
          {
            to: recipientEmail,
            toName: recipientName,
            documentName: document.fileName,
            caseName,
            reviewerName: fullReviewerName,
            feedback,
            documentUrl,
          },
          context.user.accessToken
        );

        if (success) {
          logger.info('Review feedback email sent', {
            documentId,
            recipientEmail,
            reviewerId: user.id,
          });
          return { success: true, error: null };
        } else {
          return { success: false, error: 'Eroare la trimiterea email-ului' };
        }
      } catch (error) {
        logger.error('Failed to send review feedback email', {
          documentId,
          recipientEmail,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return { success: false, error: 'Eroare la trimiterea email-ului' };
      }
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
