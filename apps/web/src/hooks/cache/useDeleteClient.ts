/**
 * useDeleteClient Hook
 *
 * Hook for deleting clients with proper cache invalidation.
 * Evicts the client from cache and refetches client lists.
 *
 * @example
 * const { deleteMutation, loading, error } = useDeleteClient({
 *   onSuccess: () => {
 *     toast.success('Clientul a fost șters');
 *     onClose();
 *   },
 * });
 *
 * await deleteMutation(clientId);
 */

import { DELETE_CLIENT } from '@/graphql/mutations';
import { useDeleteMutation } from './useDeleteMutation';

// ============================================================================
// Types
// ============================================================================

export interface DeleteClientData {
  deleteClient: {
    id: string;
    name: string;
    caseCount: number;
  } | null;
}

export interface UseDeleteClientOptions {
  /** Callback when deletion succeeds */
  onSuccess?: () => void;
  /** Callback when deletion fails */
  onError?: (error: Error) => void;
}

export interface UseDeleteClientResult {
  /** Execute the delete mutation */
  deleteMutation: (id: string) => Promise<boolean>;
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

export function useDeleteClient(options: UseDeleteClientOptions = {}): UseDeleteClientResult {
  const { onSuccess, onError } = options;

  const { deleteMutation, loading, error, resetError } = useDeleteMutation<DeleteClientData>({
    mutation: DELETE_CLIENT,
    entityType: 'Client',
    onSuccess: () => onSuccess?.(),
    onError,
    getResultData: (data) => data.deleteClient,
    refetchRelated: true, // Also refetch case queries since deleting client affects cases
  });

  return {
    deleteMutation,
    loading,
    error,
    resetError,
  };
}
