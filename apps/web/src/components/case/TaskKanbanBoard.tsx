/**
 * TaskKanbanBoard - Kanban board for task management
 * Four-column board: To Do, In Progress, Review, Complete
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { Task, TaskColumn, User } from '@legal-platform/types';
import { TaskCard } from './TaskCard';

export interface TaskKanbanBoardProps {
  tasks: Task[];
  users?: User[]; // For looking up assignees
  onTaskClick?: (task: Task) => void;
  onTaskMenu?: (task: Task) => void;
  onAddTask?: (column: TaskColumn) => void;
  className?: string;
}

/**
 * Column Configuration
 */
const COLUMN_CONFIG: Record<TaskColumn, { title: string; color: string; badgeColor: string }> = {
  todo: {
    title: 'De Făcut',
    color: 'border-linear-border-subtle',
    badgeColor: 'bg-linear-bg-tertiary text-linear-text-primary',
  },
  'in-progress': {
    title: 'În Lucru',
    color: 'border-linear-accent/50',
    badgeColor: 'bg-linear-accent/15 text-linear-accent',
  },
  review: {
    title: 'În Revizuire',
    color: 'border-linear-warning/50',
    badgeColor: 'bg-linear-warning/15 text-linear-warning',
  },
  complete: {
    title: 'Finalizat',
    color: 'border-linear-success/50',
    badgeColor: 'bg-linear-success/15 text-linear-success',
  },
};

/**
 * KanbanColumn Component
 */
interface KanbanColumnProps {
  column: TaskColumn;
  tasks: Task[];
  users?: User[];
  onTaskClick?: (task: Task) => void;
  onTaskMenu?: (task: Task) => void;
  onAddTask?: () => void;
}

function KanbanColumn({
  column,
  tasks,
  users = [],
  onTaskClick,
  onTaskMenu,
  onAddTask,
}: KanbanColumnProps) {
  const config = COLUMN_CONFIG[column];
  const taskCount = tasks.length;

  // Helper to find assignee
  const getAssignee = (task: Task) => users.find((u) => u.id === task.assignedTo);

  return (
    <div className="flex flex-col bg-linear-bg-primary rounded-lg border-2 border-dashed min-h-[400px]">
      {/* Column Header */}
      <div className={clsx('p-4 border-b-2', config.color)}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-linear-text-primary">{config.title}</h3>
          <span
            className={clsx(
              'inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold',
              config.badgeColor
            )}
          >
            {taskCount}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="w-full inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adaugă Sarcină
        </button>
      </div>

      {/* Column Body - Task Cards */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            assignee={getAssignee(task)}
            onTaskClick={onTaskClick}
            onMenuClick={onTaskMenu}
          />
        ))}

        {/* Empty State */}
        {taskCount === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-linear-text-muted">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-sm">Nicio sarcină</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TaskKanbanBoard Component
 *
 * Displays tasks in a 4-column kanban board layout
 *
 * Memoized for performance optimization to prevent unnecessary re-renders
 * when parent component updates but props remain unchanged.
 */
function TaskKanbanBoardComponent({
  tasks,
  users,
  onTaskClick,
  onTaskMenu,
  onAddTask,
  className,
}: TaskKanbanBoardProps) {
  // Group tasks by column - map between Task.status and TaskColumn
  const tasksByColumn: Record<TaskColumn, Task[]> = {
    todo: tasks.filter((t) => t.status === 'Pending'),
    'in-progress': tasks.filter((t) => t.status === 'InProgress'),
    review: tasks.filter((t) => t.status === 'Cancelled'), // Using Cancelled for review column
    complete: tasks.filter((t) => t.status === 'Completed'),
  };

  const columns: TaskColumn[] = ['todo', 'in-progress', 'review', 'complete'];

  return (
    <div className={clsx('h-full overflow-x-auto p-4 bg-linear-bg-secondary', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[800px]">
        {columns.map((column) => (
          <KanbanColumn
            key={column}
            column={column}
            tasks={tasksByColumn[column]}
            users={users}
            onTaskClick={onTaskClick}
            onTaskMenu={onTaskMenu}
            onAddTask={() => onAddTask?.(column)}
          />
        ))}
      </div>

      {/* Drag-drop note */}
      <div className="mt-4 p-4 bg-linear-accent/10 border border-linear-accent/30 rounded-lg text-sm text-linear-accent">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-medium">Funcționalitate de glisare în dezvoltare</p>
            <p className="text-xs mt-1">
              Glisarea și plasarea sarcinilor între coloane va fi implementată în versiunile
              viitoare care includ integrarea backend-ului.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoized export for performance optimization
export const TaskKanbanBoard = React.memo(TaskKanbanBoardComponent);
TaskKanbanBoard.displayName = 'TaskKanbanBoard';
