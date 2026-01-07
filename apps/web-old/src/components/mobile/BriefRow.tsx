/**
 * BriefRow Component
 * OPS-306: BriefRow Component
 *
 * Typography-first row for the newspaper brief style mobile home.
 * No card wrapper, just text layout with visual hierarchy.
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { BriefItem } from '../../hooks/useBriefFeed';

// ============================================================================
// Types
// ============================================================================

export interface BriefRowProps {
  item: BriefItem;
  onTap?: (item: BriefItem) => void;
}

// ============================================================================
// Component
// ============================================================================

export function BriefRow({ item, onTap }: BriefRowProps) {
  const handleClick = () => {
    onTap?.(item);
  };

  // Build the title - prefer subtitle (sender name) over title (action type)
  const displayTitle = item.subtitle || item.title;

  // Build preview text
  const displayPreview = item.subtitle ? item.preview || item.title : item.preview;

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'w-full text-left py-3 px-4',
        'transition-all duration-100',
        'active:bg-linear-bg-hover active:scale-[0.98]',
        'focus:outline-none focus:bg-linear-bg-hover'
      )}
    >
      {/* Title - Bold sender/action */}
      <div className="font-semibold text-linear-text-primary leading-snug">{displayTitle}</div>

      {/* Preview - Normal weight, 1-2 lines */}
      {displayPreview && (
        <div className="text-sm text-linear-text-secondary leading-snug line-clamp-2 mt-0.5">
          {displayPreview}
        </div>
      )}

      {/* Metadata - Small with tree prefix */}
      <div className="text-xs text-linear-text-muted mt-1 flex items-center gap-1">
        <span className="text-linear-border-default">└</span>
        {item.caseName && (
          <>
            <span className="truncate max-w-[180px]">{item.caseName}</span>
            <span>·</span>
          </>
        )}
        <span className="whitespace-nowrap">{item.relativeTime}</span>
      </div>
    </button>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function BriefRowSkeleton() {
  return (
    <div className="py-3 px-4 animate-pulse">
      {/* Title skeleton */}
      <div className="h-5 bg-linear-bg-tertiary rounded w-2/5 mb-1.5" />

      {/* Preview skeleton - two lines */}
      <div className="space-y-1">
        <div className="h-4 bg-linear-bg-tertiary rounded w-full" />
        <div className="h-4 bg-linear-bg-tertiary rounded w-3/4" />
      </div>

      {/* Metadata skeleton */}
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-linear-border-subtle">└</span>
        <div className="h-3 bg-linear-bg-tertiary rounded w-24" />
        <span className="text-linear-border-subtle">·</span>
        <div className="h-3 bg-linear-bg-tertiary rounded w-12" />
      </div>
    </div>
  );
}
