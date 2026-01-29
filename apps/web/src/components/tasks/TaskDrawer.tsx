'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Check,
  User,
  MoreHorizontal,
  X,
  Plus,
  Clock,
  Briefcase,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { SubtaskModal } from '@/components/forms/SubtaskModal';

// Types
export interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TaskCase {
  id: string;
  caseNumber: string;
  title: string;
  referenceNumbers?: string[];
}

// Simple subtask for backward compatibility
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

// Full subtask with all task properties
export interface FullSubtask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedDuration?: number;
  assignee?: Assignee;
}

export interface Activity {
  id: string;
  type: 'status_change' | 'comment' | 'subtask_completed' | 'created' | 'assigned';
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
  timestamp: string;
  content?: string;
  oldValue?: string;
  newValue?: string;
}

export interface TaskDetail {
  id: string;
  title: string;
  status: string; // In lucru, Planificat, Review, Finalizat
  priority: string; // urgent, high, medium, low
  assignee: Assignee;
  dueDate: string;
  estimatedDuration?: string; // e.g. "3h", "2 ore"
  case?: TaskCase;
  subtasks: Subtask[];
  fullSubtasks?: FullSubtask[]; // Full subtask data when available
  activities: Activity[];
}

export interface TaskDrawerProps {
  task: TaskDetail | null;
  onClose: () => void;
  onTaskClick?: (taskId: string) => void;
  onSubtaskClick?: (subtaskId: string) => void;
  onSubtaskToggle?: (subtaskId: string, completed: boolean) => void;
  onSubtaskComplete?: (subtaskId: string) => void;
  onAddSubtask?: () => void;
  onMarkComplete?: () => void;
  onAssign?: () => void;
  onSubtaskCreated?: () => void;
  /** Set of subtask IDs that are optimistically completed (for immediate UI feedback) */
  optimisticCompletedIds?: Set<string>;
}

// Status configuration
const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'info' | 'warning' | 'success' }
> = {
  planificat: { label: 'Planificat', variant: 'default' },
  in_lucru: { label: 'In lucru', variant: 'info' },
  'in lucru': { label: 'In lucru', variant: 'info' },
  review: { label: 'Review', variant: 'warning' },
  finalizat: { label: 'Finalizat', variant: 'success' },
};

// Priority configuration
const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500' },
  high: { label: 'Ridicata', color: 'bg-amber-500' },
  medium: { label: 'Medie', color: 'bg-blue-500' },
  low: { label: 'Scazuta', color: 'bg-linear-text-muted' },
};

// Activity type labels
const activityLabels: Record<Activity['type'], string> = {
  status_change: 'a schimbat statusul',
  comment: 'a adaugat comentariu',
  subtask_completed: 'a finalizat subtask-ul',
  created: 'a creat sarcina',
  assigned: 'a atribuit sarcina',
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getStatusConfig(status: string) {
  const normalized = status.toLowerCase().trim();
  return statusConfig[normalized] || { label: status, variant: 'default' as const };
}

function getPriorityConfig(priority: string) {
  const normalized = priority.toLowerCase().trim();
  return priorityConfig[normalized] || { label: priority, color: 'bg-linear-text-muted' };
}

// Helper to format duration
function formatDuration(hours?: number): string {
  if (!hours) return '';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours === 1) return '1 hour';
  if (hours < 8) return `${hours} hours`;
  if (hours === 8) return '1 day';
  return `${Math.round(hours / 8)} days`;
}

// Calculate progress percentage
function calculateProgress(subtasks: Subtask[] | FullSubtask[], useFullSubtasks: boolean): number {
  if (subtasks.length === 0) return 0;

  if (useFullSubtasks) {
    const full = subtasks as FullSubtask[];
    const completed = full.filter((s) => s.status.toLowerCase() === 'finalizat').length;
    return Math.round((completed / full.length) * 100);
  }

  const simple = subtasks as Subtask[];
  const completed = simple.filter((s) => s.completed).length;
  return Math.round((completed / simple.length) * 100);
}

