'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ====================================================================
// StatusDot - Colored status indicator with optional pulse
// ====================================================================

const statusDotVariants = cva('inline-block rounded-full', {
  variants: {
    /** Status color */
    status: {
      active: 'bg-linear-success shadow-[0_0_8px_var(--linear-success)]',
      pending: 'bg-linear-warning',
      'at-risk': 'bg-linear-error animate-pulse',
      info: 'bg-[#3B82F6]',
      neutral: 'bg-linear-text-tertiary',
    },
    /** Dot size */
    size: {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
      lg: 'h-2.5 w-2.5',
    },
  },
  defaultVariants: {
    status: 'neutral',
    size: 'md',
  },
});

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {
  /** Optional label to display next to the dot */
  label?: string;
}

/**
 * StatusDot renders a colored status indicator:
 * - Active: Green with glow
 * - Pending: Warning yellow
 * - At-risk: Red with pulse animation
 * - Info: Blue
 * - Neutral: Gray
 */
export function StatusDot({
  className,
  status,
  size,
  label,
  ...props
}: StatusDotProps) {
  const dot = (
    <span className={cn(statusDotVariants({ status, size }), className)} {...props} />
  );

  if (label) {
    return (
      <span className="inline-flex items-center gap-2">
        {dot}
        <span className="text-xs text-linear-text-secondary">{label}</span>
      </span>
    );
  }

  return dot;
}

// ====================================================================
// StatusBadge - Pill-shaped badge for priorities and statuses
// ====================================================================

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
  {
    variants: {
      variant: {
        urgent: 'bg-linear-error/15 text-linear-error',
        high: 'bg-linear-warning/15 text-linear-warning',
        medium: 'bg-[#3B82F6]/15 text-[#3B82F6]',
        low: 'bg-linear-bg-tertiary text-linear-text-tertiary',
        success: 'bg-linear-success/15 text-linear-success',
        neutral: 'bg-linear-bg-tertiary text-linear-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

/**
 * StatusBadge renders a pill-shaped badge for priorities:
 * - Urgent: Red background
 * - High: Yellow/orange background
 * - Medium: Blue background
 * - Low: Gray background
 */
export function StatusBadge({
  className,
  variant,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
