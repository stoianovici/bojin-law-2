'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// FilterPills - Horizontal scrollable filter pills with remove button
// ====================================================================

export interface FilterPill<T extends string = string> {
  /** Unique value identifier */
  value: T;
  /** Display label */
  label: string;
}

export interface FilterPillsProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'onToggle'> {
  /** Available filter options */
  pills: FilterPill<T>[];
  /** Currently active values */
  activeValues: T[];
  /** Callback when a pill is toggled */
  onToggle: (value: T) => void;
  /** Whether pills are removable (show X button when active) */
  removable?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * FilterPills renders a horizontal scrollable row of filter pills:
 * - Toggle between active/inactive states
 * - Optional remove button on active pills
 * - Horizontally scrollable for many filters
 *
 * @example
 * <FilterPills
 *   pills={[
 *     { value: 'urgent', label: 'Urgente' },
 *     { value: 'pending', label: 'În așteptare' },
 *     { value: 'completed', label: 'Finalizate' },
 *   ]}
 *   activeValues={activeFilters}
 *   onToggle={(value) => toggleFilter(value)}
 *   removable
 * />
 */
export function FilterPills<T extends string = string>({
  className,
  pills,
  activeValues,
  onToggle,
  removable = false,
  size = 'md',
  ...props
}: FilterPillsProps<T>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto',
        'scrollbar-none', // Hide scrollbar but keep functionality
        className
      )}
      {...props}
    >
      {pills.map((pill) => {
        const isActive = activeValues.includes(pill.value);
        return (
          <FilterPillItem
            key={pill.value}
            active={isActive}
            removable={removable && isActive}
            size={size}
            onClick={() => onToggle(pill.value)}
            onRemove={() => onToggle(pill.value)}
          >
            {pill.label}
          </FilterPillItem>
        );
      })}
    </div>
  );
}

// ====================================================================
// FilterPillItem - Individual filter pill
// ====================================================================

export interface FilterPillItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this pill is active */
  active?: boolean;
  /** Whether to show remove button */
  removable?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Callback when remove button is clicked */
  onRemove?: () => void;
}

/**
 * FilterPillItem for building custom filter pill layouts.
 */
export function FilterPillItem({
  className,
  children,
  active = false,
  removable = false,
  size = 'md',
  onRemove,
  onClick,
  ...props
}: FilterPillItemProps) {
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-all duration-150',
        size === 'sm' && 'px-2.5 py-1 text-[11px]',
        size === 'md' && 'px-3 py-1.5 text-xs',
        active
          ? 'bg-linear-accent-muted text-linear-accent'
          : 'bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {removable && (
        <span
          role="button"
          aria-label="Elimină filtru"
          onClick={handleRemoveClick}
          className={cn(
            'flex items-center justify-center rounded-full transition-colors',
            size === 'sm' && 'h-3.5 w-3.5',
            size === 'md' && 'h-4 w-4',
            'hover:bg-linear-accent/20'
          )}
        >
          <svg
            width={size === 'sm' ? 8 : 10}
            height={size === 'sm' ? 8 : 10}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      )}
    </button>
  );
}

// ====================================================================
// FilterPillsContainer - Container for custom pill layouts
// ====================================================================

export interface FilterPillsContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between pills */
  gap?: 'sm' | 'md';
}

/**
 * FilterPillsContainer for wrapping FilterPillItem components.
 */
export function FilterPillsContainer({
  className,
  children,
  gap = 'md',
  ...props
}: FilterPillsContainerProps) {
  return (
    <div
      className={cn(
        'flex items-center overflow-x-auto scrollbar-none',
        gap === 'sm' && 'gap-1.5',
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
// ActiveFiltersBar - Shows active filters with clear all option
// ====================================================================

export interface ActiveFiltersBarProps<T extends string = string>
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Active filter pills */
  filters: FilterPill<T>[];
  /** Callback when a filter is removed */
  onRemove: (value: T) => void;
  /** Callback when all filters are cleared */
  onClearAll?: () => void;
  /** Clear all button label */
  clearAllLabel?: string;
}

/**
 * ActiveFiltersBar shows currently active filters with remove and clear all options.
 *
 * @example
 * <ActiveFiltersBar
 *   filters={[
 *     { value: 'urgent', label: 'Urgente' },
 *     { value: 'high', label: 'Prioritate înaltă' },
 *   ]}
 *   onRemove={(value) => removeFilter(value)}
 *   onClearAll={() => clearAllFilters()}
 * />
 */
export function ActiveFiltersBar<T extends string = string>({
  className,
  filters,
  onRemove,
  onClearAll,
  clearAllLabel = 'Șterge tot',
  ...props
}: ActiveFiltersBarProps<T>) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <span className="text-xs text-linear-text-tertiary">Filtre active:</span>
      <div className="flex items-center gap-1.5">
        {filters.map((filter) => (
          <FilterPillItem
            key={filter.value}
            active
            removable
            size="sm"
            onRemove={() => onRemove(filter.value)}
          >
            {filter.label}
          </FilterPillItem>
        ))}
      </div>
      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-linear-text-tertiary transition-colors hover:text-linear-text-primary"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  );
}
