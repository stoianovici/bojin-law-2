'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineEvent } from './TimelineEvent';

// ============================================================================
// Types (exported for use by TimelineEvent and ChapterAccordion)
// ============================================================================

export type CaseChapterEventType =
  | 'Document'
  | 'Email'
  | 'Task'
  | 'CourtOutcome'
  | 'ContractSigned'
  | 'Negotiation'
  | 'Deadline'
  | 'ClientDecision'
  | 'TeamChange'
  | 'StatusChange'
  | 'Milestone';

export interface DocumentQuickInfo {
  id: string;
  name: string;
  fileType: string;
  size?: number;
  uploadedAt?: string;
}

export interface EmailQuickInfo {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
}

export interface CaseChapterEvent {
  id: string;
  eventType: CaseChapterEventType;
  title: string;
  summary: string;
  occurredAt: string;
  metadata: {
    documentIds?: string[];
    emailIds?: string[];
    documents?: DocumentQuickInfo[];
    emails?: EmailQuickInfo[];
  };
}

export interface TimelineViewProps {
  events: CaseChapterEvent[];
  chapterId?: string;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const INITIAL_LOAD_COUNT = 20;
const LOAD_MORE_COUNT = 20;

// Romanian month names for date formatting
const ROMANIAN_MONTHS = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date to Romanian format (e.g., "15 Ianuarie 2024")
 */
function formatRomanianDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = ROMANIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Get date key for grouping (YYYY-MM-DD)
 */
function getDateKey(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

/**
 * Group events by date
 */
function groupEventsByDate(events: CaseChapterEvent[]): Map<string, CaseChapterEvent[]> {
  const grouped = new Map<string, CaseChapterEvent[]>();

  for (const event of events) {
    const dateKey = getDateKey(event.occurredAt);
    const existing = grouped.get(dateKey) || [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

// ============================================================================
// Sub-components
// ============================================================================

interface DateSeparatorProps {
  date: string;
}

function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="relative flex items-center py-2">
      {/* Left line */}
      <div className="flex-1 h-px bg-linear-border-subtle" />

      {/* Date text */}
      <span className="px-4 text-xs font-medium text-linear-text-secondary bg-linear-bg-primary">
        {formatRomanianDate(date)}
      </span>

      {/* Right line */}
      <div className="flex-1 h-px bg-linear-border-subtle" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TimelineView({ events, chapterId, loading = false, className }: TimelineViewProps) {
  // State for lazy loading
  const [displayCount, setDisplayCount] = useState(INITIAL_LOAD_COUNT);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Determine if we need lazy loading
  const hasMore = displayCount < events.length;

  // Slice events for display
  const displayedEvents = useMemo(() => {
    return events.slice(0, displayCount);
  }, [events, displayCount]);

  // Group displayed events by date
  const groupedEvents = useMemo(() => {
    return groupEventsByDate(displayedEvents);
  }, [displayedEvents]);

  // Get sorted date keys (most recent first for typical timeline)
  const sortedDateKeys = useMemo(() => {
    return Array.from(groupedEvents.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [groupedEvents]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + LOAD_MORE_COUNT, events.length));
  }, [events.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, handleLoadMore]);

  // Loading state
  if (loading && events.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-linear-text-tertiary" />
        <span className="ml-2 text-sm text-linear-text-secondary">Se incarca evenimentele...</span>
      </div>
    );
  }

  // Empty state
  if (!loading && events.length === 0) {
    return (
      <div className={cn('py-8 text-center', className)}>
        <p className="text-sm text-linear-text-tertiary">Nu exista evenimente in acest capitol.</p>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical timeline line on the left */}
      <div
        className="absolute left-3 top-0 bottom-0 w-0.5 bg-linear-border-subtle"
        aria-hidden="true"
      />

      {/* Timeline content */}
      <div className="relative">
        {sortedDateKeys.map((dateKey, dateIndex) => {
          const dateEvents = groupedEvents.get(dateKey) || [];

          return (
            <div key={dateKey}>
              {/* Date separator */}
              <div className="ml-8 mb-2">
                <DateSeparator date={dateKey} />
              </div>

              {/* Events for this date */}
              <div className="flex flex-col gap-4">
                {dateEvents.map((event) => (
                  <div key={event.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-1.5 top-4 w-3 h-3 rounded-full bg-linear-bg-primary border-2 border-linear-border-subtle z-10"
                      aria-hidden="true"
                    />

                    {/* Event component */}
                    <TimelineEvent event={event} />
                  </div>
                ))}
              </div>

              {/* Spacing between date groups */}
              {dateIndex < sortedDateKeys.length - 1 && <div className="h-4" aria-hidden="true" />}
            </div>
          );
        })}

        {/* Load more trigger (for intersection observer) */}
        {hasMore && (
          <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-linear-text-muted" />
          </div>
        )}

        {/* End of timeline indicator */}
        {!hasMore && events.length > 0 && (
          <div className="ml-8 py-4 text-center">
            <p className="text-xs text-linear-text-muted">Sfarsitul cronologiei</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelineView;
