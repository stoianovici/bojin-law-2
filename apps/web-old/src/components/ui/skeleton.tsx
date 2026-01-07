'use client';

import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'text-sm' | 'title' | 'avatar' | 'button' | 'card' | 'row';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use shimmer gradient animation instead of pulse */
  shimmer?: boolean;
  /** Preset variant for common skeleton shapes */
  variant?: SkeletonVariant;
  /** Width override (e.g., "w-1/2", "w-32") */
  width?: string;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full',
  'text-sm': 'h-3 w-3/4',
  title: 'h-6 w-1/2',
  avatar: 'h-10 w-10 rounded-full',
  button: 'h-9 w-24 rounded-md',
  card: 'h-32 w-full rounded-lg',
  row: 'h-12 w-full rounded-md',
};

/**
 * Skeleton loading placeholder with shimmer or pulse animation
 *
 * Default uses shimmer gradient for a more polished loading effect.
 * Uses Linear design tokens for dark mode compatibility.
 * Set shimmer={false} to use the classic pulse animation.
 *
 * @example
 * // Basic usage
 * <Skeleton className="h-4 w-32" />
 *
 * // With variant
 * <Skeleton variant="title" />
 * <Skeleton variant="text" />
 * <Skeleton variant="avatar" />
 *
 * // Table row skeleton
 * <Skeleton variant="row" />
 */
function Skeleton({ className, shimmer = true, variant, width, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md',
        shimmer ? 'skeleton-shimmer' : 'skeleton',
        variant && VARIANT_CLASSES[variant],
        width,
        className
      )}
      {...props}
    />
  );
}

// ====================================================================
// Compound Skeletons for Common Patterns
// ====================================================================

interface SkeletonTextBlockProps {
  lines?: number;
  className?: string;
}

/**
 * Multi-line text skeleton
 */
function SkeletonTextBlock({ lines = 3, className }: SkeletonTextBlockProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? 'w-2/3' : undefined} />
      ))}
    </div>
  );
}

interface SkeletonListItemProps {
  hasAvatar?: boolean;
  hasAction?: boolean;
  className?: string;
}

/**
 * List item skeleton with optional avatar and action button
 */
function SkeletonListItem({
  hasAvatar = false,
  hasAction = false,
  className,
}: SkeletonListItemProps) {
  return (
    <div className={cn('flex items-center gap-3 p-3', className)}>
      {hasAvatar && <Skeleton variant="avatar" />}
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="w-1/2" />
        <Skeleton variant="text-sm" width="w-1/3" />
      </div>
      {hasAction && <Skeleton variant="button" />}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Table skeleton with rows and columns
 */
function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-4 p-3 border-b border-linear-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text-sm" width={i === 0 ? 'w-1/3' : 'w-1/4'} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width={colIndex === 0 ? 'w-1/3' : 'w-1/4'} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  hasImage?: boolean;
  className?: string;
}

/**
 * Card skeleton with optional image area
 */
function SkeletonCard({ hasImage = false, className }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-lg border border-linear-border p-4 space-y-3', className)}>
      {hasImage && <Skeleton className="h-32 w-full rounded-md" />}
      <Skeleton variant="title" />
      <SkeletonTextBlock lines={2} />
      <div className="flex gap-2 pt-2">
        <Skeleton variant="button" />
        <Skeleton variant="button" width="w-20" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonTextBlock, SkeletonListItem, SkeletonTable, SkeletonCard };
