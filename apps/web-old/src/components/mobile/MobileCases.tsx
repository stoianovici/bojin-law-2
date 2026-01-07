/**
 * MobileCases Component
 * OPS-328: Mobile Page Consistency
 *
 * Mobile-optimized cases list with:
 * - Search bar at top
 * - Touch-friendly case cards
 * - Status filter chips
 * - Pull-to-refresh support
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Scale, Plus, RefreshCw, AlertCircle, Filter, X } from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';
import { MobileHeader } from './MobileHeader';
import { useCases, type CaseWithRelations } from '../../hooks/useCases';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { usePullToRefresh, type PullState } from '../../hooks/usePullToRefresh';
import type { CaseStatus } from '@legal-platform/types';

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Active: { label: 'Activ', color: 'text-green-400', bg: 'bg-green-500/20' },
  PendingApproval: { label: 'În aprobare', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  OnHold: { label: 'În așteptare', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  Closed: { label: 'Închis', color: 'text-linear-text-tertiary', bg: 'bg-linear-bg-tertiary' },
  Archived: { label: 'Arhivat', color: 'text-linear-text-muted', bg: 'bg-linear-bg-tertiary' },
};

// Case type labels
const TYPE_LABELS: Record<string, string> = {
  Litigation: 'Litigiu',
  Contract: 'Contract',
  Advisory: 'Consultanță',
  Criminal: 'Penal',
  Other: 'Altele',
};

export function MobileCases() {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  // Set AI assistant context
  useSetAIContext('cases');

  // Fetch cases
  const { cases, loading, error, refetch } = useCases({ status: statusFilter });

  // Filter cases by search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const query = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        c.client?.name?.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const {
    state: pullState,
    pullDistance,
    progress,
    containerRef,
    containerProps,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: !loading,
  });

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const handleCaseTap = useCallback(
    (caseId: string) => {
      router.push(`/cases/${caseId}`);
    },
    [router]
  );

  const handleNewCase = useCallback(() => {
    router.push('/cases/new');
  }, [router]);

  // Error state
  if (error && cases.length === 0) {
    return (
      <div className="min-h-screen bg-linear-bg-primary flex flex-col">
        <MobileHeader title="Dosare" onMenuClick={openDrawer} />
        <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
          <p className="text-linear-text-secondary text-center mb-4">
            Nu am putut încărca dosarele
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Încearcă din nou
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-bg-primary flex flex-col">
      <MobileHeader title="Dosare" onMenuClick={openDrawer} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} />

      {/* Search and Filter Bar */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-linear-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută dosare..."
              className="w-full pl-9 pr-4 py-2.5 bg-linear-bg-secondary border border-linear-border-subtle rounded-lg text-sm text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:border-linear-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="w-4 h-4 text-linear-text-muted" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-lg border transition-colors ${
              statusFilter || showFilters
                ? 'bg-linear-accent/20 border-linear-accent text-linear-accent'
                : 'bg-linear-bg-secondary border-linear-border-subtle text-linear-text-secondary'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>

          {/* New Case Button */}
          <button
            onClick={handleNewCase}
            className="p-2.5 rounded-lg bg-linear-accent text-white active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Status Filter Chips */}
        {showFilters && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <FilterChip
              label="Toate"
              active={!statusFilter}
              onClick={() => setStatusFilter(undefined)}
            />
            <FilterChip
              label="Activ"
              active={statusFilter === 'Active'}
              onClick={() => setStatusFilter('Active')}
            />
            <FilterChip
              label="În aprobare"
              active={statusFilter === 'PendingApproval'}
              onClick={() => setStatusFilter('PendingApproval')}
            />
            <FilterChip
              label="În așteptare"
              active={statusFilter === 'OnHold'}
              onClick={() => setStatusFilter('OnHold')}
            />
            <FilterChip
              label="Închis"
              active={statusFilter === 'Closed'}
              onClick={() => setStatusFilter('Closed')}
            />
          </div>
        )}
      </div>

      {/* Cases List */}
      <main className="flex-1 overflow-hidden">
        <div ref={containerRef} className="h-full overflow-y-auto" {...containerProps}>
          {/* Pull-to-refresh indicator */}
          <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

          <div
            className="transition-transform duration-200"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            }}
          >
            {/* Loading State */}
            {loading && cases.length === 0 && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <CaseCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredCases.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
                  <Scale className="w-8 h-8 text-linear-text-muted" />
                </div>
                <p className="text-linear-text-secondary text-center font-medium">
                  {searchQuery ? 'Niciun rezultat' : 'Niciun dosar'}
                </p>
                <p className="text-sm text-linear-text-muted text-center mt-1">
                  {searchQuery
                    ? 'Încercați alte cuvinte cheie'
                    : 'Creați primul dosar pentru a începe'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleNewCase}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg active:scale-95 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    Dosar nou
                  </button>
                )}
              </div>
            )}

            {/* Cases List */}
            {filteredCases.length > 0 && (
              <div className="p-4 space-y-3">
                {filteredCases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onTap={() => handleCaseTap(caseItem.id)}
                  />
                ))}

                {/* Results count */}
                <div className="text-center py-2 text-sm text-linear-text-muted">
                  {filteredCases.length} {filteredCases.length === 1 ? 'dosar' : 'dosare'}
                </div>
              </div>
            )}

            {/* Loading more indicator */}
            {loading && cases.length > 0 && (
              <div className="flex justify-center py-4">
                <RefreshCw className="w-5 h-5 text-linear-text-muted animate-spin" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// CaseCard Component
// ============================================================================

interface CaseCardProps {
  caseItem: CaseWithRelations;
  onTap: () => void;
}

function CaseCard({ caseItem, onTap }: CaseCardProps) {
  const statusConfig = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.Active;
  const typeLabel = TYPE_LABELS[caseItem.type] || caseItem.type;

  // Get initials for team members (max 3)
  const teamInitials = caseItem.teamMembers?.slice(0, 3).map((tm) => {
    const first = tm.user?.firstName?.[0] || '';
    const last = tm.user?.lastName?.[0] || '';
    return (first + last).toUpperCase();
  });

  return (
    <button
      onClick={onTap}
      className="w-full text-left p-4 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl active:scale-[0.98] active:bg-linear-bg-tertiary transition-all"
    >
      {/* Header: Case number + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-linear-text-muted">
          {caseItem.caseNumber.slice(-12)}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-linear-text-primary mb-2 line-clamp-2">
        {caseItem.title}
      </h3>

      {/* Details */}
      <div className="flex items-center justify-between text-xs text-linear-text-secondary">
        <div className="flex items-center gap-3">
          <span className="truncate max-w-[120px]">{caseItem.client?.name}</span>
          <span className="text-linear-text-muted">·</span>
          <span>{typeLabel}</span>
        </div>

        {/* Team Avatars */}
        {teamInitials && teamInitials.length > 0 && (
          <div className="flex -space-x-1.5">
            {teamInitials.map((initials, idx) => (
              <div
                key={idx}
                className="w-6 h-6 rounded-full bg-linear-accent/20 border border-linear-bg-secondary flex items-center justify-center"
              >
                <span className="text-[10px] font-medium text-linear-accent">{initials}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// CaseCardSkeleton Component
// ============================================================================

function CaseCardSkeleton() {
  return (
    <div className="p-4 bg-linear-bg-secondary border border-linear-border-subtle rounded-xl animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-24 bg-linear-bg-tertiary rounded" />
        <div className="h-4 w-16 bg-linear-bg-tertiary rounded-full" />
      </div>
      <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-2" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-32 bg-linear-bg-tertiary rounded" />
        <div className="flex -space-x-1.5">
          <div className="w-6 h-6 rounded-full bg-linear-bg-tertiary" />
          <div className="w-6 h-6 rounded-full bg-linear-bg-tertiary" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FilterChip Component
// ============================================================================

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-linear-accent text-white'
          : 'bg-linear-bg-tertiary text-linear-text-secondary active:bg-linear-bg-quaternary'
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// PullIndicator Component
// ============================================================================

interface PullIndicatorProps {
  state: PullState;
  pullDistance: number;
  progress: number;
}

function PullIndicator({ state, pullDistance, progress }: PullIndicatorProps) {
  if (pullDistance === 0 && state === 'idle') return null;

  const isRefreshing = state === 'refreshing';
  const isReady = state === 'ready';

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center overflow-hidden z-10"
      style={{ height: pullDistance, top: 0 }}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
          isReady || isRefreshing ? 'bg-linear-accent-muted' : 'bg-linear-bg-tertiary'
        }`}
        style={{
          opacity: Math.min(progress * 1.5, 1),
          transform: `scale(${0.5 + progress * 0.5})`,
        }}
      >
        <RefreshCw
          className={`w-5 h-5 transition-colors ${
            isRefreshing
              ? 'text-linear-accent animate-spin'
              : isReady
                ? 'text-linear-accent'
                : 'text-linear-text-tertiary'
          }`}
        />
      </div>
    </div>
  );
}
