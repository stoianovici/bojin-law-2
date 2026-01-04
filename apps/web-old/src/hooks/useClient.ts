/**
 * Client Query Hook
 * OPS-227: Client Profile Page + Case Links
 *
 * Fetches a single client by ID with their case portfolio
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_CLIENT = gql`
  query GetClient($id: UUID!) {
    client(id: $id) {
      id
      name
      email
      phone
      address
      cases {
        id
        caseNumber
        title
        status
        type
        openedDate
      }
      caseCount
      activeCaseCount
      createdAt
      updatedAt
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface CaseSummaryForClient {
  id: string;
  caseNumber: string;
  title: string;
  status: 'Pending' | 'Active' | 'OnHold' | 'Closed' | 'Archived';
  type: string;
  openedDate: string;
}

export interface ClientWithCases {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cases: CaseSummaryForClient[];
  caseCount: number;
  activeCaseCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GetClientData {
  client: ClientWithCases | null;
}

interface GetClientVariables {
  id: string;
}

// ============================================================================
// Hook
// ============================================================================

export interface UseClientResult {
  client: ClientWithCases | null;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch a single client with their case portfolio
 * @param clientId - Client ID (UUID)
 * @returns Client data, loading state, error, and refetch function
 */
export function useClient(clientId: string): UseClientResult {
  const { data, loading, error, refetch } = useQuery<GetClientData, GetClientVariables>(
    GET_CLIENT,
    {
      variables: { id: clientId },
      fetchPolicy: 'cache-and-network',
      skip: !clientId,
    }
  );

  return {
    client: data?.client || null,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
