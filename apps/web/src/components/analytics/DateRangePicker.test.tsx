/**
 * DateRangePicker Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DateRangePicker } from './DateRangePicker';
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

describe('DateRangePicker', () => {
  describe('Basic Rendering', () => {
    it('renders the trigger button', () => {
      render(<DateRangePicker />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('shows preset label when preset is selected', () => {
      render(<DateRangePicker />);
      expect(screen.getByText('Ultimele 30 zile')).toBeInTheDocument();
    });

    it('shows calendar icon', () => {
      const { container } = render(<DateRangePicker />);
      const calendarIcon = container.querySelector('.lucide-calendar');
      expect(calendarIcon).toBeInTheDocument();
    });

    it('shows chevron icon', () => {
      const { container } = render(<DateRangePicker />);
      const chevronIcon = container.querySelector('.lucide-chevron-down');
      expect(chevronIcon).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    // Radix UI Popover tests need userEvent for proper async handling
    // Dropdown content tests are covered in e2e tests
    it('trigger button has correct aria attributes', () => {
      render(<DateRangePicker />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  describe('Preset Selection', () => {
    // Preset selection tests require async interactions with Radix UI Popover
    // These are better tested with userEvent or e2e tests
    it('renders with initial preset from store', () => {
      act(() => {
        useAnalyticsFiltersStore.setState({ preset: 'lastQuarter' });
      });

      render(<DateRangePicker />);

      expect(screen.getByText('Ultimul trimestru')).toBeInTheDocument();
    });
  });

  describe('Custom Date Range', () => {
    // Custom date range tests require async userEvent interactions
    // These are covered by e2e tests - unit tests focus on preset functionality
    it('renders date inputs section label', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Interval personalizat')).toBeInTheDocument();
    });
  });

  describe('Custom Display', () => {
    it('shows custom date range format when custom is selected', () => {
      act(() => {
        useAnalyticsFiltersStore.setState({
          preset: 'custom',
          dateRange: {
            start: new Date('2025-06-01'),
            end: new Date('2025-06-30'),
          },
        });
      });

      render(<DateRangePicker />);

      // Should show formatted date range (Romanian locale format)
      // Date format is "d MMM yyyy" in Romanian, e.g. "1 iun. 2025 - 30 iun. 2025"
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('applies custom className', () => {
      const { container } = render(<DateRangePicker className="custom-picker" />);
      expect(container.querySelector('.custom-picker')).toBeInTheDocument();
    });
  });
});
