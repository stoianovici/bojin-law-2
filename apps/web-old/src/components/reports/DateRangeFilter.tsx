'use client';

import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import * as Popover from '@radix-ui/react-popover';
import type { DateRangePreset } from '@legal-platform/types';
import { useReportsStore } from '../../stores/reports.store';
import { ExportButton } from './ExportButton';

const DATE_RANGE_OPTIONS: Array<{
  value: DateRangePreset | 'custom';
  label: string;
}> = [
  { value: 'thisWeek', label: 'Săptămâna Aceasta' },
  { value: 'thisMonth', label: 'Luna Aceasta' },
  { value: 'thisQuarter', label: 'Trimestrul Acesta' },
  { value: 'thisYear', label: 'Anul Acesta' },
  { value: 'custom', label: 'Personalizat' },
];

export function DateRangeFilter() {
  const { dateRange, setDateRangePreset, setDateRange, comparisonEnabled, setComparisonEnabled } =
    useReportsStore();

  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomPopoverOpen, setIsCustomPopoverOpen] = useState(false);

  const currentPreset = dateRange.preset || 'thisMonth';

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomPopoverOpen(true);
    } else {
      setDateRangePreset(value as DateRangePreset);
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        start: new Date(customStartDate),
        end: new Date(customEndDate),
        preset: null,
      });
      setIsCustomPopoverOpen(false);
    }
  };

  const formatDate = (date: Date) => {
    // Ensure date is a Date object (handle deserialized strings)
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDisplayLabel = () => {
    if (dateRange.preset) {
      return (
        DATE_RANGE_OPTIONS.find((opt) => opt.value === dateRange.preset)?.label || 'Luna Aceasta'
      );
    }
    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left Side - Date Range Selector & Comparison */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>

          <Popover.Root open={isCustomPopoverOpen} onOpenChange={setIsCustomPopoverOpen}>
            <Select.Root value={currentPreset} onValueChange={handlePresetChange}>
              <Select.Trigger className="inline-flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <Select.Value>{getDisplayLabel()}</Select.Value>
                <Select.Icon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                  <Select.Viewport className="p-1">
                    {DATE_RANGE_OPTIONS.map((option) => (
                      <Select.Item
                        key={option.value}
                        value={option.value}
                        className="relative flex cursor-pointer items-center rounded px-8 py-2 text-sm text-gray-900 outline-none hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50"
                      >
                        <Select.ItemText>{option.label}</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                          <svg
                            className="h-4 w-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Custom Date Range Popover */}
            <Popover.Portal>
              <Popover.Content
                className="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
                sideOffset={5}
              >
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Perioadă Personalizată</h3>

                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="start-date"
                        className="block text-xs font-medium text-gray-700"
                      >
                        Data de început
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="end-date" className="block text-xs font-medium text-gray-700">
                        Data de sfârșit
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Popover.Close asChild>
                      <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Anulează
                      </button>
                    </Popover.Close>
                    <button
                      onClick={handleCustomDateApply}
                      disabled={!customStartDate || !customEndDate}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Aplică
                    </button>
                  </div>
                </div>
                <Popover.Arrow className="fill-white" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Comparison Toggle */}
        <div className="flex items-center gap-2">
          <Switch.Root
            id="comparison-toggle"
            checked={comparisonEnabled}
            onCheckedChange={setComparisonEnabled}
            className="relative h-6 w-11 cursor-pointer rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 data-[state=checked]:bg-blue-600"
          >
            <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform duration-100 will-change-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
          <label
            htmlFor="comparison-toggle"
            className="cursor-pointer text-sm font-medium text-gray-700"
          >
            Compară cu perioada anterioară
          </label>
        </div>
      </div>

      {/* Right Side - Export Button */}
      <ExportButton />
    </div>
  );
}
