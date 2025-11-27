/**
 * Retainer Usage Hooks
 * Story 2.11.2: Retainer Billing Support - Task 10
 *
 * Provides hooks for fetching retainer usage data for cases with Retainer billing type
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { RetainerUsage } from '@legal-platform/types';

// GraphQL query for fetching retainer usage for a specific period
const GET_RETAINER_USAGE = gql`
  query GetRetainerUsage($caseId: UUID!, $periodStart: DateTime) {
    retainerUsage(caseId: $caseId, periodStart: $periodStart) {
      periodStart
      periodEnd
      hoursUsed
      hoursIncluded
      rolledOver
      remaining
      utilizationPercent
    }
  }
`;

// GraphQL query for fetching retainer usage history
const GET_RETAINER_USAGE_HISTORY = gql`
  query GetRetainerUsageHistory($caseId: UUID!, $limit: Int) {
    retainerUsageHistory(caseId: $caseId, limit: $limit) {
      periodStart
      periodEnd
      hoursUsed
      hoursIncluded
      rolledOver
      remaining
      utilizationPercent
    }
  }
`;

interface UseRetainerUsageVariables {
  caseId: string;
  periodStart?: string; // ISO date string
}

interface UseRetainerUsageResult {
  usage: RetainerUsage | null;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch retainer usage for the current or specified period
 * @param caseId - Case ID (UUID)
 * @param periodStart - Optional start of period to query (ISO date string, defaults to current period)
 * @returns Retainer usage data, loading state, error, and refetch function
 */
export function useRetainerUsage(
  caseId: string,
  periodStart?: string
): UseRetainerUsageResult {
  const { data, loading, error, refetch } = useQuery<
    { retainerUsage: RetainerUsage | null },
    UseRetainerUsageVariables
  >(GET_RETAINER_USAGE, {
    variables: { caseId, periodStart },
    fetchPolicy: 'cache-and-network',
    skip: !caseId, // Skip query if no caseId provided
  });

  return {
    usage: data?.retainerUsage || null,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}

interface UseRetainerHistoryVariables {
  caseId: string;
  limit?: number;
}

interface UseRetainerHistoryResult {
  history: RetainerUsage[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch retainer usage history for a case
 * @param caseId - Case ID (UUID)
 * @param limit - Maximum number of periods to return (default 12)
 * @returns Retainer usage history array, loading state, error, and refetch function
 */
export function useRetainerHistory(
  caseId: string,
  limit: number = 12
): UseRetainerHistoryResult {
  const { data, loading, error, refetch } = useQuery<
    { retainerUsageHistory: RetainerUsage[] },
    UseRetainerHistoryVariables
  >(GET_RETAINER_USAGE_HISTORY, {
    variables: { caseId, limit },
    fetchPolicy: 'cache-and-network',
    skip: !caseId, // Skip query if no caseId provided
  });

  return {
    history: data?.retainerUsageHistory || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
