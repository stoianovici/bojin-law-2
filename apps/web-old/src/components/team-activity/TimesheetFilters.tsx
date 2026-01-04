'use client';

/**
 * TimesheetFilters Component
 * OPS-271: Filter panel for team activity page
 *
 * Contains:
 * - Case picker (optional, reuses CaseCombobox)
 * - Team member multi-select
 * - Period selector with presets
 */

import { useState, useMemo, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Calendar, Users, ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { CaseCombobox } from '../task/CaseCombobox';
import { useFirmUsers, type FirmUser } from '../../hooks/useFirmUsers';
import {
  getDefaultDateRange,
  getTodayRange,
  getWeekRange,
  getMonthRange,
} from '../../hooks/useTeamActivity';

// ============================================================================
// Types
// ============================================================================

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export interface TimesheetFiltersValue {
  caseId: string | null;
  teamMemberIds: string[];
  startDate: Date;
  endDate: Date;
  periodPreset: PeriodPreset;
}

export interface TimesheetFiltersProps {
  value: TimesheetFiltersValue;
  onChange: (value: TimesheetFiltersValue) => void;
  className?: string;
}

// ============================================================================
// Period Presets
// ============================================================================

const PERIOD_PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Astăzi' },
  { value: 'week', label: 'Săptămâna aceasta' },
  { value: 'month', label: 'Luna aceasta' },
  { value: 'custom', label: 'Personalizat' },
];

// ============================================================================
// Component
// ============================================================================

