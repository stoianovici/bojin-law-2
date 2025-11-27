/**
 * Cases Query Hook
 * Story 2.8: Case CRUD Operations UI - Task 2
 *
 * Fetches cases list with optional filters using GraphQL
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { Case, CaseStatus, Client } from '@legal-platform/types';

// GraphQL query for fetching cases
const GET_CASES = gql`
  query GetCases($status: CaseStatus, $clientId: UUID, $assignedToMe: Boolean) {
    cases(status: $status, clientId: $clientId, assignedToMe: $assignedToMe) {
      id
      caseNumber
      title
      status
      type
      openedDate
      closedDate
      value
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
    }
  }
`;

interface CaseTeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CaseWithRelations extends Case {
  client: Client;
  teamMembers: CaseTeamMember[];
}

interface UseCasesVariables {
  status?: CaseStatus;
  clientId?: string;
  assignedToMe?: boolean;
}

interface UseCasesResult {
  cases: CaseWithRelations[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch cases with optional filters
 * @param variables - Filter variables (status, clientId, assignedToMe)
 * @returns Cases data, loading state, error, and refetch function
 */
export function useCases(variables: UseCasesVariables = {}): UseCasesResult {
  const { data, loading, error, refetch } = useQuery<{ cases: CaseWithRelations[] }>(GET_CASES, {
    variables,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    cases: data?.cases || [],
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
