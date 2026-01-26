'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CASES } from '@/graphql/queries';
import { useDebounce } from './useDebounce';

// ============================================
// Types
// ============================================

export type CaseStatus = 'Active' | 'Pending' | 'Closed' | 'OnHold';

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  type: string;
  client: {
    id: string;
    name: string;
  } | null;
  teamMembers: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  referenceNumbers: string[] | null;
  updatedAt: string;
}

interface CaseEdge {
  node: Case;
  cursor: string;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface PaginatedCasesData {
  paginatedCases: {
    edges: CaseEdge[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

// ============================================
// Constants
// ============================================

const PAGE_SIZE = 50;

// ============================================
// Hook
// ============================================

export function useCases() {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'All'>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search query to prevent excessive filtering on rapid typing
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, loading, error, refetch, fetchMore } = useQuery<PaginatedCasesData>(GET_CASES, {
    variables: {
      status: statusFilter === 'All' ? undefined : statusFilter,
      first: PAGE_SIZE,
    },
    fetchPolicy: 'cache-and-network',
  });

  // Extract cases from connection edges
  const allCases = useMemo(() => {
    return data?.paginatedCases?.edges?.map((edge) => edge.node) ?? [];
  }, [data?.paginatedCases?.edges]);

  // Pagination info
  const hasNextPage = data?.paginatedCases?.pageInfo?.hasNextPage ?? false;
  const totalCount = data?.paginatedCases?.totalCount ?? 0;

  // Load more function using Apollo's fetchMore
  const loadMore = useCallback(async () => {
    if (!data?.paginatedCases?.pageInfo?.hasNextPage || loadingMore) return;

    setLoadingMore(true);
    try {
      await fetchMore({
        variables: {
          after: data.paginatedCases.pageInfo.endCursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            paginatedCases: {
              ...fetchMoreResult.paginatedCases,
              edges: [...prev.paginatedCases.edges, ...fetchMoreResult.paginatedCases.edges],
            },
          };
        },
      });
    } finally {
      setLoadingMore(false);
    }
  }, [data?.paginatedCases?.pageInfo, fetchMore, loadingMore]);

  // Filter by search query locally - memoized to prevent re-computation on unrelated re-renders
  // Uses debounced search query so filtering only runs after user stops typing
  const filteredCases = useMemo(() => {
    return allCases.filter((caseItem) => {
      if (!debouncedSearchQuery.trim()) return true;

      const query = debouncedSearchQuery.toLowerCase();
      return (
        caseItem.caseNumber.toLowerCase().includes(query) ||
        caseItem.title.toLowerCase().includes(query) ||
        caseItem.client?.name.toLowerCase().includes(query) ||
        caseItem.referenceNumbers?.some((ref) => ref.toLowerCase().includes(query))
      );
    });
  }, [allCases, debouncedSearchQuery]);

  // Sort by updated date (most recent first) - memoized
  const sortedCases = useMemo(() => {
    return [...filteredCases].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [filteredCases]);

  return {
    cases: sortedCases,
    loading,
    loadingMore,
    error,
    refetch,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    // Pagination
    hasNextPage,
    totalCount,
    loadMore,
  };
}
