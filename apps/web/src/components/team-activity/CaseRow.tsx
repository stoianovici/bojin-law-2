'use client';

/**
 * CaseRow Component
 * Displays a case in the hierarchical list with expandable task list
 *
 * Features:
 * - Expandable row showing case details
 * - Progress bar based on hours (completed/in-progress/not-started)
 * - Hours summary
 * - Assignee initials
 * - Attention indicator
 * - Nested task list when expanded
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskRow } from './TaskRow';
import type { CaseProgress, AssignedUser } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

export interface CaseRowProps {
  caseProgress: CaseProgress;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getUserInitials(user: AssignedUser): string {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

// ============================================================================
// Progress Bar Component
// ============================================================================

interface ProgressBarProps {
  completed: number;
  inProgress: number;
  total: number;
}

function ProgressBar({ completed, inProgress, total }: ProgressBarProps) {
  if (total === 0) return null;

  const completedPercent = (completed / total) * 100;
  const inProgressPercent = (inProgress / total) * 100;

  return (
    <div className="h-1 w-20 bg-linear-bg-tertiary rounded-full overflow-hidden flex">
      {/* Completed segment */}
      <div className="h-full bg-linear-success" style={{ width: `${completedPercent}%` }} />
      {/* In-progress segment */}
      <div className="h-full bg-linear-accent" style={{ width: `${inProgressPercent}%` }} />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CaseRow({ caseProgress, className }: CaseRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { case: caseData, timeProgress, assignedUsers, attentionFlags, tasks } = caseProgress;
  const hasAttention = attentionFlags.length > 0;
  const primaryAssignee = assignedUsers[0];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={clsx(
            'w-full flex items-center gap-3 py-2 pl-8 pr-4',
            'text-left transition-colors',
            'hover:bg-linear-bg-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-inset'
          )}
        >
          {/* Expand chevron */}
          <ChevronRight
            className={clsx(
              'h-4 w-4 text-linear-text-muted transition-transform flex-shrink-0',
              isOpen && 'rotate-90'
            )}
          />

          {/* Case number */}
          <span className="text-sm font-medium text-linear-text-primary w-28 flex-shrink-0 truncate">
            {caseData.caseNumber}
          </span>

          {/* Case title */}
          <span className="text-sm text-linear-text-secondary flex-1 truncate min-w-0">
            {caseData.title}
          </span>

          {/* Progress bar */}
          <ProgressBar
            completed={timeProgress.completedHours}
            inProgress={timeProgress.inProgressHours}
            total={timeProgress.totalHours}
          />

          {/* Hours summary */}
          <span className="text-xs text-linear-text-muted w-16 text-right flex-shrink-0">
            {formatHours(timeProgress.completedHours)}/{formatHours(timeProgress.totalHours)}
          </span>

          {/* Primary assignee initials */}
          {primaryAssignee && (
            <span
              className="h-6 w-6 rounded-full bg-linear-accent/20 flex items-center justify-center flex-shrink-0"
              title={
                `${primaryAssignee.firstName} ${primaryAssignee.lastName}`.trim() ||
                primaryAssignee.email
              }
            >
              <span className="text-[10px] font-medium text-linear-accent">
                {getUserInitials(primaryAssignee)}
              </span>
            </span>
          )}

          {/* Attention indicator */}
          {hasAttention && <AlertTriangle className="h-4 w-4 text-linear-warning flex-shrink-0" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-linear-bg-secondary/50">
          {tasks.length > 0 ? (
            tasks.map((task, index) => (
              <TaskRow key={task.id} task={task} isLast={index === tasks.length - 1} />
            ))
          ) : (
            <div className="py-2 pl-16 pr-4 text-sm text-linear-text-muted">Nicio sarcină</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

CaseRow.displayName = 'CaseRow';

export default CaseRow;
