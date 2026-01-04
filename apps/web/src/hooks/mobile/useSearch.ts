'use client';

import { useLazyQuery } from '@apollo/client/react';
import { SEARCH_CASES } from '@/graphql/queries';

interface Client {
  id: string;
  name: string;
}

interface SearchCase {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  client: Client | null;
}

interface SearchCasesData {
  searchCases: SearchCase[];
}

interface SearchCasesVariables {
  query: string;
  limit?: number;
}

interface UseSearchOptions {
  limit?: number;
}

interface UseSearchResult {
  results: SearchCase[];
  loading: boolean;
  error: Error | undefined;
  search: (query: string) => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { limit = 10 } = options;

  const [execute, { data, loading, error }] = useLazyQuery<SearchCasesData, SearchCasesVariables>(
    SEARCH_CASES
  );

  const search = (query: string) => {
    execute({ variables: { query, limit } });
  };

  return {
    results: data?.searchCases ?? [],
    loading,
    error: error ? new Error(error.message) : undefined,
    search,
  };
}
