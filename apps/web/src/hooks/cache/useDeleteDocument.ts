/**
 * useDeleteDocument Hook
 *
 * Hook for permanently deleting documents with proper cache invalidation.
 * Evicts the document from cache and refetches document lists.
 *
 * @example
 * const { deleteMutation, loading, error } = useDeleteDocument({
 *   onSuccess: () => {
 *     toast.success('Documentul a fost șters');
 *     onClose();
 *   },
 * });
 *
 * await deleteMutation(documentId);
 */

import { PERMANENTLY_DELETE_DOCUMENT } from '@/graphql/mutations';
import { useDeleteMutation } from './useDeleteMutation';

// ============================================================================
// Types
// ============================================================================

export interface DeleteDocumentData {
  permanentlyDeleteDocument: boolean;
}

export interface UseDeleteDocumentOptions {
  /** Callback when deletion succeeds */
  onSuccess?: () => void;
  /** Callback when deletion fails */
  onError?: (error: Error) => void;
}

export interface UseDeleteDocumentResult {
  /** Execute the delete mutation */
  deleteMutation: (documentId: string) => Promise<boolean>;
  /** Whether the mutation is in progress */
  loading: boolean;
  /** Error from the last mutation attempt */
  error: Error | null;
  /** Reset the error state */
  resetError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useDeleteDocument(options: UseDeleteDocumentOptions = {}): UseDeleteDocumentResult {
  const { onSuccess, onError } = options;

  const { deleteMutation, loading, error, resetError } = useDeleteMutation<DeleteDocumentData>({
    mutation: PERMANENTLY_DELETE_DOCUMENT,
    entityType: 'Document',
    idVariableName: 'documentId',
    onSuccess: () => onSuccess?.(),
    onError,
    getResultData: (data) => data.permanentlyDeleteDocument,
  });

  return {
    deleteMutation,
    loading,
    error,
    resetError,
  };
}
