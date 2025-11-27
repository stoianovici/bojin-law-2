/**
 * Client Documents Query Hook
 * Story 2.8.4: Cross-Case Document Linking
 *
 * Fetches all documents for a client (for import modal)
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// GraphQL query for fetching client documents grouped by case
const GET_CLIENT_DOCUMENTS_GROUPED = gql`
  query GetClientDocumentsGrouped(
    $clientId: UUID!
    $excludeCaseId: UUID
    $search: String
  ) {
    clientDocumentsGroupedByCase(
      clientId: $clientId
      excludeCaseId: $excludeCaseId
      search: $search
    ) {
      case {
        id
        caseNumber
        title
        status
      }
      documents {
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
        linkedCases {
          caseId
          case {
            id
            caseNumber
            title
          }
          linkedAt
          isOriginal
        }
      }
      documentCount
    }
  }
`;

// Flat query for client documents
const GET_CLIENT_DOCUMENTS = gql`
  query GetClientDocuments(
    $clientId: UUID!
    $excludeCaseId: UUID
    $search: String
    $fileTypes: [String!]
  ) {
    clientDocuments(
      clientId: $clientId
      excludeCaseId: $excludeCaseId
      search: $search
      fileTypes: $fileTypes
    ) {
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
      linkedCases {
        caseId
        case {
          id
          caseNumber
          title
        }
        linkedAt
        isOriginal
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

export interface LinkedCase {
  caseId: string;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  };
  linkedAt: string;
  isOriginal: boolean;
}

export interface ClientDocument {
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
  linkedCases: LinkedCase[];
}

export interface DocumentsByCase {
  case: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
  } | null;
  documents: ClientDocument[];
  documentCount: number;
}

interface UseClientDocumentsVariables {
  clientId: string;
  excludeCaseId?: string;
  search?: string;
  fileTypes?: string[];
}

interface UseClientDocumentsGroupedResult {
  documentsByCase: DocumentsByCase[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

interface UseClientDocumentsResult {
  documents: ClientDocument[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch client documents grouped by source case
 * @param clientId - Client ID (UUID)
 * @param excludeCaseId - Optional case ID to exclude already-linked documents
 * @param search - Optional search term
 * @returns Documents grouped by case, loading state, error, and refetch function
 */
export function useClientDocumentsGrouped(
  clientId: string,
  excludeCaseId?: string,
  search?: string
): UseClientDocumentsGroupedResult {
  const { data, loading, error, refetch } = useQuery<
    { clientDocumentsGroupedByCase: DocumentsByCase[] }
  >(GET_CLIENT_DOCUMENTS_GROUPED, {
    variables: { clientId, excludeCaseId, search },
    fetchPolicy: 'cache-and-network',
    skip: !clientId,
  });

  return {
    documentsByCase: data?.clientDocumentsGroupedByCase || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}

/**
 * Hook to fetch client documents (flat list)
 * @param params - Query parameters
 * @returns Documents, loading state, error, and refetch function
 */
export function useClientDocuments(
  params: UseClientDocumentsVariables
): UseClientDocumentsResult {
  const { data, loading, error, refetch } = useQuery<
    { clientDocuments: ClientDocument[] }
  >(GET_CLIENT_DOCUMENTS, {
    variables: params,
    fetchPolicy: 'cache-and-network',
    skip: !params.clientId,
  });

  return {
    documents: data?.clientDocuments || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
