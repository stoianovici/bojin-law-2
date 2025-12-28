/**
 * BriefFeed Component
 * OPS-298: Mobile Home - Fresh Build
 *
 * Scrollable activity feed showing company-wide communications and documents.
 * Supports pull-to-refresh and infinite scroll.
 */

'use client';

import React, { useCallback } from 'react';
import { RefreshCw, AlertCircle, ArrowDown } from 'lucide-react';
import { useBriefFeed, type BriefItem } from '../../hooks/useBriefFeed';
import { usePullToRefresh, type PullState } from '../../hooks/usePullToRefresh';
import { StaggerChildren, StaggerItem } from '../motion/StaggerChildren';
import { BriefCard, BriefCardSkeleton } from './BriefCard';

// ============================================================================
// Types
// ============================================================================

export interface BriefFeedProps {
  onItemTap?: (item: BriefItem) => void;
}

// ============================================================================
// Component
// ============================================================================

export function BriefFeed({ onItemTap }: BriefFeedProps) {
  const { items, loading, error, hasMore, refetch, fetchMore } = useBriefFeed({
    limit: 20,
  });

  // Pull-to-refresh functionality
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
    enabled: !loading && items.length > 0,
  });

  // Handle scroll to load more
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;

      if (isNearBottom && hasMore && !loading) {
        fetchMore();
      }
    },
    [hasMore, loading, fetchMore]
  );

  // Handle item tap - sets AI context
  const handleItemTap = useCallback(
    (item: BriefItem) => {
      onItemTap?.(item);
    },
    [onItemTap]
  );

  // Error state
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <AlertCircle className="w-12 h-12 text-linear-error mb-4" />
        <p className="text-linear-text-secondary text-center mb-4">Nu am putut încărca activitatea recentă</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover active:scale-[0.98] transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Încearcă din nou
        </button>
      </div>
    );
  }

  // Loading state (initial load)
  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        <BriefCardSkeleton />
        <BriefCardSkeleton />
        <BriefCardSkeleton />
        <BriefCardSkeleton />
      </div>
    );
  }

  // Empty state
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 bg-linear-bg-tertiary rounded-full flex items-center justify-center mb-4">
          <RefreshCw className="w-8 h-8 text-linear-text-muted" />
        </div>
        <p className="text-linear-text-secondary text-center">Nu există activitate recentă</p>
        <p className="text-sm text-linear-text-muted text-center mt-1">
          Emailurile și documentele vor apărea aici
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" onScroll={handleScroll} {...containerProps}>
      {/* Pull-to-refresh indicator */}
      <PullIndicator state={pullState} pullDistance={pullDistance} progress={progress} />

      {/* Feed items */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        <StaggerChildren className="space-y-3" staggerDelay={0.04}>
          {items.map((item) => (
            <StaggerItem key={item.id}>
              <BriefCard item={item} onTap={handleItemTap} />
            </StaggerItem>
          ))}
        </StaggerChildren>

        {/* Loading more indicator */}
        {loading && items.length > 0 && (
          <div className="flex justify-center py-4">
            <RefreshCw className="w-5 h-5 text-linear-text-muted animate-spin" />
          </div>
        )}

        {/* End of list */}
        {!hasMore && items.length > 0 && (
          <div className="text-center py-4 text-sm text-linear-text-muted">
            Acesta este tot pentru ultimele 7 zile
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Pull Indicator Component
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
      style={{
        height: pullDistance,
        top: 0,
      }}
    >
      <div
        className={`
          flex items-center justify-center w-10 h-10 rounded-full
          transition-all duration-200
          ${isReady || isRefreshing ? 'bg-linear-accent-muted' : 'bg-linear-bg-tertiary'}
        `}
        style={{
          opacity: Math.min(progress * 1.5, 1),
          transform: `scale(${0.5 + progress * 0.5}) rotate(${isReady ? 180 : progress * 180}deg)`,
        }}
      >
        {isRefreshing ? (
          <RefreshCw className="w-5 h-5 text-linear-accent animate-spin" />
        ) : (
          <ArrowDown
            className={`w-5 h-5 transition-colors ${isReady ? 'text-linear-accent' : 'text-linear-text-tertiary'}`}
          />
        )}
      </div>
    </div>
  );
}
