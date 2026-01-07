'use client';

import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThreadItem } from './ThreadItem';
import type { CaseWithThreads } from '@/types/email';

interface CaseAccordionProps {
  caseData: CaseWithThreads;
  isExpanded: boolean;
  selectedThreadId: string | null;
  onToggle: () => void;
  onSelectThread: (conversationId: string, caseId: string) => void;
}

export function CaseAccordion({
  caseData,
  isExpanded,
  selectedThreadId,
  onToggle,
  onSelectThread,
}: CaseAccordionProps) {
  const hasUnread = caseData.unreadCount > 0;

  return (
    <div className="border-b border-linear-border-subtle">
      {/* Case Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors',
          'hover:bg-linear-bg-hover'
        )}
        onClick={onToggle}
      >
        {/* Expand/Collapse Icon */}
        <span className="text-linear-text-tertiary">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        {/* Case Icon */}
        <div className="w-6 h-6 flex items-center justify-center rounded bg-linear-accent text-white text-xs font-medium">
          <Folder className="h-3.5 w-3.5" />
        </div>

        {/* Case Info - Title first, number second */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm line-clamp-1',
              hasUnread
                ? 'font-semibold text-linear-text-primary'
                : 'font-medium text-linear-text-primary'
            )}
          >
            {caseData.title}
          </div>
          <div className="text-xs text-linear-text-tertiary">{caseData.caseNumber}</div>
        </div>

        {/* Thread Count Badge */}
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            hasUnread
              ? 'bg-linear-accent/15 text-linear-accent font-medium'
              : 'bg-linear-bg-tertiary text-linear-text-tertiary'
          )}
        >
          {caseData.totalCount}
        </span>
      </div>

      {/* Thread List (when expanded) */}
      {isExpanded && caseData.threads.length > 0 && (
        <div className="bg-linear-bg-elevated">
          {caseData.threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={selectedThreadId === thread.conversationId}
              onClick={() => onSelectThread(thread.conversationId, caseData.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state when expanded but no threads */}
      {isExpanded && caseData.threads.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-linear-text-tertiary bg-linear-bg-elevated">
          Nu există emailuri în acest dosar.
        </div>
      )}
    </div>
  );
}
