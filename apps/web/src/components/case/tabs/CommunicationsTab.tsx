/**
 * CommunicationsTab - Shows unified communication timeline for a case
 *
 * OPS-037: Read-only view of all firm users' communications for a case.
 * - No compose, reply, or action buttons (actions happen in /communications)
 * - Shows ALL firm users' emails for this case
 * - AI summary panel at top
 * - Proper HTML email rendering with infinite scroll
 */

'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { UnifiedTimeline } from '../../communication/UnifiedTimeline';
import { CaseConversationSummaryPanel } from '../../communication/CaseConversationSummaryPanel';

export interface CommunicationsTabProps {
  caseId?: string;
  className?: string;
}

/**
 * CommunicationsTab Component
 *
 * Read-only view of all firm users' communications for a case.
 * Users who want to take action go to /communications (their personal workspace).
 */
export function CommunicationsTab({ caseId, className }: CommunicationsTabProps) {
  const [isAISummaryExpanded, setIsAISummaryExpanded] = useState(false);

  if (!caseId) {
    return (
      <div className={clsx('flex items-center justify-center h-full bg-white p-8', className)}>
        <p className="text-gray-500">Selectați un dosar pentru a vedea comunicările.</p>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700">Comunicări</h3>
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

      {/* Timeline (read-only, no composer) */}
      <div className="flex-1 p-4 overflow-hidden">
        <UnifiedTimeline
          caseId={caseId}
          showFilters={true}
          showComposer={false}
          readOnly={true}
          className="h-full"
        />
      </div>
    </div>
  );
}

CommunicationsTab.displayName = 'CommunicationsTab';
