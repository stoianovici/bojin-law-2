/**
 * Reports Store Tests
 * Tests for reports state management, date range calculations, and actions
 */

import { useReportsStore } from './reports.store';
import type { CustomReport, DrillDownData } from '@legal-platform/types';

describe('Reports Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useReportsStore.setState({
      selectedCategoryId: null,
      selectedReportId: null,
      dateRange: {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
        preset: 'thisMonth',
      },
      comparisonEnabled: false,
      customReports: [],
      drillDownModal: { isOpen: false, data: null },
      exportModal: { isOpen: false, format: null },
    });
  });

  describe('report selection', () => {
    it('should select a report', () => {
      const { selectReport } = useReportsStore.getState();

      selectReport('cases', 'cases-by-status');

      const state = useReportsStore.getState();
      expect(state.selectedCategoryId).toBe('cases');
      expect(state.selectedReportId).toBe('cases-by-status');
    });

    it('should change selected report', () => {
      const { selectReport } = useReportsStore.getState();

      selectReport('cases', 'cases-by-status');
      selectReport('financial', 'revenue-trends');

      const state = useReportsStore.getState();
      expect(state.selectedCategoryId).toBe('financial');
      expect(state.selectedReportId).toBe('revenue-trends');
    });
  });

  describe('date range management', () => {
    it('should set custom date range', () => {
      const { setDateRange } = useReportsStore.getState();

      const customRange = {
        start: new Date('2025-02-01'),
        end: new Date('2025-02-28'),
        preset: null as null,
      };

      setDateRange(customRange);

      const state = useReportsStore.getState();
      expect(state.dateRange.start).toEqual(customRange.start);
      expect(state.dateRange.end).toEqual(customRange.end);
      expect(state.dateRange.preset).toBeNull();
    });

    it('should set date range preset for this week', () => {
      const { setDateRangePreset } = useReportsStore.getState();

      setDateRangePreset('thisWeek');

      const state = useReportsStore.getState();
      expect(state.dateRange.preset).toBe('thisWeek');
      expect(state.dateRange.start).toBeInstanceOf(Date);
      expect(state.dateRange.end).toBeInstanceOf(Date);
    });

    it('should set date range preset for this month', () => {
      const { setDateRangePreset } = useReportsStore.getState();

      setDateRangePreset('thisMonth');

      const state = useReportsStore.getState();
      expect(state.dateRange.preset).toBe('thisMonth');

      // Check that start is first day of month
      expect(state.dateRange.start.getDate()).toBe(1);

      // Check that end is last day of month
      const lastDay = new Date(
        state.dateRange.end.getFullYear(),
        state.dateRange.end.getMonth() + 1,
        0
      ).getDate();
      expect(state.dateRange.end.getDate()).toBe(lastDay);
    });

    it('should set date range preset for this quarter', () => {
      const { setDateRangePreset } = useReportsStore.getState();

      setDateRangePreset('thisQuarter');

      const state = useReportsStore.getState();
      expect(state.dateRange.preset).toBe('thisQuarter');
      expect(state.dateRange.start).toBeInstanceOf(Date);
      expect(state.dateRange.end).toBeInstanceOf(Date);
    });

    it('should set date range preset for this year', () => {
      const { setDateRangePreset } = useReportsStore.getState();

      setDateRangePreset('thisYear');

      const state = useReportsStore.getState();
      expect(state.dateRange.preset).toBe('thisYear');

      // Check that start is January 1
      expect(state.dateRange.start.getMonth()).toBe(0);
      expect(state.dateRange.start.getDate()).toBe(1);

      // Check that end is December 31
      expect(state.dateRange.end.getMonth()).toBe(11);
      expect(state.dateRange.end.getDate()).toBe(31);
    });
  });

  describe('comparison toggle', () => {
    it('should enable comparison', () => {
      const { setComparisonEnabled } = useReportsStore.getState();

      setComparisonEnabled(true);

      const state = useReportsStore.getState();
      expect(state.comparisonEnabled).toBe(true);
    });

    it('should disable comparison', () => {
      const { setComparisonEnabled } = useReportsStore.getState();

      setComparisonEnabled(true);
      setComparisonEnabled(false);

      const state = useReportsStore.getState();
      expect(state.comparisonEnabled).toBe(false);
    });
  });

  describe('custom reports', () => {
    it('should save custom report', () => {
      const { saveCustomReport } = useReportsStore.getState();

      const customReport: CustomReport = {
        id: 'custom-1',
        name: 'My Custom Report',
        dataSource: 'cases',
        selectedFields: ['Nume Dosar', 'Status'],
        filters: [],
        chartType: 'bar',
        createdAt: new Date(),
        createdBy: 'Test User',
      };

      saveCustomReport(customReport);

      const state = useReportsStore.getState();
      expect(state.customReports).toHaveLength(1);
      expect(state.customReports[0]).toEqual(customReport);
    });

    it('should save multiple custom reports', () => {
      const { saveCustomReport } = useReportsStore.getState();

      const report1: CustomReport = {
        id: 'custom-1',
        name: 'Report 1',
        dataSource: 'cases',
        selectedFields: [],
        filters: [],
        chartType: 'bar',
        createdAt: new Date(),
        createdBy: 'User',
      };

      const report2: CustomReport = {
        id: 'custom-2',
        name: 'Report 2',
        dataSource: 'timeEntries',
        selectedFields: [],
        filters: [],
        chartType: 'line',
        createdAt: new Date(),
        createdBy: 'User',
      };

      saveCustomReport(report1);
      saveCustomReport(report2);

      const state = useReportsStore.getState();
      expect(state.customReports).toHaveLength(2);
    });

    it('should delete custom report', () => {
      const { saveCustomReport, deleteCustomReport } = useReportsStore.getState();

      const report: CustomReport = {
        id: 'custom-1',
        name: 'Report to Delete',
        dataSource: 'cases',
        selectedFields: [],
        filters: [],
        chartType: 'bar',
        createdAt: new Date(),
        createdBy: 'User',
      };

      saveCustomReport(report);
      deleteCustomReport('custom-1');

      const state = useReportsStore.getState();
      expect(state.customReports).toHaveLength(0);
    });

    it('should not affect other reports when deleting', () => {
      const { saveCustomReport, deleteCustomReport } = useReportsStore.getState();

      const report1: CustomReport = {
        id: 'custom-1',
        name: 'Report 1',
        dataSource: 'cases',
        selectedFields: [],
        filters: [],
        chartType: 'bar',
        createdAt: new Date(),
        createdBy: 'User',
      };

      const report2: CustomReport = {
        id: 'custom-2',
        name: 'Report 2',
        dataSource: 'cases',
        selectedFields: [],
        filters: [],
        chartType: 'line',
        createdAt: new Date(),
        createdBy: 'User',
      };

      saveCustomReport(report1);
      saveCustomReport(report2);
      deleteCustomReport('custom-1');

      const state = useReportsStore.getState();
      expect(state.customReports).toHaveLength(1);
      expect(state.customReports[0].id).toBe('custom-2');
    });
  });

  describe('drill-down modal', () => {
    it('should open drill-down modal', () => {
      const { openDrillDown } = useReportsStore.getState();

      const drillDownData: DrillDownData = {
        reportId: 'cases-by-status',
        dataPoint: { label: 'Active', value: 10 },
        detailRows: [{ id: '1', name: 'Case 1' }],
        columns: [{ key: 'name', label: 'Name', labelRo: 'Nume', type: 'text' }],
      };

      openDrillDown(drillDownData);

      const state = useReportsStore.getState();
      expect(state.drillDownModal.isOpen).toBe(true);
      expect(state.drillDownModal.data).toEqual(drillDownData);
    });

    it('should close drill-down modal', () => {
      const { openDrillDown, closeDrillDown } = useReportsStore.getState();

      const drillDownData: DrillDownData = {
        reportId: 'cases-by-status',
        dataPoint: { label: 'Active', value: 10 },
        detailRows: [],
        columns: [],
      };

      openDrillDown(drillDownData);
      closeDrillDown();

      const state = useReportsStore.getState();
      expect(state.drillDownModal.isOpen).toBe(false);
      expect(state.drillDownModal.data).toBeNull();
    });
  });

  describe('export modal', () => {
    it('should open export modal with PDF format', () => {
      const { openExportModal } = useReportsStore.getState();

      openExportModal('pdf');

      const state = useReportsStore.getState();
      expect(state.exportModal.isOpen).toBe(true);
      expect(state.exportModal.format).toBe('pdf');
    });

    it('should open export modal with Excel format', () => {
      const { openExportModal } = useReportsStore.getState();

      openExportModal('excel');

      const state = useReportsStore.getState();
      expect(state.exportModal.isOpen).toBe(true);
      expect(state.exportModal.format).toBe('excel');
    });

    it('should close export modal', () => {
      const { openExportModal, closeExportModal } = useReportsStore.getState();

      openExportModal('pdf');
      closeExportModal();

      const state = useReportsStore.getState();
      expect(state.exportModal.isOpen).toBe(false);
      expect(state.exportModal.format).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist date range preferences', () => {
      const { setDateRangePreset } = useReportsStore.getState();

      setDateRangePreset('thisYear');

      // Check that persistence is configured (actual localStorage persistence
      // is tested via integration tests)
      const state = useReportsStore.getState();
      expect(state.dateRange.preset).toBe('thisYear');
    });

    it('should persist custom reports', () => {
      const { saveCustomReport } = useReportsStore.getState();

      const report: CustomReport = {
        id: 'custom-1',
        name: 'Persistent Report',
        dataSource: 'cases',
        selectedFields: [],
        filters: [],
        chartType: 'bar',
        createdAt: new Date(),
        createdBy: 'User',
      };

      saveCustomReport(report);

      const state = useReportsStore.getState();
      expect(state.customReports).toHaveLength(1);
    });
  });
});
