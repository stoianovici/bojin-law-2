/**
 * CaseRevenueKPIWidget Component Tests
 * Story 2.8.1: Billing & Rate Management - Task 23
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaseRevenueKPIWidget } from './CaseRevenueKPIWidget';
import { FinancialAccessProvider } from '@/contexts/FinancialAccessContext';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock hooks
const mockRefetch = jest.fn().mockResolvedValue({});

const mockKPIData = {
  caseId: 'case-123',
  billingType: 'Fixed' as const,
  actualRevenue: 100000, // $1,000.00
  projectedRevenue: 85000, // $850.00
  variance: 15000, // $150.00
  variancePercent: 17.65,
  totalHours: 8.5,
  timeEntriesCount: 5,
};

jest.mock('@/hooks/useRevenueKPIs', () => ({
  useCaseRevenueKPI: jest.fn(() => ({
    data: mockKPIData,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  })),
  formatCurrency: (cents: number) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  },
  formatPercentage: (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  },
}));

jest.mock('@/hooks/useFinancialAccess', () => ({
  useFinancialAccess: () => ({
    hasFinancialAccess: true,
    userRole: 'Partner',
  }),
}));

// Wrapper component to provide necessary context
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <FinancialAccessProvider>
      {children}
    </FinancialAccessProvider>
  </AuthProvider>
);

const defaultProps = {
  caseId: 'case-123',
  billingType: 'Fixed' as const,
};

describe('CaseRevenueKPIWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing for Hourly billing cases', () => {
      const { container } = render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} billingType="Hourly" />
        </Wrapper>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders widget for Fixed billing cases', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );
      expect(screen.getByText('Revenue KPI')).toBeInTheDocument();
    });

    it('displays all KPI metrics', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('Fixed Fee Amount')).toBeInTheDocument();
      expect(screen.getByText('Projected Hourly Revenue')).toBeInTheDocument();
      expect(screen.getByText('Variance')).toBeInTheDocument();
    });

    it('shows refresh button', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const refreshButton = screen.getByTitle('Refresh KPI');
      expect(refreshButton).toBeInTheDocument();
    });

    it('displays View Details link', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const detailsLink = screen.getByText('View Details');
      expect(detailsLink).toHaveAttribute('href', '/dashboard/kpis');
    });
  });

  describe('KPI Values Display', () => {
    it('displays fixed fee amount', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    });

    it('displays projected hourly revenue', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('$850.00')).toBeInTheDocument();
    });

    it('displays total billable hours', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText(/based on 8\.5 billable hours/i)).toBeInTheDocument();
    });

    it('displays variance amount', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });

    it('displays variance percentage', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('+17.65%')).toBeInTheDocument();
    });
  });

  describe('Variance Color Coding', () => {
    it('displays green for positive variance', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const varianceSection = screen.getByText('Variance').closest('div');
      expect(varianceSection).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200');
    });

    it('displays red for negative variance', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          variance: -20000, // -$200.00
          variancePercent: -23.53,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const varianceSection = screen.getByText('Variance').closest('div');
      expect(varianceSection).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');
    });

    it('displays gray for zero variance', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          variance: 0,
          variancePercent: 0,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const varianceSection = screen.getByText('Variance').closest('div');
      expect(varianceSection).toHaveClass('text-gray-600', 'bg-gray-50', 'border-gray-200');
    });

    it('shows up arrow for positive variance', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      // Check for up arrow SVG
      const varianceSection = screen.getByText('Variance').closest('div');
      const svg = varianceSection?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('shows down arrow for negative variance', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          variance: -20000,
          variancePercent: -23.53,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const varianceSection = screen.getByText('Variance').closest('div');
      const svg = varianceSection?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('No Time Entries State', () => {
    it('shows special state when no time entries exist', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          timeEntriesCount: 0,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('No time tracked yet')).toBeInTheDocument();
      expect(screen.getByText(/kpi will be available once time entries are logged/i)).toBeInTheDocument();
    });

    it('still shows fixed amount when no time entries', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          timeEntriesCount: 0,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('Fixed Amount:')).toBeInTheDocument();
      expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    });
  });

  describe('Null KPI Data State', () => {
    it('shows message when KPI cannot be calculated', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('Revenue KPI')).toBeInTheDocument();
      expect(screen.getByText(/kpi cannot be calculated/i)).toBeInTheDocument();
      expect(screen.getByText(/please ensure billing rates are set/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when data is loading', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays multiple skeleton items for metrics', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const skeletonMetrics = document.querySelectorAll('.h-16');
      expect(skeletonMetrics.length).toBe(3); // 3 metric placeholders
    });
  });

  describe('Error State', () => {
    it('shows error message when fetch fails', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'Network error' },
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('Failed to load KPI data')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('allows retry on error', async () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'Network error' },
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const retryButton = screen.getByText('Try again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('calls refetch when refresh button clicked', async () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const refreshButton = screen.getByTitle('Refresh KPI');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('updates timestamp after refresh', async () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      const initialTimestamp = screen.getByText(/updated/i);
      expect(initialTimestamp).toBeInTheDocument();

      const refreshButton = screen.getByTitle('Refresh KPI');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText(/just now/i)).toBeInTheDocument();
      });
    });
  });

  describe('Timestamp Display', () => {
    it('shows "just now" for recent updates', () => {
      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
    });
  });

  describe('Role-Based Access', () => {
    it('wraps content with FinancialData component', () => {
      const { container } = render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      // FinancialData wrapper should be present
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('hides widget for non-Partners', () => {
      jest.mock('@/hooks/useFinancialAccess', () => ({
        useFinancialAccess: () => ({
          hasFinancialAccess: false,
          userRole: 'Associate',
        }),
      }));

      const { container } = render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      // Content should not be visible to non-Partners
      expect(container.querySelector('.bg-white')).not.toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('formats currency with commas for large amounts', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          actualRevenue: 123456, // $1,234.56
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    });

    it('displays variance amount as absolute value', () => {
      const useCaseRevenueKPI = require('@/hooks/useRevenueKPIs').useCaseRevenueKPI;
      useCaseRevenueKPI.mockReturnValue({
        data: {
          ...mockKPIData,
          variance: -30000, // -$300.00
          variancePercent: -35.29,
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <Wrapper>
          <CaseRevenueKPIWidget {...defaultProps} />
        </Wrapper>
      );

      // Variance should show as positive number with color coding
      expect(screen.getByText('$300.00')).toBeInTheDocument();
    });
  });
});
