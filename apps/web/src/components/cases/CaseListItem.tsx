'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Case } from './index';

interface CaseListItemProps {
  caseData: Case;
  isSelected: boolean;
  onClick: () => void;
  /** Whether to indent the item (when nested within a client group) */
  indented?: boolean;
}

// Status to dot color mapping
const statusDotColors: Record<string, string> = {
  Active: 'bg-[#22C55E]', // success green
  PendingApproval: 'bg-[#F59E0B]', // warning yellow
  OnHold: 'bg-[#666666]', // tertiary gray
  Closed: 'bg-[#666666]',
  Archived: 'bg-[#444444]',
};

export function CaseListItem({
  caseData,
  isSelected,
  onClick,
  indented = false,
}: CaseListItemProps) {
  // Find team lead
  const teamLead = caseData.teamMembers.find((m) => m.role === 'Lead');
  const teamMemberCount = caseData.teamMembers.length;

  // Format date - simple relative date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Azi';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ieri';
    } else {
      return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
    }
  };

  return (
    <div
      className={cn(
        'py-3 border-b border-[rgba(255,255,255,0.06)] cursor-pointer transition-colors',
        indented ? 'pl-10 pr-6' : 'px-6 py-4',
        isSelected ? 'bg-[#2A2A2A] border-l-2 border-l-[#6366F1]' : 'hover:bg-[#222222]'
      )}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            statusDotColors[caseData.status] || 'bg-[#666666]'
          )}
        />
        {caseData.referenceNumbers?.[0] && (
          <span className="text-xs font-mono text-[#6366F1]">{caseData.referenceNumbers[0]}</span>
        )}
        <span className="ml-auto text-xs text-[#666666]">{formatDate(caseData.openedDate)}</span>
      </div>

      {/* Title */}
      <div className="text-sm font-light text-[#FAFAFA] mb-1">{caseData.title}</div>

      {/* Client - hide when indented since parent shows client name */}
      {!indented && <div className="text-[13px] text-[#666666]">{caseData.client.name}</div>}

      {/* Team Lead and Team Member Count */}
      <div className="flex items-center justify-between mt-2">
        {teamLead ? (
          <div className="text-[12px] text-[#888888]">
            Lead: {teamLead.user.firstName} {teamLead.user.lastName}
          </div>
        ) : (
          <div className="text-[12px] text-[#555555] italic">Fara lead</div>
        )}
        {teamMemberCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[#888888]">
            <Users className="h-3 w-3" />
            {teamMemberCount}
          </div>
        )}
      </div>

      {/* Tags */}
      {caseData.type && (
        <div className="flex gap-2 mt-2.5">
          <span className="text-[11px] px-2 py-0.5 rounded bg-[rgba(99,102,241,0.15)] text-[#6366F1]">
            {caseData.type}
          </span>
        </div>
      )}
    </div>
  );
}

export default CaseListItem;
