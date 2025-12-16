/**
 * Widget Loading Skeletons
 * Story 2.11.4: Financial Dashboard UI
 *
 * Skeleton components for widget loading states.
 * Uses Tailwind animate-pulse for visual feedback.
 */

'use client';

import React from 'react';

/**
 * Chart skeleton - pulsing gradient for chart areas
 */
export function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-[200px] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
    </div>
  );
}

/**
 * Number/metric skeleton
 */
export function NumberSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-10 w-32 bg-gray-200 rounded-md mb-2" />
      <div className="h-4 w-20 bg-gray-100 rounded" />
    </div>
  );
}

/**
 * List skeleton - multiple rows
 */
export function ListSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="h-6 w-16 bg-gray-100 rounded" />
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
    <div className={`animate-pulse flex justify-center ${className}`}>
      <div className="h-32 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full" />
    </div>
  );
}

/**
 * KPI card skeleton with metric and trend
 */
export function KPISkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-5 w-24 bg-gray-100 rounded mb-3" />
      <div className="h-8 w-28 bg-gray-200 rounded mb-2" />
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-gray-100 rounded" />
        <div className="h-4 w-20 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

/**
 * Default widget skeleton - combines multiple patterns
 */
export function WidgetSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse space-y-4 ${className}`}>
      {/* Header skeleton */}
      <div className="h-5 w-32 bg-gray-100 rounded" />

      {/* Main content area */}
      <div className="h-[160px] bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />

      {/* Footer stats */}
      <div className="flex justify-between">
        <div className="h-4 w-24 bg-gray-100 rounded" />
        <div className="h-4 w-20 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

export default WidgetSkeleton;
