'use client';

/**
 * TimesheetFilters Component
 * Filter panel for team activity page
 *
 * Contains:
 * - Case picker (optional)
 * - Team member multi-select
 * - Period selector with presets
 */

import { useState, useMemo, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Calendar, Users, ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { CaseCombobox } from './CaseCombobox';
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
        <label className="block text-xs font-medium text-linear-text-muted uppercase tracking-wide mb-2">
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
              className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-linear-text-muted hover:text-linear-text-secondary rounded"
              aria-label="Șterge filtru dosar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Team Member Selector */}
      <div>
        <label className="block text-xs font-medium text-linear-text-muted uppercase tracking-wide mb-2">
          Echipa
        </label>
        <Popover.Root open={isTeamPopoverOpen} onOpenChange={setIsTeamPopoverOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5',
                'border rounded-lg text-sm transition-all',
                'bg-linear-bg-secondary',
                isTeamPopoverOpen
                  ? 'border-linear-accent ring-2 ring-linear-accent/20'
                  : 'border-linear-border-subtle hover:border-linear-border'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Users className="h-4 w-4 text-linear-accent flex-shrink-0" />
                <span className="text-linear-text-primary truncate">{selectedTeamDisplay}</span>
              </div>
              <ChevronDown
                className={clsx(
                  'h-4 w-4 text-linear-text-muted transition-transform flex-shrink-0',
                  isTeamPopoverOpen && 'rotate-180'
                )}
              />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="w-64 max-h-72 overflow-y-auto rounded-lg border border-linear-border-subtle bg-linear-bg-secondary shadow-lg z-50"
              sideOffset={4}
              align="start"
            >
              <div className="p-2 border-b border-linear-border-subtle">
                <button
                  type="button"
                  onClick={handleSelectAllTeam}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-linear-text-secondary hover:text-linear-text-primary hover:bg-linear-bg-tertiary rounded"
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
                  <div className="px-3 py-4 text-center text-sm text-linear-text-muted">
                    Se încarcă...
                  </div>
                ) : users.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-linear-text-muted">
                    Nu există membri în echipă
                  </div>
                ) : (
                  users.map((user) => {
                    const isSelected = value.teamMemberIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-linear-bg-tertiary"
                      >
                        <Checkbox.Root
                          checked={isSelected}
                          onCheckedChange={() => handleTeamMemberToggle(user.id)}
                          className={clsx(
                            'h-4 w-4 rounded border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-linear-accent',
                            isSelected
                              ? 'bg-linear-accent border-linear-accent'
                              : 'bg-linear-bg-secondary border-linear-border'
                          )}
                        >
                          <Checkbox.Indicator className="flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-linear-text-primary truncate">
                            {getUserName(user)}
                          </p>
                          <p className="text-xs text-linear-text-muted truncate">{user.role}</p>
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
        <label className="block text-xs font-medium text-linear-text-muted uppercase tracking-wide mb-2">
          Perioada
        </label>
        <Popover.Root open={isPeriodPopoverOpen} onOpenChange={setIsPeriodPopoverOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5',
                'border rounded-lg text-sm transition-all',
                'bg-linear-bg-secondary',
                isPeriodPopoverOpen
                  ? 'border-linear-accent ring-2 ring-linear-accent/20'
                  : 'border-linear-border-subtle hover:border-linear-border'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Calendar className="h-4 w-4 text-linear-accent flex-shrink-0" />
                <span className="text-linear-text-primary truncate">{periodDisplay}</span>
              </div>
              <ChevronDown
                className={clsx(
                  'h-4 w-4 text-linear-text-muted transition-transform flex-shrink-0',
                  isPeriodPopoverOpen && 'rotate-180'
                )}
              />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="w-72 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary shadow-lg z-50"
              sideOffset={4}
              align="start"
            >
              {/* Presets */}
              <div className="py-1 border-b border-linear-border-subtle">
                {PERIOD_PRESETS.filter((p) => p.value !== 'custom').map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePeriodPresetChange(preset.value)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                      'hover:bg-linear-bg-tertiary transition-colors',
                      value.periodPreset === preset.value &&
                        'bg-linear-accent/10 text-linear-accent'
                    )}
                  >
                    {value.periodPreset === preset.value && (
                      <Check className="h-4 w-4 text-linear-accent" />
                    )}
                    <span className={value.periodPreset !== preset.value ? 'ml-6' : ''}>
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              <div className="p-3 space-y-3">
                <h4 className="text-xs font-medium text-linear-text-muted uppercase">
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
                      className="w-full px-2 py-1.5 text-sm border border-linear-border-subtle rounded bg-linear-bg-secondary text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent"
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
                      className="w-full px-2 py-1.5 text-sm border border-linear-border-subtle rounded bg-linear-bg-secondary text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent"
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
                    'bg-linear-accent text-white hover:bg-linear-accent/90',
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
