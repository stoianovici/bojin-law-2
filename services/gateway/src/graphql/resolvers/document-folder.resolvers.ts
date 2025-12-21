/**
 * Document Folder Resolvers
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * GraphQL resolvers for document folder management.
 */

import { prisma } from '@legal-platform/database';
import { documentFolderService } from '../../services/document-folder.service';

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

interface CreateFolderInput {
  name: string;
  caseId: string;
  parentId?: string;
}

interface UpdateFolderInput {
  name?: string;
  parentId?: string;
  order?: number;
}

interface MoveDocumentToFolderInput {
  caseDocumentId: string;
  folderId?: string;
}

interface BulkMoveDocumentsInput {
  caseDocumentIds: string[];
  folderId?: string;
}

interface ReorderFoldersInput {
  folderId: string;
  newOrder: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUserContext(context: Context) {
  if (!context.user) {
    throw new Error('Authentication required');
  }

  return {
    userId: context.user.id,
    firmId: context.user.firmId,
    role: context.user.role as any,
  };
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const documentFolderQueryResolvers = {
  /**
   * Get folder tree for a case
   */
  caseFolderTree: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const userContext = getUserContext(context);
    return documentFolderService.getCaseFolderTree(caseId, userContext);
  },

  /**
   * Get all folders for a case (flat list)
   */
  caseFolders: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const userContext = getUserContext(context);
    return documentFolderService.getCaseFolders(caseId, userContext);
  },

  /**
   * Get folder contents
   */
  folderContents: async (_: unknown, { folderId }: { folderId: string }, context: Context) => {
    const userContext = getUserContext(context);
    return documentFolderService.getFolderContents(folderId, userContext);
  },

  /**
   * Get folder by ID
   */
  folder: async (_: unknown, { id }: { id: string }, context: Context) => {
    const userContext = getUserContext(context);
    return documentFolderService.getFolder(id, userContext);
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const documentFolderMutationResolvers = {
  /**
   * Create a new folder
   */
  createFolder: async (_: unknown, { input }: { input: CreateFolderInput }, context: Context) => {
    const userContext = getUserContext(context);
    return documentFolderService.createFolder(input, userContext);
  },

  /**
   * Update folder properties
   */
  updateFolder: async (
    _: unknown,
    { id, input }: { id: string; input: UpdateFolderInput },
    context: Context
  ) => {
    const userContext = getUserContext(context);
    return documentFolderService.updateFolder(id, input, userContext);
  },

  /**
   * Delete a folder
   */
  deleteFolder: async (
    _: unknown,
    { id, deleteDocuments }: { id: string; deleteDocuments?: boolean },
    context: Context
  ) => {
    const userContext = getUserContext(context);
    return documentFolderService.deleteFolder(id, deleteDocuments ?? false, userContext);
  },

  /**
   * Move a document to a folder
   */
  moveDocumentToFolder: async (
    _: unknown,
    { input }: { input: MoveDocumentToFolderInput },
    context: Context
  ) => {
    const userContext = getUserContext(context);
    return documentFolderService.moveDocumentToFolder(input, userContext);
  },

  /**
   * Bulk move documents to a folder
   */
  bulkMoveDocumentsToFolder: async (
    _: unknown,
    { input }: { input: BulkMoveDocumentsInput },
    context: Context
  ) => {
    const userContext = getUserContext(context);
    return documentFolderService.bulkMoveDocuments(
      input.caseDocumentIds,
      input.folderId ?? null,
      userContext
    );
  },

  /**
   * Reorder folders
   */
  reorderFolders: async (
    _: unknown,
    { input }: { input: ReorderFoldersInput[] },
    context: Context
  ) => {
    const userContext = getUserContext(context);
    return documentFolderService.reorderFolders(input, userContext);
  },
};

// ============================================================================
// Type Resolvers
// ============================================================================

export const documentFolderTypeResolvers = {
  DocumentFolder: {
    /**
     * Resolve case relation
     */
    case: async (folder: { caseId: string }) => {
      return prisma.case.findUnique({
        where: { id: folder.caseId },
      });
    },

    /**
     * Resolve parent folder relation
     */
    parent: async (folder: { parentId: string | null }) => {
      if (!folder.parentId) return null;
      return prisma.documentFolder.findUnique({
        where: { id: folder.parentId },
      });
    },

    /**
     * Resolve child folders
     */
    children: async (folder: { id: string }) => {
      return prisma.documentFolder.findMany({
        where: { parentId: folder.id },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
    },

    /**
     * Resolve documents in folder
     */
    documents: async (folder: { id: string }) => {
      const caseDocuments = await prisma.caseDocument.findMany({
        where: { folderId: folder.id },
        include: {
          document: true,
          linker: true,
        },
        orderBy: { linkedAt: 'desc' },
      });

      return caseDocuments.map((cd) => ({
        document: cd.document,
        linkedBy: cd.linker,
        linkedAt: cd.linkedAt,
        isOriginal: cd.isOriginal,
        sourceCase: null,
      }));
    },

    /**
     * Count documents in folder
     */
    documentCount: async (folder: { id: string }) => {
      return prisma.caseDocument.count({
        where: { folderId: folder.id },
      });
    },
  },
};
