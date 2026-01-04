'use client';

/**
 * TimesheetExport Component
 * OPS-278: Export buttons for timesheet (PDF and clipboard)
 *
 * Provides:
 * - "Exporta PDF" primary button - generates and downloads PDF
 * - "Copiaza" secondary button - copies TSV to clipboard
 * - Toast notifications for success/error feedback
 */

import { useState, useCallback } from 'react';
import { FileDown, Copy, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore } from '../../stores/notificationStore';
import type { TimesheetEntry, TimesheetCase } from '../../hooks/useTimesheetData';

// ============================================================================
// Types
// ============================================================================

export interface TimesheetExportProps {
  entries: TimesheetEntry[];
  caseData: TimesheetCase;
  totalHours: number;
  totalBillableHours: number;
  totalCost: number;
  totalBillableCost: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
  showTeamMember: boolean;
  // OPS-287: Discount props
  discount?: number;
  finalTotal?: number;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TimesheetExport({
  entries,
  caseData,
  totalHours,
  totalBillableHours,
  totalCost,
  totalBillableCost,
  period,
  showTeamMember,
  discount = 0,
  finalTotal,
  className,
}: TimesheetExportProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const { addNotification } = useNotificationStore();

  const exportData = {
    entries,
    case: caseData,
    totalHours,
    totalBillableHours,
    totalCost,
    totalBillableCost,
    period,
    // OPS-287: Discount for export
    discount,
    finalTotal: finalTotal ?? totalBillableCost,
  };

  const handleExportPDF = useCallback(async () => {
    if (isExportingPDF) return;

    setIsExportingPDF(true);
    try {
      // Dynamic import to avoid SSR issues with @react-pdf/renderer
      const { downloadTimesheetPDF } = await import('../../utils/timesheet-pdf');
      const success = await downloadTimesheetPDF(exportData, { showTeamMember });

      if (success) {
        addNotification({ type: 'success', title: 'PDF generat cu succes' });
      } else {
        addNotification({ type: 'error', title: 'Eroare la generarea PDF' });
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      addNotification({ type: 'error', title: 'Eroare la generarea PDF' });
    } finally {
      setIsExportingPDF(false);
    }
  }, [exportData, showTeamMember, isExportingPDF, addNotification]);

  const handleCopyToClipboard = useCallback(async () => {
    if (isCopying) return;

    setIsCopying(true);
    try {
      const { copyTimesheetToClipboard } = await import('../../utils/timesheet-clipboard');
      const success = await copyTimesheetToClipboard(exportData, {
        showTeamMember,
        includeBillableColumn: true,
      });

      if (success) {
        setJustCopied(true);
        addNotification({ type: 'success', title: 'Copiat in clipboard' });
        setTimeout(() => setJustCopied(false), 2000);
      } else {
        addNotification({ type: 'error', title: 'Eroare la copiere' });
      }
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      addNotification({ type: 'error', title: 'Eroare la copiere' });
    } finally {
      setIsCopying(false);
    }
  }, [exportData, showTeamMember, isCopying, addNotification]);

  const hasEntries = entries.length > 0;

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {/* PDF Export Button */}
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={isExportingPDF || !hasEntries}
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
          'bg-amber-500 text-white hover:bg-amber-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2'
        )}
      >
        {isExportingPDF ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>Exporta PDF</span>
      </button>

      {/* Clipboard Copy Button */}
      <button
        type="button"
        onClick={handleCopyToClipboard}
        disabled={isCopying || !hasEntries}
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
          'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
          justCopied && 'border-green-500 bg-green-50 text-green-700'
        )}
      >
        {isCopying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : justCopied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span>{justCopied ? 'Copiat' : 'Copiaza'}</span>
      </button>
    </div>
  );
}

TimesheetExport.displayName = 'TimesheetExport';

export default TimesheetExport;
