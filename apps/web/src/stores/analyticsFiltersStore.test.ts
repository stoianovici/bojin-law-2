/**
 * Analytics Filters Store Tests
 * Story 2.11.4: Financial Dashboard UI
 */

import { act, renderHook } from '@testing-library/react';
import { useAnalyticsFiltersStore } from './analyticsFiltersStore';

describe('analyticsFiltersStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useAnalyticsFiltersStore.setState({
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        preset: 'last30',
        comparisonEnabled: false,
      });
    });
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    expect(result.current.preset).toBe('last30');
    expect(result.current.comparisonEnabled).toBe(false);
    expect(result.current.dateRange.start).toBeInstanceOf(Date);
    expect(result.current.dateRange.end).toBeInstanceOf(Date);
  });

  it('sets preset date ranges correctly', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    act(() => {
      result.current.setPreset('ytd');
    });

    expect(result.current.preset).toBe('ytd');
    expect(result.current.dateRange.start.getMonth()).toBe(0); // January
    expect(result.current.dateRange.start.getDate()).toBe(1);
  });

  it('sets lastQuarter preset correctly', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    act(() => {
      result.current.setPreset('lastQuarter');
    });

    expect(result.current.preset).toBe('lastQuarter');

    // Should be 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Allow for small differences due to execution time
    const diffInDays = Math.abs(
      (result.current.dateRange.start.getTime() - threeMonthsAgo.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    expect(diffInDays).toBeLessThan(2);
  });

  it('sets custom date range', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    const customStart = new Date('2025-06-01');
    const customEnd = new Date('2025-06-30');

    act(() => {
      result.current.setDateRange({ start: customStart, end: customEnd });
    });

    expect(result.current.preset).toBe('custom');
    expect(result.current.dateRange.start).toEqual(customStart);
    expect(result.current.dateRange.end).toEqual(customEnd);
  });

  it('toggles comparison', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    expect(result.current.comparisonEnabled).toBe(false);

    act(() => {
      result.current.toggleComparison();
    });

    expect(result.current.comparisonEnabled).toBe(true);

    act(() => {
      result.current.toggleComparison();
    });

    expect(result.current.comparisonEnabled).toBe(false);
  });

  it('sets comparison enabled directly', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    act(() => {
      result.current.setComparisonEnabled(true);
    });

    expect(result.current.comparisonEnabled).toBe(true);

    act(() => {
      result.current.setComparisonEnabled(false);
    });

    expect(result.current.comparisonEnabled).toBe(false);
  });

  it('calculates previous period correctly', () => {
    const { result } = renderHook(() => useAnalyticsFiltersStore());

    // Use the default last30 preset which is already set
    const previousPeriod = result.current.getPreviousPeriod();

    // Previous period should be a valid date range
    expect(previousPeriod.start).toBeInstanceOf(Date);
    expect(previousPeriod.end).toBeInstanceOf(Date);

    // Start should be before end
    expect(previousPeriod.start.getTime()).toBeLessThan(previousPeriod.end.getTime());

    // Previous end should be before current start
    expect(previousPeriod.end.getTime()).toBeLessThan(
      result.current.dateRange.start.getTime()
    );
  });
});
