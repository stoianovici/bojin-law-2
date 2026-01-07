import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DateRange,
  DateRangePreset,
  CustomReport,
  DrillDownData,
  ReportCategory,
} from '@legal-platform/types';

interface ExportModalState {
  isOpen: boolean;
  format: 'pdf' | 'excel' | null;
}

interface DrillDownModalState {
  isOpen: boolean;
  data: DrillDownData | null;
}

interface ReportsState {
  // Selected report
  selectedCategoryId: ReportCategory | null;
  selectedReportId: string | null;

  // Date range filter
  dateRange: DateRange;
  comparisonEnabled: boolean;

  // Custom reports
  customReports: CustomReport[];

  // Modal states
  drillDownModal: DrillDownModalState;
  exportModal: ExportModalState;

  // Actions
  selectReport: (categoryId: ReportCategory, reportId: string) => void;
  setDateRange: (range: DateRange) => void;
  setDateRangePreset: (preset: DateRangePreset) => void;
  setComparisonEnabled: (enabled: boolean) => void;
  saveCustomReport: (report: CustomReport) => void;
  deleteCustomReport: (reportId: string) => void;
  openDrillDown: (data: DrillDownData) => void;
  closeDrillDown: () => void;
  openExportModal: (format: 'pdf' | 'excel') => void;
  closeExportModal: () => void;
}

// Helper function to calculate date ranges for presets
const getDateRangeForPreset = (preset: DateRangePreset): DateRange => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'thisWeek': {
      // Monday to Sunday
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(now.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }

    case 'thisMonth': {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }

    case 'thisQuarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start.setMonth(currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(currentQuarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }

    case 'thisYear': {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    }
  }

  return {
    start,
    end,
    preset,
  };
};

// Default date range (this month)
const getDefaultDateRange = (): DateRange => getDateRangeForPreset('thisMonth');

export const useReportsStore = create<ReportsState>()(
  persist(
    (set) => ({
      // Initial state
      selectedCategoryId: null,
      selectedReportId: null,
      dateRange: getDefaultDateRange(),
      comparisonEnabled: false,
      customReports: [],
      drillDownModal: {
        isOpen: false,
        data: null,
      },
      exportModal: {
        isOpen: false,
        format: null,
      },

      // Actions
      selectReport: (categoryId, reportId) =>
        set({
          selectedCategoryId: categoryId,
          selectedReportId: reportId,
        }),

      setDateRange: (range) =>
        set({
          dateRange: range,
        }),

      setDateRangePreset: (preset) =>
        set({
          dateRange: getDateRangeForPreset(preset),
        }),

      setComparisonEnabled: (enabled) =>
        set({
          comparisonEnabled: enabled,
        }),

      saveCustomReport: (report) =>
        set((state) => ({
          customReports: [...state.customReports, report],
        })),

      deleteCustomReport: (reportId) =>
        set((state) => ({
          customReports: state.customReports.filter((r) => r.id !== reportId),
        })),

      openDrillDown: (data) =>
        set({
          drillDownModal: {
            isOpen: true,
            data,
          },
        }),

      closeDrillDown: () =>
        set({
          drillDownModal: {
            isOpen: false,
            data: null,
          },
        }),

      openExportModal: (format) =>
        set({
          exportModal: {
            isOpen: true,
            format,
          },
        }),

      closeExportModal: () =>
        set({
          exportModal: {
            isOpen: false,
            format: null,
          },
        }),
    }),
    {
      name: 'reports-storage',
      // Only persist date range preferences and custom reports
      partialize: (state) => ({
        dateRange: state.dateRange,
        customReports: state.customReports,
      }),
      // Custom storage to handle Date serialization/deserialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);

          // Convert date strings back to Date objects
          if (state.dateRange) {
            state.dateRange.start = new Date(state.dateRange.start);
            state.dateRange.end = new Date(state.dateRange.end);
          }

          return { state };
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
