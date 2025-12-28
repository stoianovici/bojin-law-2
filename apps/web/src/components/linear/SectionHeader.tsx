'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// SectionHeader - 11px uppercase section titles (Linear style)
// ====================================================================

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section title text */
  title: string;
  /** Optional right-side action (button, link, etc.) */
  action?: React.ReactNode;
}

/**
 * SectionHeader renders Linear-style section titles:
 * - 11px font size
 * - Uppercase letters
 * - 0.5px letter spacing
 * - Tertiary text color
 */
export function SectionHeader({ className, title, action, ...props }: SectionHeaderProps) {
  return (
    <div
      className={cn('mb-3 flex items-center justify-between px-3 py-2', className)}
      {...props}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-linear-text-tertiary">
        {title}
      </span>
      {action && <div className="flex items-center">{action}</div>}
    </div>
  );
}

// ====================================================================
// CardHeader (Linear variant) - Card header with title and actions
// ====================================================================

export interface LinearCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card title text */
  title: string;
  /** Optional icon to display before title */
  icon?: React.ReactNode;
  /** Optional actions on the right side */
  actions?: React.ReactNode;
}

/**
 * LinearCardHeader renders card headers matching the mockup:
 * - 13px font size with semibold weight
 * - Icon + title on left
 * - Actions on right
 * - Bottom border
 */
export function LinearCardHeader({
  className,
  title,
  icon,
  actions,
  ...props
}: LinearCardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-linear-border-subtle px-5 py-4',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-linear-text-primary">
        {icon && <span className="h-4 w-4 text-linear-accent">{icon}</span>}
        {title}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

// ====================================================================
// CardActionButton - Small action button for card headers
// ====================================================================

export interface CardActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * CardActionButton for use in card headers (e.g., "Vezi toate ->")
 */
export function CardActionButton({ className, children, ...props }: CardActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-2 py-1 text-xs text-linear-text-tertiary transition-colors',
        'hover:bg-linear-bg-hover hover:text-linear-text-primary',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