export function TaskDrawer({
  task,
  onClose,
  onTaskClick,
  onSubtaskClick,
  onSubtaskToggle,
  onSubtaskComplete,
  onAddSubtask,
  onMarkComplete,
  onAssign,
  onSubtaskCreated,
  optimisticCompletedIds,
}: TaskDrawerProps) {
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);

  if (!task) {
    return null;
  }

  const statusConf = getStatusConfig(task.status);
  const priorityConf = getPriorityConfig(task.priority);

  // Use full subtasks if available, otherwise fall back to simple subtasks
  const hasFullSubtasks = task.fullSubtasks && task.fullSubtasks.length > 0;
  const displaySubtasks = hasFullSubtasks ? task.fullSubtasks! : task.subtasks;
  const totalSubtasks = displaySubtasks.length;

  const completedSubtasks = hasFullSubtasks
    ? task.fullSubtasks!.filter((s) => s.status.toLowerCase() === 'finalizat').length
    : task.subtasks.filter((s) => s.completed).length;

  const progressPercent = calculateProgress(displaySubtasks, !!hasFullSubtasks);

  const handleAddSubtask = () => {
    if (onAddSubtask) {
      onAddSubtask();
    } else {
      setSubtaskModalOpen(true);
    }
  };

  const handleSubtaskCreated = () => {
    setSubtaskModalOpen(false);
    onSubtaskCreated?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-linear-border-subtle px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkComplete}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Marcheaza finalizat"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onAssign}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Atribuie"
          >
            <User className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Mai multe"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
          title="Inchide"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-5">
          {/* Title */}
          <h2 className="mb-4 text-lg font-normal leading-[1.4] text-linear-text-primary">
            {task.title}
          </h2>

          {/* Properties */}
          <div className="mb-6 flex flex-col gap-3 border-b border-linear-border-subtle pb-6">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Status</span>
              <div className="flex flex-1 items-center gap-2">
                <Badge variant={statusConf.variant} size="sm">
                  {statusConf.label}
                </Badge>
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">
                Prioritate
              </span>
              <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', priorityConf.color)} />
                <span>{priorityConf.label}</span>
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">
                Responsabil
              </span>
              <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                <Avatar size="xs" name={`${task.assignee.firstName} ${task.assignee.lastName}`} />
                <span>
                  {task.assignee.firstName} {task.assignee.lastName}
                </span>
              </div>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Scadenta</span>
              <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                <Calendar className="h-4 w-4 text-linear-text-tertiary" />
                <span>{task.dueDate}</span>
              </div>
            </div>

            {/* Estimated Duration */}
            {task.estimatedDuration && (
              <div className="flex items-center gap-3">
                <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">
                  Durata est.
                </span>
                <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                  <Clock className="h-4 w-4 text-linear-text-tertiary" />
                  <span>{task.estimatedDuration}</span>
                </div>
              </div>
            )}

            {/* Case */}
            {task.case && (
              <div className="flex items-center gap-3">
                <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Caz</span>
                <div className="flex flex-1 items-center gap-2 text-[13px]">
                  <Briefcase className="h-4 w-4 text-linear-text-tertiary" />
                  {task.case.referenceNumbers?.[0] && (
                    <span
                      className="cursor-pointer text-linear-accent hover:underline"
                      onClick={() => onTaskClick?.(task.case!.id)}
                    >
                      {task.case.referenceNumbers[0]}
                    </span>
                  )}
                  <span
                    className={
                      task.case.referenceNumbers?.[0]
                        ? 'text-linear-text-tertiary'
                        : 'cursor-pointer text-linear-accent hover:underline'
                    }
                    onClick={
                      !task.case.referenceNumbers?.[0]
                        ? () => onTaskClick?.(task.case!.id)
                        : undefined
                    }
                  >
                    {task.case.title}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Subtasks Section */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-normal uppercase tracking-[0.5px] text-linear-text-tertiary">
                Subtask-uri
              </span>
              {totalSubtasks > 0 && (
                <span className="text-[11px] text-linear-text-muted">
                  {completedSubtasks}/{totalSubtasks} complete
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {totalSubtasks > 0 && (
              <div className="mb-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-linear-bg-tertiary">
                  <div
                    className="h-full rounded-full bg-linear-accent transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* Full Subtask Cards (when fullSubtasks available) */}
              {hasFullSubtasks &&
                task.fullSubtasks!.map((subtask) => {
                  const subtaskStatus = getStatusConfig(subtask.status);
                  const subtaskPriority = getPriorityConfig(subtask.priority);
                  // Check both server status and optimistic state for immediate feedback
                  const isCompleted =
                    subtask.status.toLowerCase() === 'finalizat' ||
                    optimisticCompletedIds?.has(subtask.id) === true;

                  return (
                    <div
                      key={subtask.id}
                      className={cn(
                        'group cursor-pointer rounded-md border border-linear-border-subtle bg-linear-bg-tertiary p-3 transition-colors hover:bg-linear-bg-hover',
                        isCompleted && 'opacity-60'
                      )}
                      onClick={() => onSubtaskClick?.(subtask.id)}
                    >
                      {/* Title row */}
                      <div className="mb-2 flex items-start gap-2">
                        {/* Completion checkbox */}
                        {onSubtaskComplete ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSubtaskComplete(subtask.id);
                            }}
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                              isCompleted
                                ? 'border-linear-accent bg-linear-accent'
                                : 'border-linear-border-strong bg-transparent hover:border-linear-accent'
                            )}
                            title={isCompleted ? 'Marcheaza nefinalizat' : 'Marcheaza finalizat'}
                          >
                            {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                          </button>
                        ) : (
                          <div
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                              isCompleted
                                ? 'border-linear-accent bg-linear-accent'
                                : 'border-linear-border-strong bg-transparent'
                            )}
                          >
                            {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        )}
                        <span
                          className={cn(
                            'flex-1 text-[13px] font-normal leading-snug',
                            isCompleted
                              ? 'text-linear-text-tertiary line-through'
                              : 'text-linear-text-primary'
                          )}
                        >
                          {subtask.title}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-linear-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        <Badge variant={subtaskStatus.variant} size="sm">
                          {subtaskStatus.label}
                        </Badge>

                        {/* Priority dot */}
                        <div className="flex items-center gap-1 text-[11px] text-linear-text-muted">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              subtaskPriority.color
                            )}
                          />
                          <span>{subtaskPriority.label}</span>
                        </div>

                        {/* Due date */}
                        {subtask.dueDate && (
                          <div className="flex items-center gap-1 text-[11px] text-linear-text-muted">
                            <Calendar className="h-3 w-3" />
                            <span>{subtask.dueDate}</span>
                          </div>
                        )}

                        {/* Estimated duration */}
                        {subtask.estimatedDuration && (
                          <div className="flex items-center gap-1 text-[11px] text-linear-text-muted">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(subtask.estimatedDuration)}</span>
                          </div>
                        )}

                        {/* Assignee avatar */}
                        {subtask.assignee && (
                          <Avatar
                            size="xs"
                            name={`${subtask.assignee.firstName} ${subtask.assignee.lastName}`}
                            className="ml-auto"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Simple Subtask Checkboxes (legacy fallback) */}
              {!hasFullSubtasks &&
                task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md bg-linear-bg-tertiary px-3 py-2 transition-colors hover:bg-linear-bg-hover',
                      subtask.completed && 'completed'
                    )}
                    onClick={() => onSubtaskToggle?.(subtask.id, !subtask.completed)}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                        subtask.completed
                          ? 'border-linear-accent bg-linear-accent'
                          : 'border-linear-border-strong bg-transparent'
                      )}
                    >
                      {subtask.completed && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span
                      className={cn(
                        'flex-1 text-[13px]',
                        subtask.completed
                          ? 'text-linear-text-tertiary line-through'
                          : 'text-linear-text-primary'
                      )}
                    >
                      {subtask.title}
                    </span>
                  </div>
                ))}

              {/* Add Subtask Button */}
              <button
                onClick={handleAddSubtask}
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-linear-text-tertiary transition-colors hover:text-linear-text-secondary"
              >
                <Plus className="h-3.5 w-3.5" />
                Adauga subtask
              </button>
            </div>
          </div>

          {/* Activity */}
          <div className="border-t border-linear-border-subtle pt-4">
            <div className="mb-3">
              <span className="text-xs font-normal uppercase tracking-[0.5px] text-linear-text-tertiary">
                Activitate
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {task.activities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <Avatar
                    size="xs"
                    name={`${activity.author.firstName} ${activity.author.lastName}`}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 text-[13px]">
                      <span className="font-normal text-linear-text-primary">
                        {activity.author.firstName} {activity.author.lastName}
                      </span>
                      <span className="text-linear-text-tertiary">
                        {activityLabels[activity.type]}
                      </span>
                      <span className="text-linear-text-muted">{activity.timestamp}</span>
                    </div>
                    {activity.type === 'status_change' &&
                      activity.oldValue &&
                      activity.newValue && (
                        <div className="mt-1 flex items-center gap-1.5 text-[13px]">
                          <span className="text-linear-text-muted">{activity.oldValue}</span>
                          <span className="text-linear-text-muted">→</span>
                          <span className="text-linear-text-primary">{activity.newValue}</span>
                        </div>
                      )}
                    {activity.type === 'comment' && activity.content && (
                      <div className="mt-1 text-[13px] text-linear-text-secondary">
                        {activity.content}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Subtask Modal */}
      {task.case && (
        <SubtaskModal
          open={subtaskModalOpen}
          onOpenChange={setSubtaskModalOpen}
          parentTask={{
            id: task.id,
            title: task.title,
            case: task.case,
            assignee: task.assignee,
          }}
          onSuccess={handleSubtaskCreated}
        />
      )}
    </div>
  );
}

export default TaskDrawer;
