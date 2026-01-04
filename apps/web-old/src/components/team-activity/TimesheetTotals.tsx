'use client';

/**
 * TimesheetTotals Component
 * OPS-273: Footer row showing totals for timesheet
 * OPS-275: Updated grid layout for billable checkbox column
 * OPS-277: Selection column for merge functionality
 * OPS-287: Manual total override with discount display
 *
 * Displays:
 * - Total hours (billable + non-billable breakdown)
 * - Total cost (hourly contracts only)
 * - Editable total for Partners with discount calculation
 */

import { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { X, Pencil } from 'lucide-react';
import type { BillingType } from '../../hooks/useTimesheetData';

// ============================================================================
// Types
// ============================================================================

export interface TimesheetTotalsProps {
  totalHours: number;
  totalBillableHours: number;
  totalCost: number;
  totalBillableCost: number;
  billingType: BillingType;
  showTeamMember: boolean;
  // OPS-277: Selection column for merge
  showSelection?: boolean;
  // OPS-287: Manual total override
  manualTotal?: number | null;
  onManualTotalChange?: (value: number | null) => void;
  discount?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

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

export function TimesheetTotals({
  totalHours,
  totalBillableHours,
  totalCost,
  totalBillableCost,
  billingType,
  showTeamMember,
  showSelection = false,
  manualTotal,
  onManualTotalChange,
  discount = 0,
  className,
}: TimesheetTotalsProps) {
  const isHourly = billingType === 'Hourly';
  const nonBillableHours = totalHours - totalBillableHours;
  const nonBillableCost = totalCost - totalBillableCost;

  // OPS-287: Editable total state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Calculate display total - handle both undefined and null
  const displayTotal = manualTotal != null ? manualTotal : totalBillableCost;

  // Start editing
  const handleStartEdit = useCallback(() => {
    setEditValue(formatCurrency(displayTotal));
    setIsEditing(true);
  }, [displayTotal]);

  // Parse and validate input
  const parseAmount = useCallback((value: string): number | null => {
    // Remove spaces and replace comma with dot for parsing
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(() => {
    const parsed = parseAmount(editValue);
    if (parsed !== null && parsed >= 0 && parsed <= totalBillableCost) {
      onManualTotalChange?.(parsed);
    }
    setIsEditing(false);
  }, [editValue, parseAmount, totalBillableCost, onManualTotalChange]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  // Clear manual override
  const handleClearOverride = useCallback(() => {
    onManualTotalChange?.(null);
  }, [onManualTotalChange]);

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  // Auto-select input on focus
  useEffect(() => {
    if (isEditing) {
      const input = document.querySelector<HTMLInputElement>('[data-manual-total-input]');
      input?.select();
    }
  }, [isEditing]);

  // OPS-277: Build grid columns dynamically - must match TimesheetRow layout
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
    <div className={clsx('border-t-2 border-gray-300 bg-gray-50', className)}>
      {/* Billable Total Row */}
      <div
        className="grid gap-4 px-4 py-3 items-center"
        style={{ gridTemplateColumns: getGridColumns() }}
      >
        {/* OPS-277: Selection column placeholder */}
        {showSelection && <div />}
        <div />
        <div />
        <div className="text-sm font-medium text-gray-700">Facturabil</div>
        {showTeamMember && <div />}
        <div className="text-sm font-semibold text-gray-900 text-right tabular-nums">
          {formatHours(totalBillableHours)}
        </div>
        {isHourly && (
          <div className="text-sm font-semibold text-gray-900 text-right tabular-nums">
            {formatCurrency(totalBillableCost)} RON
          </div>
        )}
      </div>

      {/* Non-Billable Row (if any) */}
      {nonBillableHours > 0 && (
        <div
          className="grid gap-4 px-4 py-2 border-t border-gray-200 items-center"
          style={{ gridTemplateColumns: getGridColumns() }}
        >
          {/* OPS-277: Selection column placeholder */}
          {showSelection && <div />}
          <div />
          <div />
          <div className="text-sm text-gray-500">Nefacturabil</div>
          {showTeamMember && <div />}
          <div className="text-sm text-gray-500 text-right tabular-nums">
            {formatHours(nonBillableHours)}
          </div>
          {isHourly && (
            <div className="text-sm text-gray-500 text-right tabular-nums line-through">
              {formatCurrency(nonBillableCost)} RON
            </div>
          )}
        </div>
      )}

      {/* OPS-287: Discount Row (when manual total is set) */}
      {discount > 0 && (
        <div
          className="grid gap-4 px-4 py-2 border-t border-gray-200 bg-green-50 items-center"
          style={{ gridTemplateColumns: getGridColumns() }}
        >
          {showSelection && <div />}
          <div />
          <div />
          <div className="text-sm text-green-700 font-medium">Discount</div>
          {showTeamMember && <div />}
          <div />
          {isHourly && (
            <div className="text-sm text-green-700 text-right tabular-nums font-medium">
              -{formatCurrency(discount)} RON
            </div>
          )}
        </div>
      )}

      {/* Grand Total Row */}
      <div
        className="grid gap-4 px-4 py-3 border-t border-gray-300 bg-amber-50 items-center"
        style={{ gridTemplateColumns: getGridColumns() }}
      >
        {/* OPS-277: Selection column placeholder */}
        {showSelection && <div />}
        <div />
        <div />
        <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
          TOTAL
          {/* OPS-287: Reset button when override is active */}
          {manualTotal !== null && onManualTotalChange && (
            <button
              type="button"
              onClick={handleClearOverride}
              className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
              title="Resetează totalul"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {showTeamMember && <div />}
        <div className="text-sm font-bold text-gray-900 text-right tabular-nums">
          {formatHours(totalHours)}
        </div>
        {isHourly && (
          <div className="text-sm font-bold text-amber-700 text-right tabular-nums">
            {isEditing ? (
              <input
                data-manual-total-input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleKeyDown}
                className="w-24 px-2 py-0.5 text-right border border-amber-400 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold text-amber-700 bg-white"
                autoFocus
              />
            ) : onManualTotalChange ? (
              <button
                type="button"
                onClick={handleStartEdit}
                className="group inline-flex items-center gap-1 hover:bg-amber-100 px-2 py-0.5 rounded transition-colors"
                title="Click pentru a modifica totalul"
              >
                <span>{formatCurrency(displayTotal)} RON</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
              </button>
            ) : (
              <span>{formatCurrency(displayTotal)} RON</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

TimesheetTotals.displayName = 'TimesheetTotals';

export default TimesheetTotals;
