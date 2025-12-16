/**
 * RevenueTrendWidget Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RevenueTrendWidget } from './RevenueTrendWidget';
import type { RevenueTrendPoint } from '../../../hooks/useFinancialKPIs';

// Mock Recharts - SVG rendering doesn't work in jsdom
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe('RevenueTrendWidget', () => {
  const createTrendData = (count: number): RevenueTrendPoint[] => {
    const data: RevenueTrendPoint[] = [];
    const baseDate = new Date('2025-01-01');

    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i * 7); // Weekly data
      data.push({
        date: date.toISOString(),
        revenue: 10000 + Math.random() * 5000,
        caseCount: 5 + Math.floor(Math.random() * 10),
      });
    }
    return data;
  };

  const defaultProps = {
    revenueTrend: createTrendData(8),
  };

  describe('Basic Rendering', () => {
    it('renders the widget title', () => {
      render(<RevenueTrendWidget {...defaultProps} />);
      expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
    });

    it('renders the line chart when there is data', () => {
      render(<RevenueTrendWidget {...defaultProps} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders responsive container', () => {
      render(<RevenueTrendWidget {...defaultProps} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<RevenueTrendWidget {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    });

    it('does not show chart when loading', () => {
      render(<RevenueTrendWidget {...defaultProps} isLoading={true} />);
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error is provided', () => {
      const testError = new Error('Failed to fetch trend data');
      render(<RevenueTrendWidget {...defaultProps} error={testError} />);

      expect(screen.getByTestId('widget-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('displays error details', () => {
      const testError = new Error('Network timeout');
      render(<RevenueTrendWidget {...defaultProps} error={testError} />);

      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const mockRetry = jest.fn();
      const testError = new Error('Network error');

      render(<RevenueTrendWidget {...defaultProps} error={testError} onRetry={mockRetry} />);

      screen.getByRole('button', { name: /retry/i }).click();
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('shows empty message when revenueTrend is empty', () => {
      render(<RevenueTrendWidget revenueTrend={[]} />);

      expect(screen.getByTestId('widget-empty')).toBeInTheDocument();
      expect(screen.getByText('No revenue data for this period')).toBeInTheDocument();
    });

    it('shows empty message when revenueTrend is undefined', () => {
      render(<RevenueTrendWidget revenueTrend={undefined as any} />);

      expect(screen.getByTestId('widget-empty')).toBeInTheDocument();
    });
  });

  describe('Comparison Mode', () => {
    it('renders comparison data when enabled', () => {
      const previousTrend = createTrendData(8);

      render(
        <RevenueTrendWidget
          {...defaultProps}
          comparisonEnabled={true}
          previousTrend={previousTrend}
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('does not show legend when comparison is disabled', () => {
      render(<RevenueTrendWidget {...defaultProps} comparisonEnabled={false} />);

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    it('handles null previousTrend gracefully', () => {
      render(
        <RevenueTrendWidget {...defaultProps} comparisonEnabled={true} previousTrend={null} />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('handles mismatched trend lengths', () => {
      const previousTrend = createTrendData(4); // Shorter than current

      render(
        <RevenueTrendWidget
          {...defaultProps}
          comparisonEnabled={true}
          previousTrend={previousTrend}
        />
      );

      // Should still render without crashing
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles single data point', () => {
      const singlePoint: RevenueTrendPoint[] = [
        { date: '2025-01-01', revenue: 5000, caseCount: 3 },
      ];

      render(<RevenueTrendWidget revenueTrend={singlePoint} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('handles large dataset (365 days)', () => {
      const yearData = createTrendData(365);

      render(<RevenueTrendWidget revenueTrend={yearData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('handles zero revenue data points', () => {
      const zeroData: RevenueTrendPoint[] = [
        { date: '2025-01-01', revenue: 0, caseCount: 0 },
        { date: '2025-01-08', revenue: 0, caseCount: 0 },
      ];

      render(<RevenueTrendWidget revenueTrend={zeroData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <RevenueTrendWidget {...defaultProps} className="custom-trend" />
      );

      expect(container.firstChild).toHaveClass('custom-trend');
    });

    it('handles date formats correctly', () => {
      const dateFormats: RevenueTrendPoint[] = [
        { date: '2025-01-15T00:00:00.000Z', revenue: 1000, caseCount: 1 },
        { date: '2025-01-22T12:30:00.000Z', revenue: 2000, caseCount: 2 },
      ];

      render(<RevenueTrendWidget revenueTrend={dateFormats} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
});
