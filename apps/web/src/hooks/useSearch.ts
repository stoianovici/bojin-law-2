/**
 * Search Hooks
 * Story 2.10: Basic AI Search Implementation - Task 22
 *
 * Provides hooks for full-text search across cases, documents, and clients.
 */

import { gql } from '@apollo/client';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import { useState, useCallback } from 'react';
import type { CaseType, CaseStatus } from '@legal-platform/types';

// ============================================================================
// GraphQL Queries
// ============================================================================

const SEARCH_QUERY = gql`
  query Search($input: SearchInput!) {
    search(input: $input) {
      results {
        __typename
        ... on CaseSearchResult {
          case {
            id
            caseNumber
            title
            status
            type
            openedDate
            client {
              id
              name
            }
          }
          score
          highlight
        }
        ... on DocumentSearchResult {
          document {
            id
            fileName
            fileType
            uploadedAt
            client {
              id
              name
            }
          }
          score
          highlight
        }
        ... on ClientSearchResult {
          client {
            id
            name
            contactInfo
            address
          }
          score
          highlight
        }
      }
      totalCount
      searchTime
      query
    }
  }
`;

const RECENT_SEARCHES_QUERY = gql`
  query RecentSearches($limit: Int) {
    recentSearches(limit: $limit) {
      id
      query
      resultCount
      createdAt
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  caseIds?: string[];
  caseTypes?: CaseType[];
  caseStatuses?: CaseStatus[];
  documentTypes?: string[];
  clientIds?: string[];
}

export interface CaseSearchResult {
  __typename: 'CaseSearchResult';
  case: {
    id: string;
    caseNumber: string;
    title: string;
    status: CaseStatus;
    type: CaseType;
    openedDate: string;
    client: {
      id: string;
      name: string;
    };
  };
  score: number;
  highlight: string | null;
}

export interface DocumentSearchResult {
  __typename: 'DocumentSearchResult';
  document: {
    id: string;
    fileName: string;
    fileType: string;
    uploadedAt: string;
    client: {
      id: string;
      name: string;
    };
  };
  score: number;
  highlight: string | null;
}

export interface ClientSearchResult {
  __typename: 'ClientSearchResult';
  client: {
    id: string;
    name: string;
    contactInfo: any;
    address: string | null;
  };
  score: number;
  highlight: string | null;
}

export type SearchResult = CaseSearchResult | DocumentSearchResult | ClientSearchResult;

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  query: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  resultCount: number;
  createdAt: string;
}

// ============================================================================
// useSearch Hook
// ============================================================================

interface UseSearchOptions {
  debounceMs?: number;
  defaultLimit?: number;
}

interface UseSearchReturn {
  search: (query: string, filters?: SearchFilters) => void;
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  loading: boolean;
  error: Error | null;
  query: string;
  setQuery: (query: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  clearSearch: () => void;
}

/**
 * Hook for performing full-text search across cases, documents, and clients
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { defaultLimit = 20 } = options;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});

  const [executeSearch, { data, loading, error }] = useLazyQuery<{
    search: SearchResponse;
  }>(SEARCH_QUERY, {
    fetchPolicy: 'network-only',
  });

  const search = useCallback(
    (searchQuery: string, searchFilters?: SearchFilters) => {
      if (!searchQuery.trim()) {
        return;
      }

      setQuery(searchQuery);
      if (searchFilters) {
        setFilters(searchFilters);
      }

      executeSearch({
        variables: {
          input: {
            query: searchQuery,
            filters: searchFilters || filters,
            limit: defaultLimit,
            offset: 0,
          },
        },
      });
    },
    [executeSearch, filters, defaultLimit]
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setFilters({});
  }, []);

  return {
    search,
    results: data?.search?.results || [],
    totalCount: data?.search?.totalCount || 0,
    searchTime: data?.search?.searchTime || 0,
    loading,
    error: error as Error | null,
    query,
    setQuery,
    filters,
    setFilters,
    clearSearch,
  };
}

// ============================================================================
// useRecentSearches Hook
// ============================================================================

interface UseRecentSearchesReturn {
  recentSearches: RecentSearch[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching recent searches for the current user
 */
export function useRecentSearches(limit: number = 10): UseRecentSearchesReturn {
  const { data, loading, error, refetch } = useQuery<{
    recentSearches: RecentSearch[];
  }>(RECENT_SEARCHES_QUERY, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
  });

  return {
    recentSearches: data?.recentSearches || [],
    loading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a search result is a case
 */
export function isCaseResult(result: SearchResult): result is CaseSearchResult {
  return result.__typename === 'CaseSearchResult';
}

/**
 * Check if a search result is a document
 */
export function isDocumentResult(result: SearchResult): result is DocumentSearchResult {
  return result.__typename === 'DocumentSearchResult';
}

/**
 * Check if a search result is a client
 */
export function isClientResult(result: SearchResult): result is ClientSearchResult {
  return result.__typename === 'ClientSearchResult';
}

/**
 * Format search score as percentage
 */
export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get icon name for a search result type
 */
export function getResultIcon(result: SearchResult): string {
  if (isCaseResult(result)) {
    return 'briefcase';
  }
  if (isClientResult(result)) {
    return 'user';
  }
  return 'document';
}

/**
 * Get result title for display
 */
export function getResultTitle(result: SearchResult): string {
  if (isCaseResult(result)) {
    return `${result.case.caseNumber}: ${result.case.title}`;
  }
  if (isClientResult(result)) {
    return result.client.name;
  }
  return result.document.fileName;
}

/**
 * Get link URL for a search result
 */
export function getResultLink(result: SearchResult): string {
  if (isCaseResult(result)) {
    return `/cases/${result.case.id}`;
  }
  if (isClientResult(result)) {
    return `/clients/${result.client.id}`;
  }
  return `/documents/${result.document.id}`;
}
