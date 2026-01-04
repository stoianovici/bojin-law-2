'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { GET_CASE_SUMMARY, TRIGGER_CASE_SUMMARY_GENERATION } from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

export interface CaseSummary {
  id: string;
  caseId: string;
  executiveSummary: string;
  currentStatus: string;
  keyDevelopments: string[];
  openIssues: string[];
  generatedAt: string;
  isStale: boolean;
  emailCount: number;
  documentCount: number;
  noteCount: number;
  taskCount: number;
}

interface GetCaseSummaryData {
  caseSummary: CaseSummary | null;
}

interface TriggerCaseSummaryGenerationData {
  triggerCaseSummaryGeneration: {
    success: boolean;
    message: string | null;
    summary: CaseSummary | null;
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching cached AI case summary
 * Polls every 30 seconds if the summary is stale to check for updates
 */
export function useCaseSummary(caseId: string) {
  const { data, loading, error, refetch } = useQuery<GetCaseSummaryData>(GET_CASE_SUMMARY, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  // Poll every 30s if stale to check for updates
  const isStale = data?.caseSummary?.isStale ?? false;

  useQuery<GetCaseSummaryData>(GET_CASE_SUMMARY, {
    variables: { caseId },
    skip: !caseId || !isStale,
    pollInterval: 30000, // 30 seconds
    fetchPolicy: 'network-only',
  });

  // Mutation to trigger generation
  const [triggerGeneration, { loading: generating }] =
    useMutation<TriggerCaseSummaryGenerationData>(TRIGGER_CASE_SUMMARY_GENERATION, {
      variables: { caseId },
      refetchQueries: [{ query: GET_CASE_SUMMARY, variables: { caseId } }],
    });

  return {
    summary: data?.caseSummary ?? null,
    loading,
    generating,
    error,
    refetch,
    triggerGeneration,
  };
}
