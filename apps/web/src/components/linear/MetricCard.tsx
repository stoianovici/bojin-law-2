'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// MetricCard - Value + label + trend indicator
// ====================================================================

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The main metric value (e.g., "47", "87%") */
  value: string | number;
  /** Label describing the metric */
  label: string;
  /** Optional trend indicator */
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    text: string;
  };
}

/**
 * MetricCard renders a single metric with:
 * - Large value (28px, bold)
 * - Label text (12px, tertiary)
 * - Optional trend indicator with icon
 */
export function MetricCard({
  className,
  value,
  label,
  trend,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn('rounded-lg bg-linear-bg-tertiary p-4', className)}
      {...props}
    >
      <div className="mb-1 text-[28px] font-bold leading-tight text-linear-text-primary">
        {value}
      </div>
      <div className="text-xs text-linear-text-tertiary">{label}</div>
      {trend && (
        <div
          className={cn(
            'mt-2 flex items-center gap-1 text-xs',
            trend.direction === 'up' && 'text-linear-success',
            trend.direction === 'down' && 'text-linear-error',
            trend.direction === 'neutral' && 'text-linear-text-tertiary'
          )}
        >
          {trend.direction === 'up' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 15l7-7 7 7" />
            </svg>
          )}
          {trend.direction === 'down' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {trend.text}
        </div>
      )}
    </div>
  );
}

// ====================================================================
// MetricGrid - 2-column grid for metrics
// ====================================================================

export interface MetricGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (2 or 4) */
  columns?: 2 | 4;
}

/**
 * MetricGrid provides a responsive grid layout for MetricCards.
 */
export function MetricGrid({
  className,
  children,
  columns = 2,
  ...props
}: MetricGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-2',
        columns === 4 && 'grid-cols-2 md:grid-cols-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ====================================================================
// BriefingStat - Stat item for morning briefing card
// ====================================================================

export interface BriefingStatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The stat value */
  value: string | number;
  /** Label for the stat */
  label: string;
}

/**
 * BriefingStat renders a stat item for the morning briefing:
 * - Large value (24px)
 * - Small label below
 */
export function BriefingStat({
  className,
  value,
  label,
  ...props
}: BriefingStatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <div className="text-2xl font-bold text-linear-text-primary">{value}</div>
      <div className="text-xs text-linear-text-tertiary">{label}</div>
    </div>
  );
}

// ====================================================================
// BriefingStatsRow - Row of stats with border separator
// ====================================================================

export interface BriefingStatsRowProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * BriefingStatsRow wraps BriefingStat items with proper spacing and border.
 */
export function BriefingStatsRow({
  className,
  children,
  ...props
}: BriefingStatsRowProps) {
  return (
    <div
      className={cn(
        'mt-5 flex gap-6 border-t border-linear-border-subtle pt-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
