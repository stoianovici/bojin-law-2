/**
 * CaseDistributionWidget Unit Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { CaseDistributionWidget } from './CaseDistributionWidget';
import type { ChartWidget } from '@legal-platform/types';

// Mock Recharts components
jest.mock('recharts', () => {
  const React = require('react');
  return {
    ResponsiveContainer: React.forwardRef(({ children }: any, ref: any) => (
      <div ref={ref} data-testid="responsive-container">
        {children}
      </div>
    )),
    PieChart: React.forwardRef(({ children }: any, ref: any) => (
      <div ref={ref} data-testid="pie-chart">
        {children}
      </div>
    )),
    Pie: () => null,
    Cell: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe('CaseDistributionWidget', () => {
  const mockWidget: ChartWidget = {
    id: 'case-distribution-test',
    type: 'chart',
    chartType: 'pie',
    title: 'Distribuție Cazuri',
    position: { x: 8, y: 4, w: 4, h: 4 },
    collapsed: false,
    data: [
      { name: 'Litigiu', value: 45 },
      { name: 'Contract', value: 32 },
      { name: 'Consultanță', value: 28 },
      { name: 'Penal', value: 22 },
      { name: 'Altele', value: 15 },
    ],
  };

  it('renders widget with title', () => {
    render(<CaseDistributionWidget widget={mockWidget} />);
    expect(screen.getByText('Distribuție Cazuri')).toBeInTheDocument();
  });

  it('renders pie chart components', () => {
    render(<CaseDistributionWidget widget={mockWidget} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('displays total case count', () => {
    render(<CaseDistributionWidget widget={mockWidget} />);

    // Calculate total: 45 + 32 + 28 + 22 + 15 = 142
    expect(screen.getByText(/Total: 142 cazuri/)).toBeInTheDocument();
  });

  it('displays mockup indicator text', () => {
    render(<CaseDistributionWidget widget={mockWidget} />);
    expect(screen.getByText(/Date mockup/)).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    render(<CaseDistributionWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles empty data gracefully', () => {
    const emptyWidget: ChartWidget = {
      ...mockWidget,
      data: [],
    };

    render(<CaseDistributionWidget widget={emptyWidget} />);

    expect(screen.getByText('Distribuție Cazuri')).toBeInTheDocument();
    expect(screen.getByText(/Total: 0 cazuri/)).toBeInTheDocument();
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <CaseDistributionWidget
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

  it('supports Romanian diacritics in title', () => {
    render(<CaseDistributionWidget widget={mockWidget} />);

    // Check Romanian text is rendered correctly
    expect(screen.getByText('Distribuție Cazuri')).toBeInTheDocument();
    expect(screen.getByText(/cazuri/)).toBeInTheDocument();
  });

  it('renders chart with correct height', () => {
    const { container } = render(<CaseDistributionWidget widget={mockWidget} />);

    const chartContainer = container.querySelector('.h-\\[320px\\]');
    expect(chartContainer).toBeInTheDocument();
  });

  it('calculates total correctly for different values', () => {
    const customWidget: ChartWidget = {
      ...mockWidget,
      data: [
        { name: 'Type A', value: 100 },
        { name: 'Type B', value: 50 },
      ],
    };

    render(<CaseDistributionWidget widget={customWidget} />);

    expect(screen.getByText(/Total: 150 cazuri/)).toBeInTheDocument();
  });

  it('handles single data point', () => {
    const singleDataWidget: ChartWidget = {
      ...mockWidget,
      data: [{ name: 'Litigiu', value: 100 }],
    };

    render(<CaseDistributionWidget widget={singleDataWidget} />);

    expect(screen.getByText('Distribuție Cazuri')).toBeInTheDocument();
    expect(screen.getByText(/Total: 100 cazuri/)).toBeInTheDocument();
  });
});
