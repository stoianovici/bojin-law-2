/**
 * My Cases Query Hook
 * Story 2.8.2: Case Approval Workflow - Task 13
 *
 * Hook for Associates to fetch their submitted cases
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { Case, CaseStatus, Client, CaseApproval } from '@legal-platform/types';

// GraphQL query for fetching Associate's cases
const MY_CASES = gql`
  query MyCases($status: CaseStatus) {
    myCases(status: $status) {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
      client {
        id
        name
      }
      approval {
        id
        submittedAt
        reviewedBy {
          id
          firstName
          lastName
        }
        reviewedAt
        status
        rejectionReason
        revisionCount
      }
    }
  }
`;

export interface MyCasesVariables {
  status?: CaseStatus;
}

// Type for myCases query response with populated fields
export interface MyCaseWithRelations extends Case {
  client: Client;
  approval: CaseApproval;
}

interface MyCasesResult {
  myCases: MyCaseWithRelations[];
}

export interface UseMyCasesResult {
  cases: MyCaseWithRelations[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch Associate's submitted cases
 * @param status Optional filter by case status
 * @returns cases array, loading state, error, and refetch function
 */
export function useMyCases(status?: CaseStatus): UseMyCasesResult {
  const { data, loading, error, refetch } = useQuery<MyCasesResult, MyCasesVariables>(MY_CASES, {
    variables: status ? { status } : undefined,
    fetchPolicy: 'cache-and-network',
  });

  return {
    cases: data?.myCases || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
