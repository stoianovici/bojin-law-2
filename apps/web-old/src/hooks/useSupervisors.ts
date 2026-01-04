/**
 * useSupervisors Hook
 * OPS-177: Fetches list of supervisors for the review workflow picker
 */

'use client';

import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';

// ============================================================================
// Types
// ============================================================================

export interface Supervisor {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
}

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_SUPERVISORS = gql`
  query GetSupervisors {
    supervisors {
      id
      name
      email
      role
      initials
    }
  }
`;

// ============================================================================
// Hook
// ============================================================================

export function useSupervisors() {
  const { data, loading, error, refetch } = useQuery<{ supervisors: Supervisor[] }>(
    GET_SUPERVISORS,
    {
      fetchPolicy: 'cache-first',
    }
  );

  return {
    supervisors: data?.supervisors ?? [],
    loading,
    error,
    refetch,
  };
}
