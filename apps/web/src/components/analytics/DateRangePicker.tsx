/**
 * DateRangePicker Component
 * Story 2.11.4: Financial Dashboard UI
 *
 * Date range picker with preset buttons and custom date inputs.
 * Uses Radix UI Popover for dropdown.
 */

'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { useAnalyticsFiltersStore, type DateRangePreset } from '../../stores/analyticsFiltersStore';

export interface DateRangePickerProps {
  /**
   * Optional additional class names
   */
  className?: string;
  /**
   * Controlled mode: start date
   */
  startDate?: Date;
  /**
   * Controlled mode: end date
   */
  endDate?: Date;
  /**
   * Controlled mode: change handler
   */
  onChange?: (start: Date, end: Date) => void;
}

/**
 * Preset button labels
 */
const presetLabels: Record<DateRangePreset, string> = {
  last30: 'Ultimele 30 zile',
  lastQuarter: 'Ultimul trimestru',
  ytd: 'De la începutul anului',
  custom: 'Personalizat',
};

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('ro-RO', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date for input
 */
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * DateRangePicker - Date range selection with presets
 *
 * @example
 * ```tsx
 * <DateRangePicker />
 * ```
 */
export function DateRangePicker({
  className = '',
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const store = useAnalyticsFiltersStore();

  // Use controlled mode if props are provided, otherwise use store
  const isControlled = startDate !== undefined && endDate !== undefined && onChange !== undefined;
  const dateRange = isControlled ? { start: startDate, end: endDate } : store.dateRange;
  const preset = isControlled ? ('custom' as DateRangePreset) : store.preset;
  const setDateRange = isControlled
    ? (range: { start: Date; end: Date }) => onChange(range.start, range.end)
    : store.setDateRange;
  const setPreset = store.setPreset;

  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateForInput(dateRange.start));
  const [customEnd, setCustomEnd] = useState(formatDateForInput(dateRange.end));

  // Handle preset selection
  const handlePresetClick = (selectedPreset: DateRangePreset) => {
    if (selectedPreset !== 'custom') {
      if (isControlled) {
        // Calculate preset dates for controlled mode
        const now = new Date();
        let start: Date;
        let end: Date = new Date();
        end.setHours(23, 59, 59, 999);

        if (selectedPreset === 'last30') {
          start = new Date();
          start.setDate(start.getDate() - 30);
        } else if (selectedPreset === 'lastQuarter') {
          start = new Date();
          start.setMonth(start.getMonth() - 3);
        } else {
          // ytd
          start = new Date(now.getFullYear(), 0, 1);
        }
        start.setHours(0, 0, 0, 0);
        onChange!(start, end);
      } else {
        setPreset(selectedPreset);
      }
      setIsOpen(false);
    }
  };

  // Handle custom date apply
  const handleApplyCustom = () => {
    const start = new Date(customStart);
    const end = new Date(customEnd);

    if (start <= end) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (isControlled) {
        onChange!(start, end);
      } else {
        setDateRange({ start, end });
      }
      setIsOpen(false);
    }
  };

  // Display text
  const displayText =
    preset === 'custom'
      ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
      : presetLabels[preset];

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${className}`}
        >
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>{displayText}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
          sideOffset={8}
          align="start"
        >
          {/* Preset buttons */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Selectare rapidă
            </p>
            <div className="flex flex-wrap gap-2">
              {(['last30', 'lastQuarter', 'ytd'] as DateRangePreset[]).map((presetOption) => (
                <button
                  key={presetOption}
                  onClick={() => handlePresetClick(presetOption)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    preset === presetOption
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {presetLabels[presetOption]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Interval personalizat
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-date" className="block text-xs text-gray-500 mb-1">
                  Data de început
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-xs text-gray-500 mb-1">
                  Data de sfârșit
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleApplyCustom}
                className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Aplică
              </button>
            </div>
          </div>

          <Popover.Arrow className="fill-white" />

          {/* Close button */}
          <Popover.Close
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default DateRangePicker;
