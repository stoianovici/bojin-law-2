/**
 * Document Folder Resolvers
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * GraphQL resolvers for document folder management.
 * Supports both case-level and client-level folders.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
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
  caseId?: string;
  clientId?: string;
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
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  return {
    userId: context.user.id,
    firmId: context.user.firmId,
    role: context.user.role as any,
  };
}

/**
 * Validate user has access to a client
 * Partners and BusinessOwners have access to all clients in their firm
 * Associates and Paralegals need to be assigned to at least one case for the client
 */
async function validateClientAccess(
  clientId: string,
  userContext: { userId: string; firmId: string; role: string }
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firmId: true },
  });

  if (!client) {
    throw new GraphQLError('Client not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  if (client.firmId !== userContext.firmId) {
    throw new GraphQLError('Access denied', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  // Partners and BusinessOwners have access to all clients
  if (userContext.role === 'Partner' || userContext.role === 'BusinessOwner') {
    return;
  }

  // Check if user is assigned to any case for this client
  const assignment = await prisma.caseTeam.findFirst({
    where: {
      userId: userContext.userId,
      case: {
        clientId: clientId,
      },
    },
  });

  if (!assignment) {
    throw new GraphQLError('Access denied: Not assigned to any case for this client', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
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
   * Get folder tree for a client (client-level folders, not case-specific)
   */
  clientFolderTree: async (_: unknown, { clientId }: { clientId: string }, context: Context) => {
    const userContext = getUserContext(context);
    await validateClientAccess(clientId, userContext);

    // Get all client-level folders (where caseId is null)
    const folders = await prisma.documentFolder.findMany({
      where: {
        clientId,
        caseId: null,
        firmId: userContext.firmId,
      },
      include: {
        documents: {
          include: {
            document: true,
            linker: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    // Get root-level documents for client inbox (documents in client inbox without folder)
    const rootDocuments = await prisma.caseDocument.findMany({
      where: {
        clientId,
        caseId: null,
        folderId: null,
        firmId: userContext.firmId,
      },
      include: {
        document: true,
        linker: true,
      },
      orderBy: { linkedAt: 'desc' },
    });

    // Build nested tree structure
    const folderMap = new Map(folders.map((f) => [f.id, { ...f, children: [] as any[] }]));
    const rootFolders: any[] = [];

    for (const folder of folderMap.values()) {
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children.push(folder);
      } else {
        rootFolders.push(folder);
      }
    }

    // Count total documents
    const totalDocuments =
      folders.reduce((sum, f) => sum + f.documents.length, 0) + rootDocuments.length;

    return {
      folders: rootFolders,
      totalDocuments,
      rootDocuments: rootDocuments.map((cd) => ({
        id: cd.id,
        document: cd.document,
        linkedBy: cd.linker,
        linkedAt: cd.linkedAt,
        isOriginal: cd.isOriginal,
        sourceCase: null,
      })),
      rootDocumentCount: rootDocuments.length,
    };
  },

  /**
   * Get all folders for a client (flat list, client-level only)
   */
  clientFolders: async (_: unknown, { clientId }: { clientId: string }, context: Context) => {
    const userContext = getUserContext(context);
    await validateClientAccess(clientId, userContext);

    return prisma.documentFolder.findMany({
      where: {
        clientId,
        caseId: null,
        firmId: userContext.firmId,
      },
      include: {
        documents: true,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
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
   * Accepts either caseId OR clientId (not both)
   */
  createFolder: async (_: unknown, { input }: { input: CreateFolderInput }, context: Context) => {
    const userContext = getUserContext(context);
    const { name, caseId, clientId, parentId } = input;

    // Validation: exactly one of caseId or clientId must be provided
    if (caseId && clientId) {
      throw new GraphQLError('Cannot provide both caseId and clientId. Provide exactly one.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (!caseId && !clientId) {
      throw new GraphQLError('Must provide either caseId or clientId', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Case-level folder: delegate to existing service
    if (caseId) {
      return documentFolderService.createFolder({ name, caseId, parentId }, userContext);
    }

    // Client-level folder: handle directly in resolver
    await validateClientAccess(clientId!, userContext);

    // Validate parent folder if provided
    if (parentId) {
      const parentFolder = await prisma.documentFolder.findUnique({
        where: { id: parentId },
      });

      if (!parentFolder) {
        throw new GraphQLError('Parent folder not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Parent must be a client-level folder for the same client
      if (parentFolder.clientId !== clientId || parentFolder.caseId !== null) {
        throw new GraphQLError('Parent folder must be a client-level folder for the same client', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    // Get max order for sibling folders
    const maxOrder = await prisma.documentFolder.aggregate({
      where: {
        clientId,
        caseId: null,
        parentId: parentId || null,
      },
      _max: { order: true },
    });

    const folder = await prisma.documentFolder.create({
      data: {
        name,
        clientId,
        caseId: null,
        parentId: parentId || null,
        order: (maxOrder._max.order ?? -1) + 1,
        firmId: userContext.firmId,
      },
      include: {
        client: true,
        parent: true,
        children: true,
        documents: true,
      },
    });

    return folder;
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
     * Resolve case relation (null for client-level folders)
     */
    case: async (folder: { caseId: string | null }) => {
      if (!folder.caseId) return null;
      return prisma.case.findUnique({
        where: { id: folder.caseId },
      });
    },

    /**
     * Resolve client relation (null for case-level folders)
     */
    client: async (folder: { clientId: string | null; client?: any }) => {
      // Return already loaded client if present
      if (folder.client) return folder.client;
      if (!folder.clientId) return null;
      return prisma.client.findUnique({
        where: { id: folder.clientId },
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
        id: cd.id,
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