export function TimesheetFilters({ value, onChange, className }: TimesheetFiltersProps) {
  const { users, loading: usersLoading } = useFirmUsers();
  const [isTeamPopoverOpen, setIsTeamPopoverOpen] = useState(false);
  const [isPeriodPopoverOpen, setIsPeriodPopoverOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get user display name
  const getUserName = useCallback((user: FirmUser) => {
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  }, []);

  // Get selected team members display
  const selectedTeamDisplay = useMemo(() => {
    if (value.teamMemberIds.length === 0) {
      return 'Toată echipa';
    }
    if (value.teamMemberIds.length === 1) {
      const user = users.find((u) => u.id === value.teamMemberIds[0]);
      return user ? getUserName(user) : '1 selectat';
    }
    return `${value.teamMemberIds.length} selectați`;
  }, [value.teamMemberIds, users, getUserName]);

  // Get period display label
  const periodDisplay = useMemo(() => {
    const preset = PERIOD_PRESETS.find((p) => p.value === value.periodPreset);
    if (preset && value.periodPreset !== 'custom') {
      return preset.label;
    }
    // Format dates for custom range
    const formatDate = (date: Date) =>
      date.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
      });
    return `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`;
  }, [value.periodPreset, value.startDate, value.endDate]);

  // Handle case selection
  const handleCaseChange = (caseId: string) => {
    onChange({ ...value, caseId });
  };

  // Handle clear case
  const handleClearCase = () => {
    onChange({ ...value, caseId: null });
  };

  // Handle team member toggle
  const handleTeamMemberToggle = (userId: string) => {
    const isSelected = value.teamMemberIds.includes(userId);
    const newTeamMemberIds = isSelected
      ? value.teamMemberIds.filter((id) => id !== userId)
      : [...value.teamMemberIds, userId];
    onChange({ ...value, teamMemberIds: newTeamMemberIds });
  };

  // Handle select all team members
  const handleSelectAllTeam = () => {
    if (value.teamMemberIds.length === users.length) {
      onChange({ ...value, teamMemberIds: [] });
    } else {
      onChange({ ...value, teamMemberIds: users.map((u) => u.id) });
    }
  };

  // Handle period preset selection
  const handlePeriodPresetChange = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      setIsPeriodPopoverOpen(true);
      return;
    }

    let dateRange: { startDate: Date; endDate: Date };
    switch (preset) {
      case 'today':
        dateRange = getTodayRange();
        break;
      case 'week':
        dateRange = getWeekRange();
        break;
      case 'month':
      default:
        dateRange = getMonthRange();
        break;
    }

    onChange({
      ...value,
      periodPreset: preset,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    setIsPeriodPopoverOpen(false);
  };

  // Handle custom date apply
  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      onChange({
        ...value,
        periodPreset: 'custom',
        startDate: new Date(customStartDate),
        endDate: new Date(customEndDate),
      });
      setIsPeriodPopoverOpen(false);
    }
  };

  return (
    <div className={clsx('flex flex-col gap-5', className)}>
      {/* Case Picker */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Dosar
        </label>
        <div className="relative">
          <CaseCombobox
            value={value.caseId}
            onChange={handleCaseChange}
            placeholder="Toate dosarele"
          />
          {value.caseId && (
            <button
              type="button"
              onClick={handleClearCase}
              className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Șterge filtru dosar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Team Member Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Echipa
        </label>
        <Popover.Root open={isTeamPopoverOpen} onOpenChange={setIsTeamPopoverOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5',
                'border rounded-lg text-sm transition-all',
                'bg-white',
                isTeamPopoverOpen
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Users className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-gray-900 truncate">{selectedTeamDisplay}</span>
              </div>
              <ChevronDown
                className={clsx(
                  'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
                  isTeamPopoverOpen && 'rotate-180'
                )}
              />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg z-50"
              sideOffset={4}
              align="start"
            >
              <div className="p-2 border-b border-gray-100">
                <button
                  type="button"
                  onClick={handleSelectAllTeam}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded"
                >
                  {value.teamMemberIds.length === users.length ? (
                    <>
                      <X className="h-4 w-4" />
                      <span>Deselectează toți</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Selectează toți</span>
                    </>
                  )}
                </button>
              </div>

              <div className="py-1">
                {usersLoading ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">Se încarcă...</div>
                ) : users.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    Nu există membri în echipă
                  </div>
                ) : (
                  users.map((user) => {
                    const isSelected = value.teamMemberIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <Checkbox.Root
                          checked={isSelected}
                          onCheckedChange={() => handleTeamMemberToggle(user.id)}
                          className={clsx(
                            'h-4 w-4 rounded border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-amber-500',
                            isSelected
                              ? 'bg-amber-500 border-amber-500'
                              : 'bg-white border-gray-300'
                          )}
                        >
                          <Checkbox.Indicator className="flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">{getUserName(user)}</p>
                          <p className="text-xs text-gray-500 truncate">{user.role}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Period Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Perioada
        </label>
        <Popover.Root open={isPeriodPopoverOpen} onOpenChange={setIsPeriodPopoverOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5',
                'border rounded-lg text-sm transition-all',
                'bg-white',
                isPeriodPopoverOpen
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-gray-900 truncate">{periodDisplay}</span>
              </div>
              <ChevronDown
                className={clsx(
                  'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
                  isPeriodPopoverOpen && 'rotate-180'
                )}
              />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="w-72 rounded-lg border border-gray-200 bg-white shadow-lg z-50"
              sideOffset={4}
              align="start"
            >
              {/* Presets */}
              <div className="py-1 border-b border-gray-100">
                {PERIOD_PRESETS.filter((p) => p.value !== 'custom').map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePeriodPresetChange(preset.value)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                      'hover:bg-gray-50 transition-colors',
                      value.periodPreset === preset.value && 'bg-amber-50 text-amber-700'
                    )}
                  >
                    {value.periodPreset === preset.value && (
                      <Check className="h-4 w-4 text-amber-600" />
                    )}
                    <span className={value.periodPreset !== preset.value ? 'ml-6' : ''}>
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              <div className="p-3 space-y-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase">
                  Perioadă personalizată
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="filter-start-date" className="sr-only">
                      Data început
                    </label>
                    <input
                      id="filter-start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="De la"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-end-date" className="sr-only">
                      Data sfârșit
                    </label>
                    <input
                      id="filter-end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="Până la"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCustomDateApply}
                  disabled={!customStartDate || !customEndDate}
                  className={clsx(
                    'w-full px-3 py-1.5 text-sm font-medium rounded',
                    'bg-amber-500 text-white hover:bg-amber-600',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )}
                >
                  Aplică
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}

TimesheetFilters.displayName = 'TimesheetFilters';

export default TimesheetFilters;

// ============================================================================
// Default Values Helper
// ============================================================================

export function getDefaultFiltersValue(): TimesheetFiltersValue {
  const { startDate, endDate } = getDefaultDateRange();
  return {
    caseId: null,
    teamMemberIds: [],
    startDate,
    endDate,
    periodPreset: 'month',
  };
}
