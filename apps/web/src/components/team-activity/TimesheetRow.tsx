'use client';

/**
 * TimesheetRow Component
 * OPS-273: Individual row in timesheet table
 * OPS-274: Inline editing for hours
 * OPS-275: Billable controls with checkbox toggle
 * OPS-277: Selection checkbox for merge functionality
 *
 * Displays:
 * - Selection checkbox (first column, when in merge mode)
 * - Billable checkbox
 * - Date (formatted)
 * - Description (task title + description)
 * - Team member name (optional)
 * - Hours (editable)
 * - Cost (hourly contracts only, auto-calculated)
 */

import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { TimesheetEntry, BillingType } from '../../hooks/useTimesheetData';
import { formatUserName } from '../../hooks/useTimesheetData';
import { Checkbox } from '../ui/checkbox';
import { EditableCell } from './EditableCell';

// ============================================================================
// Types
// ============================================================================

export interface TimesheetRowProps {
  entry: TimesheetEntry;
  billingType: BillingType;
  showTeamMember: boolean;
  onHoursChange?: (entryId: string, hours: number) => Promise<void>;
  onBillableChange?: (entryId: string, billable: boolean) => void;
  isUpdating?: boolean;
  className?: string;
  // OPS-277: Selection for merge
  showSelection?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (entryId: string, shiftKey: boolean) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(2);
}

// ============================================================================
// Component
// ============================================================================

export function TimesheetRow({
  entry,
  billingType,
  showTeamMember,
  onHoursChange,
  onBillableChange,
  isUpdating = false,
  className,
  // OPS-277: Selection props
  showSelection = false,
  isSelected = false,
  onSelectionChange,
}: TimesheetRowProps) {
  const isHourly = billingType === 'Hourly';
  const isBillable = entry.billable;
  const isEditable = !!onHoursChange;

  // Build description from task title + entry description
  const description = entry.task ? `${entry.task.title}: ${entry.description}` : entry.description;

  // Calculate cost based on current hours (for display)
  const cost = entry.hours * entry.hourlyRate;

  const handleCheckboxChange = (checked: boolean | 'indeterminate') => {
    if (checked !== 'indeterminate' && onBillableChange) {
      onBillableChange(entry.id, checked);
    }
  };

  const handleSaveHours = async (hours: number) => {
    if (onHoursChange) {
      await onHoursChange(entry.id, hours);
    }
  };

  // OPS-277: Handle selection checkbox click
  const handleSelectionClick = (e: React.MouseEvent) => {
    if (onSelectionChange) {
      onSelectionChange(entry.id, e.shiftKey);
    }
  };

  // OPS-277: Build grid columns dynamically based on options
  const getGridColumns = () => {
    const cols: string[] = [];

    // Selection checkbox column (when enabled)
    if (showSelection) cols.push('36px');

    // Billable checkbox
    cols.push('36px');
    // Date
    cols.push('100px');
    // Description (flex)
    cols.push('1fr');
    // Team member (optional)
    if (showTeamMember) cols.push('140px');
    // Hours
    cols.push('80px');
    // Cost (hourly only)
    if (isHourly) cols.push('100px');

    return cols.join(' ');
  };

  return (
    <div
      className={clsx(
        'grid gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center',
        !isBillable && 'bg-gray-50/50',
        isSelected && 'bg-blue-50 hover:bg-blue-100',
        className
      )}
      style={{
        gridTemplateColumns: getGridColumns(),
      }}
    >
      {/* OPS-277: Selection Checkbox */}
      {showSelection && (
        <div className="flex items-center justify-center" onClick={handleSelectionClick}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {}} // Handled by onClick for shiftKey access
            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
          />
        </div>
      )}

      {/* Billable Checkbox */}
      <div className="flex items-center justify-center">
        {isUpdating ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <Checkbox
            checked={isBillable}
            onCheckedChange={handleCheckboxChange}
            disabled={!onBillableChange}
            title={isBillable ? 'Marchează ca nefacturabil' : 'Marchează ca facturabil'}
            className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
        )}
      </div>

      {/* Date */}
      <div className={clsx('text-sm', isBillable ? 'text-gray-600' : 'text-gray-400')}>
        {formatDate(entry.date)}
      </div>

      {/* Description */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={clsx('text-sm truncate', isBillable ? 'text-gray-900' : 'text-gray-400')}>
              {description}
            </p>
            {entry.narrative && (
              <p
                className={clsx(
                  'text-xs mt-0.5 line-clamp-2',
                  isBillable ? 'text-gray-500' : 'text-gray-300'
                )}
              >
                {entry.narrative}
              </p>
            )}
          </div>
          {/* Non-billable badge */}
          {!isBillable && (
            <span className="flex-shrink-0 text-[10px] uppercase tracking-wide font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              Non-fact
            </span>
          )}
        </div>
      </div>

      {/* Team Member */}
      {showTeamMember && (
        <div className={clsx('text-sm truncate', isBillable ? 'text-gray-600' : 'text-gray-400')}>
          {formatUserName(entry.user)}
        </div>
      )}

      {/* Hours - editable if onHoursChange provided */}
      <div className="text-right">
        {isEditable ? (
          <EditableCell
            value={entry.hours}
            onSave={handleSaveHours}
            formatDisplay={formatHours}
            min={0.25}
            max={24}
            step={0.25}
            disabled={isUpdating}
            className={clsx(!isBillable && 'opacity-50')}
          />
        ) : (
          <span
            className={clsx(
              'text-sm text-right font-medium tabular-nums',
              isBillable ? 'text-gray-900' : 'text-gray-400'
            )}
          >
            {formatHours(entry.hours)}
          </span>
        )}
      </div>

      {/* Cost (hourly only) - auto-calculated from hours */}
      {isHourly && (
        <div
          className={clsx(
            'text-sm text-right font-medium tabular-nums',
            isBillable ? 'text-gray-900' : 'text-gray-400 line-through'
          )}
        >
          {formatCurrency(cost)} RON
        </div>
      )}
    </div>
  );
}

TimesheetRow.displayName = 'TimesheetRow';

export default TimesheetRow;
