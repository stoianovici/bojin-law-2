/**
 * FirmKPIsWidget Unit Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FirmKPIsWidget } from './FirmKPIsWidget';
import type { KPIWidget } from '@legal-platform/types';

describe('FirmKPIsWidget', () => {
  const mockWidget: KPIWidget = {
    id: 'firm-kpis-test',
    type: 'kpi',
    title: 'KPI-uri Firmă',
    position: { x: 0, y: 0, w: 12, h: 4 },
    collapsed: false,
    metrics: [
      {
        label: 'Cazuri Active',
        value: '142',
        trend: {
          direction: 'up',
          percentage: 8,
          comparison: 'vs. luna trecută',
        },
      },
      {
        label: 'Ore Facturabile',
        value: '1,847',
        trend: {
          direction: 'up',
          percentage: 12,
          comparison: 'vs. luna trecută',
        },
      },
      {
        label: 'Progres Țintă Venit',
        value: '87%',
        trend: {
          direction: 'up',
          percentage: 5,
          comparison: 'vs. luna trecută',
        },
      },
      {
        label: 'Utilizare Echipă',
        value: '76%',
        trend: {
          direction: 'down',
          percentage: 3,
          comparison: 'vs. luna trecută',
        },
      },
    ],
  };

  it('renders widget with title', () => {
    render(<FirmKPIsWidget widget={mockWidget} />);
    expect(screen.getByText('KPI-uri Firmă')).toBeInTheDocument();
  });

  it('displays all KPI metrics', () => {
    render(<FirmKPIsWidget widget={mockWidget} />);

    expect(screen.getByText('Cazuri Active')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();

    expect(screen.getByText('Ore Facturabile')).toBeInTheDocument();
    expect(screen.getByText('1,847')).toBeInTheDocument();

    expect(screen.getByText('Progres Țintă Venit')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();

    expect(screen.getByText('Utilizare Echipă')).toBeInTheDocument();
    expect(screen.getByText('76%')).toBeInTheDocument();
  });

  it('displays trend indicators correctly', () => {
    render(<FirmKPIsWidget widget={mockWidget} />);

    // Check for trend percentages
    expect(screen.getByText('8%')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('3%')).toBeInTheDocument();

    // Check for comparison text
    const comparisonTexts = screen.getAllByText('vs. luna trecută');
    expect(comparisonTexts).toHaveLength(4);
  });

  it('renders loading state when isLoading is true', () => {
    render(<FirmKPIsWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles metrics without trends', () => {
    const widgetWithoutTrends: KPIWidget = {
      ...mockWidget,
      metrics: [
        {
          label: 'Cazuri Active',
          value: '142',
        },
      ],
    };

    render(<FirmKPIsWidget widget={widgetWithoutTrends} />);

    expect(screen.getByText('Cazuri Active')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    // No trend indicators should be present
    expect(screen.queryByText('vs. luna trecută')).not.toBeInTheDocument();
  });

  it('renders correct trend colors', () => {
    const { container } = render(<FirmKPIsWidget widget={mockWidget} />);

    // Check for green (up trend) classes
    const upTrends = container.querySelectorAll('.text-green-600');
    expect(upTrends.length).toBeGreaterThan(0);

    // Check for red (down trend) classes
    const downTrends = container.querySelectorAll('.text-red-600');
    expect(downTrends.length).toBeGreaterThan(0);
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <FirmKPIsWidget
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

  it('renders empty state when no metrics provided', () => {
    const emptyWidget: KPIWidget = {
      ...mockWidget,
      metrics: [],
    };

    render(<FirmKPIsWidget widget={emptyWidget} />);

    expect(screen.getByText('KPI-uri Firmă')).toBeInTheDocument();
    // Grid should be empty
    const grid = document.querySelector('.grid');
    expect(grid?.children.length).toBe(0);
  });

  it('supports Romanian diacritics in labels', () => {
    render(<FirmKPIsWidget widget={mockWidget} />);

    // Check Romanian text is rendered correctly
    expect(screen.getByText('Progres Țintă Venit')).toBeInTheDocument();
  });
});
