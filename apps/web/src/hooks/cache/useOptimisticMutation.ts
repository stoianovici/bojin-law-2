/**
 * useOptimisticMutation Hook
 *
 * A generic hook for handling mutations with optimistic UI updates.
 * Provides instant UI feedback and handles rollback on errors.
 *
 * Especially useful for:
 * - Privacy toggles (isPrivate field changes)
 * - Status changes
 * - Any state change that should feel instant
 *
 * @example
 * const { mutate, loading, error } = useOptimisticMutation({
 *   mutation: MARK_DOCUMENT_PUBLIC,
 *   entityType: 'Document',
 *   getOptimisticResponse: (variables) => ({
 *     markDocumentPublic: {
 *       __typename: 'Document',
 *       id: variables.documentId,
 *       isPrivate: false,
 *     },
 *   }),
 * });
 *
 * await mutate({ documentId: '123' });
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { type DocumentNode, type FetchResult } from '@apollo/client';
import { type EntityType, getEntityConfig, getListQueries } from '@/lib/cache';

// ============================================================================
// Types
// ============================================================================

export interface UseOptimisticMutationOptions<TData, TVariables> {
  /** The GraphQL mutation */
  mutation: DocumentNode;
  /** The entity type being modified (for cache management) */
  entityType: EntityType;
  /**
   * Generate the optimistic response for instant UI feedback.
   * The response should match the mutation's return shape.
   */
  getOptimisticResponse: (variables: TVariables) => TData;
  /** Callback when mutation succeeds */
  onSuccess?: (data: TData) => void;
  /** Callback when mutation fails */
  onError?: (error: Error) => void;
  /**
   * Whether this mutation affects filtered lists (e.g., privacy changes).
   * If true, will refetch list queries to ensure correct filtering.
   */
  affectsFilteredLists?: boolean;
  /** Additional queries to refetch after the mutation */
  additionalRefetchQueries?: DocumentNode[];
}

export interface UseOptimisticMutationResult<TData, TVariables> {
  /** Execute the mutation with optimistic update */
  mutate: (variables: TVariables) => Promise<TData | null>;
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

export function useOptimisticMutation<TData = unknown, TVariables = Record<string, unknown>>(
  options: UseOptimisticMutationOptions<TData, TVariables>
): UseOptimisticMutationResult<TData, TVariables> {
  const {
    mutation,
    entityType,
    getOptimisticResponse,
    onSuccess,
    onError,
    affectsFilteredLists = false,
    additionalRefetchQueries = [],
  } = options;

  const [localError, setLocalError] = useState<Error | null>(null);

  // Get list queries to refetch if this affects filtered lists
  const refetchQueries = affectsFilteredLists
    ? [...getListQueries(entityType, false), ...additionalRefetchQueries]
    : additionalRefetchQueries;

  const [executeMutation, { loading, error: mutationError }] = useMutation<TData>(mutation, {
    // Refetch affected queries if this changes filtering
    refetchQueries:
      refetchQueries.length > 0 ? refetchQueries.map((query) => ({ query })) : undefined,
    // Don't wait for refetches - the optimistic update provides instant feedback
    awaitRefetchQueries: false,
  });

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      setLocalError(null);

      try {
        // Generate the optimistic response for instant UI
        const optimisticResponse = getOptimisticResponse(variables);

        const result: FetchResult<TData> = await executeMutation({
          variables: variables as Record<string, unknown>,
          optimisticResponse,
        });

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors[0].message;
          const error = new Error(errorMessage);
          setLocalError(error);
          onError?.(error);
          return null;
        }

        // Call success handler
        if (result.data) {
          onSuccess?.(result.data);
        }

        return result.data ?? null;
      } catch (err) {
        // Apollo will automatically roll back the optimistic update on error
        const error = err instanceof Error ? err : new Error(String(err));
        setLocalError(error);
        onError?.(error);
        return null;
      }
    },
    [executeMutation, getOptimisticResponse, onSuccess, onError]
  );

  const resetError = useCallback(() => {
    setLocalError(null);
  }, []);

  // Combine local and mutation errors
  const error = localError || (mutationError ? new Error(mutationError.message) : null);

  return {
    mutate,
    loading,
    error,
    resetError,
  };
}

