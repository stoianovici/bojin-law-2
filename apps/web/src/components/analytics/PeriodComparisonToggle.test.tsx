/**
 * PeriodComparisonToggle Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PeriodComparisonToggle } from './PeriodComparisonToggle';
import { useAnalyticsFiltersStore } from '../../stores/analyticsFiltersStore';

// Reset Zustand store before each test
beforeEach(() => {
  act(() => {
    useAnalyticsFiltersStore.setState({
      dateRange: {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      },
      preset: 'last30',
      comparisonEnabled: false,
    });
  });
});

describe('PeriodComparisonToggle', () => {
  describe('Basic Rendering', () => {
    it('renders the switch element', () => {
      render(<PeriodComparisonToggle />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('renders the label text', () => {
      render(<PeriodComparisonToggle />);
      expect(screen.getByText('Compară cu perioada anterioară')).toBeInTheDocument();
    });

    it('renders the comparison icon', () => {
      const { container } = render(<PeriodComparisonToggle />);
      const icon = container.querySelector('.lucide-git-compare-arrows');
      expect(icon).toBeInTheDocument();
    });

    it('label is associated with switch', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');
      const label = screen.getByText('Compară cu perioada anterioară');

      expect(switchElement).toHaveAttribute('id', 'period-comparison');
      expect(label.closest('label')).toHaveAttribute('for', 'period-comparison');
    });
  });

  describe('Initial State', () => {
    it('switch is unchecked when comparisonEnabled is false', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');
    });

    it('switch is checked when comparisonEnabled is true', () => {
      act(() => {
        useAnalyticsFiltersStore.setState({ comparisonEnabled: true });
      });

      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Toggle Behavior', () => {
    it('toggles store state when switch is clicked', () => {
      render(<PeriodComparisonToggle />);

      const switchElement = screen.getByRole('switch');
      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(false);

      fireEvent.click(switchElement);

      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(true);
    });

    it('toggles back to false when clicked again', () => {
      act(() => {
        useAnalyticsFiltersStore.setState({ comparisonEnabled: true });
      });

      render(<PeriodComparisonToggle />);

      const switchElement = screen.getByRole('switch');
      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(true);

      fireEvent.click(switchElement);

      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(false);
    });

    it('updates switch visual state after toggle', () => {
      render(<PeriodComparisonToggle />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');

      fireEvent.click(switchElement);

      expect(switchElement).toHaveAttribute('data-state', 'checked');
    });

    it('toggles via label click', () => {
      render(<PeriodComparisonToggle />);

      const label = screen.getByText('Compară cu perioada anterioară');
      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(false);

      fireEvent.click(label);

      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(true);
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      const { container } = render(<PeriodComparisonToggle className="custom-toggle" />);

      expect(container.firstChild).toHaveClass('custom-toggle');
    });

    it('has flex layout', () => {
      const { container } = render(<PeriodComparisonToggle />);
      expect(container.firstChild).toHaveClass('flex');
      expect(container.firstChild).toHaveClass('items-center');
    });

    it('switch has proper base styling', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveClass('w-10', 'h-6', 'rounded-full');
    });
  });

  describe('Accessibility', () => {
    it('switch is keyboard accessible', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');

      // Focus the switch
      switchElement.focus();
      expect(document.activeElement).toBe(switchElement);
    });

    it('switch has correct ARIA attributes', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('type', 'button');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('aria-checked updates when toggled', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Store Integration', () => {
    it('reflects external store changes', () => {
      const { rerender } = render(<PeriodComparisonToggle />);

      let switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');

      // Simulate external store update
      act(() => {
        useAnalyticsFiltersStore.getState().setComparisonEnabled(true);
      });

      rerender(<PeriodComparisonToggle />);

      switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'checked');
    });

    it('multiple rapid toggles work correctly', () => {
      render(<PeriodComparisonToggle />);
      const switchElement = screen.getByRole('switch');

      // Toggle multiple times rapidly
      fireEvent.click(switchElement);
      fireEvent.click(switchElement);
      fireEvent.click(switchElement);

      // Should end up as true (odd number of toggles)
      expect(useAnalyticsFiltersStore.getState().comparisonEnabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('renders correctly without className prop', () => {
      render(<PeriodComparisonToggle />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('handles className with spaces', () => {
      const { container } = render(
        <PeriodComparisonToggle className="  spaced-class  another-class  " />
      );

      expect(container.firstChild).toHaveClass('spaced-class');
      expect(container.firstChild).toHaveClass('another-class');
    });
  });
});
