'use client';

import * as React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';

// ====================================================================
// GroupedTable - Table with collapsible group sections
// ====================================================================

export interface GroupDef<T> {
  /** Unique group identifier */
  id: string;
  /** Group header label (e.g., "ACEASTĂ SĂPTĂMÂNĂ") */
  label: string;
  /** Items in this group */
  items: T[];
  /** Whether group is collapsed initially */
  defaultCollapsed?: boolean;
}

export interface GroupedColumnDef<T> {
  /** Unique column key */
  id: string;
  /** Column header text (optional for grouped tables) */
  header?: string;
  /** Accessor function to get cell value */
  accessor: (row: T) => React.ReactNode;
  /** Custom cell className */
  cellClassName?: string;
  /** Column width (e.g., '100px', '20%') */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

export interface GroupedTableProps<T> {
  /** Column definitions */
  columns: GroupedColumnDef<T>[];
  /** Grouped data */
  groups: GroupDef<T>[];
  /** Get unique key for each row */
  getRowKey: (row: T, index: number) => string | number;
  /** Callback when row is clicked */
  onRowClick?: (row: T) => void;
  /** Show column headers */
  showHeaders?: boolean;
  /** Show loading skeleton */
  loading?: boolean;
  /** Number of skeleton rows per group */
  skeletonRowsPerGroup?: number;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Additional table className */
  className?: string;
  /** Custom group header renderer */
  renderGroupHeader?: (group: GroupDef<T>, isOpen: boolean) => React.ReactNode;
}

/**
 * GroupedTable renders data in collapsible sections:
 * - Collapsible group headers with chevron and count
 * - Uppercase group labels (11px, tertiary color)
 * - Rows within each group
 * - Smooth expand/collapse animation
 */
export function GroupedTable<T>({
  columns,
  groups,
  getRowKey,
  onRowClick,
  showHeaders = false,
  loading,
  skeletonRowsPerGroup = 3,
  emptyState,
  className,
  renderGroupHeader,
}: GroupedTableProps<T>) {
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    groups.forEach((group) => {
      if (!group.defaultCollapsed) {
        initial.add(group.id);
      }
    });
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('w-full', className)}>
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="mb-4">
            <div className="flex items-center gap-2 border-b border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5">
              <div className="h-3 w-3 animate-pulse rounded bg-linear-bg-hover" />
              <div className="h-3 w-32 animate-pulse rounded bg-linear-bg-hover" />
              <div className="h-3 w-16 animate-pulse rounded bg-linear-bg-hover" />
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {Array.from({ length: skeletonRowsPerGroup }).map((_, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-linear-border-subtle last:border-b-0"
                  >
                    {columns.map((column) => (
                      <td key={column.id} className="px-3 py-2.5">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-linear-bg-tertiary" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (groups.length === 0 || groups.every((g) => g.items.length === 0)) {
    if (emptyState) {
      return <div className={cn('w-full py-12', className)}>{emptyState}</div>;
    }
    return null;
  }

  return (
    <div className={cn('w-full', className)}>
      {showHeaders && (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    'border-b border-linear-border-subtle px-3 py-2 text-left text-xs font-medium text-linear-text-tertiary',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center'
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      )}

      {groups.map((group) => {
        const isOpen = openGroups.has(group.id);
        const itemCount = group.items.length;

        return (
          <Collapsible.Root key={group.id} open={isOpen} onOpenChange={() => toggleGroup(group.id)}>
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5 text-left transition-colors hover:bg-linear-bg-hover"
              >
                {renderGroupHeader ? (
                  renderGroupHeader(group, isOpen)
                ) : (
                  <>
                    <span
                      className={cn(
                        'text-linear-text-muted transition-transform duration-200',
                        isOpen && 'rotate-90'
                      )}
                    >
                      ▶
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-linear-text-tertiary">
                      {group.label}
                    </span>
                    <span className="text-[11px] text-linear-text-muted">
                      {itemCount} {itemCount === 1 ? 'înregistrare' : 'înregistrări'}
                    </span>
                  </>
                )}
              </button>
            </Collapsible.Trigger>

            <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapseHeight data-[state=open]:animate-expandHeight">
              {itemCount > 0 && (
                <table className="w-full border-collapse">
                  <tbody>
                    {group.items.map((row, rowIndex) => (
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
                              'px-3 py-2.5 text-sm text-linear-text-primary',
                              column.align === 'right' && 'text-right',
                              column.align === 'center' && 'text-center',
                              column.cellClassName
                            )}
                            style={{ width: column.width }}
                          >
                            {column.accessor(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Collapsible.Content>
          </Collapsible.Root>
        );
      })}
    </div>
  );
}

// ====================================================================
// Date grouping utilities
// ====================================================================

export type DateGroupKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'older';

const DATE_GROUP_LABELS: Record<DateGroupKey, string> = {
  today: 'AZI',
  yesterday: 'IERI',
  this_week: 'ACEASTĂ SĂPTĂMÂNĂ',
  last_week: 'SĂPTĂMÂNA TRECUTĂ',
  this_month: 'ACEASTĂ LUNĂ',
  older: 'MAI VECHI',
};

/**
 * Get the date group key for a given date
 */
export function getDateGroupKey(date: Date | string): DateGroupKey {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return 'today';
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'yesterday';
  }

  // Start of this week (Monday)
  const startOfWeek = new Date(today);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diff);

  if (dateOnly >= startOfWeek) {
    return 'this_week';
  }

  // Start of last week
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  if (dateOnly >= startOfLastWeek) {
    return 'last_week';
  }

  // Start of this month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (dateOnly >= startOfMonth) {
    return 'this_month';
  }

  return 'older';
}

/**
 * Group items by date using a date accessor
 */
export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => Date | string,
  options?: {
    /** Which groups to include (defaults to all) */
    includeGroups?: DateGroupKey[];
    /** Default collapsed state for each group */
    defaultCollapsed?: Partial<Record<DateGroupKey, boolean>>;
  }
): GroupDef<T>[] {
  const { includeGroups, defaultCollapsed = {} } = options || {};

  const groupMap = new Map<DateGroupKey, T[]>();

  // Initialize groups in order
  const groupOrder: DateGroupKey[] = [
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'older',
  ];

  groupOrder.forEach((key) => {
    if (!includeGroups || includeGroups.includes(key)) {
      groupMap.set(key, []);
    }
  });

  // Assign items to groups
  items.forEach((item) => {
    const groupKey = getDateGroupKey(getDate(item));
    if (groupMap.has(groupKey)) {
      groupMap.get(groupKey)!.push(item);
    } else if (groupMap.has('older')) {
      groupMap.get('older')!.push(item);
    }
  });

  // Convert to GroupDef array, filtering out empty groups
  return Array.from(groupMap.entries())
    .filter(([, items]) => items.length > 0)
    .map(([key, items]) => ({
      id: key,
      label: DATE_GROUP_LABELS[key],
      items,
      defaultCollapsed: defaultCollapsed[key] ?? (key === 'older' || key === 'last_week'),
    }));
}

// ====================================================================
// ReportTable footer helpers
// ====================================================================

export interface TableFooterCellProps {
  children: React.ReactNode;
  /** Number of columns to span */
  colSpan?: number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Additional className */
  className?: string;
}

/**
 * TableFooterCell for use in MinimalTable footer
 */
export function TableFooterCell({
  children,
  colSpan,
  align = 'left',
  className,
}: TableFooterCellProps) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'px-3 py-3 text-sm font-semibold text-linear-text-primary',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  );
}

export interface TotalsRowProps {
  /** Label for the totals row (e.g., "Total perioada") */
  label: string;
  /** Number of columns the label should span */
  labelColSpan?: number;
  /** Totals values to display */
  values: Array<{
    value: string | number;
    align?: 'left' | 'center' | 'right';
    className?: string;
  }>;
}

/**
 * TotalsRow renders a footer row with label and totals
 */
export function TotalsRow({ label, labelColSpan = 1, values }: TotalsRowProps) {
  return (
    <>
      <TableFooterCell colSpan={labelColSpan}>{label}</TableFooterCell>
      {values.map((val, idx) => (
        <TableFooterCell key={idx} align={val.align || 'right'} className={val.className}>
          {typeof val.value === 'number' ? val.value.toLocaleString('ro-RO') : val.value}
        </TableFooterCell>
      ))}
    </>
  );
}
