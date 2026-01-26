'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CASES } from '@/graphql/queries';

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

interface CasesData {
  cases: Case[];
}

// ============================================
// Hook
// ============================================

export function useCases() {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'All'>('Active');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, loading, error, refetch } = useQuery<CasesData>(GET_CASES, {
    variables: {
      status: statusFilter === 'All' ? undefined : statusFilter,
    },
    fetchPolicy: 'cache-and-network',
  });

  // Filter by search query locally
  const filteredCases =
    data?.cases?.filter((caseItem) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        caseItem.caseNumber.toLowerCase().includes(query) ||
        caseItem.title.toLowerCase().includes(query) ||
        caseItem.client?.name.toLowerCase().includes(query) ||
        caseItem.referenceNumbers?.some((ref) => ref.toLowerCase().includes(query))
      );
    }) ?? [];

  // Sort by updated date (most recent first)
  const sortedCases = [...filteredCases].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return {
    cases: sortedCases,
    loading,
    error,
    refetch,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
  };
}
