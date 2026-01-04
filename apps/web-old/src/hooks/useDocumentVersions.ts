/**
 * Document Versions React Hook
 * OPS-176: Document Version History Drawer
 *
 * Provides hook for fetching document version history
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_DOCUMENT_VERSIONS = gql`
  query GetDocumentVersions($documentId: ID!) {
    documentVersions(documentId: $documentId) {
      id
      versionNumber
      createdAt
      createdBy {
        id
        firstName
        lastName
        avatar
      }
      changesSummary
      fileSize
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface DocumentVersionUser {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: DocumentVersionUser;
  changesSummary?: string | null;
  fileSize?: number | null;
}

interface GetDocumentVersionsData {
  documentVersions: DocumentVersion[];
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching document version history
 * Used by DocumentVersionDrawer to display version timeline
 */
export function useDocumentVersions(documentId: string | null) {
  const { data, loading, error, refetch } = useQuery<GetDocumentVersionsData>(
    GET_DOCUMENT_VERSIONS,
    {
      variables: { documentId },
      skip: !documentId,
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    versions: data?.documentVersions ?? [],
    versionCount: data?.documentVersions?.length ?? 0,
    loading,
    error,
    refetch,
  };
}
