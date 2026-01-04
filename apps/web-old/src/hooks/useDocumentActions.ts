/**
 * Document Actions Mutation Hooks
 * Story 2.8.4: Cross-Case Document Linking
 *
 * Provides hooks for document linking, unlinking, and deletion
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';

// Link documents to case mutation
const LINK_DOCUMENTS_TO_CASE = gql`
  mutation LinkDocumentsToCase($input: LinkDocumentsInput!) {
    linkDocumentsToCase(input: $input) {
      id
      fileName
      fileType
      linkedCases {
        caseId
        case {
          id
          caseNumber
          title
        }
      }
    }
  }
`;

// Unlink document from case mutation
const UNLINK_DOCUMENT_FROM_CASE = gql`
  mutation UnlinkDocumentFromCase($caseId: UUID!, $documentId: UUID!) {
    unlinkDocumentFromCase(caseId: $caseId, documentId: $documentId)
  }
`;

// Permanently delete document mutation
const PERMANENTLY_DELETE_DOCUMENT = gql`
  mutation PermanentlyDeleteDocument($documentId: UUID!) {
    permanentlyDeleteDocument(documentId: $documentId)
  }
`;

// Upload document mutation
const UPLOAD_DOCUMENT = gql`
  mutation UploadDocument($input: UploadDocumentInput!) {
    uploadDocument(input: $input) {
      id
      fileName
      fileType
      fileSize
      storagePath
      uploadedAt
      uploadedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

// OPS-228: Withdraw document from review mutation
const WITHDRAW_FROM_REVIEW = gql`
  mutation WithdrawFromReview($documentId: ID!) {
    withdrawFromReview(documentId: $documentId) {
      success
      message
      document {
        id
        status
      }
    }
  }
`;

export interface LinkDocumentsInput {
  caseId: string;
  documentIds: string[];
}

export interface UploadDocumentInput {
  caseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  metadata?: Record<string, unknown>;
}

interface UseLinkDocumentsResult {
  linkDocuments: (input: LinkDocumentsInput) => Promise<void>;
  loading: boolean;
  error?: Error;
}

interface UseUnlinkDocumentResult {
  unlinkDocument: (caseId: string, documentId: string) => Promise<void>;
  loading: boolean;
  error?: Error;
}

interface UseDeleteDocumentResult {
  deleteDocument: (documentId: string) => Promise<void>;
  loading: boolean;
  error?: Error;
}

interface UseUploadDocumentResult {
  uploadDocument: (input: UploadDocumentInput) => Promise<any>;
  loading: boolean;
  error?: Error;
}

// OPS-228: Withdraw from review result interface
interface UseWithdrawFromReviewResult {
  withdrawFromReview: (documentId: string) => Promise<{ success: boolean; message?: string }>;
  loading: boolean;
  error?: Error;
}

/**
 * Hook to link documents to a case
 */
export function useLinkDocuments(): UseLinkDocumentsResult {
  const [mutate, { loading, error }] = useMutation(LINK_DOCUMENTS_TO_CASE);

  const linkDocuments = async (input: LinkDocumentsInput) => {
    await mutate({
      variables: { input },
      refetchQueries: ['GetCaseDocuments', 'GetClientDocumentsGrouped'],
    });
  };

  return {
    linkDocuments,
    loading,
    error: error as Error | undefined,
  };
}

/**
 * Hook to unlink a document from a case
 */
export function useUnlinkDocument(): UseUnlinkDocumentResult {
  const [mutate, { loading, error }] = useMutation(UNLINK_DOCUMENT_FROM_CASE);

  const unlinkDocument = async (caseId: string, documentId: string) => {
    await mutate({
      variables: { caseId, documentId },
      refetchQueries: ['GetCaseDocuments'],
    });
  };

  return {
    unlinkDocument,
    loading,
    error: error as Error | undefined,
  };
}

/**
 * Hook to permanently delete a document (Partners only)
 */
export function useDeleteDocument(): UseDeleteDocumentResult {
  const [mutate, { loading, error }] = useMutation(PERMANENTLY_DELETE_DOCUMENT);

  const deleteDocument = async (documentId: string) => {
    await mutate({
      variables: { documentId },
      refetchQueries: ['GetCaseDocuments', 'GetClientDocumentsGrouped'],
    });
  };

  return {
    deleteDocument,
    loading,
    error: error as Error | undefined,
  };
}

/**
 * Hook to upload a document
 */
export function useUploadDocument(): UseUploadDocumentResult {
  const [mutate, { loading, error }] = useMutation<{ uploadDocument: any }>(UPLOAD_DOCUMENT);

  const uploadDocument = async (input: UploadDocumentInput) => {
    const result = await mutate({
      variables: { input },
      refetchQueries: ['GetCaseDocuments'],
    });
    return result.data?.uploadDocument;
  };

  return {
    uploadDocument,
    loading,
    error: error as Error | undefined,
  };
}

/**
 * OPS-228: Hook to withdraw a document from review
 * Allows the author to retract their review request
 */
export function useWithdrawFromReview(): UseWithdrawFromReviewResult {
  const [mutate, { loading, error }] = useMutation<{
    withdrawFromReview: {
      success: boolean;
      message?: string;
      document?: { id: string; status: string };
    };
  }>(WITHDRAW_FROM_REVIEW);

  const withdrawFromReview = async (documentId: string) => {
    const result = await mutate({
      variables: { documentId },
      refetchQueries: ['GetCaseDocuments', 'GetCaseDocumentsGrid'],
    });
    return {
      success: result.data?.withdrawFromReview?.success ?? false,
      message: result.data?.withdrawFromReview?.message,
    };
  };

  return {
    withdrawFromReview,
    loading,
    error: error as Error | undefined,
  };
}
