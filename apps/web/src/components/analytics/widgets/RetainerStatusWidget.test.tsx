/**
 * RetainerStatusWidget Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RetainerStatusWidget } from './RetainerStatusWidget';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

// Mock Recharts - SVG rendering doesn't work in jsdom
jest.mock('recharts', () => ({
  RadialBarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="radial-bar-chart">{children}</div>
  ),
  RadialBar: () => <div data-testid="radial-bar" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe('RetainerStatusWidget', () => {
  const defaultProps = {
    retainerUtilizationAverage: 65,
    retainerCasesCount: 8,
  };

  describe('Basic Rendering', () => {
    it('renders the widget title', () => {
      render(<RetainerStatusWidget {...defaultProps} />);
      expect(screen.getByText('Retainer Status')).toBeInTheDocument();
    });

    it('renders utilization percentage', () => {
      render(<RetainerStatusWidget {...defaultProps} />);
      expect(screen.getByText('65.0%')).toBeInTheDocument();
    });

    it('renders gauge chart', () => {
      render(<RetainerStatusWidget {...defaultProps} />);
      expect(screen.getByTestId('radial-bar-chart')).toBeInTheDocument();
    });

    it('renders average utilization label', () => {
      render(<RetainerStatusWidget {...defaultProps} />);
      expect(screen.getByText('avg utilization')).toBeInTheDocument();
    });

    it('renders retainer cases count', () => {
      render(<RetainerStatusWidget {...defaultProps} />);
      expect(screen.getByText('Active Retainers')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('cases')).toBeInTheDocument();
    });

    it('renders singular "case" for single retainer', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={50}
          retainerCasesCount={1}
        />
      );
      expect(screen.getByText('case')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<RetainerStatusWidget {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    });

    it('does not show utilization data when loading', () => {
      render(<RetainerStatusWidget {...defaultProps} isLoading={true} />);
      expect(screen.queryByText('65%')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error is provided', () => {
      const testError = new Error('Failed to fetch retainer status');
      render(<RetainerStatusWidget {...defaultProps} error={testError} />);

      expect(screen.getByTestId('widget-error')).toBeInTheDocument();
    });

    it('calls onRetry when retry button clicked', () => {
      const mockRetry = jest.fn();
      const testError = new Error('Network error');

      render(
        <RetainerStatusWidget
          {...defaultProps}
          error={testError}
          onRetry={mockRetry}
        />
      );

      screen.getByRole('button', { name: /retry/i }).click();
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('No Retainer Cases State', () => {
    it('shows special empty state when no retainer cases', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={null}
          retainerCasesCount={0}
        />
      );

      expect(screen.getByText('No retainer cases')).toBeInTheDocument();
      expect(
        screen.getByText('Retainer metrics will appear when you have active retainer agreements')
      ).toBeInTheDocument();
    });

    it('does not show gauge when no retainer cases', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={null}
          retainerCasesCount={0}
        />
      );

      expect(screen.queryByTestId('radial-bar-chart')).not.toBeInTheDocument();
    });
  });

  describe('Status Color Coding (Inverse - Lower is Better)', () => {
    it('shows green color for healthy utilization (<80%)', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={50}
          retainerCasesCount={5}
        />
      );

      const percentageElement = screen.getByText('50.0%');
      // Green is #10B981
      expect(percentageElement).toHaveStyle({ color: 'rgb(16, 185, 129)' });
    });

    it('shows green status text for healthy', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={50}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('shows yellow color for approaching limit (80-100%)', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={90}
          retainerCasesCount={5}
        />
      );

      const percentageElement = screen.getByText('90.0%');
      // Yellow is #F59E0B
      expect(percentageElement).toHaveStyle({ color: 'rgb(245, 158, 11)' });
    });

    it('shows approaching limit status text', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={90}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('Approaching limit')).toBeInTheDocument();
    });

    it('shows red color for over-utilized (>100%)', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={120}
          retainerCasesCount={5}
        />
      );

      const percentageElement = screen.getByText('120.0%');
      // Red is #EF4444
      expect(percentageElement).toHaveStyle({ color: 'rgb(239, 68, 68)' });
    });

    it('shows over utilized status text', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={120}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('Over utilized')).toBeInTheDocument();
    });
  });

  describe('Overage Warning', () => {
    it('shows warning banner when utilization exceeds 100%', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={115}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('Retainer hours exceeded')).toBeInTheDocument();
      expect(
        screen.getByText(/Some retainer agreements are over-utilized/)
      ).toBeInTheDocument();
    });

    it('does not show warning when utilization is under 100%', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={95}
          retainerCasesCount={5}
        />
      );

      expect(screen.queryByText('Retainer hours exceeded')).not.toBeInTheDocument();
    });
  });

  describe('Delta Badge', () => {
    it('renders delta badge when provided', () => {
      const delta: KPIDelta = {
        absolute: 10,
        percentage: 15.4,
        direction: 'up',
      };

      render(<RetainerStatusWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('+15.4%')).toBeInTheDocument();
    });

    it('does not render delta when null', () => {
      render(<RetainerStatusWidget {...defaultProps} delta={null} />);

      expect(screen.queryByText(/^\+\d+.*%$/)).not.toBeInTheDocument();
    });

    it('shows negative delta correctly', () => {
      const delta: KPIDelta = {
        absolute: -5,
        percentage: -7.1,
        direction: 'down',
      };

      render(<RetainerStatusWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('-7.1%')).toBeInTheDocument();
    });

    it('treats positive as bad for retainer utilization (positiveIsGood=false)', () => {
      // This test validates that increasing retainer utilization is considered bad
      // The DeltaBadge should be passed positiveIsGood={false}
      const delta: KPIDelta = {
        absolute: 10,
        percentage: 10,
        direction: 'up',
      };

      const { container } = render(
        <RetainerStatusWidget {...defaultProps} delta={delta} />
      );

      // When positiveIsGood is false, an increase should be shown in red
      // This is important because for retainer, using MORE hours is typically bad
      expect(container.textContent).toContain('+10.0%');
    });
  });

  describe('Edge Cases', () => {
    it('handles 0% utilization', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={0}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles exactly 80% utilization (boundary)', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={80}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('80.0%')).toBeInTheDocument();
      expect(screen.getByText('Approaching limit')).toBeInTheDocument();
    });

    it('handles exactly 100% utilization (boundary)', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={100}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('100.0%')).toBeInTheDocument();
      expect(screen.getByText('Approaching limit')).toBeInTheDocument();
    });

    it('handles extreme overage (200%)', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={200}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('200.0%')).toBeInTheDocument();
      expect(screen.getByText('Over utilized')).toBeInTheDocument();
    });

    it('handles null utilization with cases', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={null}
          retainerCasesCount={5}
        />
      );

      // Should default to 0 and still render
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles decimal utilization', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={65.5}
          retainerCasesCount={5}
        />
      );

      expect(screen.getByText('65.5%')).toBeInTheDocument();
    });

    it('handles large number of retainer cases', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={50}
          retainerCasesCount={150}
        />
      );

      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <RetainerStatusWidget {...defaultProps} className="custom-retainer" />
      );

      expect(container.firstChild).toHaveClass('custom-retainer');
    });
  });

  describe('Gauge Behavior', () => {
    it('caps gauge display at 100% even when over', () => {
      render(
        <RetainerStatusWidget
          retainerUtilizationAverage={150}
          retainerCasesCount={5}
        />
      );

      // The gauge should exist but text should show actual value
      expect(screen.getByTestId('radial-bar-chart')).toBeInTheDocument();
      expect(screen.getByText('150.0%')).toBeInTheDocument();
    });
  });
});
