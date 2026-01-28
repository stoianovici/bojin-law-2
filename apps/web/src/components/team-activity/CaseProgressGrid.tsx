'use client';

/**
 * CaseProgressGrid Component
 * Displays a responsive grid of CaseProgressCard components for the Team Activity Overview
 *
 * Features:
 * - Responsive CSS grid layout (1 column mobile, 2 tablet, 3 desktop)
 * - Loading state with skeleton cards
 * - Empty state with localized message
 * - Optional pagination for large datasets (>20 cases)
 */

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Briefcase } from 'lucide-react';
import { CaseProgressCard } from './CaseProgressCard';
import type { CaseProgress } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

export interface CaseProgressGridProps {
  cases: CaseProgress[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const INITIAL_DISPLAY_COUNT = 20;
const SKELETON_CARD_COUNT = 6;

// ============================================================================
// Skeleton Card Component
// ============================================================================

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-linear-bg-tertiary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-24 bg-linear-bg-tertiary rounded mb-2" />
          <div className="h-5 w-full bg-linear-bg-tertiary rounded" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="h-14 bg-linear-bg-tertiary rounded-lg" />
        <div className="h-14 bg-linear-bg-tertiary rounded-lg" />
      </div>

      {/* Team avatars skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-full bg-linear-bg-tertiary" />
        <div className="h-7 w-7 rounded-full bg-linear-bg-tertiary" />
        <div className="h-7 w-7 rounded-full bg-linear-bg-tertiary" />
      </div>

      {/* Footer skeleton */}
      <div className="h-3 w-32 bg-linear-bg-tertiary rounded" />
    </div>
  );
}

// ============================================================================
// Loading State Component
// ============================================================================

function LoadingGrid({ className }: { className?: string }) {
  return (
    <div className={clsx('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4', className)}>
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ className }: { className?: string }) {
  return (
    <div className={clsx('py-12 text-center', className)}>
      <Briefcase className="h-12 w-12 text-linear-text-muted mx-auto mb-4" aria-hidden="true" />
      <p className="text-sm text-linear-text-secondary">
        Nu există dosare active în această perioadă
      </p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CaseProgressGrid({ cases, loading = false, className }: CaseProgressGridProps) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const handleLoadMore = useCallback(() => {
    setDisplayCount((prev) => prev + INITIAL_DISPLAY_COUNT);
  }, []);

  // Show loading state
  if (loading) {
    return <LoadingGrid className={className} />;
  }

  // Show empty state if no cases
  if (cases.length === 0) {
    return <EmptyState className={className} />;
  }

  // Determine if we need pagination
  const hasMore = cases.length > displayCount;
  const displayedCases = cases.slice(0, displayCount);

  return (
    <div className={className}>
      {/* Grid of case cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayedCases.map((caseProgress) => (
          <CaseProgressCard key={caseProgress.case.id} caseProgress={caseProgress} />
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className={clsx(
              'inline-flex items-center px-4 py-2 rounded-lg',
              'text-sm font-medium',
              'bg-linear-bg-secondary text-linear-text-primary',
              'border border-linear-border-subtle',
              'hover:bg-linear-bg-tertiary hover:border-linear-border',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2 focus-visible:ring-offset-linear-bg-primary'
            )}
          >
            Încarcă mai mult
          </button>
        </div>
      )}
    </div>
  );
}

CaseProgressGrid.displayName = 'CaseProgressGrid';

export default CaseProgressGrid;
