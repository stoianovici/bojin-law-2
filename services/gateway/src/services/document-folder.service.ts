/**
 * Document Folder Service
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Manages document folder hierarchy within cases.
 * Folders are case-specific and support unlimited nesting depth.
 */

import { prisma } from '@legal-platform/database';
import { UserRole } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

interface CreateFolderInput {
  name: string;
  caseId: string;
  parentId?: string | null;
}

interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  order?: number;
}

interface MoveDocumentInput {
  caseDocumentId: string;
  folderId?: string | null;
}

interface ReorderInput {
  folderId: string;
  newOrder: number;
}

// ============================================================================
// Service
// ============================================================================

export class DocumentFolderService {
  /**
   * Get folder tree for a case
   * Returns all folders with nested structure and root documents
   */
  async getCaseFolderTree(caseId: string, userContext: UserContext) {
    await this.validateCaseAccess(caseId, userContext);

    // Get all folders for the case
    const folders = await prisma.documentFolder.findMany({
      where: {
        caseId,
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

    // Get root-level documents (documents without a folder)
    const rootDocuments = await prisma.caseDocument.findMany({
      where: {
        caseId,
        firmId: userContext.firmId,
        folderId: null,
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
      rootDocuments: this.mapCaseDocuments(rootDocuments),
      rootDocumentCount: rootDocuments.length,
    };
  }

  /**
   * Get all folders for a case (flat list)
   */
  async getCaseFolders(caseId: string, userContext: UserContext) {
    await this.validateCaseAccess(caseId, userContext);

    return prisma.documentFolder.findMany({
      where: {
        caseId,
        firmId: userContext.firmId,
      },
      include: {
        documents: true,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get folder contents
   */
  async getFolderContents(folderId: string, userContext: UserContext) {
    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: {
        case: true,
        parent: true,
        children: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
        documents: {
          include: {
            document: true,
            linker: true,
          },
          orderBy: { linkedAt: 'desc' },
        },
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.firmId !== userContext.firmId) {
      throw new Error('Access denied');
    }

    await this.validateCaseAccess(folder.caseId, userContext);

    return folder;
  }

  /**
   * Get folder by ID
   */
  async getFolder(folderId: string, userContext: UserContext) {
    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: {
        case: true,
        parent: true,
        children: true,
        documents: {
          include: {
            document: true,
            linker: true,
          },
        },
      },
    });

    if (!folder) {
      return null;
    }

    if (folder.firmId !== userContext.firmId) {
      throw new Error('Access denied');
    }

    await this.validateCaseAccess(folder.caseId, userContext);

    return folder;
  }

  /**
   * Create a new folder
   */
  async createFolder(input: CreateFolderInput, userContext: UserContext) {
    await this.validateCaseAccess(input.caseId, userContext);

    // Validate parent folder if provided
    if (input.parentId) {
      const parentFolder = await prisma.documentFolder.findUnique({
        where: { id: input.parentId },
      });

      if (!parentFolder) {
        throw new Error('Parent folder not found');
      }

      if (parentFolder.caseId !== input.caseId) {
        throw new Error('Parent folder must be in the same case');
      }
    }

    // Get max order for sibling folders
    const maxOrder = await prisma.documentFolder.aggregate({
      where: {
        caseId: input.caseId,
        parentId: input.parentId || null,
      },
      _max: { order: true },
    });

    const folder = await prisma.documentFolder.create({
      data: {
        name: input.name,
        caseId: input.caseId,
        parentId: input.parentId || null,
        order: (maxOrder._max.order ?? -1) + 1,
        firmId: userContext.firmId,
      },
      include: {
        case: true,
        parent: true,
        children: true,
        documents: true,
      },
    });

    return folder;
  }

  /**
   * Update folder properties
   */
  async updateFolder(folderId: string, input: UpdateFolderInput, userContext: UserContext) {
    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.firmId !== userContext.firmId) {
      throw new Error('Access denied');
    }

    await this.validateCaseAccess(folder.caseId, userContext);

    // Validate new parent if changing
    if (input.parentId !== undefined) {
      // Prevent moving folder into itself or its descendants
      if (input.parentId === folderId) {
        throw new Error('Cannot move folder into itself');
      }

      if (input.parentId) {
        const newParent = await prisma.documentFolder.findUnique({
          where: { id: input.parentId },
        });

        if (!newParent) {
          throw new Error('New parent folder not found');
        }

        if (newParent.caseId !== folder.caseId) {
          throw new Error('Cannot move folder to a different case');
        }

        // Check if new parent is a descendant of this folder
        const isDescendant = await this.isDescendantOf(input.parentId, folderId);
        if (isDescendant) {
          throw new Error('Cannot move folder into its own descendant');
        }
      }
    }

    const updatedFolder = await prisma.documentFolder.update({
      where: { id: folderId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.order !== undefined && { order: input.order }),
      },
      include: {
        case: true,
        parent: true,
        children: true,
        documents: {
          include: {
            document: true,
            linker: true,
          },
        },
      },
    });

    return updatedFolder;
  }

  /**
   * Delete a folder
   * Documents can be moved to parent or deleted
   */
  async deleteFolder(folderId: string, deleteDocuments: boolean, userContext: UserContext) {
    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: {
        documents: true,
        children: true,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.firmId !== userContext.firmId) {
      throw new Error('Access denied');
    }

    await this.validateCaseAccess(folder.caseId, userContext);

    // Handle child folders recursively
    for (const child of folder.children) {
      await this.deleteFolder(child.id, deleteDocuments, userContext);
    }

    if (!deleteDocuments) {
      // Move documents to parent folder (or root if no parent)
      await prisma.caseDocument.updateMany({
        where: { folderId },
        data: { folderId: folder.parentId },
      });
    }
    // If deleteDocuments is true, the cascade will handle it when folder is deleted

    await prisma.documentFolder.delete({
      where: { id: folderId },
    });

    return true;
  }

  /**
   * Move a document to a folder
   */
  async moveDocumentToFolder(input: MoveDocumentInput, userContext: UserContext) {
    const caseDocument = await prisma.caseDocument.findUnique({
      where: { id: input.caseDocumentId },
      include: {
        document: true,
        linker: true,
      },
    });

    if (!caseDocument) {
      throw new Error('Document not found');
    }

    if (caseDocument.firmId !== userContext.firmId) {
      throw new Error('Access denied');
    }

    await this.validateCaseAccess(caseDocument.caseId, userContext);

    // Validate target folder if provided
    if (input.folderId) {
      const folder = await prisma.documentFolder.findUnique({
        where: { id: input.folderId },
      });

      if (!folder) {
        throw new Error('Target folder not found');
      }

      if (folder.caseId !== caseDocument.caseId) {
        throw new Error('Target folder must be in the same case');
      }
    }

    const updated = await prisma.caseDocument.update({
      where: { id: input.caseDocumentId },
      data: { folderId: input.folderId || null },
      include: {
        document: true,
        linker: true,
      },
    });

    return this.mapCaseDocument(updated);
  }

  /**
   * Bulk move documents to a folder
   */
  async bulkMoveDocuments(
    caseDocumentIds: string[],
    folderId: string | null,
    userContext: UserContext
  ) {
    // Validate all documents belong to user's firm and same case
    const documents = await prisma.caseDocument.findMany({
      where: {
        id: { in: caseDocumentIds },
        firmId: userContext.firmId,
      },
    });

    if (documents.length !== caseDocumentIds.length) {
      throw new Error('Some documents not found or access denied');
    }

    const caseIds = new Set(documents.map((d) => d.caseId));
    if (caseIds.size !== 1) {
      throw new Error('All documents must be from the same case');
    }

    const caseId = documents[0].caseId;
    await this.validateCaseAccess(caseId, userContext);

    // Validate target folder if provided
    if (folderId) {
      const folder = await prisma.documentFolder.findUnique({
        where: { id: folderId },
      });

      if (!folder || folder.caseId !== caseId) {
        throw new Error('Target folder not found or not in the same case');
      }
    }

    await prisma.caseDocument.updateMany({
      where: { id: { in: caseDocumentIds } },
      data: { folderId: folderId || null },
    });

    // Return updated documents
    const updated = await prisma.caseDocument.findMany({
      where: { id: { in: caseDocumentIds } },
      include: {
        document: true,
        linker: true,
      },
    });

    return updated.map((d) => this.mapCaseDocument(d));
  }

  /**
   * Reorder folders
   */
  async reorderFolders(inputs: ReorderInput[], userContext: UserContext) {
    // Validate all folders
    const folderIds = inputs.map((i) => i.folderId);
    const folders = await prisma.documentFolder.findMany({
      where: {
        id: { in: folderIds },
        firmId: userContext.firmId,
      },
    });

    if (folders.length !== folderIds.length) {
      throw new Error('Some folders not found or access denied');
    }

    // Update orders in transaction
    await prisma.$transaction(
      inputs.map((input) =>
        prisma.documentFolder.update({
          where: { id: input.folderId },
          data: { order: input.newOrder },
        })
      )
    );

    // Return updated folders
    return prisma.documentFolder.findMany({
      where: { id: { in: folderIds } },
      include: {
        case: true,
        parent: true,
        children: true,
        documents: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Validate user has access to a case
   */
  private async validateCaseAccess(caseId: string, userContext: UserContext): Promise<void> {
    // Partners have access to all cases in their firm
    if (userContext.role === 'Partner') {
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseRecord || caseRecord.firmId !== userContext.firmId) {
        throw new Error('Case not found');
      }

      return;
    }

    // Check if user is assigned to the case
    const assignment = await prisma.caseTeam.findFirst({
      where: {
        caseId,
        userId: userContext.userId,
      },
    });

    if (!assignment) {
      throw new Error('Access denied: Not assigned to this case');
    }
  }

  /**
   * Check if a folder is a descendant of another folder
   */
  private async isDescendantOf(folderId: string, potentialAncestorId: string): Promise<boolean> {
    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      select: { parentId: true },
    });

    if (!folder || !folder.parentId) {
      return false;
    }

    if (folder.parentId === potentialAncestorId) {
      return true;
    }

    return this.isDescendantOf(folder.parentId, potentialAncestorId);
  }

  /**
   * Map case document to response format
   */
  private mapCaseDocument(caseDoc: any) {
    return {
      id: caseDoc.id, // CaseDocument ID for folder operations
      document: caseDoc.document,
      linkedBy: caseDoc.linker,
      linkedAt: caseDoc.linkedAt,
      isOriginal: caseDoc.isOriginal,
      sourceCase: null, // Computed in resolver if needed
    };
  }

  /**
   * Map array of case documents
   */
  private mapCaseDocuments(caseDocs: any[]) {
    return caseDocs.map((d) => this.mapCaseDocument(d));
  }
}

// Export singleton instance
export const documentFolderService = new DocumentFolderService();
