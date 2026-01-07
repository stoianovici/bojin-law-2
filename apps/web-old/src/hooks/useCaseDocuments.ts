/**
 * Case Documents Query Hook
 * Story 2.8.4: Cross-Case Document Linking
 * Story 2.9: Document Storage with OneDrive Integration
 *
 * Fetches documents linked to a specific case
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// GraphQL query for fetching case documents
const GET_CASE_DOCUMENTS = gql`
  query GetCaseDocuments($caseId: UUID!) {
    caseDocuments(caseId: $caseId) {
      id
      document {
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
        # Story 2.9: OneDrive fields
        oneDriveId
        oneDrivePath
        status
        versions {
          id
          versionNumber
          changesSummary
          createdAt
          createdBy {
            id
            firstName
            lastName
          }
        }
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
  }
`;

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

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  changesSummary: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type DocumentStatus = 'DRAFT' | 'FINAL' | 'ARCHIVED';

export interface CaseDocumentData {
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
  // Story 2.9: OneDrive fields
  oneDriveId: string | null;
  oneDrivePath: string | null;
  status: DocumentStatus;
  versions: DocumentVersion[];
}

export interface CaseDocumentWithContext {
  id: string; // CaseDocument ID (join table)
  document: CaseDocumentData;
  linkedBy: DocumentUser;
  linkedAt: string;
  isOriginal: boolean;
  sourceCase: DocumentSource | null;
}

interface UseCaseDocumentsResult {
  documents: CaseDocumentWithContext[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

interface UseCaseDocumentsOptions {
  // OPS-229: Skip query when not in list view (lazy loading optimization)
  skip?: boolean;
}

/**
 * Hook to fetch documents linked to a case
 * @param caseId - Case ID (UUID)
 * @param options - Query options (skip)
 * @returns Case documents with context, loading state, error, and refetch function
 */
export function useCaseDocuments(
  caseId: string,
  options: UseCaseDocumentsOptions = {}
): UseCaseDocumentsResult {
  const { skip = false } = options;

  const { data, loading, error, refetch } = useQuery<{ caseDocuments: CaseDocumentWithContext[] }>(
    GET_CASE_DOCUMENTS,
    {
      variables: { caseId },
      fetchPolicy: 'cache-and-network',
      // OPS-229: Skip query when not in list view or caseId is missing
      skip: !caseId || skip,
    }
  );

  // OPS-229: Also consider as loading if query should run but we have no data yet
  // This fixes a race condition on initial mount where loading=false before query starts
  const queryIsSkipped = !caseId || skip;
  const effectiveLoading = loading || (!queryIsSkipped && !data && !error);

  return {
    documents: data?.caseDocuments || [],
    loading: effectiveLoading,
    error: error as Error | undefined,
    refetch,
  };
}
