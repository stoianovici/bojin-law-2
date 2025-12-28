'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// WidgetGrid - Responsive grid for dashboard widgets
// ====================================================================

export interface WidgetGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (2 or 3) */
  columns?: 2 | 3;
}

/**
 * WidgetGrid provides a responsive grid layout for dashboard cards/widgets:
 * - 3-column default
 * - 2-column option
 * - Proper gap spacing (20px)
 */
export function WidgetGrid({
  className,
  children,
  columns = 3,
  ...props
}: WidgetGridProps) {
  return (
    <div
      className={cn(
        'grid gap-5',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ====================================================================
// Widget - Individual widget card with Linear styling
// ====================================================================

export interface WidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Span multiple columns */
  span?: 1 | 2 | 3;
}

/**
 * Widget wraps content in a Linear-styled card with:
 * - Secondary background
 * - Subtle border
 * - Hover effect
 * - Optional column span
 */
export function Widget({ className, children, span = 1, ...props }: WidgetProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-secondary transition-all duration-200',
        'hover:border-linear-border hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
        span === 2 && 'md:col-span-2',
        span === 3 && 'lg:col-span-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ====================================================================
// WidgetBody - Content area for widgets
// ====================================================================

export interface WidgetBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * WidgetBody provides consistent padding for widget content.
 */
export function WidgetBody({ className, children, ...props }: WidgetBodyProps) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  );
}

// ====================================================================
// BriefingCard - Special card for morning briefing
// ====================================================================

export interface BriefingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon element for the briefing header */
  icon?: React.ReactNode;
  /** Main title (e.g., "Bună dimineața, Alexandru") */
  title: string;
  /** Subtitle (e.g., date) */
  subtitle?: string;
  /** Optional action button on the right */
  action?: React.ReactNode;
}

/**
 * BriefingCard renders the morning briefing card with:
 * - Accent gradient line at top
 * - Icon + title header
 * - Optional action button
 */
export function BriefingCard({
  className,
  icon,
  title,
  subtitle,
  action,
  children,
  ...props
}: BriefingCardProps) {
  return (
    <div
      className={cn(
        'relative mb-6 overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5',
        className
      )}
      {...props}
    >
      {/* Accent gradient line at top */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-linear-accent to-[#8B5CF6] opacity-50" />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-accent/15">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-linear-text-primary">{title}</h2>
            {subtitle && (
              <span className="text-[13px] text-linear-text-tertiary">{subtitle}</span>
            )}
          </div>
        </div>
        {action}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

// ====================================================================
// WorkloadItem - Team member workload row
// ====================================================================

export interface WorkloadItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** User initials for avatar */
  initials: string;
  /** User name */
  name: string;
  /** Utilization percentage (0-100) */
  percentage: number;
}

/**
 * WorkloadItem renders a team member workload row:
 * - Avatar with initials
 * - Name
 * - Progress bar
 * - Percentage
 */
export function WorkloadItem({
  className,
  initials,
  name,
  percentage,
  ...props
}: WorkloadItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-linear-border-subtle py-3 last:border-b-0',
        className
      )}
      {...props}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-linear-bg-tertiary text-[13px] font-semibold text-linear-text-secondary">
        {initials}
      </div>
      <div className="flex-1">
        <div className="mb-2 text-[13px] font-medium text-linear-text-primary">{name}</div>
        <div className="h-1.5 overflow-hidden rounded-full bg-linear-bg-hover">
          <div
            className="h-full rounded-full bg-gradient-to-r from-linear-accent to-[#8B5CF6] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      </div>
      <div className="min-w-[45px] text-right text-[13px] font-semibold text-linear-text-primary">
        {percentage}%
      </div>
    </div>
  );
}
