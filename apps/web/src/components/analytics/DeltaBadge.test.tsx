/**
 * DeltaBadge Component Tests
 * Story 2.11.4: Financial Dashboard UI
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeltaBadge } from './DeltaBadge';
import type { KPIDelta } from '../../hooks/useFinancialKPIsComparison';

describe('DeltaBadge', () => {
  it('renders positive change correctly', () => {
    const delta: KPIDelta = {
      absolute: 1000,
      percentage: 12.5,
      direction: 'up',
    };

    render(<DeltaBadge delta={delta} />);

    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('renders negative change correctly', () => {
    const delta: KPIDelta = {
      absolute: -500,
      percentage: -8.3,
      direction: 'down',
    };

    render(<DeltaBadge delta={delta} />);

    expect(screen.getByText('-8.3%')).toBeInTheDocument();
  });

  it('renders neutral change correctly', () => {
    const delta: KPIDelta = {
      absolute: 0,
      percentage: 0,
      direction: 'neutral',
    };

    render(<DeltaBadge delta={delta} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows green for positive when positiveIsGood is true', () => {
    const delta: KPIDelta = {
      absolute: 100,
      percentage: 10,
      direction: 'up',
    };

    const { container } = render(
      <DeltaBadge delta={delta} positiveIsGood={true} />
    );

    expect(container.firstChild).toHaveClass('bg-green-100');
    expect(container.firstChild).toHaveClass('text-green-700');
  });

  it('shows red for positive when positiveIsGood is false', () => {
    const delta: KPIDelta = {
      absolute: 100,
      percentage: 10,
      direction: 'up',
    };

    const { container } = render(
      <DeltaBadge delta={delta} positiveIsGood={false} />
    );

    expect(container.firstChild).toHaveClass('bg-red-100');
    expect(container.firstChild).toHaveClass('text-red-700');
  });

  it('renders medium size variant', () => {
    const delta: KPIDelta = {
      absolute: 100,
      percentage: 10,
      direction: 'up',
    };

    const { container } = render(<DeltaBadge delta={delta} size="md" />);

    expect(container.firstChild).toHaveClass('text-sm');
  });

  it('shows absolute value in title attribute', () => {
    const delta: KPIDelta = {
      absolute: 1000,
      percentage: 12.5,
      direction: 'up',
    };

    const { container } = render(<DeltaBadge delta={delta} />);

    expect(container.firstChild).toHaveAttribute(
      'title',
      'Change: +1,000'
    );
  });
});
