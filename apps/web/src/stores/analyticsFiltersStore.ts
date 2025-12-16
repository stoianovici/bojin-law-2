/**
 * Analytics Filters Store
 * Story 2.11.4: Financial Dashboard UI
 *
 * Zustand store for managing analytics dashboard filter state.
 * - Date range selection with presets
 * - Period comparison toggle
 */

import { create } from 'zustand';

/**
 * Date range type for filtering KPIs
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Date range preset options
 */
export type DateRangePreset = 'last30' | 'lastQuarter' | 'ytd' | 'custom';

/**
 * Analytics filters store state
 */
export interface AnalyticsFiltersState {
  /**
   * Current date range for filtering
   */
  dateRange: DateRange;

  /**
   * Currently selected preset (or 'custom' if manual)
   */
  preset: DateRangePreset;

  /**
   * Whether period comparison is enabled
   */
  comparisonEnabled: boolean;

  /**
   * Set a custom date range
   */
  setDateRange: (range: DateRange) => void;

  /**
   * Set a preset date range
   */
  setPreset: (preset: DateRangePreset) => void;

  /**
   * Toggle period comparison
   */
  toggleComparison: () => void;

  /**
   * Set comparison enabled state directly
   */
  setComparisonEnabled: (enabled: boolean) => void;

  /**
   * Get the previous period date range for comparison
   */
  getPreviousPeriod: () => DateRange;
}

/**
 * Calculate date range for a preset
 */
function getPresetDateRange(preset: DateRangePreset): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  let start: Date;

  switch (preset) {
    case 'last30':
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastQuarter':
      start = new Date();
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case 'ytd':
      start = new Date(end.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'custom':
    default:
      // Default to last 30 days for custom
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

/**
 * Calculate previous period based on current date range
 * Duration matches the current period length
 */
function calculatePreviousPeriod(dateRange: DateRange): DateRange {
  const duration = dateRange.end.getTime() - dateRange.start.getTime();

  // Previous end is 1ms before current start (same day boundary)
  const previousEnd = new Date(dateRange.start.getTime() - 1);

  // Previous start is duration before previous end
  const previousStart = new Date(previousEnd.getTime() - duration);
  previousStart.setHours(0, 0, 0, 0);

  return {
    start: previousStart,
    end: previousEnd,
  };
}

/**
 * Analytics filters Zustand store
 */
export const useAnalyticsFiltersStore = create<AnalyticsFiltersState>((set, get) => ({
  dateRange: getPresetDateRange('last30'),
  preset: 'last30',
  comparisonEnabled: false,

  setDateRange: (range: DateRange) =>
    set({
      dateRange: range,
      preset: 'custom',
    }),

  setPreset: (preset: DateRangePreset) =>
    set({
      dateRange: getPresetDateRange(preset),
      preset,
    }),

  toggleComparison: () =>
    set((state) => ({
      comparisonEnabled: !state.comparisonEnabled,
    })),

  setComparisonEnabled: (enabled: boolean) =>
    set({
      comparisonEnabled: enabled,
    }),

  getPreviousPeriod: () => {
    const { dateRange } = get();
    return calculatePreviousPeriod(dateRange);
  },
}));
