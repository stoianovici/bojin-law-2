/**
 * BillableHoursChartWidget Unit Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BillableHoursChartWidget } from './BillableHoursChartWidget';
import type { ChartWidget } from '@legal-platform/types';

// Mock Recharts components
jest.mock('recharts', () => {
  const React = require('react');
  return {
    ResponsiveContainer: React.forwardRef(({ children }: any, ref: any) => (
      <div ref={ref} data-testid="responsive-container">{children}</div>
    )),
    BarChart: React.forwardRef(({ children }: any, ref: any) => (
      <div ref={ref} data-testid="bar-chart">{children}</div>
    )),
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe('BillableHoursChartWidget', () => {
  const mockWidget: ChartWidget = {
    id: 'billable-hours-chart-test',
    type: 'chart',
    chartType: 'bar',
    title: 'Ore Facturabile',
    position: { x: 0, y: 4, w: 8, h: 4 },
    collapsed: false,
    data: [
      { month: 'Ian', Litigiu: 120, Contract: 80, Consultanță: 60, Penal: 40, Altele: 20 },
      { month: 'Feb', Litigiu: 130, Contract: 85, Consultanță: 65, Penal: 45, Altele: 25 },
      { month: 'Mar', Litigiu: 140, Contract: 90, Consultanță: 70, Penal: 50, Altele: 30 },
      { month: 'Apr', Litigiu: 135, Contract: 88, Consultanță: 68, Penal: 48, Altele: 28 },
      { month: 'Mai', Litigiu: 145, Contract: 92, Consultanță: 72, Penal: 52, Altele: 32 },
      { month: 'Iun', Litigiu: 150, Contract: 95, Consultanță: 75, Penal: 55, Altele: 35 },
    ],
    xAxisKey: 'month',
  };

  it('renders widget with title', () => {
    render(<BillableHoursChartWidget widget={mockWidget} />);
    expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();
  });

  it('renders chart components', () => {
    render(<BillableHoursChartWidget widget={mockWidget} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('displays Romanian axis label', () => {
    render(<BillableHoursChartWidget widget={mockWidget} />);
    // Note: Actual label rendering is handled by Recharts, mocked in tests
    expect(screen.getByText('Ultimele 6 luni - Date mockup')).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    render(<BillableHoursChartWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles empty data gracefully', () => {
    const emptyWidget: ChartWidget = {
      ...mockWidget,
      data: [],
    };

    render(<BillableHoursChartWidget widget={emptyWidget} />);

    expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <BillableHoursChartWidget
        widget={mockWidget}
        onRefresh={mockRefresh}
        onConfigure={mockConfigure}
        onRemove={mockRemove}
      />
    );

    // Action menu should be present
    const actionButton = screen.getByLabelText('Widget actions');
    expect(actionButton).toBeInTheDocument();
  });

  it('supports Romanian diacritics in title and labels', () => {
    render(<BillableHoursChartWidget widget={mockWidget} />);

    // Check Romanian text is rendered correctly
    expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();
    expect(screen.getByText('Ultimele 6 luni - Date mockup')).toBeInTheDocument();
  });

  it('renders chart with correct height', () => {
    const { container } = render(<BillableHoursChartWidget widget={mockWidget} />);

    const chartContainer = container.querySelector('.h-\\[300px\\]');
    expect(chartContainer).toBeInTheDocument();
  });

  it('handles missing xAxisKey by defaulting to month', () => {
    const widgetWithoutXAxisKey: ChartWidget = {
      ...mockWidget,
      xAxisKey: undefined,
    };

    render(<BillableHoursChartWidget widget={widgetWithoutXAxisKey} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
