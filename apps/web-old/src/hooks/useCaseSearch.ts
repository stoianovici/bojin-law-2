/**
 * Case Search Query Hook
 * Story 2.8: Case CRUD Operations UI - Task 5
 *
 * Full-text search across cases
 */

import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import type { Case, Client } from '@legal-platform/types';

// GraphQL query for searching cases
const SEARCH_CASES = gql`
  query SearchCases($query: String!, $limit: Int) {
    searchCases(query: $query, limit: $limit) {
      id
      caseNumber
      title
      status
      type
      client {
        id
        name
      }
    }
  }
`;

export interface CaseSearchResult extends Omit<Case, 'client'> {
  client: Client;
}

interface SearchCasesVariables {
  query: string;
  limit?: number;
}

interface SearchCasesResult {
  searchCases: CaseSearchResult[];
}

interface UseCaseSearchResult {
  search: (query: string, limit?: number) => void;
  results: CaseSearchResult[];
  loading: boolean;
  error?: Error;
}

/**
 * Hook for searching cases with full-text search
 * Minimum 3 characters required
 * @returns search function, results, loading state, and error
 */
export function useCaseSearch(): UseCaseSearchResult {
  const [searchQuery, { data, loading, error }] = useLazyQuery<
    SearchCasesResult,
    SearchCasesVariables
  >(SEARCH_CASES, {
    fetchPolicy: 'network-only',
  });

  const search = (query: string, limit: number = 50) => {
    // Validate minimum query length
    if (query.length < 3) {
      return;
    }

    searchQuery({
      variables: {
        query,
        limit: Math.min(limit, 100), // Max 100 results
      },
    });
  };

  return {
    search,
    results: data?.searchCases || [],
    loading,
    error: error as Error | undefined,
  };
}
