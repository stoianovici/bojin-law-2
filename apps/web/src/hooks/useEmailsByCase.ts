'use client';

import { useQuery } from './useGraphQL';
import { GET_EMAILS_BY_CASE } from '@/graphql/queries';
import type { EmailsByCase } from '@/types/email';

interface UseEmailsByCaseOptions {
  limit?: number;
  offset?: number;
  skip?: boolean;
}

interface UseEmailsByCaseResult {
  data: EmailsByCase | null;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

export function useEmailsByCase(options: UseEmailsByCaseOptions = {}): UseEmailsByCaseResult {
  const { limit = 50, offset = 0, skip = false } = options;

  const { data, loading, error, refetch } = useQuery<{ emailsByCase: EmailsByCase }>(
    GET_EMAILS_BY_CASE,
    {
      variables: { limit, offset },
      skip,
    }
  );

  return {
    data: data?.emailsByCase || null,
    loading,
    error,
    refetch,
  };
}
