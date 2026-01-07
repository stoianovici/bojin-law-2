'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PriorityBar, WorkflowStatusBadge } from '@/components/linear/StatusDot';
import type { WorkflowStatus } from '@/components/linear/StatusDot';
import { Calendar, Check } from 'lucide-react';

// ====================================================================
// TaskItem - Individual task row in the list
// ====================================================================

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'planned' | 'in-progress' | 'review' | 'completed';

const statusLabels: Record<TaskStatus, string> = {
  planned: 'Planificat',
  'in-progress': 'In lucru',
  review: 'Review',
  completed: 'Finalizat',
};

export interface TaskItemProps {
  /** Task ID */
  id: string;
  /** Task title */
  title: string;
  /** Task description/notes */
  description?: string;
  /** Case reference (e.g., "CAZ-2024-0156") */
  caseRef?: string;
  /** Case link URL */
  caseLink?: string;
  /** Priority level */
  priority: TaskPriority;
  /** Current status */
  status: TaskStatus;
  /** Due date label (e.g., "Maine", "30 Dec") */
  dueDate?: string;
  /** Whether due date is overdue */
  isOverdue?: boolean;
  /** Assignee initials */
  assigneeInitials?: string;
  /** Assignee avatar color (gradient or solid) */
  assigneeColor?: string;
  /** Whether the task is completed */
  isCompleted?: boolean;
  /** Whether this task is currently selected */
  isSelected?: boolean;
  /** Callback when task is clicked */
  onClick?: () => void;
  /** Callback when checkbox is clicked */
  onToggleComplete?: () => void;
}

/**
 * TaskItem renders a task row matching the mockup:
 * - Checkbox + priority bar
 * - Title + meta (case ref, description)
 * - Status badge + due date + assignee avatar
 */
export function TaskItem({
  id: _id,
  title,
  description,
  caseRef,
  caseLink,
  priority,
  status,
  dueDate,
  isOverdue,
  assigneeInitials,
  assigneeColor = 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  isCompleted,
  isSelected,
  onClick,
  onToggleComplete,
}: TaskItemProps) {
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.();
  };

  const handleCaseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Map TaskStatus to WorkflowStatus for the badge
  const workflowStatus: WorkflowStatus = status === 'in-progress' ? 'in-progress' : status;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-transparent bg-linear-bg-secondary px-4 py-3 transition-all cursor-pointer',
        'hover:bg-linear-bg-hover',
        isSelected && 'border-linear-accent bg-linear-bg-elevated'
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={handleCheckboxClick}
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-all',
          isCompleted
            ? 'border-linear-success bg-linear-success'
            : 'border-linear-border-default hover:border-linear-accent'
        )}
        aria-label={isCompleted ? 'Marcheaza ca nefinalizat' : 'Marcheaza ca finalizat'}
      >
        {isCompleted && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>

      {/* Priority Bar */}
      <PriorityBar priority={priority} size="md" className="flex-shrink-0" />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'mb-1 text-[14px] font-medium leading-tight',
            isCompleted ? 'text-linear-text-muted line-through' : 'text-linear-text-primary'
          )}
        >
          {title}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {caseRef && (
            <a
              href={caseLink || '#'}
              onClick={handleCaseClick}
              className="text-linear-accent hover:underline"
            >
              {caseRef}
            </a>
          )}
          {caseRef && description && <span className="text-linear-text-muted">•</span>}
          {description && (
            <span className="text-linear-text-tertiary line-clamp-1">{description}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {/* Status Badge */}
        <WorkflowStatusBadge status={workflowStatus}>{statusLabels[status]}</WorkflowStatusBadge>

        {/* Due Date */}
        {dueDate && (
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs',
              isOverdue ? 'text-linear-error' : 'text-linear-text-secondary'
            )}
          >
            <Calendar
              className={cn(
                'h-3.5 w-3.5',
                isOverdue ? 'text-linear-error' : 'text-linear-text-tertiary'
              )}
            />
            {dueDate}
          </span>
        )}

        {/* Assignee Avatar */}
        {assigneeInitials && (
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: assigneeColor }}
          >
            {assigneeInitials}
          </div>
        )}
      </div>
    </div>
  );
}
