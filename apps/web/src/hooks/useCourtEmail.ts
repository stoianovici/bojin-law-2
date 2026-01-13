'use client';

import { useQuery } from './useGraphQL';
import { GET_EMAIL } from '@/graphql/queries';
import type { Email } from '@/types/email';

interface UseCourtEmailOptions {
  skip?: boolean;
}

interface UseCourtEmailResult {
  email: Email | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a single email by ID.
 * Used for court emails in INSTANȚE which don't have conversationId.
 */
export function useCourtEmail(
  emailId: string | null,
  options: UseCourtEmailOptions = {}
): UseCourtEmailResult {
  const { skip = false } = options;

  const { data, loading, error, refetch } = useQuery<{ email: Email }>(GET_EMAIL, {
    variables: { id: emailId },
    skip: skip || !emailId,
  });

  return {
    email: data?.email || null,
    loading,
    error,
    refetch,
  };
}
