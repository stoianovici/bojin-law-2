/**
 * ReportCategoriesSidebar Component Tests
 * Tests for report category navigation, search, and role-based filtering
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportCategoriesSidebar } from './ReportCategoriesSidebar';
import { useReportsStore } from '../../stores/reports.store';
import { useNavigationStore } from '../../stores/navigation.store';

// Mock the report data
jest.mock('../../lib/mock-reports-data', () => ({
  getReportMetadata: jest.fn(() => [
    {
      id: 'cases-by-status',
      categoryId: 'cases',
      name: 'Cases by Status',
      nameRo: 'Dosare după Status',
      description: 'Distribution of cases by status',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'pie',
      requiresDateRange: false,
    },
    {
      id: 'revenue-trends',
      categoryId: 'financial',
      name: 'Revenue Trends',
      nameRo: 'Tendințe Venituri',
      description: 'Revenue over time',
      allowedRoles: ['Partner'],
      chartType: 'line',
      requiresDateRange: true,
    },
    {
      id: 'billable-hours',
      categoryId: 'time',
      name: 'Billable Hours',
      nameRo: 'Ore Facturabile',
      description: 'Billable hours over time',
      allowedRoles: ['Partner', 'Associate'],
      chartType: 'area',
      requiresDateRange: true,
    },
  ]),
}));

describe('ReportCategoriesSidebar', () => {
  beforeEach(() => {
    // Reset store states
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

    useNavigationStore.setState({
      currentSection: 'reports',
      currentRole: 'Partner',
      currentUser: { id: '1', name: 'Test User', role: 'Partner' },
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
    });
  });

  describe('rendering', () => {
    it('should render search input', () => {
      render(<ReportCategoriesSidebar />);
      expect(screen.getByPlaceholderText('Caută rapoarte...')).toBeInTheDocument();
    });

    it('should render all category sections', () => {
      render(<ReportCategoriesSidebar />);

      expect(screen.getByText('Dosare')).toBeInTheDocument();
      expect(screen.getByText('Pontaj')).toBeInTheDocument();
      expect(screen.getByText('Financiar')).toBeInTheDocument();
      expect(screen.getByText('Echipă')).toBeInTheDocument();
      expect(screen.getByText('Clienți')).toBeInTheDocument();
      expect(screen.getByText('Documente')).toBeInTheDocument();
    });

    it('should render custom report button', () => {
      render(<ReportCategoriesSidebar />);
      expect(screen.getByText('+ Raport Personalizat')).toBeInTheDocument();
    });

    it('should show report count for each category', () => {
      render(<ReportCategoriesSidebar />);

      // Cases category should have 1 report visible to Partner
      const casesSection = screen.getByText('Dosare').closest('button');
      expect(casesSection).toHaveTextContent('1 rapoarte');
    });
  });

  describe('category expansion', () => {
    it('should expand cases category by default', () => {
      render(<ReportCategoriesSidebar />);

      // Click to expand cases category (it starts expanded by default)
      expect(screen.getByText('Dosare după Status')).toBeInTheDocument();
    });

    it('should collapse category when clicked', () => {
      render(<ReportCategoriesSidebar />);

      const casesButton = screen.getByText('Dosare').closest('button');

      // Should be expanded by default, so report is visible
      expect(screen.getByText('Dosare după Status')).toBeInTheDocument();

      // Click to collapse
      if (casesButton) fireEvent.click(casesButton);

      // Report should no longer be visible
      expect(screen.queryByText('Dosare după Status')).not.toBeInTheDocument();
    });

    it('should expand collapsed category when clicked', () => {
      render(<ReportCategoriesSidebar />);

      const timeButton = screen.getByText('Pontaj').closest('button');

      // Should be collapsed by default
      expect(screen.queryByText('Ore Facturabile')).not.toBeInTheDocument();

      // Click to expand
      if (timeButton) fireEvent.click(timeButton);

      // Report should now be visible
      expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();
    });
  });

  describe('report selection', () => {
    it('should select report when clicked', () => {
      render(<ReportCategoriesSidebar />);

      const reportButton = screen.getByText('Dosare după Status');
      fireEvent.click(reportButton);

      const state = useReportsStore.getState();
      expect(state.selectedCategoryId).toBe('cases');
      expect(state.selectedReportId).toBe('cases-by-status');
    });

    it('should highlight selected report', () => {
      useReportsStore.setState({
        selectedCategoryId: 'cases',
        selectedReportId: 'cases-by-status',
      });

      render(<ReportCategoriesSidebar />);

      const reportButton = screen.getByText('Dosare după Status').closest('button');
      expect(reportButton).toHaveClass('bg-blue-100');
    });
  });

  describe('search functionality', () => {
    it('should filter reports by search query', async () => {
      render(<ReportCategoriesSidebar />);

      // Expand time category to see the report
      const timeButton = screen.getByText('Pontaj').closest('button');
      if (timeButton) fireEvent.click(timeButton);

      // Initially both reports should be visible
      expect(screen.getByText('Dosare după Status')).toBeInTheDocument();
      expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();

      // Search for "Ore"
      const searchInput = screen.getByPlaceholderText('Caută rapoarte...');
      fireEvent.change(searchInput, { target: { value: 'Ore' } });

      await waitFor(() => {
        expect(screen.queryByText('Dosare după Status')).not.toBeInTheDocument();
        expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();
      });
    });

    it('should hide empty categories when searching', async () => {
      render(<ReportCategoriesSidebar />);

      const searchInput = screen.getByPlaceholderText('Caută rapoarte...');
      fireEvent.change(searchInput, { target: { value: 'Venituri' } });

      await waitFor(() => {
        // Only Financial category should be visible
        expect(screen.queryByText('Dosare')).not.toBeInTheDocument();
        expect(screen.getByText('Financiar')).toBeInTheDocument();
      });
    });
  });

  describe('role-based filtering', () => {
    it('should show all reports for Partner role', () => {
      useNavigationStore.setState({ currentRole: 'Partner' });
      render(<ReportCategoriesSidebar />);

      // Expand financial category
      const financialButton = screen.getByText('Financiar').closest('button');
      if (financialButton) fireEvent.click(financialButton);

      expect(screen.getByText('Tendințe Venituri')).toBeInTheDocument();
    });

    it('should hide restricted reports for Associate role', () => {
      useNavigationStore.setState({ currentRole: 'Associate' });
      render(<ReportCategoriesSidebar />);

      // Expand financial category
      const financialButton = screen.getByText('Financiar').closest('button');
      if (financialButton) fireEvent.click(financialButton);

      // Financial reports should not be visible for Associate
      expect(screen.queryByText('Tendințe Venituri')).not.toBeInTheDocument();
    });

    it('should show lock icon for restricted reports', () => {
      useNavigationStore.setState({ currentRole: 'Paralegal' });
      render(<ReportCategoriesSidebar />);

      // Expand time category
      const timeButton = screen.getByText('Pontaj').closest('button');
      if (timeButton) fireEvent.click(timeButton);

      // Should show lock icon for restricted report
      const timeSection = screen.getByText('Pontaj').closest('div');
      expect(timeSection?.querySelector('svg')).toBeInTheDocument();
    });

    it('should not allow clicking restricted reports', () => {
      useNavigationStore.setState({ currentRole: 'Paralegal' });
      render(<ReportCategoriesSidebar />);

      // Expand time category
      const timeButton = screen.getByText('Pontaj').closest('button');
      if (timeButton) fireEvent.click(timeButton);

      const restrictedReport = screen.getByText('Ore Facturabile').closest('button');

      // Button should be disabled
      expect(restrictedReport).toHaveAttribute('disabled');
    });
  });

  describe('custom report builder', () => {
    it('should open report builder when custom report button clicked', () => {
      render(<ReportCategoriesSidebar />);

      const customButton = screen.getByText('+ Raport Personalizat');
      fireEvent.click(customButton);

      // ReportBuilder modal should open (checking for modal title)
      expect(screen.getByText('Creare Raport Personalizat')).toBeInTheDocument();
    });
  });
});
