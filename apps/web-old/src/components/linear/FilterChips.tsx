'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// FilterChip - Individual filter chip/pill
// ====================================================================

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the chip is currently selected */
  selected?: boolean;
}

/**
 * FilterChip renders an individual filter option:
 * - Pill-shaped button
 * - Selected state with accent background
 * - Hover state
 */
export function FilterChip({ className, children, selected = false, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
        selected
          ? 'bg-linear-accent-muted text-linear-accent'
          : 'text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ====================================================================
// FilterChipsRow - Row of filter chips
// ====================================================================

export interface FilterChipsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between chips */
  gap?: 'sm' | 'md';
}

/**
 * FilterChipsRow provides a horizontal row for FilterChip components.
 */
export function FilterChipsRow({ className, children, gap = 'sm', ...props }: FilterChipsRowProps) {
  return (
    <div
      className={cn(
        'flex items-center',
        gap === 'sm' && 'gap-1',
        gap === 'md' && 'gap-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ====================================================================
// FilterSelect - Dropdown-style filter button
// ====================================================================

export interface FilterSelectProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Current selected value to display */
  value: string;
  /** Icon to show (optional) */
  icon?: React.ReactNode;
}

/**
 * FilterSelect renders a dropdown-style filter button:
 * - Shows current value
 * - Chevron indicator
 * - Hover state
 */
export function FilterSelect({ className, value, icon, ...props }: FilterSelectProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs',
        'text-linear-text-tertiary transition-colors',
        'hover:bg-linear-bg-hover hover:text-linear-text-primary',
        className
      )}
      {...props}
    >
      {icon}
      <span>{value}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-50"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

// ====================================================================
// SearchBox - Linear-styled search input
// ====================================================================

export interface SearchBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Show keyboard shortcut hint */
  shortcut?: string;
}

/**
 * SearchBox renders a Linear-styled search input:
 * - Search icon
 * - Input field
 * - Optional keyboard shortcut hint
 */
export const SearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ className, shortcut, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 transition-all duration-150',
          'focus-within:border-linear-accent focus-within:shadow-[0_0_0_3px_rgba(94,106,210,0.15)]',
          className
        )}
      >
        <svg
          className="h-4 w-4 text-linear-text-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={ref}
          type="text"
          className="flex-1 bg-transparent text-[13px] text-linear-text-primary outline-none placeholder:text-linear-text-tertiary"
          {...props}
        />
        {shortcut && (
          <span className="rounded bg-linear-bg-hover px-1.5 py-0.5 font-mono text-[11px] text-linear-text-muted">
            {shortcut}
          </span>
        )}
      </div>
    );
  }
);
SearchBox.displayName = 'SearchBox';

// ====================================================================
// IconButton - Icon-only button for headers
// ====================================================================

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show notification badge */
  badge?: boolean;
}

/**
 * IconButton renders an icon-only button:
 * - 36x36px touch target
 * - Hover state
 * - Optional notification badge
 */
export function IconButton({ className, children, badge = false, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg text-linear-text-secondary transition-colors',
        'hover:bg-linear-bg-hover hover:text-linear-text-primary',
        className
      )}
      {...props}
    >
      {children}
      {badge && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-linear-bg-primary bg-linear-error" />
      )}
    </button>
  );
}
