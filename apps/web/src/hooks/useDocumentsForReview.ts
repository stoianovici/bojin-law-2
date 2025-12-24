/**
 * Documents For Review Hook
 * OPS-174: Supervisor Review Queue Tab
 *
 * Fetches documents pending review by the current user.
 * Only accessible by supervisors (Partner, Senior Associate).
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_DOCUMENTS_FOR_REVIEW = gql`
  query GetDocumentsForReview {
    documentsForReview {
      id
      document {
        id
        fileName
        fileType
        fileSize
        status
        sourceType
        thumbnailSmall
        thumbnailMedium
        uploadedAt
        uploadedBy {
          id
          firstName
          lastName
        }
      }
      case {
        id
        caseNumber
        title
        client {
          id
          name
        }
      }
      submittedBy {
        id
        firstName
        lastName
        email
      }
      submittedAt
    }
  }
`;

const GET_DOCUMENTS_FOR_REVIEW_COUNT = gql`
  query GetDocumentsForReviewCount {
    documentsForReviewCount
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface ReviewDocumentUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface ReviewDocumentCase {
  id: string;
  caseNumber: string;
  title: string;
  client: {
    id: string;
    name: string;
  };
}

export interface ReviewDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  sourceType: string;
  thumbnailSmall: string | null;
  thumbnailMedium: string | null;
  uploadedAt: string;
  uploadedBy: ReviewDocumentUser;
}

export interface DocumentForReview {
  id: string;
  document: ReviewDocument;
  case: ReviewDocumentCase;
  submittedBy: ReviewDocumentUser;
  submittedAt: string;
}

// Grouped by case for UI display
export interface ReviewQueueByCase {
  case: ReviewDocumentCase;
  documents: DocumentForReview[];
}

interface UseDocumentsForReviewResult {
  documents: DocumentForReview[];
  documentsByCase: ReviewQueueByCase[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

interface UseDocumentsForReviewCountResult {
  count: number;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch documents pending review by the current user
 * @returns Documents grouped by case, loading state, and refetch function
 */
export function useDocumentsForReview(): UseDocumentsForReviewResult {
  const { data, loading, error, refetch } = useQuery<{
    documentsForReview: DocumentForReview[];
  }>(GET_DOCUMENTS_FOR_REVIEW, {
    fetchPolicy: 'cache-and-network',
  });

  const documents = data?.documentsForReview ?? [];

  // Group documents by case for UI display
  const documentsByCase = documents.reduce<ReviewQueueByCase[]>(
    (acc: ReviewQueueByCase[], item: DocumentForReview) => {
      const existingCase = acc.find((group: ReviewQueueByCase) => group.case.id === item.case.id);
      if (existingCase) {
        existingCase.documents.push(item);
      } else {
        acc.push({
          case: item.case,
          documents: [item],
        });
      }
      return acc;
    },
    []
  );

  return {
    documents,
    documentsByCase,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}

/**
 * Hook to fetch count of documents pending review
 * Used for displaying badge on the review tab
 * @returns Count, loading state, and refetch function
 */
export function useDocumentsForReviewCount(): UseDocumentsForReviewCountResult {
  const { data, loading, error, refetch } = useQuery<{
    documentsForReviewCount: number;
  }>(GET_DOCUMENTS_FOR_REVIEW_COUNT, {
    fetchPolicy: 'cache-and-network',
    // Poll every 60 seconds to keep count fresh
    pollInterval: 60000,
  });

  return {
    count: data?.documentsForReviewCount ?? 0,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
