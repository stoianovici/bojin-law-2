'use client';

import { useQuery } from './useGraphQL';
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

  const { data, loading, error, refetch } = useQuery<{ emailThread: EmailThread }>(
    GET_EMAIL_THREAD,
    {
      variables: { conversationId },
      skip: skip || !conversationId,
    }
  );

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
