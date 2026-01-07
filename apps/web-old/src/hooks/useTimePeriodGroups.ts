/**
 * useTimePeriodGroups Hook
 *
 * Groups items by time period (Astazi, Saptamana aceasta, Luna aceasta, Luna trecuta, Mai vechi)
 * for use in document and attachment lists.
 */

import { useMemo } from 'react';
import {
  isToday,
  isThisWeek,
  isThisMonth,
  startOfMonth,
  subMonths,
  isWithinInterval,
  endOfMonth,
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface TimePeriod<T> {
  key: 'today' | 'this-week' | 'this-month' | 'last-month' | 'older';
  label: string;
  items: T[];
  defaultOpen: boolean;
}

export interface UseTimePeriodGroupsOptions {
  /**
   * Week starts on Monday (1) by default for Romanian locale
   */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

// ============================================================================
// Period Definitions
// ============================================================================

const PERIOD_LABELS: Record<TimePeriod<unknown>['key'], string> = {
  today: 'Astăzi',
  'this-week': 'Săptămâna aceasta',
  'this-month': 'Luna aceasta',
  'last-month': 'Luna trecută',
  older: 'Mai vechi',
};

const PERIOD_DEFAULT_OPEN: Record<TimePeriod<unknown>['key'], boolean> = {
  today: true,
  'this-week': true,
  'this-month': true,
  'last-month': false,
  older: false,
};

const PERIOD_ORDER: TimePeriod<unknown>['key'][] = [
  'today',
  'this-week',
  'this-month',
  'last-month',
  'older',
];

// ============================================================================
// Helper Functions
// ============================================================================

function getPeriodKey(
  date: Date,
  now: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
): TimePeriod<unknown>['key'] {
  // Check today first (most specific)
  if (isToday(date)) {
    return 'today';
  }

  // Check this week (excluding today which is already handled)
  if (isThisWeek(date, { weekStartsOn })) {
    return 'this-week';
  }

  // Check this month (excluding this week which is already handled)
  if (isThisMonth(date)) {
    return 'this-month';
  }

  // Check last month
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  if (isWithinInterval(date, { start: lastMonthStart, end: lastMonthEnd })) {
    return 'last-month';
  }

  // Everything else is older
  return 'older';
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Groups items by time period for display in collapsible sections.
 *
 * @param items - Array of items to group
 * @param getDate - Function to extract date from each item
 * @param options - Configuration options
 * @returns Array of time periods with grouped items (empty periods excluded)
 *
 * @example
 * ```tsx
 * const periods = useTimePeriodGroups(
 *   documents,
 *   (doc) => new Date(doc.createdAt)
 * );
 *
 * return periods.map((period) => (
 *   <TimePeriodSection key={period.key} {...period}>
 *     {period.items.map((doc) => <DocumentCard document={doc} />)}
 *   </TimePeriodSection>
 * ));
 * ```
 */
export function useTimePeriodGroups<T>(
  items: T[],
  getDate: (item: T) => Date | string | null | undefined,
  options: UseTimePeriodGroupsOptions = {}
): TimePeriod<T>[] {
  const { weekStartsOn = 1 } = options; // Monday by default

  return useMemo(() => {
    const now = new Date();

    // Group items by period
    const groups: Record<TimePeriod<T>['key'], T[]> = {
      today: [],
      'this-week': [],
      'this-month': [],
      'last-month': [],
      older: [],
    };

    for (const item of items) {
      const dateValue = getDate(item);
      if (dateValue === null || dateValue === undefined) {
        // Items without dates go to 'older'
        groups.older.push(item);
        continue;
      }

      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;

      // Skip invalid dates
      if (isNaN(date.getTime())) {
        groups.older.push(item);
        continue;
      }

      const periodKey = getPeriodKey(date, now, weekStartsOn);
      groups[periodKey].push(item);
    }

    // Build result array, excluding empty periods
    const result: TimePeriod<T>[] = [];

    for (const key of PERIOD_ORDER) {
      const periodItems = groups[key];
      if (periodItems.length > 0) {
        result.push({
          key,
          label: PERIOD_LABELS[key],
          items: periodItems,
          defaultOpen: PERIOD_DEFAULT_OPEN[key],
        });
      }
    }

    return result;
  }, [items, getDate, weekStartsOn]);
}

export default useTimePeriodGroups;
