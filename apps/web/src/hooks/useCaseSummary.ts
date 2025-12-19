/**
 * Case Summary React Hook
 * OPS-050: Overview Tab AI Summary UI
 *
 * Provides hook for fetching cached AI-generated case summaries
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_CASE_SUMMARY = gql`
  query GetCaseSummary($caseId: ID!) {
    caseSummary(caseId: $caseId) {
      id
      caseId
      executiveSummary
      currentStatus
      keyDevelopments
      openIssues
      generatedAt
      isStale
      emailCount
      documentCount
      noteCount
      taskCount
    }
  }
`;

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

// ============================================================================
// Hooks
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

  // Use separate query for polling to avoid issues with conditional pollInterval
  useQuery<GetCaseSummaryData>(GET_CASE_SUMMARY, {
    variables: { caseId },
    skip: !caseId || !isStale,
    pollInterval: 30000, // 30 seconds
    fetchPolicy: 'network-only',
  });

  return {
    summary: data?.caseSummary ?? null,
    loading,
    error,
    refetch,
  };
}
