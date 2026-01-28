'use client';

/**
 * TaskRow Component
 * Displays a single task in the hierarchical list
 *
 * Features:
 * - Status icon (✓ completed, → in progress, ○ not started)
 * - Title with truncation
 * - Warning badge if stuck
 * - Estimated hours
 */

import { clsx } from 'clsx';
import { Check, ArrowRight, Circle, AlertTriangle } from 'lucide-react';
import type { OverviewTask, TaskStatusType } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

export interface TaskRowProps {
  task: OverviewTask;
  isLast?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: TaskStatusType) {
  switch (status) {
    case 'Completed':
      return <Check className="h-3.5 w-3.5 text-linear-success" />;
    case 'InProgress':
      return <ArrowRight className="h-3.5 w-3.5 text-linear-accent" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-linear-text-muted" />;
  }
}

function formatHours(hours: number | null): string {
  if (hours === null) return '';
  if (hours === 1) return '1h';
  return `${hours}h`;
}

// ============================================================================
// Component
// ============================================================================

export function TaskRow({ task, isLast = false, className }: TaskRowProps) {
  return (
    <div className={clsx('flex items-center gap-2 py-1.5 pl-12 pr-4', 'text-sm', className)}>
      {/* Tree connector */}
      <span className="text-linear-text-muted text-xs w-4 flex-shrink-0">
        {isLast ? '└─' : '├─'}
      </span>

      {/* Status icon */}
      <span className="flex-shrink-0 w-4 flex items-center justify-center">
        {getStatusIcon(task.status)}
      </span>

      {/* Title */}
      <span
        className={clsx(
          'flex-1 truncate',
          task.status === 'Completed' ? 'text-linear-text-secondary' : 'text-linear-text-primary'
        )}
      >
        {task.title}
      </span>

      {/* Warning badge if stuck */}
      {task.isStuck && task.stuckMessage && (
        <span className="flex items-center gap-1 text-xs text-linear-warning flex-shrink-0">
          <AlertTriangle className="h-3 w-3" />
          <span className="hidden sm:inline">{task.stuckMessage}</span>
        </span>
      )}

      {/* Estimated hours */}
      {task.estimatedHours !== null && (
        <span className="text-xs text-linear-text-muted flex-shrink-0 w-8 text-right">
          {formatHours(task.estimatedHours)}
        </span>
      )}
    </div>
  );
}

TaskRow.displayName = 'TaskRow';

export default TaskRow;
