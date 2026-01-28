'use client';

/**
 * CaseProgressCard Component
 * Displays a single case's progress with expandable details
 *
 * Features:
 * - Collapsed view with case info, progress bar, stats, team avatars
 * - Expanded view with task list, doc list, recent activity (placeholders)
 * - Attention badges for items needing action
 * - Click-to-expand functionality using Radix Collapsible
 */

import { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AttentionBadge } from './AttentionBadge';
import type { CaseProgress, AttentionType } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

export interface CaseProgressCardProps {
  caseProgress: CaseProgress;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getUserInitials(user: { firstName: string; lastName: string; email: string }): string {
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

function getProgressPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function formatRelativeTime(dateString: string | null): string | null {
  if (!dateString) return null;
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ro });
  } catch {
    return null;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

interface AvatarStackProps {
  users: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  maxVisible?: number;
}

function AvatarStack({ users, maxVisible = 3 }: AvatarStackProps) {
  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user) => (
        <div
          key={user.id}
          className="h-7 w-7 rounded-full bg-linear-accent/20 flex items-center justify-center border-2 border-linear-bg-secondary"
          title={`${user.firstName} ${user.lastName}`.trim() || user.email}
        >
          <span className="text-xs font-medium text-linear-accent">{getUserInitials(user)}</span>
        </div>
      ))}
      {overflowCount > 0 && (
        <div className="h-7 w-7 rounded-full bg-linear-bg-tertiary flex items-center justify-center border-2 border-linear-bg-secondary">
          <span className="text-xs font-medium text-linear-text-secondary">+{overflowCount}</span>
        </div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  completed: number;
  total: number;
}

function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = getProgressPercentage(completed, total);

  return (
    <div className="h-1.5 w-full bg-linear-bg-tertiary rounded-full overflow-hidden">
      <div
        className="h-full bg-linear-accent transition-all duration-300"
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percentage}% completat`}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CaseProgressCard({ caseProgress, className }: CaseProgressCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const {
    case: caseData,
    taskStats,
    docStats,
    assignedUsers,
    lastActivity,
    attentionFlags,
  } = caseProgress;

  const relativeTime = formatRelativeTime(lastActivity);
  const firstAttentionFlag = attentionFlags.length > 0 ? attentionFlags[0] : null;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={clsx(
        'rounded-lg border border-linear-border-subtle bg-linear-bg-secondary overflow-hidden',
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={clsx(
            'w-full p-4 text-left transition-colors',
            'hover:bg-linear-bg-tertiary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-inset'
          )}
        >
          {/* Header: Case number + Client name */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium text-linear-text-primary truncate">
                {caseData.caseNumber}
              </span>
              {caseData.client && (
                <span className="text-sm text-linear-text-secondary truncate">
                  {caseData.client.name}
                </span>
              )}
            </div>
            <ChevronDown
              className={clsx(
                'h-5 w-5 text-linear-text-muted transition-transform duration-200 flex-shrink-0',
                isOpen && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <ProgressBar completed={taskStats.completed} total={taskStats.total} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-linear-text-secondary mb-3">
            <span>{taskStats.inProgress} în progres</span>
            <span>
              {docStats.total} docs{' '}
              {docStats.drafts > 0 && (
                <span className="text-linear-text-muted">({docStats.drafts} ciornă)</span>
              )}
            </span>
          </div>

          {/* Team row */}
          <div className="flex items-center justify-between">
            <AvatarStack users={assignedUsers} maxVisible={3} />

            {/* Footer: Relative time OR first attention badge */}
            <div className="flex items-center">
              {firstAttentionFlag ? (
                <AttentionBadge
                  type={firstAttentionFlag.type as AttentionType}
                  message={firstAttentionFlag.message}
                  severity={firstAttentionFlag.severity}
                />
              ) : relativeTime ? (
                <span className="text-xs text-linear-text-muted">{relativeTime}</span>
              ) : null}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-linear-border-subtle p-4 space-y-4">
          {/* Task list placeholder */}
          <div>
            <h4 className="text-sm font-medium text-linear-text-primary mb-2">Sarcini</h4>
            <div className="bg-linear-bg-tertiary rounded-md p-3 text-sm text-linear-text-muted">
              Lista sarcinilor în progres și recent completate
            </div>
          </div>

          {/* Doc list placeholder */}
          <div>
            <h4 className="text-sm font-medium text-linear-text-primary mb-2">Documente</h4>
            <div className="bg-linear-bg-tertiary rounded-md p-3 text-sm text-linear-text-muted">
              Lista documentelor cu status
            </div>
          </div>

          {/* Recent activity placeholder */}
          <div>
            <h4 className="text-sm font-medium text-linear-text-primary mb-2">
              Activitate recentă
            </h4>
            <div className="bg-linear-bg-tertiary rounded-md p-3 text-sm text-linear-text-muted">
              Evenimente recente pentru acest caz
            </div>
          </div>

          {/* Show all attention flags if more than one */}
          {attentionFlags.length > 1 && (
            <div>
              <h4 className="text-sm font-medium text-linear-text-primary mb-2">
                Atenție necesară
              </h4>
              <div className="flex flex-wrap gap-2">
                {attentionFlags.map((flag, index) => (
                  <AttentionBadge
                    key={`${flag.type}-${flag.relatedId || index}`}
                    type={flag.type as AttentionType}
                    message={flag.message}
                    severity={flag.severity}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

CaseProgressCard.displayName = 'CaseProgressCard';

export default CaseProgressCard;
