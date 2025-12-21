/**
 * useFolderActions Hook
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Provides mutations for folder management: create, update, delete, move documents.
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Mutations
// ============================================================================

const CREATE_FOLDER = gql`
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
      id
      name
      caseId
      parentId
      order
      documentCount
      createdAt
    }
  }
`;

const UPDATE_FOLDER = gql`
  mutation UpdateFolder($id: UUID!, $input: UpdateFolderInput!) {
    updateFolder(id: $id, input: $input) {
      id
      name
      parentId
      order
      updatedAt
    }
  }
`;

const DELETE_FOLDER = gql`
  mutation DeleteFolder($id: UUID!, $deleteDocuments: Boolean) {
    deleteFolder(id: $id, deleteDocuments: $deleteDocuments)
  }
`;

const MOVE_DOCUMENT_TO_FOLDER = gql`
  mutation MoveDocumentToFolder($input: MoveDocumentToFolderInput!) {
    moveDocumentToFolder(input: $input) {
      document {
        id
        fileName
      }
      linkedAt
      isOriginal
    }
  }
`;

const BULK_MOVE_DOCUMENTS = gql`
  mutation BulkMoveDocumentsToFolder($input: BulkMoveDocumentsInput!) {
    bulkMoveDocumentsToFolder(input: $input) {
      document {
        id
        fileName
      }
    }
  }
`;

const REORDER_FOLDERS = gql`
  mutation ReorderFolders($input: [ReorderFoldersInput!]!) {
    reorderFolders(input: $input) {
      id
      order
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface CreateFolderInput {
  name: string;
  caseId: string;
  parentId?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  order?: number;
}

export interface MoveDocumentInput {
  caseDocumentId: string;
  folderId?: string | null;
}

export interface ReorderInput {
  folderId: string;
  newOrder: number;
}

// Mutation response types
interface FolderData {
  id: string;
  name: string;
  caseId: string;
  parentId: string | null;
  order: number;
}

interface CreateFolderResponse {
  createFolder: FolderData;
}

interface UpdateFolderResponse {
  updateFolder: FolderData;
}

interface DeleteFolderResponse {
  deleteFolder: boolean;
}

interface MoveDocumentResponse {
  moveDocumentToFolder: {
    document: { id: string; fileName: string };
    linkedAt: string;
    isOriginal: boolean;
  };
}

interface BulkMoveResponse {
  bulkMoveDocumentsToFolder: Array<{
    document: { id: string; fileName: string };
  }>;
}

interface ReorderResponse {
  reorderFolders: Array<{ id: string; order: number }>;
}

// ============================================================================
// Hook
// ============================================================================

export function useFolderActions() {
  const [createFolderMutation, { loading: creating }] =
    useMutation<CreateFolderResponse>(CREATE_FOLDER);
  const [updateFolderMutation, { loading: updating }] =
    useMutation<UpdateFolderResponse>(UPDATE_FOLDER);
  const [deleteFolderMutation, { loading: deleting }] =
    useMutation<DeleteFolderResponse>(DELETE_FOLDER);
  const [moveDocumentMutation, { loading: movingDocument }] =
    useMutation<MoveDocumentResponse>(MOVE_DOCUMENT_TO_FOLDER);
  const [bulkMoveMutation, { loading: bulkMoving }] =
    useMutation<BulkMoveResponse>(BULK_MOVE_DOCUMENTS);
  const [reorderMutation, { loading: reordering }] = useMutation<ReorderResponse>(REORDER_FOLDERS);

  /**
   * Create a new folder
   */
  const createFolder = useCallback(
    async (input: CreateFolderInput) => {
      const result = await createFolderMutation({
        variables: { input },
        refetchQueries: ['GetCaseFolderTree', 'GetCaseFolders'],
      });
      return result.data?.createFolder;
    },
    [createFolderMutation]
  );

  /**
   * Rename a folder
   */
  const renameFolder = useCallback(
    async (id: string, name: string) => {
      const result = await updateFolderMutation({
        variables: { id, input: { name } },
        refetchQueries: ['GetCaseFolderTree', 'GetCaseFolders'],
      });
      return result.data?.updateFolder;
    },
    [updateFolderMutation]
  );

  /**
   * Move a folder to a new parent
   */
  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      const result = await updateFolderMutation({
        variables: { id, input: { parentId } },
        refetchQueries: ['GetCaseFolderTree', 'GetCaseFolders'],
      });
      return result.data?.updateFolder;
    },
    [updateFolderMutation]
  );

  /**
   * Delete a folder
   */
  const deleteFolder = useCallback(
    async (id: string, deleteDocuments = false) => {
      const result = await deleteFolderMutation({
        variables: { id, deleteDocuments },
        refetchQueries: ['GetCaseFolderTree', 'GetCaseFolders'],
      });
      return result.data?.deleteFolder;
    },
    [deleteFolderMutation]
  );

  /**
   * Move a document to a folder (or root)
   */
  const moveDocumentToFolder = useCallback(
    async (caseDocumentId: string, folderId: string | null) => {
      const result = await moveDocumentMutation({
        variables: { input: { caseDocumentId, folderId } },
        refetchQueries: ['GetCaseFolderTree', 'GetFolderContents'],
      });
      return result.data?.moveDocumentToFolder;
    },
    [moveDocumentMutation]
  );

  /**
   * Bulk move multiple documents to a folder
   */
  const bulkMoveDocuments = useCallback(
    async (caseDocumentIds: string[], folderId: string | null) => {
      const result = await bulkMoveMutation({
        variables: { input: { caseDocumentIds, folderId } },
        refetchQueries: ['GetCaseFolderTree', 'GetFolderContents'],
      });
      return result.data?.bulkMoveDocumentsToFolder;
    },
    [bulkMoveMutation]
  );

  /**
   * Reorder folders
   */
  const reorderFolders = useCallback(
    async (orders: ReorderInput[]) => {
      const result = await reorderMutation({
        variables: { input: orders },
        refetchQueries: ['GetCaseFolderTree', 'GetCaseFolders'],
      });
      return result.data?.reorderFolders;
    },
    [reorderMutation]
  );

  return {
    // Actions
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveDocumentToFolder,
    bulkMoveDocuments,
    reorderFolders,

    // Loading states
    loading: creating || updating || deleting || movingDocument || bulkMoving || reordering,
    creating,
    updating,
    deleting,
    movingDocument,
    bulkMoving,
    reordering,
  };
}
