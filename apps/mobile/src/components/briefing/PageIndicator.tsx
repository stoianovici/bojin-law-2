'use client';

/**
 * PageIndicator Component
 *
 * Displays dots showing current page position in the Flipboard-style briefing.
 * Subtle design positioned at the bottom of the screen.
 */

import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

export interface PageIndicatorProps {
  totalPages: number;
  currentPage: number;
  className?: string;
}

// ============================================
// Component
// ============================================

export function PageIndicator({ totalPages, currentPage, className }: PageIndicatorProps) {
  // Don't show indicator for single page
  if (totalPages <= 1) return null;

  // Limit visible dots for many pages
  const maxVisibleDots = 7;
  const showCompact = totalPages > maxVisibleDots;

  if (showCompact) {
    // Show current / total format for many pages
    return (
      <div className={clsx('flex items-center justify-center gap-1', className)}>
        <span className="text-xs font-medium text-text-primary">{currentPage + 1}</span>
        <span className="text-xs text-text-tertiary">/</span>
        <span className="text-xs text-text-tertiary">{totalPages}</span>
      </div>
    );
  }

  return (
    <div
      className={clsx('flex items-center justify-center gap-1.5', className)}
      role="navigation"
      aria-label={`Pagina ${currentPage + 1} din ${totalPages}`}
    >
      {Array.from({ length: totalPages }).map((_, index) => {
        const isActive = index === currentPage;
        const isNear = Math.abs(index - currentPage) === 1;

        return (
          <div
            key={index}
            className={clsx(
              'rounded-full transition-all duration-300',
              isActive
                ? 'w-6 h-1.5 bg-accent'
                : isNear
                  ? 'w-1.5 h-1.5 bg-text-tertiary/50'
                  : 'w-1.5 h-1.5 bg-text-tertiary/30'
            )}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
