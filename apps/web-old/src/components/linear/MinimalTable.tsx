'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// MinimalTable - Clean table with light headers and row hover
// ====================================================================

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnDef<T> {
  /** Unique column key */
  id: string;
  /** Column header text */
  header: string;
  /** Accessor function to get cell value */
  accessor: (row: T) => React.ReactNode;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Custom cell className */
  cellClassName?: string;
  /** Custom header className */
  headerClassName?: string;
  /** Column width (e.g., '100px', '20%') */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

export interface MinimalTableProps<T> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Data rows */
  data: T[];
  /** Get unique key for each row */
  getRowKey: (row: T, index: number) => string | number;
  /** Callback when row is clicked */
  onRowClick?: (row: T) => void;
  /** Currently sorted column id */
  sortColumn?: string;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Callback when sort changes */
  onSort?: (columnId: string, direction: SortDirection) => void;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Show loading skeleton */
  loading?: boolean;
  /** Number of skeleton rows to show when loading */
  skeletonRows?: number;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Additional table className */
  className?: string;
}

/**
 * MinimalTable renders a clean, Linear-style table:
 * - Light header (no background, 12px font, muted color)
 * - Subtle bottom borders
 * - Row hover with background highlight
 * - Sortable columns with direction indicator
 * - Title + subtitle pattern support in cells
 */
export function MinimalTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  footer,
  loading,
  skeletonRows = 5,
  emptyState,
  className,
}: MinimalTableProps<T>) {
  const handleSort = (columnId: string) => {
    if (!onSort) return;

    let newDirection: SortDirection;
    if (sortColumn !== columnId) {
      newDirection = 'asc';
    } else if (sortDirection === 'asc') {
      newDirection = 'desc';
    } else {
      newDirection = null;
    }

    onSort(columnId, newDirection);
  };

  const renderSortIcon = (columnId: string, sortable?: boolean) => {
    if (!sortable) return null;

    const isActive = sortColumn === columnId;
    const direction = isActive ? sortDirection : null;

    return (
      <span
        className={cn(
          'ml-1 inline-block transition-colors',
          isActive ? 'text-linear-accent' : 'text-linear-text-muted'
        )}
      >
        {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
      </span>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('w-full', className)}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    'border-b border-linear-border-subtle px-3 py-2 text-left text-xs font-medium text-linear-text-tertiary',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.headerClassName
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-linear-border-subtle last:border-b-0">
                {columns.map((column) => (
                  <td key={column.id} className="px-3 py-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-linear-bg-tertiary" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0 && emptyState) {
    return (
      <div className={cn('w-full', className)}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    'border-b border-linear-border-subtle px-3 py-2 text-left text-xs font-medium text-linear-text-tertiary',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.headerClassName
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="py-12">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  'border-b border-linear-border-subtle px-3 py-2 text-left text-xs font-medium text-linear-text-tertiary',
                  column.sortable && 'cursor-pointer hover:text-linear-text-secondary',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center',
                  column.headerClassName
                )}
                style={{ width: column.width }}
                onClick={column.sortable ? () => handleSort(column.id) : undefined}
              >
                {column.header}
                {renderSortIcon(column.id, column.sortable)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={getRowKey(row, rowIndex)}
              className={cn(
                'border-b border-linear-border-subtle transition-colors last:border-b-0',
                onRowClick && 'cursor-pointer hover:bg-linear-bg-hover'
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    'px-3 py-3 text-sm text-linear-text-primary',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.cellClassName
                  )}
                >
                  {column.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-linear-border-default bg-linear-bg-tertiary">
              {footer}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ====================================================================
// TableCell helpers - Common cell patterns
// ====================================================================

export interface TitleSubtitleCellProps {
  /** Primary title text */
  title: string;
  /** Secondary subtitle text */
  subtitle?: string;
  /** Make title a monospace accent link style */
  titleAccent?: boolean;
}

/**
 * TitleSubtitleCell renders the common title + subtitle pattern:
 * - Title: 14px, medium weight, primary color
 * - Subtitle: 12px, tertiary color
 */
export function TitleSubtitleCell({ title, subtitle, titleAccent }: TitleSubtitleCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'text-[14px] font-medium text-linear-text-primary',
          titleAccent && 'font-mono font-semibold text-linear-accent'
        )}
      >
        {title}
      </span>
      {subtitle && <span className="text-xs text-linear-text-tertiary">{subtitle}</span>}
    </div>
  );
}

export interface NumericCellProps {
  /** The numeric value to display */
  value: string | number;
  /** Optional unit suffix (e.g., 'h', '€') */
  unit?: string;
  /** Whether to show in success/positive color */
  positive?: boolean;
}

/**
 * NumericCell renders numbers with consistent formatting:
 * - Monospace font
 * - Right-aligned (use align='right' on column)
 * - Optional unit suffix
 */
export function NumericCell({ value, unit, positive }: NumericCellProps) {
  return (
    <span className={cn('font-mono', positive && 'text-linear-success')}>
      {typeof value === 'number' ? value.toLocaleString('ro-RO') : value}
      {unit && <span className="text-linear-text-tertiary">{unit}</span>}
    </span>
  );
}

export interface ActionsCellProps {
  children: React.ReactNode;
}

/**
 * ActionsCell renders action buttons in a table cell
 */
export function ActionsCell({ children }: ActionsCellProps) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
