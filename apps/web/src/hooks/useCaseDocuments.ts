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

/**
 * Hook to fetch documents linked to a case
 * @param caseId - Case ID (UUID)
 * @returns Case documents with context, loading state, error, and refetch function
 */
export function useCaseDocuments(caseId: string): UseCaseDocumentsResult {
  const { data, loading, error, refetch } = useQuery<{ caseDocuments: CaseDocumentWithContext[] }>(
    GET_CASE_DOCUMENTS,
    {
      variables: { caseId },
      fetchPolicy: 'cache-and-network',
      skip: !caseId,
    }
  );

  return {
    documents: data?.caseDocuments || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
