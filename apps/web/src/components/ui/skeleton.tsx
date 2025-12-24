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
 * Set shimmer={false} to use the classic pulse animation.
 */
function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md',
        shimmer
          ? 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]'
          : 'animate-pulse bg-muted',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
