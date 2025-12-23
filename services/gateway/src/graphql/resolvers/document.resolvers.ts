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

      // For imported documents, find the original case
      const result = await Promise.all(
        caseLinks.map(async (link) => {
          let sourceCase = null;

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

          return {
            document: link.document,
            // OPS-045: Return placeholder if linker user was deleted
            linkedBy: link.linker || (await getDeletedUserPlaceholder(link.linkedBy)),
            linkedAt: link.linkedAt,
            isOriginal: link.isOriginal,
            sourceCase,
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

    // Get document preview URL (OPS-087, OPS-109)
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
            });
            return {
              url: previewInfo.url,
              source: previewInfo.source,
              expiresAt: previewInfo.expiresAt,
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
    caseDocumentsGrid: async (
      _: any,
      args: {
        caseId: string;
        first?: number;
        after?: string;
        fileTypes?: string[];
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
    updateDocumentStatus: async (
      _: any,
      args: { documentId: string; input: { status: 'DRAFT' | 'FINAL' | 'ARCHIVED' } },
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

      const updated = await prisma.$transaction(async (tx) => {
        const updatedDoc = await tx.document.update({
          where: { id: args.documentId },
          data: {
            status: args.input.status,
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
            previousStatus: document.status,
            newStatus: args.input.status,
          },
          firmId: user.firmId,
        });

        return updatedDoc;
      });

      return updated;
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
