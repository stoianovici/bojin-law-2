/**
 * Firm Users Query Hook
 * Fetches all users in the current firm for selection dropdowns
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_FIRM_USERS = gql`
  query GetFirmUsers {
    firmUsers {
      id
      firstName
      lastName
      email
      role
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface FirmUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface GetFirmUsersResult {
  firmUsers: FirmUser[];
}

// ============================================================================
// Hook
// ============================================================================

export function useFirmUsers() {
  const { data, loading, error, refetch } = useQuery<GetFirmUsersResult>(GET_FIRM_USERS, {
    fetchPolicy: 'cache-and-network',
  });

  return {
    users: data?.firmUsers || [],
    loading,
    error,
    refetch,
  };
}
