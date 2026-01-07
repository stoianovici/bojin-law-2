'use client';

/**
 * TimesheetTotals Component
 * Footer row showing totals for timesheet
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
  showSelection?: boolean;
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

  // Editable total state
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

  // Build grid columns dynamically - must match TimesheetRow layout
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
    <div className={clsx('border-t-2 border-linear-border bg-linear-bg-tertiary', className)}>
      {/* Billable Total Row */}
      <div
        className="grid gap-4 px-4 py-3 items-center"
        style={{ gridTemplateColumns: getGridColumns() }}
      >
        {/* Selection column placeholder */}
        {showSelection && <div />}
        <div />
        <div />
        <div className="text-sm font-medium text-linear-text-secondary">Facturabil</div>
        {showTeamMember && <div />}
        <div className="text-sm font-semibold text-linear-text-primary text-right tabular-nums">
          {formatHours(totalBillableHours)}
        </div>
        {isHourly && (
          <div className="text-sm font-semibold text-linear-text-primary text-right tabular-nums">
            {formatCurrency(totalBillableCost)} RON
          </div>
        )}
      </div>

      {/* Non-Billable Row (if any) */}
      {nonBillableHours > 0 && (
        <div
          className="grid gap-4 px-4 py-2 border-t border-linear-border-subtle items-center"
          style={{ gridTemplateColumns: getGridColumns() }}
        >
          {/* Selection column placeholder */}
          {showSelection && <div />}
          <div />
          <div />
          <div className="text-sm text-linear-text-muted">Nefacturabil</div>
          {showTeamMember && <div />}
          <div className="text-sm text-linear-text-muted text-right tabular-nums">
            {formatHours(nonBillableHours)}
          </div>
          {isHourly && (
            <div className="text-sm text-linear-text-muted text-right tabular-nums line-through">
              {formatCurrency(nonBillableCost)} RON
            </div>
          )}
        </div>
      )}

      {/* Discount Row (when manual total is set) */}
      {discount > 0 && (
        <div
          className="grid gap-4 px-4 py-2 border-t border-linear-border-subtle bg-linear-success/10 items-center"
          style={{ gridTemplateColumns: getGridColumns() }}
        >
          {showSelection && <div />}
          <div />
          <div />
          <div className="text-sm text-linear-success font-medium">Discount</div>
          {showTeamMember && <div />}
          <div />
          {isHourly && (
            <div className="text-sm text-linear-success text-right tabular-nums font-medium">
              -{formatCurrency(discount)} RON
            </div>
          )}
        </div>
      )}

      {/* Grand Total Row */}
      <div
        className="grid gap-4 px-4 py-3 border-t border-linear-border bg-linear-accent/10 items-center"
        style={{ gridTemplateColumns: getGridColumns() }}
      >
        {/* Selection column placeholder */}
        {showSelection && <div />}
        <div />
        <div />
        <div className="text-sm font-bold text-linear-text-primary flex items-center gap-2">
          TOTAL
          {/* Reset button when override is active */}
          {manualTotal !== null && onManualTotalChange && (
            <button
              type="button"
              onClick={handleClearOverride}
              className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-linear-bg-tertiary hover:bg-linear-bg-secondary text-linear-text-muted transition-colors"
              title="Resetează totalul"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {showTeamMember && <div />}
        <div className="text-sm font-bold text-linear-text-primary text-right tabular-nums">
          {formatHours(totalHours)}
        </div>
        {isHourly && (
          <div className="text-sm font-bold text-linear-accent text-right tabular-nums">
            {isEditing ? (
              <input
                data-manual-total-input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleKeyDown}
                className="w-24 px-2 py-0.5 text-right border border-linear-accent rounded focus:outline-none focus:ring-2 focus:ring-linear-accent text-sm font-bold text-linear-accent bg-linear-bg-secondary"
                autoFocus
              />
            ) : onManualTotalChange ? (
              <button
                type="button"
                onClick={handleStartEdit}
                className="group inline-flex items-center gap-1 hover:bg-linear-accent/20 px-2 py-0.5 rounded transition-colors"
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
