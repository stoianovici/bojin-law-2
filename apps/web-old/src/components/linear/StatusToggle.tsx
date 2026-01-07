'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CountBadge } from './StatusDot';

// ====================================================================
// StatusToggle - Button group for switching between status views
// ====================================================================

export interface StatusToggleOption<T extends string = string> {
  /** Unique value identifier */
  value: T;
  /** Display label */
  label: string;
  /** Optional count badge */
  count?: number;
}

export interface StatusToggleProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Available options */
  options: StatusToggleOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * StatusToggle renders a button group for status filtering:
 * - Segmented control appearance
 * - Active state with accent background
 * - Optional count badges on each option
 *
 * @example
 * <StatusToggle
 *   options={[
 *     { value: 'draft', label: 'Ciornă' },
 *     { value: 'review', label: 'Review', count: 3 },
 *     { value: 'final', label: 'Final', count: 2 },
 *   ]}
 *   value={status}
 *   onChange={setStatus}
 * />
 */
export function StatusToggle<T extends string = string>({
  className,
  options,
  value,
  onChange,
  size = 'md',
  ...props
}: StatusToggleProps<T>) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary',
        className
      )}
      {...props}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap font-medium transition-all duration-150',
            size === 'sm' && 'px-2.5 py-1.5 text-[11px]',
            size === 'md' && 'px-3 py-2 text-xs',
            value === option.value
              ? 'bg-linear-accent-muted text-linear-accent'
              : 'bg-transparent text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary',
            // Divider between buttons (except first)
            index > 0 && 'border-l border-linear-border-subtle'
          )}
        >
          <span>{option.label}</span>
          {option.count !== undefined && option.count > 0 && (
            <CountBadge
              count={option.count}
              size="sm"
              variant={value === option.value ? 'accent' : 'muted'}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ====================================================================
// StatusToggleItem - Individual item for controlled composition
// ====================================================================

export interface StatusToggleItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this item is selected */
  selected?: boolean;
  /** Optional count badge */
  count?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether this is the first item (controls left border) */
  isFirst?: boolean;
}

/**
 * StatusToggleItem for building custom toggle groups with controlled composition.
 */
export function StatusToggleItem({
  className,
  children,
  selected = false,
  count,
  size = 'md',
  isFirst = false,
  ...props
}: StatusToggleItemProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        'flex items-center gap-2 whitespace-nowrap font-medium transition-all duration-150',
        size === 'sm' && 'px-2.5 py-1.5 text-[11px]',
        size === 'md' && 'px-3 py-2 text-xs',
        selected
          ? 'bg-linear-accent-muted text-linear-accent'
          : 'bg-transparent text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary',
        !isFirst && 'border-l border-linear-border-subtle',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {count !== undefined && count > 0 && (
        <CountBadge count={count} size="sm" variant={selected ? 'accent' : 'muted'} />
      )}
    </button>
  );
}

/**
 * StatusToggleGroup wraps StatusToggleItem components.
 */
export function StatusToggleGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
