/**
 * Pending Cases Query Hook
 * Story 2.8.2: Case Approval Workflow - Task 15
 *
 * Hook for Partners to fetch all pending approval cases
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { Case, Client, CaseApproval, CaseTeam } from '@legal-platform/types';

// Type for pendingCases query response with populated fields
export interface PendingCaseWithRelations extends Case {
  client: Client;
  teamMembers: CaseTeam[];
  approval: CaseApproval;
}

// GraphQL query for fetching pending approval cases
const PENDING_CASES = gql`
  query GetPendingCases {
    pendingCases {
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
      teamMembers {
        id
        userId
        role
        user {
          id
          firstName
          lastName
        }
      }
      approval {
        id
        submittedBy {
          id
          firstName
          lastName
        }
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

interface PendingCasesResult {
  pendingCases: PendingCaseWithRelations[];
}

export interface UsePendingCasesResult {
  cases: PendingCaseWithRelations[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch all pending approval cases (Partners only)
 * @returns cases array sorted by submission date (oldest first), loading state, error, and refetch function
 */
export function usePendingCases(skip = false): UsePendingCasesResult {
  const { data, loading, error, refetch } = useQuery<PendingCasesResult>(PENDING_CASES, {
    fetchPolicy: 'cache-and-network',
    skip, // Skip query if not needed (e.g., non-Partners)
  });

  return {
    cases: data?.pendingCases || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
