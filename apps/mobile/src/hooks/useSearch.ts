'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { SEARCH_CASES, SEARCH_CLIENTS } from '@/graphql/queries';

// ============================================
// Types
// ============================================

interface CaseResult {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  referenceNumbers: string[] | null;
  client: { id: string; name: string } | null;
}

interface ClientResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface SearchResults {
  cases: CaseResult[];
  clients: ClientResult[];
}

// ============================================
// Hook
// ============================================

export function useSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Search queries
  const [searchCases, { data: casesData, loading: casesLoading }] = useLazyQuery<{
    searchCases: CaseResult[];
  }>(SEARCH_CASES);

  const [searchClients, { data: clientsData, loading: clientsLoading }] = useLazyQuery<{
    searchClients: ClientResult[];
  }>(SEARCH_CLIENTS);

  // Execute search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      setIsSearching(true);
      Promise.all([
        searchCases({ variables: { query: debouncedQuery, limit: 10 } }),
        searchClients({ variables: { query: debouncedQuery, limit: 5 } }),
      ]).finally(() => {
        setIsSearching(false);
      });
    }
  }, [debouncedQuery, searchCases, searchClients]);

  const results: SearchResults = {
    cases: casesData?.searchCases ?? [],
    clients: clientsData?.searchClients ?? [],
  };

  const hasResults = results.cases.length > 0 || results.clients.length > 0;
  const loading = casesLoading || clientsLoading || isSearching;
  const showResults = debouncedQuery.trim().length >= 2;

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    hasResults,
    showResults,
    clearSearch,
  };
}
