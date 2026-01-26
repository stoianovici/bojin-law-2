'use client';

import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

// ============================================
// Component
// ============================================

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  className,
  style,
  ...props
}: SkeletonProps) {
  const baseStyles = clsx(
    'skeleton', // Uses the shimmer animation from globals.css
    'rounded'
  );

  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className={clsx('flex flex-col gap-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx(baseStyles, variantStyles.text)}
            style={{
              width: i === lines - 1 ? '70%' : width || '100%',
              height: height || undefined,
              ...style,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(baseStyles, variantStyles[variant], className)}
      style={{
        width: width || (variant === 'circular' ? 40 : '100%'),
        height: height || (variant === 'circular' ? 40 : variant === 'text' ? 16 : 100),
        ...style,
      }}
      {...props}
    />
  );
}

// ============================================
// Preset Skeletons
// ============================================

export function SkeletonCard() {
  return (
    <div className="bg-bg-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" className="mt-1" />
        </div>
      </div>
      <Skeleton variant="text" lines={2} />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton variant="circular" width={44} height={44} />
      <div className="flex-1">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="50%" className="mt-1" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}
