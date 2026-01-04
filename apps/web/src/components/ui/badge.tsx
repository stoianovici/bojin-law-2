'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full font-normal', {
  variants: {
    variant: {
      default: 'bg-linear-bg-tertiary text-linear-text-secondary',
      success: 'bg-linear-success/10 text-linear-success',
      warning: 'bg-linear-warning/10 text-linear-warning',
      error: 'bg-linear-error/10 text-linear-error',
      info: 'bg-linear-accent/10 text-linear-accent',
    },
    size: {
      sm: 'text-[10px] px-1.5 py-0.5',
      md: 'text-xs px-2 py-0.5',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, icon, children, ...props }, ref) => {
    return (
      <span className={cn(badgeVariants({ variant, size, className }))} ref={ref} {...props}>
        {dot && (
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              variant === 'success' && 'bg-linear-success',
              variant === 'warning' && 'bg-linear-warning',
              variant === 'error' && 'bg-linear-error',
              variant === 'info' && 'bg-linear-accent',
              (!variant || variant === 'default') && 'bg-linear-text-secondary'
            )}
          />
        )}
        {icon && <span className="mr-1 shrink-0">{icon}</span>}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export function getStatusBadgeVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    // Case statuses
    ACTIVE: 'success',
    PENDING: 'warning',
    CLOSED: 'default',
    ARCHIVED: 'default',

    // Task statuses
    TODO: 'default',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    BLOCKED: 'error',
    OVERDUE: 'error',

    // Document statuses
    DRAFT: 'default',
    IN_REVIEW: 'warning',
    CHANGES_REQUESTED: 'error',
    FINAL: 'success',
  };
  return map[status] || 'default';
}

export { Badge, badgeVariants };
