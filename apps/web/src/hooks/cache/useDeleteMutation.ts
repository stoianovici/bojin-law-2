/**
 * useDeleteMutation Hook
 *
 * A generic hook for handling entity deletions with proper cache invalidation.
 * Automatically evicts the deleted entity from cache and refetches affected list queries.
 *
 * @example
 * const { deleteMutation, loading, error } = useDeleteMutation({
 *   mutation: DELETE_CASE,
 *   entityType: 'Case',
 *   onSuccess: () => console.log('Deleted!'),
 * });
 *
 * // Call with the entity ID and any additional variables
 * await deleteMutation(caseId, { input: { archiveDocuments: true } });
 */

import { useState, useCallback } from 'react';
import { useMutation, useApolloClient } from '@apollo/client/react';
import { type DocumentNode, type FetchResult } from '@apollo/client';
import { type EntityType, getListQueries, getCacheId } from '@/lib/cache';

// ============================================================================
// Types
// ============================================================================

export interface UseDeleteMutationOptions<TData> {
  /** The GraphQL delete mutation */
  mutation: DocumentNode;
  /** The entity type being deleted (for cache management) */
  entityType: EntityType;
  /** Callback when deletion succeeds */
  onSuccess?: (data: TData) => void;
  /** Callback when deletion fails */
  onError?: (error: Error) => void;
  /** Additional queries to refetch after deletion */
  additionalRefetchQueries?: DocumentNode[];
  /** Whether to include related entity queries in refetch (default: false) */
  refetchRelated?: boolean;
  /** Custom variable name for the entity ID (default: 'id') */
  idVariableName?: string;
  /** Extract result data from mutation response (for validation) */
  getResultData?: (data: TData) => unknown;
}

export interface UseDeleteMutationResult {
  /** Execute the delete mutation */
  deleteMutation: (id: string, additionalVariables?: Record<string, unknown>) => Promise<boolean>;
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

export function useDeleteMutation<TData = unknown>(
  options: UseDeleteMutationOptions<TData>
): UseDeleteMutationResult {
  const {
    mutation,
    entityType,
    onSuccess,
    onError,
    additionalRefetchQueries = [],
    refetchRelated = false,
    idVariableName = 'id',
    getResultData,
  } = options;

  const [localError, setLocalError] = useState<Error | null>(null);
  const client = useApolloClient();

  // Get all list queries that should be refetched after deletion
  const refetchQueries = [
    ...getListQueries(entityType, refetchRelated),
    ...additionalRefetchQueries,
  ];

  const [executeMutation, { loading, error: mutationError }] = useMutation<TData>(mutation, {
    // Refetch affected queries to ensure consistency
    refetchQueries: refetchQueries.map((query) => ({ query })),
    // Wait for refetches to complete before returning
    awaitRefetchQueries: true,
  });

  const deleteMutation = useCallback(
    async (id: string, additionalVariables?: Record<string, unknown>): Promise<boolean> => {
      setLocalError(null);

      try {
        const variables = {
          [idVariableName]: id,
          ...additionalVariables,
        };

        const result: FetchResult<TData> = await executeMutation({ variables });

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors[0].message;
          const error = new Error(errorMessage);
          setLocalError(error);
          onError?.(error);
          return false;
        }

        // Validate result data if validator is provided
        if (getResultData && result.data) {
          const resultData = getResultData(result.data);
          if (!resultData) {
            const error = new Error('Deletion returned empty result');
            setLocalError(error);
            onError?.(error);
            return false;
          }
        }

        // Evict the deleted entity from Apollo cache
        // This ensures other components don't show stale cached data
        const cacheId = getCacheId(entityType, id);
        client.cache.evict({ id: cacheId });
        client.cache.gc(); // Garbage collect dangling references

        // Call success handler
        if (result.data) {
          onSuccess?.(result.data);
        }

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setLocalError(error);
        onError?.(error);
        return false;
      }
    },
    [executeMutation, idVariableName, getResultData, onSuccess, onError, client, entityType]
  );

  const resetError = useCallback(() => {
    setLocalError(null);
  }, []);

  // Combine local and mutation errors
  const error = localError || (mutationError ? new Error(mutationError.message) : null);

  return {
    deleteMutation,
    loading,
    error,
    resetError,
  };
}

// ============================================================================
// Type Helpers for Entity-Specific Hooks
// ============================================================================

/**
 * Helper type to create the variables type for a delete mutation
 */
export type DeleteVariables<T extends string = 'id'> = {
  [K in T]: string;
};
