/**
 * useDocumentPrivacy Hook
 *
 * Hook for toggling document privacy with optimistic UI updates.
 * Provides instant feedback when marking documents as public or private.
 *
 * @example
 * const { markPublic, markPrivate, togglePrivacy, loading, error } = useDocumentPrivacy({
 *   onSuccess: () => toast.success('Vizibilitatea a fost actualizată'),
 * });
 *
 * // Toggle based on current state
 * await togglePrivacy(documentId, document.isPrivate);
 *
 * // Or use direct methods
 * await markPublic(documentId);
 * await markPrivate(documentId);
 */

import { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { MARK_DOCUMENT_PUBLIC, MARK_DOCUMENT_PRIVATE } from '@/graphql/mutations';
import { getListQueries } from '@/lib/cache';

// ============================================================================
// Types
// ============================================================================

export interface UseDocumentPrivacyOptions {
  /** Callback when privacy change succeeds */
  onSuccess?: () => void;
  /** Callback when privacy change fails */
  onError?: (error: Error) => void;
}

export interface UseDocumentPrivacyResult {
  /** Mark the document as public (visible to team) */
  markPublic: (documentId: string) => Promise<boolean>;
  /** Mark the document as private (hidden from team) */
  markPrivate: (documentId: string) => Promise<boolean>;
  /** Toggle privacy based on current state */
  togglePrivacy: (documentId: string, currentlyPrivate: boolean) => Promise<boolean>;
  /** Whether a mutation is in progress */
  loading: boolean;
  /** Error from the last mutation attempt */
  error: Error | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentPrivacy(
  options: UseDocumentPrivacyOptions = {}
): UseDocumentPrivacyResult {
  const { onSuccess, onError } = options;
  const [localError, setLocalError] = useState<Error | null>(null);

  // Get document list queries to refetch (for filtered views)
  const refetchQueries = getListQueries('Document', false).map((query) => ({ query }));

  // Mark document as public
  const [executeMarkPublic, { loading: markingPublic }] = useMutation(MARK_DOCUMENT_PUBLIC, {
    refetchQueries,
    awaitRefetchQueries: false,
  });

  // Mark document as private
  const [executeMarkPrivate, { loading: markingPrivate }] = useMutation(MARK_DOCUMENT_PRIVATE, {
    refetchQueries,
    awaitRefetchQueries: false,
  });

  const markPublic = useCallback(
    async (documentId: string): Promise<boolean> => {
      setLocalError(null);

      try {
        await executeMarkPublic({
          variables: { documentId },
          optimisticResponse: {
            markDocumentPublic: {
              __typename: 'Document',
              id: documentId,
              isPrivate: false,
              markedPublicAt: new Date().toISOString(),
              markedPublicBy: null,
            },
          },
        });

        onSuccess?.();
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setLocalError(error);
        onError?.(error);
        return false;
      }
    },
    [executeMarkPublic, onSuccess, onError]
  );

  const markPrivate = useCallback(
    async (documentId: string): Promise<boolean> => {
      setLocalError(null);

      try {
        await executeMarkPrivate({
          variables: { documentId },
          optimisticResponse: {
            markDocumentPrivate: {
              __typename: 'Document',
              id: documentId,
              isPrivate: true,
            },
          },
        });

        onSuccess?.();
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setLocalError(error);
        onError?.(error);
        return false;
      }
    },
    [executeMarkPrivate, onSuccess, onError]
  );

  const togglePrivacy = useCallback(
    async (documentId: string, currentlyPrivate: boolean): Promise<boolean> => {
      if (currentlyPrivate) {
        return markPublic(documentId);
      }
      return markPrivate(documentId);
    },
    [markPublic, markPrivate]
  );

  return {
    markPublic,
    markPrivate,
    togglePrivacy,
    loading: markingPublic || markingPrivate,
    error: localError,
  };
}
