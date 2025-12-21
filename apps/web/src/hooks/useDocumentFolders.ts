/**
 * useDocumentFolders Hook
 * OPS-089: /documents Section with Case Navigation and Folder Structure
 *
 * Provides folder tree data for a case, including nested folder hierarchy
 * and root-level documents.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const DOCUMENT_FIELDS_FRAGMENT = gql`
  fragment DocumentFieldsForFolder on Document {
    id
    fileName
    fileType
    fileSize
    storagePath
    uploadedAt
    status
    thumbnailUrl
    downloadUrl
  }
`;

const FOLDER_FIELDS_FRAGMENT = gql`
  fragment FolderFields on DocumentFolder {
    id
    name
    caseId
    parentId
    order
    documentCount
    createdAt
    updatedAt
  }
`;

const CASE_DOCUMENT_CONTEXT_FRAGMENT = gql`
  ${DOCUMENT_FIELDS_FRAGMENT}
  fragment CaseDocumentContextForFolder on CaseDocumentWithContext {
    id
    document {
      ...DocumentFieldsForFolder
    }
    linkedBy {
      id
      firstName
      lastName
    }
    linkedAt
    isOriginal
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_CASE_FOLDER_TREE = gql`
  ${FOLDER_FIELDS_FRAGMENT}
  ${CASE_DOCUMENT_CONTEXT_FRAGMENT}
  query GetCaseFolderTree($caseId: UUID!) {
    caseFolderTree(caseId: $caseId) {
      folders {
        ...FolderFields
        children {
          ...FolderFields
          children {
            ...FolderFields
            children {
              ...FolderFields
            }
          }
        }
      }
      totalDocuments
      rootDocuments {
        ...CaseDocumentContextForFolder
      }
      rootDocumentCount
    }
  }
`;

const GET_CASE_FOLDERS = gql`
  ${FOLDER_FIELDS_FRAGMENT}
  query GetCaseFolders($caseId: UUID!) {
    caseFolders(caseId: $caseId) {
      ...FolderFields
    }
  }
`;

const GET_FOLDER_CONTENTS = gql`
  ${FOLDER_FIELDS_FRAGMENT}
  ${CASE_DOCUMENT_CONTEXT_FRAGMENT}
  query GetFolderContents($folderId: UUID!) {
    folderContents(folderId: $folderId) {
      ...FolderFields
      children {
        ...FolderFields
      }
      documents {
        ...CaseDocumentContextForFolder
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface DocumentInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
  status: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
}

export interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CaseDocumentContext {
  id: string; // CaseDocument ID for folder operations
  document: DocumentInfo;
  linkedBy: UserInfo;
  linkedAt: string;
  isOriginal: boolean;
}

export interface FolderInfo {
  id: string;
  name: string;
  caseId: string;
  parentId: string | null;
  order: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
  children?: FolderInfo[];
  documents?: CaseDocumentContext[];
}

export interface FolderTree {
  folders: FolderInfo[];
  totalDocuments: number;
  rootDocuments: CaseDocumentContext[];
  rootDocumentCount: number;
}

// ============================================================================
// Query Response Types
// ============================================================================

interface CaseFolderTreeResponse {
  caseFolderTree: FolderTree;
}

interface CaseFoldersResponse {
  caseFolders: FolderInfo[];
}

interface FolderContentsResponse {
  folderContents: FolderInfo;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch folder tree for a case
 */
export function useCaseFolderTree(caseId: string | null) {
  const { data, loading, error, refetch } = useQuery<CaseFolderTreeResponse>(GET_CASE_FOLDER_TREE, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    folderTree: data?.caseFolderTree,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch flat list of folders for a case (useful for dropdowns)
 */
export function useCaseFolders(caseId: string | null) {
  const { data, loading, error, refetch } = useQuery<CaseFoldersResponse>(GET_CASE_FOLDERS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    folders: data?.caseFolders ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch contents of a specific folder
 */
export function useFolderContents(folderId: string | null) {
  const { data, loading, error, refetch } = useQuery<FolderContentsResponse>(GET_FOLDER_CONTENTS, {
    variables: { folderId },
    skip: !folderId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    folder: data?.folderContents,
    loading,
    error,
    refetch,
  };
}
