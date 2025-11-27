/**
 * useRateHistory Hook
 * Story 2.8.1: Billing & Rate Management - Task 14
 *
 * Hook for fetching case rate change history.
 * Partners only - financial data.
 */

'use client';

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// GraphQL query
const GET_RATE_HISTORY = gql`
  query GetRateHistory($caseId: UUID!) {
    case(id: $caseId) {
      id
      rateHistory {
        id
        caseId
        changedAt
        changedBy {
          id
          firstName
          lastName
          email
        }
        rateType
        oldRate
        newRate
      }
    }
  }
`;

export interface RateHistoryEntry {
  id: string;
  caseId: string;
  changedAt: Date;
  changedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  rateType: 'partner' | 'associate' | 'paralegal' | 'fixed';
  oldRate: number;
  newRate: number;
}

interface GetRateHistoryQueryResult {
  case: {
    id: string;
    rateHistory: RateHistoryEntry[];
  };
}

interface UseRateHistoryResult {
  history: RateHistoryEntry[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch rate change history for a case
 * @param caseId - The case ID to fetch history for
 * @returns Rate history, loading state, and error
 */
export function useRateHistory(caseId: string): UseRateHistoryResult {
  const { data, loading, error, refetch } = useQuery<GetRateHistoryQueryResult>(
    GET_RATE_HISTORY,
    {
      variables: { caseId },
      skip: !caseId,
    }
  );

  return {
    history: data?.case?.rateHistory || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
