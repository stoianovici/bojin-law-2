'use client';

import { useQuery } from '@apollo/client/react';
import { useAuth } from './useAuth';
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Skip query while auth is loading or if user is not authenticated
  const shouldSkip = skip || authLoading || !isAuthenticated;

  console.log('[useEmailsByCase] Auth state:', { authLoading, isAuthenticated, shouldSkip });

  const { data, loading, error, refetch } = useQuery<{ emailsByCase: EmailsByCase }>(
    GET_EMAILS_BY_CASE,
    {
      variables: { limit, offset },
      skip: shouldSkip,
      // Always fetch fresh data from network - critical for seeing deleted cases
      fetchPolicy: 'network-only',
      // Poll every 60 seconds to catch case deletions by other users
      pollInterval: 60000,
    }
  );

  console.log('[useEmailsByCase] Query result:', {
    loading,
    hasError: !!error,
    errorMessage: error?.message,
    casesCount: data?.emailsByCase?.cases?.length,
    uncertainCount: data?.emailsByCase?.uncertainEmailsCount,
  });

  // Wrap refetch to match expected return type
  const wrappedRefetch = async () => {
    await refetch();
  };

  return {
    data: data?.emailsByCase || null,
    // Show loading while auth is loading OR while query is loading
    loading: authLoading || loading,
    error: error ? new Error(error.message) : undefined,
    refetch: wrappedRefetch,
  };
}
