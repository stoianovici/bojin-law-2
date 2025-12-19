/**
 * Time Grouping Utility
 * OPS-051: Time Grouping Utility for Chronology
 *
 * Groups events by time period for chronology display
 */

import { isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ro } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

export type TimePeriod = 'today' | 'thisWeek' | 'thisMonth' | 'older';

export interface TimeGroup<T> {
  period: TimePeriod;
  label: string;
  events: T[];
  count: number;
}

// ============================================================================
// Constants
// ============================================================================

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: 'Astăzi',
  thisWeek: 'Săptămâna aceasta',
  thisMonth: 'Luna aceasta',
  older: 'Mai vechi',
};

const PERIOD_ORDER: TimePeriod[] = ['today', 'thisWeek', 'thisMonth', 'older'];

/** Export for external use */
export { PERIOD_ORDER };

// ============================================================================
// Options
// ============================================================================

export interface GroupingOptions {
  /** If true, includes all time periods even if they have no events (default: false) */
  includeEmptyPeriods?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines which time period a date belongs to
 * Uses Romanian locale (week starts on Monday)
 */
function getTimePeriod(date: Date): TimePeriod {
  if (isToday(date)) {
    return 'today';
  }
  // isThisWeek with weekStartsOn: 1 (Monday) and excluding today
  if (isThisWeek(date, { locale: ro, weekStartsOn: 1 })) {
    return 'thisWeek';
  }
  // isThisMonth excluding this week
  if (isThisMonth(date)) {
    return 'thisMonth';
  }
  return 'older';
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Groups events by time period
 *
 * @param events - Array of events with an occurredAt string property
 * @param options - Grouping options (includeEmptyPeriods: boolean)
 * @returns Array of time groups, ordered: today → thisWeek → thisMonth → older
 *
 * @example
 * ```ts
 * const events = [
 *   { id: '1', title: 'Today event', occurredAt: new Date().toISOString() },
 *   { id: '2', title: 'Last month', occurredAt: '2024-11-15T10:00:00Z' },
 * ];
 * const groups = groupEventsByTimePeriod(events);
 * // Returns: [{ period: 'today', label: 'Astăzi', events: [...], count: 1 }, ...]
 *
 * // With includeEmptyPeriods: true, returns all 4 periods even if empty
 * const allGroups = groupEventsByTimePeriod(events, { includeEmptyPeriods: true });
 * ```
 */
export function groupEventsByTimePeriod<T extends { occurredAt: string }>(
  events: T[],
  options: GroupingOptions = {}
): TimeGroup<T>[] {
  const { includeEmptyPeriods = false } = options;

  // Handle empty input - if includeEmptyPeriods, return all empty groups
  if (!events || events.length === 0) {
    if (includeEmptyPeriods) {
      return PERIOD_ORDER.map((period) => ({
        period,
        label: PERIOD_LABELS[period],
        events: [],
        count: 0,
      }));
    }
    return [];
  }

  // Initialize buckets for each period
  const buckets: Record<TimePeriod, T[]> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  // Sort events into buckets
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const period = getTimePeriod(date);
    buckets[period].push(event);
  }

  // Sort events within each bucket (most recent first)
  for (const period of PERIOD_ORDER) {
    buckets[period].sort((a, b) => {
      const dateA = new Date(a.occurredAt).getTime();
      const dateB = new Date(b.occurredAt).getTime();
      return dateB - dateA; // Most recent first
    });
  }

  // Build result array
  const result: TimeGroup<T>[] = [];
  for (const period of PERIOD_ORDER) {
    // Include group if it has events, or if includeEmptyPeriods is enabled
    if (buckets[period].length > 0 || includeEmptyPeriods) {
      result.push({
        period,
        label: PERIOD_LABELS[period],
        events: buckets[period],
        count: buckets[period].length,
      });
    }
  }

  return result;
}

/**
 * Gets the Romanian label for a time period
 */
export function getTimePeriodLabel(period: TimePeriod): string {
  return PERIOD_LABELS[period];
}
