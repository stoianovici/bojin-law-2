'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// ViewToggle - Icon-only button group for switching views
// ====================================================================

// Built-in icons for common view types
const ViewIcons = {
  grid: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  list: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" />
      <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" />
      <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" />
    </svg>
  ),
  kanban: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="5" height="15" rx="1" />
    </svg>
  ),
  calendar: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  table: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
} as const;

export type ViewType = keyof typeof ViewIcons;

export interface ViewToggleOption<T extends string = string> {
  /** Unique value identifier */
  value: T;
  /** Accessible label */
  label: string;
  /** Icon - can be a built-in ViewType or custom React node */
  icon: ViewType | React.ReactNode;
}

export interface ViewToggleProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Available options */
  options: ViewToggleOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
}

/**
 * ViewToggle renders an icon-only button group for view switching:
 * - Compact segmented control
 * - Icon-only display with tooltips
 * - Active state with background highlight
 *
 * @example
 * <ViewToggle
 *   options={[
 *     { value: 'grid', label: 'Vizualizare grilă', icon: 'grid' },
 *     { value: 'list', label: 'Vizualizare listă', icon: 'list' },
 *   ]}
 *   value={view}
 *   onChange={setView}
 * />
 */
export function ViewToggle<T extends string = string>({
  className,
  options,
  value,
  onChange,
  ...props
}: ViewToggleProps<T>) {
  const getIcon = (icon: ViewType | React.ReactNode): React.ReactNode => {
    if (typeof icon === 'string' && icon in ViewIcons) {
      return ViewIcons[icon as ViewType];
    }
    return icon;
  };

  return (
    <div
      role="group"
      className={cn(
        'inline-flex overflow-hidden rounded-md border border-linear-border-subtle bg-linear-bg-tertiary',
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
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center justify-center p-2 transition-all duration-150',
            value === option.value
              ? 'bg-linear-bg-hover text-linear-text-primary'
              : 'bg-transparent text-linear-text-tertiary hover:text-linear-text-secondary',
            // Divider between buttons (except first)
            index > 0 && 'border-l border-linear-border-subtle'
          )}
        >
          {getIcon(option.icon)}
        </button>
      ))}
    </div>
  );
}

// ====================================================================
// ViewToggleButton - Individual toggle button for custom layouts
// ====================================================================

export interface ViewToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this button is selected */
  selected?: boolean;
  /** Accessible label */
  label: string;
  /** Icon - built-in ViewType or custom React node */
  icon: ViewType | React.ReactNode;
}

/**
 * ViewToggleButton for building custom view toggle groups.
 */
export function ViewToggleButton({
  className,
  selected = false,
  label,
  icon,
  ...props
}: ViewToggleButtonProps) {
  const getIcon = (iconProp: ViewType | React.ReactNode): React.ReactNode => {
    if (typeof iconProp === 'string' && iconProp in ViewIcons) {
      return ViewIcons[iconProp as ViewType];
    }
    return iconProp;
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center justify-center p-2 transition-all duration-150',
        selected
          ? 'bg-linear-bg-hover text-linear-text-primary'
          : 'bg-transparent text-linear-text-tertiary hover:text-linear-text-secondary',
        className
      )}
      {...props}
    >
      {getIcon(icon)}
    </button>
  );
}
