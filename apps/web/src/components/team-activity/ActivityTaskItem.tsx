'use client';

/**
 * ActivityTaskItem Component
 * Individual task row in team activity view
 *
 * Displays:
 * - Case name (linked)
 * - Task description
 * - Hours logged
 * - Completion time
 */

import Link from 'next/link';
import { Clock, FileText, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';
import type { ActivityEntry } from '../../hooks/useTeamActivity';

// ============================================================================
// Types
// ============================================================================

export interface ActivityTaskItemProps {
  entry: ActivityEntry;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHours(hours: number): string {
  if (hours === 0) return '-';
  if (hours === 1) return '1 oră';
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  return `${hours.toFixed(1)} ore`;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Component
// ============================================================================

export function ActivityTaskItem({ entry, className }: ActivityTaskItemProps) {
  const { task, hoursLogged, completedAt } = entry;

  return (
    <div
      className={clsx(
        'flex items-center gap-4 py-2.5 px-3',
        'border-b border-linear-border-subtle last:border-b-0',
        'hover:bg-linear-bg-tertiary/50 transition-colors',
        className
      )}
    >
      {/* Task icon */}
      <div className="flex-shrink-0">
        <FileText className="h-4 w-4 text-linear-text-muted" aria-hidden="true" />
      </div>

      {/* Case info */}
      <div className="flex-shrink-0 min-w-[120px] max-w-[200px]">
        <Link
          href={`/cases/${task.case.id}`}
          className="flex items-center gap-1.5 text-sm text-linear-text-secondary hover:text-linear-accent transition-colors"
        >
          <Briefcase className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate" title={task.case.title}>
            {task.case.referenceNumbers?.[0] || task.case.title}
          </span>
        </Link>
      </div>

      {/* Task title and description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-linear-text-primary truncate" title={task.title}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-linear-text-muted truncate mt-0.5" title={task.description}>
            {task.description}
          </p>
        )}
      </div>

      {/* Hours logged */}
      <div className="flex-shrink-0 flex items-center gap-1.5 text-sm">
        <Clock className="h-3.5 w-3.5 text-linear-text-muted" aria-hidden="true" />
        <span
          className={clsx(
            'font-medium',
            hoursLogged > 0 ? 'text-linear-text-primary' : 'text-linear-text-muted'
          )}
        >
          {formatHours(hoursLogged)}
        </span>
      </div>

      {/* Completion time */}
      <div className="flex-shrink-0 text-xs text-linear-text-muted w-12 text-right">
        {formatTime(completedAt)}
      </div>
    </div>
  );
}

ActivityTaskItem.displayName = 'ActivityTaskItem';

export default ActivityTaskItem;
