/**
 * UtilizationWidget Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UtilizationWidget } from './UtilizationWidget';
import type { UtilizationByRole } from '../../../hooks/useFinancialKPIs';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

// Mock Recharts - SVG rendering doesn't work in jsdom
jest.mock('recharts', () => ({
  RadialBarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="radial-bar-chart">{children}</div>
  ),
  RadialBar: () => <div data-testid="radial-bar" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe('UtilizationWidget', () => {
  const defaultProps = {
    utilizationRate: 75,
    totalBillableHours: 150,
    totalNonBillableHours: 50,
    utilizationByRole: [
      { role: 'Partner', utilizationRate: 85, billableHours: 80, totalHours: 94 },
      { role: 'Associate', utilizationRate: 70, billableHours: 50, totalHours: 71 },
      { role: 'Paralegal', utilizationRate: 60, billableHours: 20, totalHours: 33 },
    ] as UtilizationByRole[],
  };

  describe('Basic Rendering', () => {
    it('renders the widget title', () => {
      render(<UtilizationWidget {...defaultProps} />);
      expect(screen.getByText('Utilization')).toBeInTheDocument();
    });

    it('renders utilization percentage', () => {
      render(<UtilizationWidget {...defaultProps} />);
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });

    it('renders gauge chart', () => {
      render(<UtilizationWidget {...defaultProps} />);
      expect(screen.getByTestId('radial-bar-chart')).toBeInTheDocument();
    });

    it('renders hours breakdown', () => {
      render(<UtilizationWidget {...defaultProps} />);
      expect(screen.getByText('Billable')).toBeInTheDocument();
      expect(screen.getByText('Non-Billable')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('renders formatted hours', () => {
      render(<UtilizationWidget {...defaultProps} />);
      expect(screen.getByText('150h')).toBeInTheDocument();
      expect(screen.getByText('50h')).toBeInTheDocument();
      expect(screen.getByText('200h')).toBeInTheDocument();
    });

    it('renders role breakdown section', () => {
      render(<UtilizationWidget {...defaultProps} />);
      expect(screen.getByText('By Role')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<UtilizationWidget {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    });

    it('does not show utilization data when loading', () => {
      render(<UtilizationWidget {...defaultProps} isLoading={true} />);
      expect(screen.queryByText('75.0%')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error is provided', () => {
      const testError = new Error('Failed to fetch utilization');
      render(<UtilizationWidget {...defaultProps} error={testError} />);

      expect(screen.getByTestId('widget-error')).toBeInTheDocument();
    });

    it('calls onRetry when retry button clicked', () => {
      const mockRetry = jest.fn();
      const testError = new Error('Network error');

      render(<UtilizationWidget {...defaultProps} error={testError} onRetry={mockRetry} />);

      screen.getByRole('button', { name: /retry/i }).click();
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('shows empty message when total hours is 0', () => {
      render(
        <UtilizationWidget
          utilizationRate={0}
          totalBillableHours={0}
          totalNonBillableHours={0}
          utilizationByRole={[]}
        />
      );

      expect(screen.getByTestId('widget-empty')).toBeInTheDocument();
      expect(screen.getByText('No utilization data for this period')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('shows green color for high utilization (>=80%)', () => {
      render(<UtilizationWidget {...defaultProps} utilizationRate={85} />);

      // The percentage text should be styled with green
      const percentageElement = screen.getByText('85.0%');
      // Green is #10B981
      expect(percentageElement).toHaveStyle({ color: 'rgb(16, 185, 129)' });
    });

    it('shows yellow color for medium utilization (60-79%)', () => {
      render(<UtilizationWidget {...defaultProps} utilizationRate={70} />);

      const percentageElement = screen.getByText('70.0%');
      // Yellow is #F59E0B
      expect(percentageElement).toHaveStyle({ color: 'rgb(245, 158, 11)' });
    });

    it('shows red color for low utilization (<60%)', () => {
      render(<UtilizationWidget {...defaultProps} utilizationRate={45} />);

      const percentageElement = screen.getByText('45.0%');
      // Red is #EF4444
      expect(percentageElement).toHaveStyle({ color: 'rgb(239, 68, 68)' });
    });
  });

  describe('Delta Badge', () => {
    it('renders delta badge when provided', () => {
      const delta: KPIDelta = {
        absolute: 5,
        percentage: 7.1,
        direction: 'up',
      };

      render(<UtilizationWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('+7.1%')).toBeInTheDocument();
    });

    it('does not render delta when null', () => {
      render(<UtilizationWidget {...defaultProps} delta={null} />);

      expect(screen.queryByText(/^\+\d+.*%$/)).not.toBeInTheDocument();
    });

    it('shows negative delta correctly', () => {
      const delta: KPIDelta = {
        absolute: -10,
        percentage: -12.5,
        direction: 'down',
      };

      render(<UtilizationWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('-12.5%')).toBeInTheDocument();
    });
  });

  describe('Role Breakdown', () => {
    it('does not show role breakdown section when empty', () => {
      render(<UtilizationWidget {...defaultProps} utilizationByRole={[]} />);

      expect(screen.queryByText('By Role')).not.toBeInTheDocument();
    });

    it('handles single role', () => {
      render(
        <UtilizationWidget
          {...defaultProps}
          utilizationByRole={[
            { role: 'Partner', utilizationRate: 90, billableHours: 45, totalHours: 50 },
          ]}
        />
      );

      expect(screen.getByText('By Role')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles 100% utilization', () => {
      render(
        <UtilizationWidget
          utilizationRate={100}
          totalBillableHours={200}
          totalNonBillableHours={0}
          utilizationByRole={[]}
        />
      );

      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('handles 0% utilization', () => {
      render(
        <UtilizationWidget
          utilizationRate={0}
          totalBillableHours={0}
          totalNonBillableHours={100}
          utilizationByRole={[]}
        />
      );

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles decimal utilization rates', () => {
      render(<UtilizationWidget {...defaultProps} utilizationRate={72.5} />);

      expect(screen.getByText('72.5%')).toBeInTheDocument();
    });

    it('handles very large hours', () => {
      render(
        <UtilizationWidget
          utilizationRate={80}
          totalBillableHours={10000}
          totalNonBillableHours={2500}
          utilizationByRole={[]}
        />
      );

      expect(screen.getByText('10,000h')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <UtilizationWidget {...defaultProps} className="custom-utilization" />
      );

      expect(container.firstChild).toHaveClass('custom-utilization');
    });

    it('handles unknown roles gracefully', () => {
      render(
        <UtilizationWidget
          {...defaultProps}
          utilizationByRole={[
            { role: 'CustomRole', utilizationRate: 70, billableHours: 35, totalHours: 50 },
          ]}
        />
      );

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });
});
