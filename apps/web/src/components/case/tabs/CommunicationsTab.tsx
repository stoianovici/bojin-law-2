/**
 * CommunicationsTab - Shows unified communication timeline for a case
 *
 * Redesigned to use UnifiedTimeline component for full feature parity
 * with the main /communications page, including:
 * - Proper HTML email rendering
 * - Internal note composer with privacy controls
 * - Advanced filtering (channel, date, direction)
 * - Infinite scroll
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import { UnifiedTimeline } from '../../communication/UnifiedTimeline';

export interface CommunicationsTabProps {
  caseId?: string;
  className?: string;
}

/**
 * CommunicationsTab Component
 *
 * Displays the unified timeline for case communications.
 * Requires a caseId to function properly.
 */
export function CommunicationsTab({ caseId, className }: CommunicationsTabProps) {
  if (!caseId) {
    return (
      <div className={clsx('flex items-center justify-center h-full bg-white p-8', className)}>
        <p className="text-gray-500">Selectați un dosar pentru a vedea comunicările.</p>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full bg-white p-4', className)}>
      <UnifiedTimeline caseId={caseId} showFilters={true} showComposer={true} className="flex-1" />
    </div>
  );
}

CommunicationsTab.displayName = 'CommunicationsTab';
