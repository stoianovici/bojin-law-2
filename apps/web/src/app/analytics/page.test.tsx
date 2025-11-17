/**
 * Analytics Page Integration Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from './page';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import { useRouter } from 'next/navigation';

// Mock stores and router
jest.mock('../../stores/navigation.store');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock widget components to avoid rendering complexity
jest.mock('@/components/dashboard/widgets/FirmKPIsWidget', () => ({
  FirmKPIsWidget: ({ widget }: any) => <div data-testid="firm-kpis-widget">{widget.title}</div>,
}));

jest.mock('@/components/dashboard/widgets/BillableHoursChartWidget', () => ({
  BillableHoursChartWidget: ({ widget }: any) => (
    <div data-testid="billable-hours-widget">{widget.title}</div>
  ),
}));

jest.mock('@/components/dashboard/widgets/CaseDistributionWidget', () => ({
  CaseDistributionWidget: ({ widget }: any) => (
    <div data-testid="case-distribution-widget">{widget.title}</div>
  ),
}));

jest.mock('@/components/dashboard/widgets/PendingApprovalsWidget', () => ({
  PendingApprovalsWidget: ({ widget }: any) => (
    <div data-testid="pending-approvals-widget">{widget.title}</div>
  ),
}));

describe('AnalyticsPage', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockNavigationStore = {
    currentRole: 'Partner',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockNavigationStore)
    );
  });

  describe('Partner Access', () => {
    it('renders analytics page for Partner role', () => {
      render(<AnalyticsPage />);

      expect(screen.getByText('Analytics & KPIs')).toBeInTheDocument();
    });

    it('displays page header with description', () => {
      render(<AnalyticsPage />);

      expect(screen.getByText('Analytics & KPIs')).toBeInTheDocument();
      expect(
        screen.getByText('Vizualizare KPI-uri și metrici firmă pentru parteneri')
      ).toBeInTheDocument();
    });

    it('displays date range selector', () => {
      render(<AnalyticsPage />);

      const dateSelector = screen.getByRole('combobox');
      expect(dateSelector).toBeInTheDocument();

      // Check options
      expect(screen.getByText('Ultimele 7 zile')).toBeInTheDocument();
      expect(screen.getByText('Ultimele 30 zile')).toBeInTheDocument();
      expect(screen.getByText('Ultimele 90 zile')).toBeInTheDocument();
      expect(screen.getByText('Ultimul an')).toBeInTheDocument();
    });

    it('displays export button', () => {
      render(<AnalyticsPage />);

      const exportButton = screen.getByText('Export');
      expect(exportButton).toBeInTheDocument();
    });

    it('renders all KPI widgets', () => {
      render(<AnalyticsPage />);

      expect(screen.getByTestId('firm-kpis-widget')).toBeInTheDocument();
      expect(screen.getByTestId('billable-hours-widget')).toBeInTheDocument();
      expect(screen.getByTestId('case-distribution-widget')).toBeInTheDocument();
      expect(screen.getByTestId('pending-approvals-widget')).toBeInTheDocument();
    });

    it('displays Firm KPIs widget with title', () => {
      render(<AnalyticsPage />);

      const firmKPIsWidget = screen.getByTestId('firm-kpis-widget');
      expect(firmKPIsWidget).toHaveTextContent('KPI-uri Firmă');
    });

    it('displays Billable Hours widget with title', () => {
      render(<AnalyticsPage />);

      const billableHoursWidget = screen.getByTestId('billable-hours-widget');
      expect(billableHoursWidget).toHaveTextContent('Ore Facturabile - Ultimele 4 Săptămâni');
    });

    it('displays Case Distribution widget with title', () => {
      render(<AnalyticsPage />);

      const caseDistWidget = screen.getByTestId('case-distribution-widget');
      expect(caseDistWidget).toHaveTextContent('Distribuție Cazuri pe Tip');
    });

    it('displays Pending Approvals widget with title', () => {
      render(<AnalyticsPage />);

      const approvalsWidget = screen.getByTestId('pending-approvals-widget');
      expect(approvalsWidget).toHaveTextContent('Aprobări în Așteptare');
    });
  });

  describe('Role-Based Access Control', () => {
    it('redirects Associate role to dashboard', async () => {
      (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ currentRole: 'Associate' })
      );

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });

    it('redirects Paralegal role to dashboard', async () => {
      (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ currentRole: 'Paralegal' })
      );

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });

    it('returns null while redirecting non-Partner users', () => {
      (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ currentRole: 'Associate' })
      );

      const { container } = render(<AnalyticsPage />);

      // Component should return null immediately for non-Partners
      expect(container.firstChild).toBeNull();
    });

    it('logs warning when non-Partner attempts to access', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ currentRole: 'Associate' })
      );

      render(<AnalyticsPage />);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Analytics] Non-Partner user attempted to access Analytics. Redirecting to dashboard.'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Widget Layout', () => {
    it('displays widgets in correct layout structure', () => {
      const { container } = render(<AnalyticsPage />);

      // Check for layout grid
      const grids = container.querySelectorAll('.grid');
      expect(grids.length).toBeGreaterThan(0);
    });

    it('displays firm KPIs widget at the top', () => {
      const { container } = render(<AnalyticsPage />);

      const widgets = container.querySelectorAll('[data-testid]');
      expect(widgets[0]).toHaveAttribute('data-testid', 'firm-kpis-widget');
    });

    it('displays billable hours and case distribution in charts row', () => {
      render(<AnalyticsPage />);

      // Both chart widgets should be present
      expect(screen.getByTestId('billable-hours-widget')).toBeInTheDocument();
      expect(screen.getByTestId('case-distribution-widget')).toBeInTheDocument();
    });

    it('displays pending approvals widget at the bottom', () => {
      render(<AnalyticsPage />);

      expect(screen.getByTestId('pending-approvals-widget')).toBeInTheDocument();
    });
  });

  describe('Romanian Language Support', () => {
    it('displays Romanian text in page header', () => {
      render(<AnalyticsPage />);

      expect(screen.getByText('Analytics & KPIs')).toBeInTheDocument();
      expect(
        screen.getByText('Vizualizare KPI-uri și metrici firmă pentru parteneri')
      ).toBeInTheDocument();
    });

    it('displays Romanian date range options', () => {
      render(<AnalyticsPage />);

      expect(screen.getByText('Ultimele 7 zile')).toBeInTheDocument();
      expect(screen.getByText('Ultimele 30 zile')).toBeInTheDocument();
      expect(screen.getByText('Ultimele 90 zile')).toBeInTheDocument();
      expect(screen.getByText('Ultimul an')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('shows alert when export button is clicked (placeholder)', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      render(<AnalyticsPage />);

      const exportButton = screen.getByText('Export');
      exportButton.click();

      expect(alertSpy).toHaveBeenCalledWith('Export Analytics - To be implemented');

      alertSpy.mockRestore();
    });
  });

  describe('Styling and Accessibility', () => {
    it('applies correct background color', () => {
      const { container } = render(<AnalyticsPage />);

      const mainDiv = container.querySelector('.min-h-screen');
      expect(mainDiv).toHaveClass('bg-gray-50');
    });

    it('renders with proper spacing', () => {
      const { container } = render(<AnalyticsPage />);

      // Check for space-y-6 class on widgets container
      const widgetsContainer = container.querySelector('.space-y-6');
      expect(widgetsContainer).toBeInTheDocument();
    });

    it('uses proper heading hierarchy', () => {
      render(<AnalyticsPage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Analytics & KPIs');
    });

    it('includes descriptive text for screen readers', () => {
      render(<AnalyticsPage />);

      const description = screen.getByText(
        'Vizualizare KPI-uri și metrici firmă pentru parteneri'
      );
      expect(description).toBeInTheDocument();
    });
  });

  describe('useEffect Hook Behavior', () => {
    it('runs redirect check on mount', () => {
      (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ currentRole: 'Paralegal' })
      );

      render(<AnalyticsPage />);

      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('runs redirect check when role changes', () => {
      const { rerender } = render(<AnalyticsPage />);

      // Change role to Associate
      (useNavigationStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ currentRole: 'Associate' })
      );

      rerender(<AnalyticsPage />);

      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  describe('Widget Props', () => {
    it('passes correct widget configuration to FirmKPIsWidget', () => {
      render(<AnalyticsPage />);

      const firmKPIsWidget = screen.getByTestId('firm-kpis-widget');
      expect(firmKPIsWidget).toBeInTheDocument();
      // Widget should render with title from props
      expect(firmKPIsWidget).toHaveTextContent('KPI-uri Firmă');
    });

    it('passes mock data to all widgets', () => {
      render(<AnalyticsPage />);

      // All widgets should be rendered with mock data
      expect(screen.getByTestId('firm-kpis-widget')).toBeInTheDocument();
      expect(screen.getByTestId('billable-hours-widget')).toBeInTheDocument();
      expect(screen.getByTestId('case-distribution-widget')).toBeInTheDocument();
      expect(screen.getByTestId('pending-approvals-widget')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive grid classes', () => {
      const { container } = render(<AnalyticsPage />);

      // Check for responsive grid (lg:grid-cols-12)
      const responsiveGrid = container.querySelector('.lg\\:grid-cols-12');
      expect(responsiveGrid).toBeInTheDocument();
    });

    it('applies responsive column spans', () => {
      const { container } = render(<AnalyticsPage />);

      // Check for lg:col-span-8 and lg:col-span-4 classes
      const largeColSpan = container.querySelector('.lg\\:col-span-8');
      expect(largeColSpan).toBeInTheDocument();

      const smallColSpan = container.querySelector('.lg\\:col-span-4');
      expect(smallColSpan).toBeInTheDocument();
    });

    it('applies max-width container for large screens', () => {
      const { container } = render(<AnalyticsPage />);

      const maxWidthContainer = container.querySelector('.max-w-7xl');
      expect(maxWidthContainer).toBeInTheDocument();
    });
  });

  describe('Page Structure', () => {
    it('renders header with border', () => {
      const { container } = render(<AnalyticsPage />);

      const header = container.querySelector('.bg-white.border-b');
      expect(header).toBeInTheDocument();
    });

    it('renders widgets section with padding', () => {
      const { container } = render(<AnalyticsPage />);

      const widgetsSection = container.querySelector('.py-8');
      expect(widgetsSection).toBeInTheDocument();
    });

    it('renders export button with icon', () => {
      render(<AnalyticsPage />);

      const exportButton = screen.getByText('Export');
      expect(exportButton).toBeInTheDocument();

      // Check for SVG icon
      const svg = exportButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});
