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

import React, { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { UnifiedTimeline } from '../../communication/UnifiedTimeline';
import { EmailImportWizard } from '../EmailImportWizard';
import { CaseConversationSummaryPanel } from '../../communication/CaseConversationSummaryPanel';

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
  const [isAISummaryExpanded, setIsAISummaryExpanded] = useState(false);

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

      {/* AI Thread Summary Section */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setIsAISummaryExpanded(!isAISummaryExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          aria-expanded={isAISummaryExpanded}
          aria-controls="ai-summary-panel"
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700">Rezumat AI Thread-uri</span>
          </div>
          {isAISummaryExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
          )}
        </button>
        {isAISummaryExpanded && (
          <div id="ai-summary-panel" className="px-4 pb-4">
            <CaseConversationSummaryPanel caseId={caseId} />
          </div>
        )}
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
