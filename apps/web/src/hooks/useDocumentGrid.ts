/**
 * Document Grid Query Hook
 * OPS-111: Document Grid UI with Thumbnails
 * OPS-173: Added sourceTypes filter for document separation tabs
 *
 * Fetches documents with thumbnails for grid view display
 * Uses caseDocumentsGrid query with pagination support
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const DOCUMENT_GRID_FIELDS = gql`
  fragment DocumentGridFields on Document {
    id
    clientId
    firmId
    fileName
    fileType
    fileSize
    storagePath
    uploadedAt
    metadata
    uploadedBy {
      id
      firstName
      lastName
      email
    }
    client {
      id
      name
    }
    # Storage type for display
    storageType
    sharePointItemId
    oneDriveId
    # Thumbnails for grid view
    thumbnailSmall
    thumbnailMedium
    thumbnailLarge
    # Status
    status
    # OPS-173: Source type for tab filtering
    sourceType
    # Download URL for PDF preview
    downloadUrl
    # OPS-176: Version count for version history badge
    versionCount
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_CASE_DOCUMENTS_GRID = gql`
  ${DOCUMENT_GRID_FIELDS}
  query GetCaseDocumentsGrid(
    $caseId: UUID!
    $first: Int
    $after: String
    $fileTypes: [String!]
    $sourceTypes: [DocumentSourceType!]
    $includePromotedAttachments: Boolean
    $sortBy: DocumentSortField
    $sortDirection: SortDirection
  ) {
    caseDocumentsGrid(
      caseId: $caseId
      first: $first
      after: $after
      fileTypes: $fileTypes
      sourceTypes: $sourceTypes
      includePromotedAttachments: $includePromotedAttachments
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      edges {
        node {
          id
          document {
            ...DocumentGridFields
          }
          linkedBy {
            id
            firstName
            lastName
            email
          }
          linkedAt
          isOriginal
          sourceCase {
            id
            caseNumber
            title
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface DocumentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DocumentClient {
  id: string;
  name: string;
}

export interface DocumentSource {
  id: string;
  caseNumber: string;
  title: string;
}

export type DocumentStatus = 'DRAFT' | 'PENDING' | 'FINAL' | 'ARCHIVED';
export type DocumentStorageType = 'ONEDRIVE' | 'SHAREPOINT' | 'R2';
// OPS-173: Document source type for tab filtering
export type DocumentSourceType = 'UPLOAD' | 'EMAIL_ATTACHMENT' | 'AI_GENERATED' | 'TEMPLATE';
export type DocumentSortField =
  | 'LINKED_AT'
  | 'UPLOADED_AT'
  | 'FILE_NAME'
  | 'FILE_SIZE'
  | 'FILE_TYPE';
export type SortDirection = 'ASC' | 'DESC';

export interface DocumentGridData {
  id: string;
  clientId: string;
  firmId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
  metadata: Record<string, unknown>;
  uploadedBy: DocumentUser;
  client: DocumentClient;
  // Storage
  storageType: DocumentStorageType;
  sharePointItemId: string | null;
  oneDriveId: string | null;
  // Thumbnails
  thumbnailSmall: string | null;
  thumbnailMedium: string | null;
  thumbnailLarge: string | null;
  // Status
  status: DocumentStatus;
  // OPS-173: Source type for tab filtering
  sourceType: DocumentSourceType;
  // Download URL for PDF preview
  downloadUrl: string | null;
  // OPS-176: Version count for version history badge
  versionCount: number;
}

export interface DocumentGridItem {
  id: string;
  document: DocumentGridData;
  linkedBy: DocumentUser;
  linkedAt: string;
  isOriginal: boolean;
  sourceCase: DocumentSource | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface DocumentGridConnection {
  edges: Array<{
    node: DocumentGridItem;
    cursor: string;
  }>;
  pageInfo: PageInfo;
  totalCount: number;
}

interface UseDocumentGridOptions {
  first?: number;
  fileTypes?: string[];
  // OPS-173: Source types filter for document separation tabs
  sourceTypes?: DocumentSourceType[];
  // OPS-173: Include promoted attachments (for working docs tab)
  includePromotedAttachments?: boolean;
  sortBy?: DocumentSortField;
  sortDirection?: SortDirection;
}

interface UseDocumentGridResult {
  documents: DocumentGridItem[];
  loading: boolean;
  error?: Error;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to fetch documents for grid view with thumbnails
 * @param caseId - Case ID (UUID)
 * @param options - Query options (pagination, filtering, sorting)
 * @returns Documents with thumbnails, pagination helpers, and loading state
 */
export function useDocumentGrid(
  caseId: string,
  options: UseDocumentGridOptions = {}
): UseDocumentGridResult {
  const {
    first = 20,
    fileTypes,
    // OPS-173: Source types for document tab filtering
    sourceTypes,
    includePromotedAttachments,
    sortBy = 'LINKED_AT',
    sortDirection = 'DESC',
  } = options;

  const { data, loading, error, fetchMore, refetch } = useQuery<{
    caseDocumentsGrid: DocumentGridConnection;
  }>(GET_CASE_DOCUMENTS_GRID, {
    variables: {
      caseId,
      first,
      fileTypes,
      sourceTypes,
      includePromotedAttachments,
      sortBy,
      sortDirection,
    },
    fetchPolicy: 'cache-and-network',
    skip: !caseId,
  });

  const loadMore = useCallback(() => {
    if (!data?.caseDocumentsGrid.pageInfo.hasNextPage) return;

    fetchMore({
      variables: {
        after: data.caseDocumentsGrid.pageInfo.endCursor,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;

        return {
          caseDocumentsGrid: {
            ...fetchMoreResult.caseDocumentsGrid,
            edges: [...prev.caseDocumentsGrid.edges, ...fetchMoreResult.caseDocumentsGrid.edges],
          },
        };
      },
    });
  }, [data, fetchMore]);

  const documents = data?.caseDocumentsGrid.edges.map((edge) => edge.node) ?? [];
  const totalCount = data?.caseDocumentsGrid.totalCount ?? 0;
  const hasMore = data?.caseDocumentsGrid.pageInfo.hasNextPage ?? false;

  return {
    documents,
    loading,
    error: error as Error | undefined,
    totalCount,
    hasMore,
    loadMore,
    refetch,
  };
}
