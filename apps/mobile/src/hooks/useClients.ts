'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CLIENTS } from '@/graphql/queries';
import { useDebounce } from './useDebounce';

// ============================================
// Types
// ============================================

export type ClientType = 'individual' | 'company';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  clientType: ClientType | null;
  caseCount: number;
  activeCaseCount: number;
}

interface ClientsData {
  clients: Client[];
}

// ============================================
// Hook
// ============================================

// TODO: Add cursor-based pagination support once backend `paginatedClients` query is implemented.
// Follow the same pattern as useCases hook with fetchMore, loadMore, and hasNextPage.
// See useCases.ts for reference implementation.

export function useClients() {
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce search query to prevent excessive filtering on rapid typing
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, loading, error, refetch } = useQuery<ClientsData>(GET_CLIENTS, {
    fetchPolicy: 'cache-and-network',
  });

  // Filter by search query locally - memoized to prevent re-computation on unrelated re-renders
  // Uses debounced search query so filtering only runs after user stops typing
  const filteredClients = useMemo(() => {
    return (
      data?.clients?.filter((client) => {
        if (!debouncedSearchQuery.trim()) return true;

        const query = debouncedSearchQuery.toLowerCase();
        return (
          client.name.toLowerCase().includes(query) ||
          client.email?.toLowerCase().includes(query) ||
          client.phone?.toLowerCase().includes(query)
        );
      }) ?? []
    );
  }, [data?.clients, debouncedSearchQuery]);

  // Sort by name alphabetically - memoized
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [filteredClients]);

  return {
    clients: sortedClients,
    loading,
    error,
    refetch,
    searchQuery,
    setSearchQuery,
  };
}
