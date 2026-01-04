'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { SEARCH_CLIENTS } from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

export interface Client {
  id: string;
  name: string;
  contactInfo: string;
  address: string;
}

interface SearchClientsData {
  searchClients: Client[];
}

interface SearchClientsVariables {
  query: string;
  limit?: number;
}

interface UseClientSearchOptions {
  useMock?: boolean;
  limit?: number;
  debounceMs?: number;
}

interface UseClientSearchResult {
  clients: Client[];
  loading: boolean;
  error: Error | undefined;
  search: (query: string) => void;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'SC Alpha SRL',
    contactInfo: 'office@alpha.ro',
    address: 'Str. Victoriei 10, București',
  },
  {
    id: '2',
    name: 'SC Beta SA',
    contactInfo: 'contact@beta.ro',
    address: 'Bd. Unirii 25, Cluj-Napoca',
  },
  {
    id: '3',
    name: 'Ion Popescu PFA',
    contactInfo: 'ion@popescu.ro',
    address: 'Str. Libertății 5, Timișoara',
  },
  {
    id: '4',
    name: 'SC Gamma SRL',
    contactInfo: 'info@gamma.ro',
    address: 'Str. Republicii 15, Iași',
  },
  {
    id: '5',
    name: 'Maria Ionescu',
    contactInfo: 'maria.ionescu@email.ro',
    address: 'Str. Mihai Viteazu 8, Brașov',
  },
];

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for searching clients by name with debounced Apollo query.
 *
 * Can be used in two ways:
 *
 * 1. With searchTerm parameter (debounced automatically):
 *    const { clients, loading, error } = useClientSearch(searchTerm);
 *
 * 2. Without searchTerm, using search() imperatively:
 *    const { clients, loading, search } = useClientSearch();
 *    search('query'); // call when needed
 */
export function useClientSearch(
  searchTerm?: string,
  options: UseClientSearchOptions = {}
): UseClientSearchResult {
  const { useMock = false, limit = 10, debounceMs = 300 } = options;

  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm ?? '');
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [mockLoading, setMockLoading] = useState(false);
  const [mockClients, setMockClients] = useState<Client[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [execute, { data, loading: queryLoading, error: queryError }] = useLazyQuery<
    SearchClientsData,
    SearchClientsVariables
  >(SEARCH_CLIENTS);

  // Filter mock data by name (case-insensitive)
  const filterMockClients = useCallback(
    (term: string): Client[] => {
      if (!term.trim()) {
        return [];
      }
      const lowerTerm = term.toLowerCase();
      return MOCK_CLIENTS.filter((client) => client.name.toLowerCase().includes(lowerTerm)).slice(
        0,
        limit
      );
    },
    [limit]
  );

  // Imperative search function (for use without searchTerm parameter)
  const search = useCallback(
    (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setCurrentSearchTerm(query);

        if (!query.trim()) {
          setMockClients([]);
          return;
        }

        if (useMock) {
          setMockLoading(true);
          // Simulate network delay for mock data
          setTimeout(() => {
            setMockClients(filterMockClients(query));
            setMockLoading(false);
          }, 200);
        } else {
          execute({ variables: { query, limit } });
        }
      }, debounceMs);
    },
    [useMock, execute, limit, debounceMs, filterMockClients]
  );

  // Debounce the search term (when used with searchTerm parameter)
  useEffect(() => {
    if (searchTerm === undefined) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  // Execute search when debounced term changes (when used with searchTerm parameter)
  useEffect(() => {
    if (searchTerm === undefined) return;

    if (!debouncedTerm.trim()) {
      return;
    }

    if (useMock) {
      setMockLoading(true);
      // Simulate network delay for mock data
      const timer = setTimeout(() => {
        setMockClients(filterMockClients(debouncedTerm));
        setMockLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }

    execute({ variables: { query: debouncedTerm, limit } });
  }, [debouncedTerm, useMock, execute, limit, searchTerm, filterMockClients]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Determine which data to return
  const getClients = (): Client[] => {
    const term = searchTerm !== undefined ? debouncedTerm : currentSearchTerm;

    if (!term.trim()) {
      return [];
    }

    // Use mock data if explicitly requested or if query failed
    if (useMock || queryError) {
      return mockClients;
    }

    return data?.searchClients ?? [];
  };

  return {
    clients: getClients(),
    loading: useMock ? mockLoading : queryLoading,
    error: useMock ? undefined : queryError ? new Error(queryError.message) : undefined,
    search,
  };
}
