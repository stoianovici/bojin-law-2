'use client';

import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

// ============================================
// Styles
// ============================================

const baseStyles = 'inline-flex items-center font-medium rounded-full';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-bg-hover text-text-secondary',
  primary: 'bg-accent-muted text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  info: 'bg-blue-500/15 text-blue-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-2xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-text-tertiary',
  primary: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-blue-400',
};

// ============================================
// Component
// ============================================

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotStyles[variant])} />}
      {children}
    </span>
  );
}

// ============================================
// Status Badge (for case/task status)
// ============================================

type StatusType = 'active' | 'pending' | 'completed' | 'cancelled' | 'draft' | 'overdue';

const statusConfig: Record<StatusType, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'primary', label: 'Activ' },
  pending: { variant: 'warning', label: 'În așteptare' },
  completed: { variant: 'success', label: 'Finalizat' },
  cancelled: { variant: 'error', label: 'Anulat' },
  draft: { variant: 'default', label: 'Draft' },
  overdue: { variant: 'error', label: 'Întârziat' },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: BadgeSize;
  className?: string;
}

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size={size} dot className={className}>
      {config.label}
    </Badge>
  );
}

// ============================================
// Priority Badge
// ============================================

type PriorityType = 'low' | 'medium' | 'high' | 'urgent';

const priorityConfig: Record<PriorityType, { variant: BadgeVariant; label: string }> = {
  low: { variant: 'default', label: 'Scăzută' },
  medium: { variant: 'info', label: 'Medie' },
  high: { variant: 'warning', label: 'Ridicată' },
  urgent: { variant: 'error', label: 'Urgentă' },
};

interface PriorityBadgeProps {
  priority: PriorityType;
  size?: BadgeSize;
  className?: string;
}

export function PriorityBadge({ priority, size = 'sm', className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  );
}
