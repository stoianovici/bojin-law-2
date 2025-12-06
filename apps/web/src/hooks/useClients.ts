/**
 * Hook for searching clients
 * Provides client search functionality for autocomplete
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';

// GraphQL Query for searching clients
const SEARCH_CLIENTS = gql`
  query SearchClients($query: String!, $limit: Int) {
    searchClients(query: $query, limit: $limit) {
      id
      name
      contactInfo
      address
    }
  }
`;

export interface ClientOption {
  id: string;
  name: string;
  contactInfo?: Record<string, unknown>;
  address?: string;
}

interface UseClientsOptions {
  debounceMs?: number;
  limit?: number;
}

export function useClients(options: UseClientsOptions = {}) {
  const { debounceMs = 300, limit = 10 } = options;
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [searchClientsQuery, { loading }] = useLazyQuery<{ searchClients: ClientOption[] }>(
    SEARCH_CLIENTS,
    {
      fetchPolicy: 'network-only',
      onCompleted: (data) => {
        setClients(data?.searchClients ?? []);
      },
      onError: () => {
        setClients([]);
      },
    }
  );

  const searchClients = useCallback(
    (query: string) => {
      setSearchTerm(query);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Don't search for empty or single character queries
      if (query.length < 1) {
        setClients([]);
        return;
      }

      // Debounce the search
      debounceRef.current = setTimeout(() => {
        searchClientsQuery({
          variables: { query, limit },
        });
      }, debounceMs);
    },
    [searchClientsQuery, debounceMs, limit]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const clearClients = useCallback(() => {
    setClients([]);
    setSearchTerm('');
  }, []);

  return {
    clients,
    loading,
    searchTerm,
    searchClients,
    clearClients,
  };
}
