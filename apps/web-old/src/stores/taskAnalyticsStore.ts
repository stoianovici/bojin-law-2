/**
 * Task Analytics Store
 * Story 4.7: Task Analytics and Optimization - Task 30
 *
 * Zustand store for managing task analytics filter state.
 * Extends the existing analytics filter pattern with task-specific state.
 */

import { create } from 'zustand';
import type { TaskType } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Date range type for filtering
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Date range preset options
 */
export type DateRangePreset = 'last7' | 'last30' | 'lastQuarter' | 'ytd' | 'custom';

/**
 * Velocity interval options
 */
export type VelocityInterval = 'daily' | 'weekly' | 'monthly';

/**
 * Analytics tab options
 */
export type AnalyticsTab =
  | 'overview'
  | 'completion'
  | 'overdue'
  | 'velocity'
  | 'patterns'
  | 'delegation'
  | 'roi';

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'pdf';

/**
 * Task analytics store state
 */
export interface TaskAnalyticsState {
  // Date range filters
  dateRange: DateRange;
  preset: DateRangePreset;

  // Task-specific filters
  selectedTaskTypes: TaskType[];
  selectedUserIds: string[];
  selectedCaseIds: string[];

  // UI state
  activeTab: AnalyticsTab;
  velocityInterval: VelocityInterval;
  comparisonEnabled: boolean;

  // Export state
  isExporting: boolean;
  exportFormat: ExportFormat;

  // Actions
  setDateRange: (range: DateRange) => void;
  setPreset: (preset: DateRangePreset) => void;
  setSelectedTaskTypes: (types: TaskType[]) => void;
  setSelectedUserIds: (ids: string[]) => void;
  setSelectedCaseIds: (ids: string[]) => void;
  setActiveTab: (tab: AnalyticsTab) => void;
  setVelocityInterval: (interval: VelocityInterval) => void;
  toggleComparison: () => void;
  setIsExporting: (exporting: boolean) => void;
  setExportFormat: (format: ExportFormat) => void;
  resetFilters: () => void;
  getPreviousPeriod: () => DateRange;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate date range for a preset
 */
function getPresetDateRange(preset: DateRangePreset): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  let start: Date;

  switch (preset) {
    case 'last7':
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
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
    default:
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

/**
 * Calculate previous period date range for comparison
 */
function getPreviousPeriodDateRange(current: DateRange): DateRange {
  const periodLength = current.end.getTime() - current.start.getTime();

  return {
    start: new Date(current.start.getTime() - periodLength),
    end: new Date(current.start.getTime() - 1),
  };
}

// ============================================================================
// Store
// ============================================================================

const defaultDateRange = getPresetDateRange('last30');

export const useTaskAnalyticsStore = create<TaskAnalyticsState>((set, get) => ({
  // Initial state
  dateRange: defaultDateRange,
  preset: 'last30',
  selectedTaskTypes: [],
  selectedUserIds: [],
  selectedCaseIds: [],
  activeTab: 'overview',
  velocityInterval: 'weekly',
  comparisonEnabled: true,
  isExporting: false,
  exportFormat: 'csv',

  // Actions
  setDateRange: (range) =>
    set({
      dateRange: range,
      preset: 'custom',
    }),

  setPreset: (preset) =>
    set({
      preset,
      dateRange: getPresetDateRange(preset),
    }),

  setSelectedTaskTypes: (types) =>
    set({
      selectedTaskTypes: types,
    }),

  setSelectedUserIds: (ids) =>
    set({
      selectedUserIds: ids,
    }),

  setSelectedCaseIds: (ids) =>
    set({
      selectedCaseIds: ids,
    }),

  setActiveTab: (tab) =>
    set({
      activeTab: tab,
    }),

  setVelocityInterval: (interval) =>
    set({
      velocityInterval: interval,
    }),

  toggleComparison: () =>
    set((state) => ({
      comparisonEnabled: !state.comparisonEnabled,
    })),

  setIsExporting: (exporting) =>
    set({
      isExporting: exporting,
    }),

  setExportFormat: (format) =>
    set({
      exportFormat: format,
    }),

  resetFilters: () =>
    set({
      dateRange: defaultDateRange,
      preset: 'last30',
      selectedTaskTypes: [],
      selectedUserIds: [],
      selectedCaseIds: [],
      velocityInterval: 'weekly',
      comparisonEnabled: true,
    }),

  getPreviousPeriod: () => getPreviousPeriodDateRange(get().dateRange),
}));

export default useTaskAnalyticsStore;
