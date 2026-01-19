/**
 * useEmailPrivacy Hook
 *
 * Hook for toggling email privacy with optimistic UI updates.
 * Provides instant feedback when marking emails as public or private.
 *
 * @example
 * const { markPublic, markPrivate, togglePrivacy, loading, error } = useEmailPrivacy({
 *   onSuccess: () => toast.success('Vizibilitatea a fost actualizată'),
 * });
 *
 * // Toggle based on current state
 * await togglePrivacy(emailId, email.isPrivate);
 */

import { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { MARK_EMAIL_PUBLIC, MARK_EMAIL_PRIVATE } from '@/graphql/mutations';
import { getListQueries } from '@/lib/cache';

// ============================================================================
// Types
// ============================================================================

export interface UseEmailPrivacyOptions {
  /** Callback when privacy change succeeds */
  onSuccess?: () => void;
  /** Callback when privacy change fails */
  onError?: (error: Error) => void;
}

export interface UseEmailPrivacyResult {
  /** Mark the email as public (visible to team) */
  markPublic: (emailId: string) => Promise<boolean>;
  /** Mark the email as private (hidden from team) */
  markPrivate: (emailId: string) => Promise<boolean>;
  /** Toggle privacy based on current state */
  togglePrivacy: (emailId: string, currentlyPrivate: boolean) => Promise<boolean>;
  /** Whether a mutation is in progress */
  loading: boolean;
  /** Error from the last mutation attempt */
  error: Error | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useEmailPrivacy(options: UseEmailPrivacyOptions = {}): UseEmailPrivacyResult {
  const { onSuccess, onError } = options;
  const [localError, setLocalError] = useState<Error | null>(null);

  // Get email list queries to refetch (for filtered views)
  const refetchQueries = getListQueries('Email', false).map((query) => ({ query }));

  // Mark email as public
  const [executeMarkPublic, { loading: markingPublic }] = useMutation(MARK_EMAIL_PUBLIC, {
    refetchQueries,
    awaitRefetchQueries: false,
  });

  // Mark email as private
  const [executeMarkPrivate, { loading: markingPrivate }] = useMutation(MARK_EMAIL_PRIVATE, {
    refetchQueries,
    awaitRefetchQueries: false,
  });

  const markPublic = useCallback(
    async (emailId: string): Promise<boolean> => {
      setLocalError(null);

      try {
        await executeMarkPublic({
          variables: { emailId },
          optimisticResponse: {
            markEmailPublic: {
              __typename: 'Email',
              id: emailId,
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
    async (emailId: string): Promise<boolean> => {
      setLocalError(null);

      try {
        await executeMarkPrivate({
          variables: { emailId },
          optimisticResponse: {
            markEmailPrivate: {
              __typename: 'Email',
              id: emailId,
              isPrivate: true,
              markedPrivateAt: new Date().toISOString(),
              markedPrivateBy: null,
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
    async (emailId: string, currentlyPrivate: boolean): Promise<boolean> => {
      if (currentlyPrivate) {
        return markPublic(emailId);
      }
      return markPrivate(emailId);
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
