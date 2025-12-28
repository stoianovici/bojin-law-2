'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use shimmer gradient animation instead of pulse */
  shimmer?: boolean;
}

/**
 * Skeleton loading placeholder with shimmer or pulse animation
 *
 * Default uses shimmer gradient for a more polished loading effect.
 * Uses Linear design tokens for dark mode compatibility.
 * Set shimmer={false} to use the classic pulse animation.
 */
function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('rounded-md', shimmer ? 'skeleton-shimmer' : 'skeleton', className)}
      {...props}
    />
  );
}

export { Skeleton };
