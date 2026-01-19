/**
 * useDeleteCase Hook
 *
 * Hook for deleting cases with proper cache invalidation.
 * Evicts the case from cache and refetches case lists.
 *
 * @example
 * const { deleteMutation, loading, error } = useDeleteCase({
 *   onSuccess: () => {
 *     toast.success('Cazul a fost șters');
 *     onClose();
 *   },
 * });
 *
 * await deleteMutation(caseId, { archiveDocuments: true });
 */

import { DELETE_CASE } from '@/graphql/mutations';
import { useDeleteMutation } from './useDeleteMutation';

// ============================================================================
// Types
// ============================================================================

export interface DeleteCaseData {
  deleteCase: {
    id: string;
    status: string;
    closedDate: string | null;
  } | null;
}

export interface UseDeleteCaseOptions {
  /** Callback when deletion succeeds */
  onSuccess?: () => void;
  /** Callback when deletion fails */
  onError?: (error: Error) => void;
}

export interface UseDeleteCaseResult {
  /** Execute the delete mutation */
  deleteMutation: (id: string, options: { archiveDocuments: boolean }) => Promise<boolean>;
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

export function useDeleteCase(options: UseDeleteCaseOptions = {}): UseDeleteCaseResult {
  const { onSuccess, onError } = options;

  const {
    deleteMutation: baseMutation,
    loading,
    error,
    resetError,
  } = useDeleteMutation<DeleteCaseData>({
    mutation: DELETE_CASE,
    entityType: 'Case',
    onSuccess: () => onSuccess?.(),
    onError,
    getResultData: (data) => data.deleteCase,
    refetchRelated: true, // Also refetch client queries since cases affect clients
  });

  // Wrap the base mutation to provide a cleaner API
  const deleteMutation = async (
    id: string,
    { archiveDocuments }: { archiveDocuments: boolean }
  ): Promise<boolean> => {
    return baseMutation(id, { input: { archiveDocuments } });
  };

  return {
    deleteMutation,
    loading,
    error,
    resetError,
  };
}
