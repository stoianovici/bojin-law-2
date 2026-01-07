'use client';

/**
 * MergeActionBar Component
 * Floating action bar shown when 2+ rows are selected
 *
 * Features:
 * - Selected count badge
 * - "Îmbină selectate" button (opens merge dialog)
 * - "Deselectează" button (clears selection)
 * - Positioned at bottom of timesheet
 */

import { X, Merge } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/button';

// ============================================================================
// Types
// ============================================================================

export interface MergeActionBarProps {
  selectedCount: number;
  onMerge: () => void;
  onDeselect: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function MergeActionBar({
  selectedCount,
  onMerge,
  onDeselect,
  className,
}: MergeActionBarProps) {
  // Only show when 2+ selected
  if (selectedCount < 2) return null;

  return (
    <div
      className={clsx(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3',
        'bg-linear-bg-secondary border border-linear-border-subtle rounded-lg shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        className
      )}
    >
      {/* Selected count badge */}
      <div className="flex items-center gap-2 px-3 py-1 bg-linear-accent/20 rounded-full">
        <span className="text-sm font-medium text-linear-accent">{selectedCount} selectate</span>
      </div>

      {/* Merge button */}
      <Button onClick={onMerge} className="bg-linear-accent hover:bg-linear-accent/90 text-white">
        <Merge className="h-4 w-4 mr-2" />
        Îmbină selectate
      </Button>

      {/* Deselect button */}
      <Button
        variant="ghost"
        onClick={onDeselect}
        className="text-linear-text-secondary hover:text-linear-text-primary"
      >
        <X className="h-4 w-4 mr-2" />
        Deselectează
      </Button>
    </div>
  );
}

MergeActionBar.displayName = 'MergeActionBar';

export default MergeActionBar;
