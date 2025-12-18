/**
 * Unified Timeline Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 1, 4)
 *
 * Displays all communication types in chronological order with infinite scroll
 */

'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useCaseTimeline, useChannelMetadata, type TimelineFilter } from '@/hooks/useCaseTimeline';
import { TimelineEntryCard } from './TimelineEntryCard';
import { TimelineFilterBar } from './TimelineFilterBar';
import { InternalNoteComposer } from './InternalNoteComposer';
import { Loader2 } from 'lucide-react';

interface UnifiedTimelineProps {
  caseId: string;
  className?: string;
  showFilters?: boolean;
  showComposer?: boolean;
  /** Hide action buttons (reply, forward, etc.) for read-only views like case details */
  readOnly?: boolean;
  onEntryClick?: (entryId: string) => void;
}

export function UnifiedTimeline({
  caseId,
  className = '',
  showFilters = true,
  showComposer = true,
  readOnly = false,
  onEntryClick,
}: UnifiedTimelineProps) {
  const [filter, setFilter] = React.useState<Omit<TimelineFilter, 'caseId'>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { entries, totalCount, hasMore, loading, error, loadMore, refetch } = useCaseTimeline(
    caseId,
    filter
  );

  const { isChannelDisabled } = useChannelMetadata();

  // Infinite scroll observer
  useEffect(() => {
    if (loading) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadMore]);

  const handleFilterChange = useCallback((newFilter: Partial<TimelineFilter>) => {
    setFilter((prev) => ({
      ...prev,
      ...newFilter,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilter({});
  }, []);

  const handleNoteCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  // Calculate active filter count
  const activeFilterCount = Object.values(filter).filter(
    (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
        <p className="text-sm text-red-600">Eroare la încărcarea cronologiei: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cronologie Comunicări</h2>
          <p className="text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? 'înregistrare' : 'înregistrări'}
            {activeFilterCount > 0 && ` (filtrat)`}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <TimelineFilterBar
          filter={filter}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          activeCount={activeFilterCount}
          className="mt-4"
        />
      )}

      {/* Note Composer */}
      {showComposer && (
        <InternalNoteComposer caseId={caseId} onNoteCreated={handleNoteCreated} className="mt-4" />
      )}

      {/* Timeline Feed */}
      <div
        role="feed"
        aria-busy={loading}
        aria-label="Communication timeline"
        className="mt-4 space-y-4"
      >
        {entries.length === 0 && !loading ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm text-gray-500">
              {activeFilterCount > 0
                ? 'Nicio comunicare nu corespunde filtrelor'
                : 'Nu există comunicări încă'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Șterge filtrele
              </button>
            )}
          </div>
        ) : (
          entries.map((entry, index) => (
            <TimelineEntryCard
              key={entry.id}
              entry={entry}
              onClick={onEntryClick ? () => onEntryClick(entry.id) : undefined}
              isDisabled={isChannelDisabled(entry.channelType)}
              readOnly={readOnly}
              aria-setsize={totalCount}
              aria-posinset={index + 1}
            />
          ))
        )}

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="h-4" />

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Se încarcă...</span>
          </div>
        )}

        {/* End of list */}
        {!hasMore && entries.length > 0 && !loading && (
          <p className="py-4 text-center text-sm text-gray-400">Sfârșitul cronologiei</p>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for timeline
 */
export function UnifiedTimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-4 w-1/4 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/3 rounded bg-gray-200" />
              <div className="mt-3 h-16 w-full rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default UnifiedTimeline;
