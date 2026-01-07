'use client';

/**
 * MergedRow Component
 * Display a merged group of timesheet entries
 *
 * Features:
 * - Special styling to indicate merged state
 * - Combined hours and cost display
 * - "Desparte" button to un-merge
 * - Shows merge icon
 */

import { Merge, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/button';
import type { MergedGroup } from '../../hooks/useTimesheetMerge';
import type { BillingType, TimesheetEntry } from '../../hooks/useTimesheetData';

// ============================================================================
// Types
// ============================================================================

export interface MergedRowProps {
  group: MergedGroup;
  originalEntries: TimesheetEntry[];
  billingType: BillingType;
  showTeamMember: boolean;
  showSelection: boolean;
  onUnmerge: (groupId: string) => void;
  className?: string;
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

export function MergedRow({
  group,
  originalEntries,
  billingType,
  showTeamMember,
  showSelection,
  onUnmerge,
  className,
}: MergedRowProps) {
  const isHourly = billingType === 'Hourly';
  const isBillable = group.billable;

  // Get unique team members from original entries
  const uniqueUsers = Array.from(new Map(originalEntries.map((e) => [e.user.id, e.user])).values());
  const teamMemberDisplay =
    uniqueUsers.length === 1
      ? [uniqueUsers[0].firstName, uniqueUsers[0].lastName].filter(Boolean).join(' ') ||
        uniqueUsers[0].email
      : `${uniqueUsers.length} persoane`;

  // Build grid columns dynamically based on options
  const getGridColumns = () => {
    const cols: string[] = [];

    // Selection checkbox column (when enabled) - empty for merged rows
    if (showSelection) cols.push('36px');

    // Billable indicator (merged rows don't have toggle)
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
        'grid gap-4 px-4 py-3 border-b border-linear-border-subtle items-center',
        'bg-linear-accent/10 hover:bg-linear-accent/15 transition-colors',
        !isBillable && 'opacity-60',
        className
      )}
      style={{
        gridTemplateColumns: getGridColumns(),
      }}
    >
      {/* Empty space for selection column */}
      {showSelection && <div />}

      {/* Merge icon instead of billable checkbox */}
      <div className="flex items-center justify-center">
        <Merge className="h-4 w-4 text-linear-accent" />
      </div>

      {/* Date */}
      <div
        className={clsx(
          'text-sm',
          isBillable ? 'text-linear-text-secondary' : 'text-linear-text-muted'
        )}
      >
        {formatDate(group.date)}
      </div>

      {/* Description with entry count and un-merge button */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                'text-sm truncate font-medium',
                isBillable ? 'text-linear-text-primary' : 'text-linear-text-muted'
              )}
            >
              {group.customDescription}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-linear-accent bg-linear-accent/20 px-1.5 py-0.5 rounded">
                {group.entryIds.length} intrări îmbinate
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUnmerge(group.id)}
                className="h-5 px-1.5 text-xs text-linear-text-muted hover:text-linear-text-primary"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Desparte
              </Button>
            </div>
          </div>
          {/* Non-billable badge */}
          {!isBillable && (
            <span className="flex-shrink-0 text-[10px] uppercase tracking-wide font-medium text-linear-text-muted bg-linear-bg-tertiary px-1.5 py-0.5 rounded">
              Non-fact
            </span>
          )}
        </div>
      </div>

      {/* Team Member */}
      {showTeamMember && (
        <div
          className={clsx(
            'text-sm truncate',
            isBillable ? 'text-linear-text-secondary' : 'text-linear-text-muted'
          )}
        >
          {teamMemberDisplay}
        </div>
      )}

      {/* Hours */}
      <div className="text-right">
        <span
          className={clsx(
            'text-sm text-right font-medium tabular-nums',
            isBillable ? 'text-linear-text-primary' : 'text-linear-text-muted'
          )}
        >
          {formatHours(group.totalHours)}
        </span>
      </div>

      {/* Cost (hourly only) */}
      {isHourly && (
        <div
          className={clsx(
            'text-sm text-right font-medium tabular-nums',
            isBillable ? 'text-linear-text-primary' : 'text-linear-text-muted line-through'
          )}
        >
          {formatCurrency(group.totalAmount)} RON
        </div>
      )}
    </div>
  );
}

MergedRow.displayName = 'MergedRow';

export default MergedRow;
