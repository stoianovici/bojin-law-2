'use client';

import * as React from 'react';
import { AlertTriangle, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

// ============================================================================
// TYPES
// ============================================================================

export interface UrgentTask {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  estimatedDuration?: string;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  case?: {
    id: string;
    caseNumber: string;
    title: string;
    referenceNumbers?: string[];
  };
}

export interface UrgentTasksPanelProps {
  tasks: UrgentTask[];
  onTaskClick: (taskId: string) => void;
  className?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  urgent: { color: 'bg-red-500', label: 'Urgent' },
  high: { color: 'bg-amber-500', label: 'Ridicată' },
  medium: { color: 'bg-blue-500', label: 'Medie' },
  low: { color: 'bg-zinc-500', label: 'Scăzută' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isOverdue(dueDate: string): boolean {
  return dueDate === 'Ieri' || dueDate.includes('dec.') || dueDate.includes('nov.');
}

function isDueToday(dueDate: string): boolean {
  return dueDate === 'Astăzi';
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface TaskItemProps {
  task: UrgentTask;
  urgencyType: 'overdue' | 'today' | 'high-priority';
  onClick: () => void;
}

function TaskItem({ task, urgencyType, onClick }: TaskItemProps) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 p-4 rounded-lg cursor-pointer transition-all',
        'bg-linear-bg-tertiary border border-linear-border-subtle',
        'hover:border-linear-border-default hover:bg-linear-bg-hover',
        urgencyType === 'overdue' && 'border-l-2 border-l-red-500',
        urgencyType === 'today' && 'border-l-2 border-l-amber-500',
        urgencyType === 'high-priority' && 'border-l-2 border-l-orange-500'
      )}
    >
      {/* Header row with priority and assignee */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityConfig.color)} />
          {task.case?.referenceNumbers?.[0] && (
            <span className="text-[10px] font-mono text-linear-accent">
              {task.case.referenceNumbers[0]}
            </span>
          )}
        </div>
        <Avatar
          size="xs"
          name={`${task.assignee.firstName} ${task.assignee.lastName}`}
          className="shrink-0"
        />
      </div>

      {/* Task title */}
      <div className="text-[13px] font-light text-linear-text-primary line-clamp-2">{task.title}</div>

      {/* Case title */}
      {task.case && (
        <div className="text-[11px] text-linear-text-secondary truncate">
          {task.case.title}
        </div>
      )}

      {/* Due date and estimated time */}
      <div className="flex items-center justify-between text-[11px] pt-1">
        <span className="text-linear-text-tertiary">{task.dueDate}</span>
        {task.estimatedDuration && (
          <span className="text-linear-text-secondary bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
            {task.estimatedDuration}
          </span>
        )}
      </div>
    </div>
  );
}

interface TaskSectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: UrgentTask[];
  urgencyType: 'overdue' | 'today' | 'high-priority';
  onTaskClick: (taskId: string) => void;
  iconColor: string;
}

function TaskSection({
  title,
  icon,
  tasks,
  urgencyType,
  onTaskClick,
  iconColor,
}: TaskSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={iconColor}>{icon}</span>
        <span className="text-xs font-normal uppercase tracking-wider text-linear-text-tertiary">
          {title}
        </span>
        <span className="text-[10px] text-linear-text-muted bg-linear-bg-tertiary px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            urgencyType={urgencyType}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UrgentTasksPanel({ tasks, onTaskClick, className }: UrgentTasksPanelProps) {
  // Categorize tasks
  const overdueTasks = tasks.filter((t) => isOverdue(t.dueDate));
  const todayTasks = tasks.filter((t) => isDueToday(t.dueDate) && !isOverdue(t.dueDate));
  const highPriorityTasks = tasks.filter(
    (t) =>
      (t.priority === 'urgent' || t.priority === 'high') &&
      !isOverdue(t.dueDate) &&
      !isDueToday(t.dueDate)
  );

  const hasNoUrgentTasks =
    overdueTasks.length === 0 && todayTasks.length === 0 && highPriorityTasks.length === 0;

  if (hasNoUrgentTasks) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <div className="w-12 h-12 rounded-full bg-linear-bg-tertiary flex items-center justify-center mb-3">
          <Clock className="h-6 w-6 text-linear-text-tertiary" />
        </div>
        <p className="text-sm text-linear-text-tertiary">Nicio sarcină urgentă</p>
        <p className="text-xs text-linear-text-muted mt-1">Ești la zi cu toate sarcinile</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <TaskSection
        title="Întârziate"
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        tasks={overdueTasks}
        urgencyType="overdue"
        onTaskClick={onTaskClick}
        iconColor="text-red-400"
      />

      <TaskSection
        title="Astăzi"
        icon={<Clock className="h-3.5 w-3.5" />}
        tasks={todayTasks}
        urgencyType="today"
        onTaskClick={onTaskClick}
        iconColor="text-amber-400"
      />

      <TaskSection
        title="Prioritate ridicată"
        icon={<Flame className="h-3.5 w-3.5" />}
        tasks={highPriorityTasks}
        urgencyType="high-priority"
        onTaskClick={onTaskClick}
        iconColor="text-orange-400"
      />
    </div>
  );
}

export default UrgentTasksPanel;
