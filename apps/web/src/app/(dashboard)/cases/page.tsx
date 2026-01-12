/* eslint-disable react-hooks/preserve-manual-memoization */
'use client';

import * as React from 'react';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCasesStore } from '@/store/casesStore';
import { useQuery } from '@/hooks/useGraphQL';
import { GET_CASES } from '@/graphql/queries';
import { useAuth } from '@/hooks/useAuth';
import { useCaseKeyboardNav } from '@/hooks/useCaseKeyboardNav';
import { usePendingCases } from '@/hooks/useCaseApproval';
import { Card } from '@/components/ui';
import { CaseListPanel, CaseDetailPanel, type Case } from '@/components/cases';

// GraphQL query response type
interface GetCasesResponse {
  cases: Case[];
}

// Loading skeleton for the list panel
function ListLoadingSkeleton() {
  return (
    <div className="w-[280px] xl:w-[400px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary">
      {/* Header skeleton */}
      <div className="px-6 py-5 border-b border-linear-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-20 bg-linear-bg-tertiary rounded animate-pulse" />
          <div className="h-9 w-24 bg-linear-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="h-10 bg-linear-bg-tertiary rounded animate-pulse" />
      </div>
      {/* Filter skeleton */}
      <div className="flex gap-2 px-6 py-3 border-b border-linear-border-subtle">
        <div className="h-7 w-16 bg-linear-bg-tertiary rounded animate-pulse" />
        <div className="h-7 w-14 bg-linear-bg-tertiary rounded animate-pulse" />
        <div className="h-7 w-20 bg-linear-bg-tertiary rounded animate-pulse" />
      </div>
      {/* List skeleton */}
      <div className="flex-1 p-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="py-4 px-6 border-b border-linear-border-subtle animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-linear-bg-tertiary" />
              <div className="h-3 w-24 bg-linear-bg-tertiary rounded" />
              <div className="ml-auto h-3 w-12 bg-linear-bg-tertiary rounded" />
            </div>
            <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-1" />
            <div className="h-3 w-1/2 bg-linear-bg-tertiary rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CasesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Check if user is admin (partner)
  const isAdmin = user?.role === 'ADMIN';

  // Pending mode state (for Partners viewing pending approval cases)
  const [pendingMode, setPendingMode] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    selectedCaseId,
    selectCase,
    showMyCases,
    setShowMyCases,
    selectedStatuses,
    selectedTypes,
  } = useCasesStore();

  // NOTE: Removed automatic showMyCases filtering for non-admin users
  // All firm members should see all cases (financial data is protected by @requiresFinancialAccess directive)

  // Fetch all cases (skip until auth is ready to ensure x-mock-user header is sent)
  const shouldSkipQuery = authLoading || !isAuthenticated;

  // DEBUG: Log auth state for cases query
  console.log('[CasesPage] Auth state:', {
    authLoading,
    isAuthenticated,
    shouldSkipQuery,
    userRole: user?.role,
    userEmail: user?.email,
  });

  const { data, loading, error, refetch: refetchCases } = useQuery<GetCasesResponse>(GET_CASES, {
    skip: shouldSkipQuery,
  });

  // DEBUG: Log query result
  console.log('[CasesPage] Query result:', {
    loading,
    error: error?.message,
    casesCount: data?.cases?.length,
    shouldSkipQuery,
  });

  const cases: Case[] = useMemo(() => data?.cases || [], [data?.cases]);

  // Fetch pending cases (for Partners)
  const {
    pendingCases,
    loading: pendingLoading,
    error: pendingError,
    refetch: refetchPendingCases,
  } = usePendingCases();

  // Handler to refresh all case data (called after approval/rejection)
  const handleApprovalComplete = useCallback(async () => {
    await Promise.all([refetchCases(), refetchPendingCases()]);
  }, [refetchCases, refetchPendingCases]);

  // Use pending cases when in pending mode (Partners only)
  const activeCases = pendingMode && isAdmin ? (pendingCases as Case[]) : cases;
  const activeLoading = authLoading || (pendingMode && isAdmin ? pendingLoading : loading);
  const activeError = pendingMode && isAdmin ? pendingError : error;

  // Filter cases based on all active filters
  const filteredCases = useMemo(() => {
    let filtered = activeCases;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.caseNumber.toLowerCase().includes(query) ||
          c.client.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    // Filter by "My Cases" - cases where current user is a team member
    if (showMyCases && user?.id) {
      filtered = filtered.filter((c) => c.teamMembers.some((m) => m.user.id === user.id));
    }

    // Filter by status
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((c) =>
        selectedStatuses.includes(c.status as (typeof selectedStatuses)[number])
      );
    }

    // Filter by type
    if (selectedTypes.length > 0) {
      filtered = filtered.filter((c) => selectedTypes.includes(c.type));
    }

    return filtered;
  }, [activeCases, searchQuery, showMyCases, user?.id, selectedStatuses, selectedTypes]);

  // Get selected case for detail panel
  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return activeCases.find((c) => c.id === selectedCaseId) || null;
  }, [activeCases, selectedCaseId]);

  // Handle case selection
  const handleSelectCase = (caseId: string) => {
    selectCase(caseId);
  };

  // Handle new case
  const handleNewCase = () => {
    router.push('/cases/new');
  };

  // Keyboard navigation
  useCaseKeyboardNav({
    cases: filteredCases,
    selectedCaseId,
    selectCase: handleSelectCase,
    onNewCase: handleNewCase,
    onEnter: () => {
      // Could navigate to full case page or open a modal
      if (selectedCaseId) {
        // For now, do nothing - case details are already visible
      }
    },
  });

  // Error state
  if (activeError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <p className="text-linear-error mb-2">Eroare la incarcarea cazurilor</p>
          <p className="text-sm text-linear-text-secondary">{activeError.message}</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Case List */}
        {activeLoading ? (
          <ListLoadingSkeleton />
        ) : (
          <CaseListPanel
            cases={filteredCases}
            selectedCaseId={selectedCaseId}
            onSelectCase={handleSelectCase}
            onNewCase={handleNewCase}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isAdmin={isAdmin}
            showAllCases={!showMyCases}
            onToggleShowAllCases={() => setShowMyCases(!showMyCases)}
            onPendingModeChange={(isPending) => {
              setPendingMode(isPending);
              selectCase(null); // Clear selection when switching modes
            }}
          />
        )}

        {/* Right Panel - Case Detail */}
        <CaseDetailPanel
          caseData={selectedCase}
          onEdit={() => {
            if (selectedCaseId) {
              router.push(`/cases/${selectedCaseId}/edit`);
            }
          }}
          onApprovalComplete={handleApprovalComplete}
        />
      </div>
    </>
  );
}
