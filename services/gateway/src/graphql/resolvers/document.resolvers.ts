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
import { r2StorageService } from '../../services/r2-storage.service';
import { thumbnailService } from '../../services/thumbnail.service';
import { caseSummaryService } from '../../services/case-summary.service';
import logger from '../../utils/logger';

// Extended Context type that includes accessToken for OneDrive operations
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
  accessToken?: string; // OAuth access token for Microsoft Graph API
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

    // Get document thumbnail (Story 2.9 AC5)
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

      // For OneDrive documents, use OneDrive thumbnail endpoint
      if (document.oneDriveId) {
        const accessToken = context.accessToken;
        if (!accessToken) {
          throw new GraphQLError('Access token required for thumbnail generation', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

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

      // For local files without OneDrive ID, thumbnail generation would
      // require fetching the file from storage - return null for now
      // This could be enhanced to support local storage thumbnails
      return null;
    },

    // Get document preview URL (OPS-087)
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

      // File types that can be previewed directly in browser (PDFs and images)
      const browserPreviewableTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      // Try OneDrive preview first (supports Office docs + PDFs + images)
      if (document.oneDriveId) {
        const accessToken = context.accessToken;
        if (!accessToken) {
          throw new GraphQLError('Access token required for preview generation', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const previewInfo = await oneDriveService.getPreviewUrl(
          accessToken,
          document.oneDriveId,
          document.fileType
        );

        if (previewInfo) {
          return {
            url: previewInfo.url,
            source: previewInfo.source,
            expiresAt: previewInfo.expiresAt,
          };
        }
      }

      // Fallback to R2 presigned URL for browser-previewable types (PDF, images)
      if (browserPreviewableTypes.includes(document.fileType) && document.storagePath) {
        const presignedUrl = await r2StorageService.getPresignedUrl(document.storagePath);
        if (presignedUrl) {
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
      }

      logger.debug('Preview not available for document', {
        documentId: args.documentId,
        fileType: document.fileType,
        hasOneDriveId: !!document.oneDriveId,
        hasStoragePath: !!document.storagePath,
      });
      return null;
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

    // Get temporary download URL for a document
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
