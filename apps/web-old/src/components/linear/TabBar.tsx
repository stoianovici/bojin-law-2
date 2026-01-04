'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CountBadge } from './StatusDot';

// ====================================================================
// TabBar - Horizontal tabs with underline indicator
// ====================================================================

export interface TabOption<T extends string = string> {
  /** Unique value identifier */
  value: T;
  /** Display label */
  label: string;
  /** Optional count badge */
  count?: number;
  /** Whether this tab is disabled */
  disabled?: boolean;
}

export interface TabBarProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Available tabs */
  tabs: TabOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * TabBar renders horizontal tabs with underline active indicator:
 * - Underline indicator on active tab
 * - Badge support for counts
 * - Horizontally scrollable for many tabs
 *
 * @example
 * <TabBar
 *   tabs={[
 *     { value: 'details', label: 'Detalii' },
 *     { value: 'documents', label: 'Documente', count: 5 },
 *     { value: 'activity', label: 'Activitate' },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 * />
 */
export function TabBar<T extends string = string>({
  className,
  tabs,
  value,
  onChange,
  size = 'md',
  ...props
}: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-linear-border-subtle',
        'scrollbar-none', // Hide scrollbar but keep functionality
        size === 'sm' && 'px-3',
        size === 'md' && 'px-4',
        className
      )}
      {...props}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          aria-disabled={tab.disabled}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.value)}
          className={cn(
            'relative flex items-center gap-2 whitespace-nowrap font-medium transition-colors',
            size === 'sm' && 'px-3 py-2.5 text-xs',
            size === 'md' && 'px-4 py-3 text-[13px]',
            value === tab.value
              ? 'text-linear-text-primary'
              : 'text-linear-text-secondary hover:text-linear-text-primary',
            tab.disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <CountBadge
              count={tab.count}
              size="sm"
              variant={value === tab.value ? 'default' : 'muted'}
            />
          )}
          {/* Active indicator line */}
          {value === tab.value && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-accent"
              aria-hidden="true"
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ====================================================================
// Tab - Individual tab for controlled composition
// ====================================================================

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this tab is selected */
  selected?: boolean;
  /** Optional count badge */
  count?: number;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Tab for building custom tab bars with controlled composition.
 */
export function Tab({
  className,
  children,
  selected = false,
  count,
  size = 'md',
  disabled,
  ...props
}: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      className={cn(
        'relative flex items-center gap-2 whitespace-nowrap font-medium transition-colors',
        size === 'sm' && 'px-3 py-2.5 text-xs',
        size === 'md' && 'px-4 py-3 text-[13px]',
        selected
          ? 'text-linear-text-primary'
          : 'text-linear-text-secondary hover:text-linear-text-primary',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {count !== undefined && count > 0 && (
        <CountBadge count={count} size="sm" variant={selected ? 'default' : 'muted'} />
      )}
      {selected && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-accent"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/**
 * TabList wraps Tab components with proper styling.
 */
export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant applied to container padding */
  size?: 'sm' | 'md';
}

export function TabList({ className, children, size = 'md', ...props }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-linear-border-subtle',
        'scrollbar-none',
        size === 'sm' && 'px-3',
        size === 'md' && 'px-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ====================================================================
// TabPanel - Content panel for tabs
// ====================================================================

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value of the tab this panel is associated with */
  value: string;
  /** Currently active tab value */
  activeValue: string;
}

/**
 * TabPanel renders content for a specific tab.
 * Only renders when value matches activeValue.
 */
export function TabPanel({ className, children, value, activeValue, ...props }: TabPanelProps) {
  if (value !== activeValue) return null;

  return (
    <div
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      className={cn('outline-none', className)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
}
