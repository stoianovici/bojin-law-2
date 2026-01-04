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
export function StatusDot({ className, status, size, label, ...props }: StatusDotProps) {
  const dot = <span className={cn(statusDotVariants({ status, size }), className)} {...props} />;

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
export function StatusBadge({ className, variant, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

// ====================================================================
// PriorityBadge - Alias for StatusBadge with priority-specific types
// ====================================================================

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

export interface PriorityBadgeProps extends Omit<StatusBadgeProps, 'variant'> {
  priority: PriorityLevel;
}

/**
 * PriorityBadge is a semantic alias for StatusBadge for priority display
 */
export function PriorityBadge({ priority, children, ...props }: PriorityBadgeProps) {
  return (
    <StatusBadge variant={priority} {...props}>
      {children}
    </StatusBadge>
  );
}

// ====================================================================
// PriorityBar - Vertical colored bar indicating task priority
// ====================================================================

const priorityBarVariants = cva('w-[3px] rounded-sm', {
  variants: {
    priority: {
      urgent: 'bg-linear-error',
      high: 'bg-[#F97316]',
      medium: 'bg-linear-warning',
      low: 'bg-linear-success',
    },
    size: {
      sm: 'h-6',
      md: 'h-10',
      lg: 'h-14',
    },
  },
  defaultVariants: {
    priority: 'medium',
    size: 'md',
  },
});

export interface PriorityBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof priorityBarVariants> {}

/**
 * PriorityBar renders a vertical colored bar for task priority:
 * - Urgent: Red (#EF4444)
 * - High: Orange (#F97316)
 * - Medium: Yellow (#EAB308)
 * - Low: Green (#22C55E)
 */
export function PriorityBar({ className, priority, size, ...props }: PriorityBarProps) {
  return <div className={cn(priorityBarVariants({ priority, size }), className)} {...props} />;
}

// ====================================================================
// WorkflowStatusBadge - Badge with dot + text for workflow statuses
// ====================================================================

const workflowStatusColors = {
  planned: {
    dot: 'bg-[#71717A]',
    bg: 'bg-[#71717A]/15',
    text: 'text-[#71717A]',
  },
  'in-progress': {
    dot: 'bg-[#6366F1]',
    bg: 'bg-[#6366F1]/15',
    text: 'text-[#6366F1]',
  },
  review: {
    dot: 'bg-[#A855F7]',
    bg: 'bg-[#A855F7]/15',
    text: 'text-[#A855F7]',
  },
  completed: {
    dot: 'bg-linear-success',
    bg: 'bg-linear-success/15',
    text: 'text-linear-success',
  },
} as const;

export type WorkflowStatus = keyof typeof workflowStatusColors;

export interface WorkflowStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: WorkflowStatus;
}

/**
 * WorkflowStatusBadge renders a pill with colored dot + text label:
 * - Planned (Planificat): Gray
 * - In Progress (În lucru): Indigo
 * - Review: Purple
 * - Completed (Finalizat): Green
 */
export function WorkflowStatusBadge({
  className,
  status,
  children,
  ...props
}: WorkflowStatusBadgeProps) {
  const colors = workflowStatusColors[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-medium',
        colors.bg,
        colors.text,
        className
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {children}
    </span>
  );
}

// ====================================================================
// FileTypeBadge - Colored badge indicating document type
// ====================================================================

const fileTypeColors = {
  pdf: { bg: 'bg-linear-error/15', text: 'text-linear-error' },
  doc: { bg: 'bg-[#3B82F6]/15', text: 'text-[#3B82F6]' },
  docx: { bg: 'bg-[#3B82F6]/15', text: 'text-[#3B82F6]' },
  xls: { bg: 'bg-linear-success/15', text: 'text-linear-success' },
  xlsx: { bg: 'bg-linear-success/15', text: 'text-linear-success' },
  jpg: { bg: 'bg-linear-warning/15', text: 'text-linear-warning' },
  jpeg: { bg: 'bg-linear-warning/15', text: 'text-linear-warning' },
  png: { bg: 'bg-linear-warning/15', text: 'text-linear-warning' },
  default: { bg: 'bg-linear-bg-tertiary', text: 'text-linear-text-secondary' },
} as const;

export type FileType = keyof typeof fileTypeColors;

export interface FileTypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: string;
}

/**
 * FileTypeBadge renders a colored badge for file types:
 * - PDF: Red
 * - DOC/DOCX: Blue
 * - XLS/XLSX: Green
 * - JPG/PNG: Yellow/orange
 */
export function FileTypeBadge({ className, type, ...props }: FileTypeBadgeProps) {
  const normalizedType = type.toLowerCase().replace('.', '') as FileType;
  const colors = fileTypeColors[normalizedType] || fileTypeColors.default;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        colors.bg,
        colors.text,
        className
      )}
      {...props}
    >
      {type.toUpperCase().replace('.', '')}
    </span>
  );
}

// ====================================================================
// CountBadge - Numeric badge for counts/notifications
// ====================================================================

const countBadgeVariants = cva('inline-flex items-center justify-center font-semibold', {
  variants: {
    variant: {
      default: 'bg-linear-bg-tertiary text-linear-text-secondary',
      accent: 'bg-linear-accent text-white',
      muted: 'bg-linear-bg-tertiary/50 text-linear-text-tertiary',
    },
    size: {
      sm: 'min-w-[16px] h-4 px-1 text-[9px] rounded-full',
      md: 'min-w-[18px] h-[18px] px-1.5 text-[10px] rounded-[9px]',
      lg: 'min-w-[22px] h-[22px] px-2 text-[11px] rounded-xl',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export interface CountBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof countBadgeVariants> {
  count: number;
  max?: number;
}

/**
 * CountBadge renders a numeric badge for counts:
 * - Default: Gray background
 * - Accent: Primary accent color (for active states)
 * - Muted: Subtle gray (for inactive states)
 *
 * If count exceeds max, displays "max+"
 */
export function CountBadge({
  className,
  variant,
  size,
  count,
  max = 99,
  ...props
}: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString();

  if (count === 0) return null;

  return (
    <span className={cn(countBadgeVariants({ variant, size }), className)} {...props}>
      {displayCount}
    </span>
  );
}
