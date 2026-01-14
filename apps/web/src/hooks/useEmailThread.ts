'use client';

import { useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import { GET_EMAIL_THREAD } from '@/graphql/queries';
import type { EmailThread } from '@/types/email';

interface UseEmailThreadOptions {
  skip?: boolean;
}

interface UseEmailThreadResult {
  thread: EmailThread | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

export function useEmailThread(
  conversationId: string | null,
  options: UseEmailThreadOptions = {}
): UseEmailThreadResult {
  const { skip = false } = options;

  console.log(
    '[useEmailThread] Called with: conversationId=' +
      conversationId +
      ', willSkip=' +
      (skip || !conversationId)
  );

  // Use Apollo's native useQuery to automatically react to cache updates
  // This enables optimistic UI updates when privacy toggles modify the cache
  const {
    data,
    loading,
    error,
    refetch: apolloRefetch,
  } = useQuery<{ emailThread: EmailThread }>(GET_EMAIL_THREAD, {
    variables: { conversationId },
    skip: skip || !conversationId,
    // Use cache-and-network to show cached data immediately while fetching
    fetchPolicy: 'cache-and-network',
    // Ensure component re-renders on cache updates
    notifyOnNetworkStatusChange: true,
  });

  // Wrap refetch to match the expected signature
  const refetch = useCallback(async () => {
    await apolloRefetch();
  }, [apolloRefetch]);

  console.log('[useEmailThread] Result:', {
    hasData: !!data?.emailThread,
    loading,
    hasError: !!error,
  });

  return {
    thread: data?.emailThread || null,
    loading,
    error,
    refetch,
  };
}
