/**
 * RevenueOverviewWidget Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RevenueOverviewWidget } from './RevenueOverviewWidget';
import type { RevenueByBillingType } from '../../../hooks/useFinancialKPIs';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

// Mock Recharts - SVG rendering doesn't work in jsdom
jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="pie-cell" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('RevenueOverviewWidget', () => {
  const defaultProps = {
    totalRevenue: 150000,
    revenueByBillingType: {
      hourly: 75000,
      fixed: 50000,
      retainer: 25000,
    } as RevenueByBillingType,
  };

  describe('Basic Rendering', () => {
    it('renders the widget title', () => {
      render(<RevenueOverviewWidget {...defaultProps} />);
      expect(screen.getByText('Sumar Venituri')).toBeInTheDocument();
    });

    it('renders total revenue amount', () => {
      render(<RevenueOverviewWidget {...defaultProps} />);
      expect(screen.getByText('Total Venituri')).toBeInTheDocument();
      // Should show 150.000 formatted (Romanian locale uses . as thousand separator)
      expect(screen.getByText('150.000')).toBeInTheDocument();
    });

    it('renders the pie chart when there is data', () => {
      render(<RevenueOverviewWidget {...defaultProps} />);
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('renders legend with billing type breakdown', () => {
      render(<RevenueOverviewWidget {...defaultProps} />);
      expect(screen.getByText('Orar')).toBeInTheDocument();
      expect(screen.getByText('Fix')).toBeInTheDocument();
      expect(screen.getByText('Abonament')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<RevenueOverviewWidget {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    });

    it('does not show revenue data when loading', () => {
      render(<RevenueOverviewWidget {...defaultProps} isLoading={true} />);
      expect(screen.queryByText('150.000')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error is provided', () => {
      const testError = new Error('Failed to fetch revenue data');
      render(<RevenueOverviewWidget {...defaultProps} error={testError} />);

      expect(screen.getByTestId('widget-error')).toBeInTheDocument();
      expect(screen.getByText('Eroare la încărcarea datelor')).toBeInTheDocument();
    });

    it('shows retry button when onRetry is provided', () => {
      const mockRetry = jest.fn();
      const testError = new Error('Network error');
      render(<RevenueOverviewWidget {...defaultProps} error={testError} onRetry={mockRetry} />);

      expect(screen.getByRole('button', { name: /reîncearcă/i })).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when totalRevenue is 0', () => {
      render(
        <RevenueOverviewWidget
          totalRevenue={0}
          revenueByBillingType={{ hourly: 0, fixed: 0, retainer: 0 }}
        />
      );

      expect(screen.getByTestId('widget-empty')).toBeInTheDocument();
      expect(screen.getByText('Nu există date pentru această perioadă')).toBeInTheDocument();
    });

    it('shows empty when all billing types are 0', () => {
      render(
        <RevenueOverviewWidget
          totalRevenue={100}
          revenueByBillingType={{ hourly: 0, fixed: 0, retainer: 0 }}
        />
      );

      // No chart data to show even though totalRevenue > 0
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    });
  });

  describe('Delta Badge', () => {
    it('renders delta badge when delta is provided', () => {
      const delta: KPIDelta = {
        absolute: 15000,
        percentage: 11.1,
        direction: 'up',
      };

      render(<RevenueOverviewWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('+11.1%')).toBeInTheDocument();
    });

    it('does not render delta badge when delta is null', () => {
      render(<RevenueOverviewWidget {...defaultProps} delta={null} />);

      // Should not have any percentage change indicators
      expect(screen.queryByText(/\+.*%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/-.*%/)).not.toBeInTheDocument();
    });

    it('shows negative delta correctly', () => {
      const delta: KPIDelta = {
        absolute: -10000,
        percentage: -6.25,
        direction: 'down',
      };

      render(<RevenueOverviewWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('-6.3%')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles single billing type correctly', () => {
      render(
        <RevenueOverviewWidget
          totalRevenue={50000}
          revenueByBillingType={{ hourly: 50000, fixed: 0, retainer: 0 }}
        />
      );

      expect(screen.getByText('Orar')).toBeInTheDocument();
      expect(screen.queryByText('Fix')).not.toBeInTheDocument();
      expect(screen.queryByText('Abonament')).not.toBeInTheDocument();
    });

    it('handles very large revenue values', () => {
      render(
        <RevenueOverviewWidget
          totalRevenue={10000000}
          revenueByBillingType={{
            hourly: 5000000,
            fixed: 3000000,
            retainer: 2000000,
          }}
        />
      );

      // Should format large numbers correctly (Romanian locale uses . as thousand separator)
      expect(screen.getByText('10.000.000')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <RevenueOverviewWidget {...defaultProps} className="custom-widget" />
      );

      expect(container.firstChild).toHaveClass('custom-widget');
    });

    it('handles undefined revenueByBillingType gracefully', () => {
      render(<RevenueOverviewWidget totalRevenue={1000} revenueByBillingType={undefined as any} />);

      // Should not crash
      expect(screen.getByText('Sumar Venituri')).toBeInTheDocument();
    });
  });
});