// ============================================================================
// Privacy Toggle Hook Factory
// ============================================================================

/**
 * Options for creating a privacy toggle hook
 */
export interface CreatePrivacyToggleOptions {
  /** The entity type (Document, Email, etc.) */
  entityType: EntityType;
  /** The mutation to mark as public */
  markPublicMutation: DocumentNode;
  /** The mutation to mark as private */
  markPrivateMutation: DocumentNode;
  /** The typename for the GraphQL response */
  typename: string;
  /** The ID field name in variables (default: 'id') */
  idFieldName?: string;
}

/**
 * Result of a privacy toggle hook
 */
export interface PrivacyToggleResult {
  /** Mark the entity as public (visible to team) */
  markPublic: (id: string) => Promise<boolean>;
  /** Mark the entity as private (hidden from team) */
  markPrivate: (id: string) => Promise<boolean>;
  /** Toggle privacy based on current state */
  togglePrivacy: (id: string, currentlyPrivate: boolean) => Promise<boolean>;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Create a reusable privacy toggle hook for an entity type.
 * This factory function creates hooks like useDocumentPrivacy, useEmailPrivacy, etc.
 */
export function createPrivacyToggleHook(
  options: CreatePrivacyToggleOptions
): () => PrivacyToggleResult {
  const {
    entityType,
    markPublicMutation,
    markPrivateMutation,
    typename,
    idFieldName = 'id',
  } = options;

  // Get the entity config to know the privacy field name
  const config = getEntityConfig(entityType);
  const privacyField = config.privacyField || 'isPrivate';

  return function usePrivacyToggle(): PrivacyToggleResult {
    // Mark as public mutation
    const {
      mutate: executeMarkPublic,
      loading: markingPublic,
      error: markPublicError,
    } = useOptimisticMutation({
      mutation: markPublicMutation,
      entityType,
      getOptimisticResponse: (variables: Record<string, string>) => ({
        [getMutationFieldName(markPublicMutation)]: {
          __typename: typename,
          id: variables[idFieldName],
          [privacyField]: false,
          markedPublicAt: new Date().toISOString(),
        },
      }),
      affectsFilteredLists: true,
    });

    // Mark as private mutation
    const {
      mutate: executeMarkPrivate,
      loading: markingPrivate,
      error: markPrivateError,
    } = useOptimisticMutation({
      mutation: markPrivateMutation,
      entityType,
      getOptimisticResponse: (variables: Record<string, string>) => ({
        [getMutationFieldName(markPrivateMutation)]: {
          __typename: typename,
          id: variables[idFieldName],
          [privacyField]: true,
        },
      }),
      affectsFilteredLists: true,
    });

    const markPublic = useCallback(
      async (id: string): Promise<boolean> => {
        const result = await executeMarkPublic({ [idFieldName]: id });
        return result !== null;
      },
      [executeMarkPublic]
    );

    const markPrivate = useCallback(
      async (id: string): Promise<boolean> => {
        const result = await executeMarkPrivate({ [idFieldName]: id });
        return result !== null;
      },
      [executeMarkPrivate]
    );

    const togglePrivacy = useCallback(
      async (id: string, currentlyPrivate: boolean): Promise<boolean> => {
        if (currentlyPrivate) {
          return markPublic(id);
        }
        return markPrivate(id);
      },
      [markPublic, markPrivate]
    );

    return {
      markPublic,
      markPrivate,
      togglePrivacy,
      loading: markingPublic || markingPrivate,
      error: markPublicError || markPrivateError,
    };
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract the mutation field name from a DocumentNode
 */
function getMutationFieldName(mutation: DocumentNode): string {
  const definition = mutation.definitions[0];
  if (definition.kind === 'OperationDefinition' && definition.selectionSet) {
    const selection = definition.selectionSet.selections[0];
    if (selection.kind === 'Field') {
      return selection.name.value;
    }
  }
  return 'mutation';
}
