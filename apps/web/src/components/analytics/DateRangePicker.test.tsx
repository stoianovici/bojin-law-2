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
      expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
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
    it('opens dropdown when trigger is clicked', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Quick Select')).toBeInTheDocument();
      expect(screen.getByText('Custom Range')).toBeInTheDocument();
    });

    it('shows preset buttons in dropdown', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      // "Last 30 Days" appears in both trigger and dropdown
      expect(screen.getAllByText('Last 30 Days').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Last Quarter')).toBeInTheDocument();
      expect(screen.getByText('Year to Date')).toBeInTheDocument();
    });

    it('shows date inputs for custom range', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('shows Apply and Cancel buttons', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Apply')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Preset Selection', () => {
    it('updates store when Last 30 Days is selected', () => {
      // Start with different preset
      act(() => {
        useAnalyticsFiltersStore.setState({ preset: 'ytd' });
      });

      render(<DateRangePicker />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click Last 30 Days
      fireEvent.click(screen.getByText('Last 30 Days'));

      // Check store is updated
      const { preset } = useAnalyticsFiltersStore.getState();
      expect(preset).toBe('last30');
    });

    it('updates store when Last Quarter is selected', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Last Quarter'));

      const { preset } = useAnalyticsFiltersStore.getState();
      expect(preset).toBe('lastQuarter');
    });

    it('updates store when Year to Date is selected', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Year to Date'));

      const { preset } = useAnalyticsFiltersStore.getState();
      expect(preset).toBe('ytd');
    });

    it('closes dropdown after preset selection', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Quick Select')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Year to Date'));

      // Dropdown content should be closed
      expect(screen.queryByText('Quick Select')).not.toBeInTheDocument();
    });
  });

  describe('Custom Date Range', () => {
    it('updates custom start date input', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      const startInput = screen.getByLabelText('Start Date');
      fireEvent.change(startInput, { target: { value: '2025-02-01' } });

      expect(startInput).toHaveValue('2025-02-01');
    });

    it('updates custom end date input', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      const endInput = screen.getByLabelText('End Date');
      fireEvent.change(endInput, { target: { value: '2025-02-28' } });

      expect(endInput).toHaveValue('2025-02-28');
    });

    it('applies custom date range when Apply is clicked', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      const startInput = screen.getByLabelText('Start Date');
      const endInput = screen.getByLabelText('End Date');

      fireEvent.change(startInput, { target: { value: '2025-03-01' } });
      fireEvent.change(endInput, { target: { value: '2025-03-31' } });

      fireEvent.click(screen.getByText('Apply'));

      const { preset, dateRange } = useAnalyticsFiltersStore.getState();
      expect(preset).toBe('custom');
      expect(dateRange.start.getMonth()).toBe(2); // March is 2 (0-indexed)
      expect(dateRange.end.getMonth()).toBe(2);
    });

    it('does not apply when start > end', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      const startInput = screen.getByLabelText('Start Date');
      const endInput = screen.getByLabelText('End Date');

      fireEvent.change(startInput, { target: { value: '2025-03-31' } });
      fireEvent.change(endInput, { target: { value: '2025-03-01' } });

      const originalPreset = useAnalyticsFiltersStore.getState().preset;

      fireEvent.click(screen.getByText('Apply'));

      // Preset should not change to custom
      const { preset } = useAnalyticsFiltersStore.getState();
      expect(preset).toBe(originalPreset);
    });

    it('closes dropdown after Cancel is clicked', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Quick Select')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      // Dropdown should be closed
      expect(screen.queryByText('Quick Select')).not.toBeInTheDocument();
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

      // Should show formatted date range, not "Custom"
      expect(screen.getByText(/Jun 1, 2025/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('applies custom className', () => {
      const { container } = render(<DateRangePicker className="custom-picker" />);
      expect(container.querySelector('.custom-picker')).toBeInTheDocument();
    });

    it('handles same start and end date', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      const startInput = screen.getByLabelText('Start Date');
      const endInput = screen.getByLabelText('End Date');

      fireEvent.change(startInput, { target: { value: '2025-05-15' } });
      fireEvent.change(endInput, { target: { value: '2025-05-15' } });

      fireEvent.click(screen.getByText('Apply'));

      const { dateRange } = useAnalyticsFiltersStore.getState();
      expect(dateRange.start.getDate()).toBe(15);
      expect(dateRange.end.getDate()).toBe(15);
    });

    it('highlights active preset button', () => {
      render(<DateRangePicker />);

      fireEvent.click(screen.getByRole('button'));

      // Get all buttons with "Last 30 Days" text (one is trigger, one is preset)
      const presetButtons = screen.getAllByText('Last 30 Days');
      const presetButton = presetButtons.find((btn) =>
        btn.classList.contains('bg-blue-600')
      );

      expect(presetButton).toBeDefined();
    });
  });
});
