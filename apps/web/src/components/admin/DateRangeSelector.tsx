/**
 * Date Range Selector for AI Ops Dashboard
 * OPS-244: Cost Breakdown & Charts Page
 *
 * Provides preset date ranges and custom date selection.
 */

'use client';

import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import { Calendar, ChevronDown, Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export type DateRangePreset = '7days' | '30days' | '90days' | 'thisYear' | 'custom';

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

// ============================================================================
// Date Range Presets
// ============================================================================

const DATE_RANGE_OPTIONS: Array<{
  value: DateRangePreset;
  label: string;
  getRange: () => DateRange;
}> = [
  {
    value: '7days',
    label: 'Ultimele 7 zile',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { start, end };
    },
  },
  {
    value: '30days',
    label: 'Ultimele 30 zile',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { start, end };
    },
  },
  {
    value: '90days',
    label: 'Ultimele 90 zile',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return { start, end };
    },
  },
  {
    value: 'thisYear',
    label: 'An curent',
    getRange: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return { start, end };
    },
  },
  {
    value: 'custom',
    label: 'Personalizat',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { start, end };
    },
  },
];

// ============================================================================
// Component
// ============================================================================

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomPopoverOpen, setIsCustomPopoverOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<DateRangePreset>('30days');

  const handlePresetChange = (presetValue: string) => {
    const preset = presetValue as DateRangePreset;
    setCurrentPreset(preset);

    if (preset === 'custom') {
      setIsCustomPopoverOpen(true);
    } else {
      const option = DATE_RANGE_OPTIONS.find((opt) => opt.value === preset);
      if (option) {
        onChange(option.getRange());
      }
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      onChange({
        start: new Date(customStartDate),
        end: new Date(customEndDate),
      });
      setIsCustomPopoverOpen(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDisplayLabel = () => {
    if (currentPreset === 'custom') {
      return `${formatDate(value.start)} - ${formatDate(value.end)}`;
    }
    return (
      DATE_RANGE_OPTIONS.find((opt) => opt.value === currentPreset)?.label || 'Ultimele 30 zile'
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-500" />

      <Popover.Root open={isCustomPopoverOpen} onOpenChange={setIsCustomPopoverOpen}>
        <Select.Root value={currentPreset} onValueChange={handlePresetChange}>
          <Select.Trigger className="inline-flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[200px]">
            <Select.Value>{getDisplayLabel()}</Select.Value>
            <Select.Icon>
              <ChevronDown className="h-4 w-4" />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg z-50">
              <Select.Viewport className="p-1">
                {DATE_RANGE_OPTIONS.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-pointer items-center rounded px-8 py-2 text-sm text-gray-900 outline-none hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50"
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                      <Check className="h-4 w-4 text-blue-600" />
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
            className="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl z-50"
            sideOffset={5}
          >
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Perioadă Personalizată</h3>

              <div className="space-y-3">
                <div>
                  <label htmlFor="start-date" className="block text-xs font-medium text-gray-700">
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
  );
}
