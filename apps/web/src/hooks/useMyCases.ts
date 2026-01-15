/**
 * My Cases Query Hook
 * Hook for fetching cases for the current user
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// GraphQL query for fetching cases
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
      referenceNumbers
      client {
        id
        name
      }
    }
  }
`;

export interface MyCasesVariables {
  status?: string;
}

export interface MyCaseClient {
  id: string;
  name: string;
}

export interface MyCase {
  id: string;
  caseNumber?: string;
  title: string;
  status: string;
  type?: string;
  description?: string;
  openedDate?: string;
  referenceNumbers?: string[];
  client?: MyCaseClient;
}

interface MyCasesResult {
  myCases: MyCase[];
}

export interface UseMyCasesResult {
  cases: MyCase[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

/**
 * Hook to fetch cases for the current user
 * @param status Optional filter by case status
 * @returns cases array, loading state, error, and refetch function
 */
export function useMyCases(status?: string): UseMyCasesResult {
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
