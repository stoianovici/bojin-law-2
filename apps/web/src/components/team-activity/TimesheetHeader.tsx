'use client';

/**
 * TimesheetHeader Component
 * Column headers for timesheet table with contract info display
 *
 * Displays:
 * - Contract type and rate info
 * - Toggle for team member visibility
 * - Export buttons (PDF and clipboard)
 * - Column labels (Selection, Billable, Date, Description, Hours, Cost)
 * - Cost column conditionally shown based on billing type
 */

import { FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { Switch } from '../ui/switch';
import type { TimesheetCase, TimesheetEntry } from '../../hooks/useTimesheetData';
import { getBillingTypeLabel } from '../../hooks/useTimesheetData';
import { TimesheetExport } from './TimesheetExport';

// ============================================================================
// Types
// ============================================================================

export interface TimesheetHeaderProps {
  caseData: TimesheetCase;
  showTeamMember: boolean;
  onShowTeamMemberChange?: (value: boolean) => void;
  showSelection?: boolean;
  entries?: TimesheetEntry[];
  totalHours?: number;
  totalBillableHours?: number;
  totalCost?: number;
  totalBillableCost?: number;
  period?: {
    startDate: Date;
    endDate: Date;
  };
  discount?: number;
  finalTotal?: number;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TimesheetHeader({
  caseData,
  showTeamMember,
  onShowTeamMemberChange,
  showSelection = false,
  entries,
  totalHours,
  totalBillableHours,
  totalCost,
  totalBillableCost,
  period,
  discount = 0,
  finalTotal,
  className,
}: TimesheetHeaderProps) {
  const isHourly = caseData.billingType === 'Hourly';
  const billingLabel = getBillingTypeLabel(caseData.billingType);

  // Check if export data is available
  const canExport = entries && period && totalHours !== undefined;

  // Build grid columns dynamically
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
    <div className={clsx('border-b border-linear-border-subtle', className)}>
      {/* Contract Info Bar */}
      <div className="px-4 py-3 bg-linear-accent/10 border-b border-linear-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-linear-accent" />
            <span className="text-sm font-medium text-linear-text-primary">{caseData.title}</span>
            {caseData.caseNumber && (
              <span className="text-sm text-linear-text-muted">({caseData.caseNumber})</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            {caseData.client && (
              <span className="text-linear-text-secondary">
                Client: <span className="font-medium text-linear-text-primary">{caseData.client.name}</span>
              </span>
            )}
            <span className="text-linear-text-secondary">
              Contract:{' '}
              <span className="font-medium text-linear-accent">
                {billingLabel}
                {isHourly &&
                  caseData.customRates?.partnerRate &&
                  ` · ${caseData.customRates.partnerRate} RON/oră`}
              </span>
            </span>
            {/* Team attribution toggle */}
            {onShowTeamMemberChange && (
              <label className="flex items-center gap-2 text-linear-text-secondary cursor-pointer">
                <Switch
                  checked={showTeamMember}
                  onCheckedChange={onShowTeamMemberChange}
                />
                <span className="text-xs font-medium">Afișează membrul echipei</span>
              </label>
            )}
            {/* Export buttons */}
            {canExport && (
              <TimesheetExport
                entries={entries}
                caseData={caseData}
                totalHours={totalHours}
                totalBillableHours={totalBillableHours ?? 0}
                totalCost={totalCost ?? 0}
                totalBillableCost={totalBillableCost ?? 0}
                period={period}
                showTeamMember={showTeamMember}
                discount={discount}
                finalTotal={finalTotal}
              />
            )}
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div
        className="grid gap-4 px-4 py-2 bg-linear-bg-tertiary text-xs font-medium text-linear-text-muted uppercase tracking-wide items-center"
        style={{
          gridTemplateColumns: getGridColumns(),
        }}
      >
        {/* Selection column header */}
        {showSelection && <div />}
        <div className="text-center" title="Facturabil">
          Fact
        </div>
        <div>Data</div>
        <div>Descriere</div>
        {showTeamMember && <div>Responsabil</div>}
        <div className="text-right">Ore</div>
        {isHourly && <div className="text-right">Cost</div>}
      </div>
    </div>
  );
}

TimesheetHeader.displayName = 'TimesheetHeader';

export default TimesheetHeader;
