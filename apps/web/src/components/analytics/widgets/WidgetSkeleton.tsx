/**
 * Widget Loading Skeletons
 * Story 2.11.4: Financial Dashboard UI
 *
 * Skeleton components for widget loading states.
 * Uses shimmer gradient animation for polished loading effect.
 */

'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Chart skeleton - shimmer gradient for chart areas
 */
export function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-[200px]" />
    </div>
  );
}

/**
 * Number/metric skeleton
 */
export function NumberSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * List skeleton - multiple rows
 */
export function ListSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Gauge/radial chart skeleton
 */
export function GaugeSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Skeleton className="h-32 w-32 rounded-full" />
    </div>
  );
}

/**
 * KPI card skeleton with metric and trend
 */
export function KPISkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-28" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * Default widget skeleton - combines multiple patterns
 */
export function WidgetSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header skeleton */}
      <Skeleton className="h-5 w-32" />

      {/* Main content area */}
      <Skeleton className="h-[160px]" />

      {/* Footer stats */}
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

export default WidgetSkeleton;
