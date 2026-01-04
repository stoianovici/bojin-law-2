'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/components/linear/CollapsibleSection';
import { TaskItem, type TaskPriority, type TaskStatus } from './TaskItem';

// ====================================================================
// TasksListView - Task list with collapsible sections
// ====================================================================

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  caseRef?: string;
  caseLink?: string;
  caseId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date | string;
  dueDateLabel?: string;
  isOverdue?: boolean;
  assigneeId?: string;
  assigneeInitials?: string;
  assigneeColor?: string;
  isCompleted?: boolean;
}

export interface TaskSection {
  id: string;
  title: string;
  tasks: TaskData[];
  defaultExpanded?: boolean;
}

export interface TasksListViewProps {
  /** Sections of tasks to display */
  sections: TaskSection[];
  /** Currently selected task ID */
  selectedTaskId?: string;
  /** Callback when a task is clicked */
  onTaskClick?: (task: TaskData) => void;
  /** Callback when a task's completion is toggled */
  onTaskToggle?: (taskId: string) => void;
  /** Loading state */
  loading?: boolean;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Format date to Romanian display format
 */
function formatDueDate(date: Date | string | undefined): { label: string; isOverdue: boolean } {
  if (!date) return { label: '', isOverdue: false };

  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const isOverdue = dateOnly < today;

  if (dateOnly.getTime() === today.getTime()) {
    return { label: 'Azi', isOverdue: false };
  }
  if (dateOnly.getTime() === tomorrow.getTime()) {
    return { label: 'Maine', isOverdue: false };
  }

  // Check if yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateOnly.getTime() === yesterday.getTime()) {
    return { label: 'Ieri', isOverdue: true };
  }

  // Format as "30 Dec"
  const day = d.getDate();
  const months = [
    'Ian',
    'Feb',
    'Mar',
    'Apr',
    'Mai',
    'Iun',
    'Iul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[d.getMonth()];

  return { label: `${day} ${month}`, isOverdue };
}

/**
 * TasksListView renders tasks in collapsible sections:
 * - Urgente (expanded by default)
 * - Aceasta saptamana (expanded by default)
 * - Finalizate recent (collapsed by default)
 */
export function TasksListView({
  sections,
  selectedTaskId,
  onTaskClick,
  onTaskToggle,
  loading,
  emptyState,
  className,
}: TasksListViewProps) {
  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-6 p-6', className)}>
        {Array.from({ length: 3 }).map((_, sectionIdx) => (
          <div key={sectionIdx}>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-linear-bg-tertiary" />
              <div className="h-3 w-24 animate-pulse rounded bg-linear-bg-tertiary" />
              <div className="h-4 w-6 animate-pulse rounded-full bg-linear-bg-tertiary" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: sectionIdx === 0 ? 2 : 3 }).map((_, taskIdx) => (
                <div
                  key={taskIdx}
                  className="flex items-center gap-3 rounded-lg bg-linear-bg-secondary p-4"
                >
                  <div className="h-[18px] w-[18px] animate-pulse rounded border bg-linear-bg-tertiary" />
                  <div className="h-10 w-[3px] animate-pulse rounded bg-linear-bg-tertiary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-linear-bg-tertiary" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-linear-bg-tertiary" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded-full bg-linear-bg-tertiary" />
                  <div className="h-6 w-12 animate-pulse rounded bg-linear-bg-tertiary" />
                  <div className="h-7 w-7 animate-pulse rounded-full bg-linear-bg-tertiary" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  const totalTasks = sections.reduce((sum, s) => sum + s.tasks.length, 0);
  if (totalTasks === 0) {
    if (emptyState) {
      return <div className={cn('p-6', className)}>{emptyState}</div>;
    }
    return (
      <div className={cn('flex flex-col items-center justify-center py-20', className)}>
        <div className="mb-4 text-linear-text-muted">
          <svg
            className="h-12 w-12 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <p className="text-sm text-linear-text-tertiary">Nicio sarcina de afisat</p>
      </div>
    );
  }

  return (
    <div className={cn('p-6', className)}>
      {sections.map((section) => {
        // Skip empty sections
        if (section.tasks.length === 0) return null;

        return (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            count={section.tasks.length}
            defaultExpanded={section.defaultExpanded ?? true}
          >
            <div className="space-y-1">
              {section.tasks.map((task) => {
                const dateInfo = formatDueDate(task.dueDate);
                return (
                  <TaskItem
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    description={task.description}
                    caseRef={task.caseRef}
                    caseLink={task.caseLink || (task.caseId ? `/cases/${task.caseId}` : undefined)}
                    priority={task.priority}
                    status={task.status}
                    dueDate={task.dueDateLabel || dateInfo.label}
                    isOverdue={task.isOverdue ?? dateInfo.isOverdue}
                    assigneeInitials={task.assigneeInitials}
                    assigneeColor={task.assigneeColor}
                    isCompleted={task.isCompleted}
                    isSelected={task.id === selectedTaskId}
                    onClick={() => onTaskClick?.(task)}
                    onToggleComplete={() => onTaskToggle?.(task.id)}
                  />
                );
              })}
            </div>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

// ====================================================================
// Utility: Group tasks by urgency/date
// ====================================================================

export function groupTasksByUrgency(tasks: TaskData[]): TaskSection[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

  const urgent: TaskData[] = [];
  const thisWeek: TaskData[] = [];
  const completed: TaskData[] = [];

  tasks.forEach((task) => {
    if (task.isCompleted || task.status === 'completed') {
      completed.push(task);
      return;
    }

    if (task.priority === 'urgent' || task.priority === 'high') {
      urgent.push(task);
      return;
    }

    if (task.dueDate) {
      const dueDate = typeof task.dueDate === 'string' ? new Date(task.dueDate) : task.dueDate;
      if (dueDate <= endOfWeek) {
        thisWeek.push(task);
        return;
      }
    }

    thisWeek.push(task);
  });

  return [
    { id: 'urgent', title: 'URGENTE', tasks: urgent, defaultExpanded: true },
    { id: 'this-week', title: 'ACEASTA SAPTAMANA', tasks: thisWeek, defaultExpanded: true },
    { id: 'completed', title: 'FINALIZATE RECENT', tasks: completed, defaultExpanded: false },
  ].filter((section) => section.tasks.length > 0);
}
