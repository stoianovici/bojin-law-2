'use client';

/**
 * TimesheetHeader Component
 * OPS-273: Column headers for timesheet table with contract info display
 * OPS-275: Added billable checkbox column
 * OPS-276: Team attribution toggle
 * OPS-277: Selection checkbox column for merge functionality
 * OPS-278: Export buttons (PDF and clipboard)
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
  // OPS-277: Selection column for merge
  showSelection?: boolean;
  // OPS-278: Export data
  entries?: TimesheetEntry[];
  totalHours?: number;
  totalBillableHours?: number;
  totalCost?: number;
  totalBillableCost?: number;
  period?: {
    startDate: Date;
    endDate: Date;
  };
  // OPS-287: Discount export props
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

  // OPS-278: Check if export data is available
  const canExport = entries && period && totalHours !== undefined;

  // OPS-277: Build grid columns dynamically
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
    <div className={clsx('border-b border-gray-200', className)}>
      {/* Contract Info Bar */}
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-gray-900">{caseData.title}</span>
            {caseData.caseNumber && (
              <span className="text-sm text-gray-500">({caseData.caseNumber})</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            {caseData.client && (
              <span className="text-gray-600">
                Client: <span className="font-medium text-gray-900">{caseData.client.name}</span>
              </span>
            )}
            <span className="text-gray-600">
              Contract:{' '}
              <span className="font-medium text-amber-700">
                {billingLabel}
                {isHourly &&
                  caseData.customRates?.partnerRate &&
                  ` · ${caseData.customRates.partnerRate} RON/oră`}
              </span>
            </span>
            {/* OPS-276: Team attribution toggle */}
            {onShowTeamMemberChange && (
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <Switch
                  checked={showTeamMember}
                  onCheckedChange={onShowTeamMemberChange}
                  className="data-[state=checked]:bg-amber-500"
                />
                <span className="text-xs font-medium">Afișează membrul echipei</span>
              </label>
            )}
            {/* OPS-278: Export buttons */}
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
                // OPS-287: Discount props
                discount={discount}
                finalTotal={finalTotal}
              />
            )}
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div
        className="grid gap-4 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide items-center"
        style={{
          gridTemplateColumns: getGridColumns(),
        }}
      >
        {/* OPS-277: Selection column header */}
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
