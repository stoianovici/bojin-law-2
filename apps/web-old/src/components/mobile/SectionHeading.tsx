/**
 * SectionHeading Component
 * OPS-307: Newspaper-style section divider for mobile home feed
 *
 * Displays a simple section heading with:
 * - Small caps title (uppercase, letter-spacing)
 * - Horizontal rule extending to the right
 * - Count badge at the end
 * - No collapse behavior (all sections visible)
 */

'use client';

import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

interface SectionHeadingProps {
  /** Section title (Romanian, will be uppercased) */
  title: string;
  /** Item count for the badge */
  count: number;
  /** Optional className for the container */
  className?: string;
  /** If true, adds top margin (default: true for non-first sections) */
  withTopMargin?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SectionHeading({
  title,
  count,
  className,
  withTopMargin = true,
}: SectionHeadingProps) {
  return (
    <div className={clsx('flex items-center gap-3 px-4 py-2', withTopMargin && 'mt-4', className)}>
      <span className="text-xs font-semibold text-linear-text-tertiary uppercase tracking-wide whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-linear-border-subtle" />
      <span className="text-xs text-linear-text-muted">({count})</span>
    </div>
  );
}
