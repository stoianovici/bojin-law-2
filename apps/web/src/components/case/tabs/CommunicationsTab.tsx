/**
 * CommunicationsTab - Shows unified communication timeline for a case
 *
 * Redesigned to use UnifiedTimeline component for full feature parity
 * with the main /communications page, including:
 * - Proper HTML email rendering
 * - Internal note composer with privacy controls
 * - Advanced filtering (channel, date, direction)
 * - Infinite scroll
 * - Email import wizard (OPS-022)
 */

'use client';

import React, { useCallback } from 'react';
import { clsx } from 'clsx';
import { UnifiedTimeline } from '../../communication/UnifiedTimeline';
import { EmailImportWizard } from '../EmailImportWizard';

export interface CommunicationsTabProps {
  caseId?: string;
  caseTitle?: string;
  className?: string;
}

/**
 * CommunicationsTab Component
 *
 * Displays the unified timeline for case communications.
 * Requires a caseId to function properly.
 */
export function CommunicationsTab({ caseId, caseTitle, className }: CommunicationsTabProps) {
  // Callback to refresh timeline after email import
  const handleImportSuccess = useCallback(() => {
    // The UnifiedTimeline will auto-refresh when emails are linked to case
    // This callback can be used for additional UI feedback if needed
  }, []);

  if (!caseId) {
    return (
      <div className={clsx('flex items-center justify-center h-full bg-white p-8', className)}>
        <p className="text-gray-500">Selectați un dosar pentru a vedea comunicările.</p>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700">Comunicări</h3>
        <div className="flex items-center gap-2">
          <EmailImportWizard
            caseId={caseId}
            caseTitle={caseTitle}
            onSuccess={handleImportSuccess}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 p-4 overflow-hidden">
        <UnifiedTimeline
          caseId={caseId}
          showFilters={true}
          showComposer={true}
          className="h-full"
        />
      </div>
    </div>
  );
}

CommunicationsTab.displayName = 'CommunicationsTab';
