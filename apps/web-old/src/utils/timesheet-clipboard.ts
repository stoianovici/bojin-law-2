/**
 * Timesheet Clipboard Utilities
 * OPS-278: Format timesheet data as TSV for clipboard export
 * OPS-287: Add discount line when manual total is set
 *
 * TSV format works when pasted into:
 * - Microsoft Excel
 * - Google Sheets
 * - Microsoft Word tables
 * - Any spreadsheet application
 */

import type { TimesheetEntry, TimesheetCase } from '../hooks/useTimesheetData';
import { formatUserName } from '../hooks/useTimesheetData';

// ============================================================================
// Types
// ============================================================================

export interface TimesheetExportData {
  entries: TimesheetEntry[];
  case: TimesheetCase;
  totalHours: number;
  totalBillableHours: number;
  totalCost: number;
  totalBillableCost: number;
  // OPS-287: Discount for export
  discount?: number;
  finalTotal?: number;
}

export interface TimesheetExportOptions {
  showTeamMember: boolean;
  includeBillableColumn: boolean;
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

/**
 * Escape special characters for TSV format
 * Tab characters and newlines need to be handled
 */
function escapeCell(value: string): string {
  // Replace tabs and newlines with spaces
  return value.replace(/[\t\n\r]/g, ' ').trim();
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Format timesheet data as TSV (Tab-Separated Values)
 * This can be pasted directly into Excel, Google Sheets, or Word tables
 */
export function formatTimesheetAsTSV(
  data: TimesheetExportData,
  options: TimesheetExportOptions
): string {
  const {
    entries,
    case: caseData,
    totalBillableHours,
    totalBillableCost,
    discount = 0,
    finalTotal,
  } = data;
  const { showTeamMember, includeBillableColumn } = options;
  const isHourly = caseData.billingType === 'Hourly';

  // OPS-287: Calculate display total
  const displayTotal = finalTotal ?? totalBillableCost;
  const hasDiscount = discount > 0;

  const lines: string[] = [];

  // Header row
  const headers: string[] = [];
  headers.push('Data');
  headers.push('Descriere');
  if (showTeamMember) {
    headers.push('Responsabil');
  }
  headers.push('Ore');
  if (isHourly) {
    headers.push('Cost (RON)');
  }
  if (includeBillableColumn) {
    headers.push('Facturabil');
  }
  lines.push(headers.join('\t'));

  // Data rows - only billable entries or all with billable indicator
  const entriesToExport = includeBillableColumn ? entries : entries.filter((e) => e.billable);

  for (const entry of entriesToExport) {
    const description = entry.task
      ? `${entry.task.title}: ${entry.description}`
      : entry.description;

    const row: string[] = [];
    row.push(formatDate(entry.date));
    row.push(escapeCell(description));
    if (showTeamMember) {
      row.push(formatUserName(entry.user));
    }
    row.push(formatHours(entry.hours));
    if (isHourly) {
      row.push(formatCurrency(entry.hours * entry.hourlyRate));
    }
    if (includeBillableColumn) {
      row.push(entry.billable ? 'Da' : 'Nu');
    }
    lines.push(row.join('\t'));
  }

  // Empty row before totals
  lines.push('');

  // OPS-287: Subtotal row (only when discount applies)
  if (hasDiscount) {
    const subtotalRow: string[] = [];
    subtotalRow.push('');
    subtotalRow.push('Subtotal');
    if (showTeamMember) {
      subtotalRow.push('');
    }
    subtotalRow.push(formatHours(totalBillableHours));
    if (isHourly) {
      subtotalRow.push(formatCurrency(totalBillableCost));
    }
    if (includeBillableColumn) {
      subtotalRow.push('');
    }
    lines.push(subtotalRow.join('\t'));

    // Discount row
    const discountRow: string[] = [];
    discountRow.push('');
    discountRow.push('Discount');
    if (showTeamMember) {
      discountRow.push('');
    }
    discountRow.push('');
    if (isHourly) {
      discountRow.push(`-${formatCurrency(discount)}`);
    }
    if (includeBillableColumn) {
      discountRow.push('');
    }
    lines.push(discountRow.join('\t'));
  }

  // Totals row
  const totalRow: string[] = [];
  totalRow.push('');
  totalRow.push(hasDiscount ? 'TOTAL' : 'TOTAL');
  if (showTeamMember) {
    totalRow.push('');
  }
  totalRow.push(formatHours(totalBillableHours));
  if (isHourly) {
    totalRow.push(formatCurrency(displayTotal));
  }
  if (includeBillableColumn) {
    totalRow.push('');
  }
  lines.push(totalRow.join('\t'));

  return lines.join('\n');
}

/**
 * Copy timesheet data to clipboard
 * Returns true if successful, false otherwise
 */
export async function copyTimesheetToClipboard(
  data: TimesheetExportData,
  options: TimesheetExportOptions
): Promise<boolean> {
  try {
    const tsv = formatTimesheetAsTSV(data, options);
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
