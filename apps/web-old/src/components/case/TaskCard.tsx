/**
 * TaskCard - Individual task card for kanban board
 * Displays task information with assignee, due date, and priority
 */

'use client';

import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import type { Task, User } from '@legal-platform/types';
import * as Avatar from '@radix-ui/react-avatar';

export interface TaskCardProps {
  task: Task;
  assignee?: User;
  onTaskClick?: (task: Task) => void;
  onMenuClick?: (task: Task) => void;
  className?: string;
}

/**
 * Priority Badge Component
 */
interface PriorityBadgeProps {
  priority: 'High' | 'Medium' | 'Low';
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const priorityConfig: Record<'High' | 'Medium' | 'Low', { label: string; className: string }> = {
    High: {
      label: 'Înaltă',
      className: 'bg-linear-error/15 text-linear-error border-linear-error/30',
    },
    Medium: {
      label: 'Medie',
      className: 'bg-linear-warning/15 text-linear-warning border-linear-warning/30',
    },
    Low: {
      label: 'Scăzută',
      className: 'bg-linear-bg-tertiary text-linear-text-primary border-linear-border-subtle',
    },
  };

  const config = priorityConfig[priority];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Due Date Badge Component
 */
interface DueDateBadgeProps {
  dueDate: Date;
}

function DueDateBadge({ dueDate }: DueDateBadgeProps) {
  const daysUntil = differenceInDays(dueDate, new Date());

  const urgencyConfig = {
    className:
      daysUntil < 0
        ? 'text-linear-error bg-linear-error/10'
        : daysUntil < 3
          ? 'text-linear-error bg-linear-error/10'
          : daysUntil < 7
            ? 'text-linear-warning bg-linear-warning/10'
            : 'text-linear-accent bg-linear-accent/10',
  };

  const label = daysUntil < 0 ? 'Întârziat' : format(dueDate, 'dd MMM', { locale: ro });

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
        urgencyConfig.className
      )}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}

/**
 * TaskCard Component
 *
 * Displays task information in a card format for kanban boards
 */
export function TaskCard({ task, assignee, onTaskClick, onMenuClick, className }: TaskCardProps) {
  const initials = assignee
    ? `${assignee.firstName.charAt(0)}${assignee.lastName.charAt(0)}`.toUpperCase()
    : '?';

  // Truncate description to 2 lines
  const truncatedDescription =
    task.description && task.description.length > 100
      ? task.description.substring(0, 100) + '...'
      : task.description;

  return (
    <div
      className={clsx(
        'bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group',
        className
      )}
      onClick={() => onTaskClick?.(task)}
    >
      {/* Header: Title and Menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-linear-text-primary leading-snug flex-1">
          {task.title}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick?.(task);
          }}
          className="flex-shrink-0 p-1 rounded text-linear-text-muted hover:text-linear-text-secondary hover:bg-linear-bg-hover opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Opțiuni sarcină"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>

      {/* Description */}
      {truncatedDescription && (
        <p className="text-xs text-linear-text-secondary mb-3 line-clamp-2">
          {truncatedDescription}
        </p>
      )}

      {/* Footer: Priority, Due Date, Assignee */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={task.priority as 'High' | 'Medium' | 'Low'} />
          {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
        </div>

        {/* Assignee Avatar */}
        {assignee && (
          <Avatar.Root
            className="inline-flex h-6 w-6 rounded-full flex-shrink-0"
            title={`${assignee.firstName} ${assignee.lastName}`}
          >
            <Avatar.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-linear-accent text-white text-xs font-medium">
              {initials}
            </Avatar.Fallback>
          </Avatar.Root>
        )}
      </div>

      {/* Drag hint tooltip (visual only) */}
      <div className="mt-2 pt-2 border-t border-linear-border-subtle opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs text-linear-text-tertiary text-center">Trageți pentru a muta</p>
      </div>
    </div>
  );
}

TaskCard.displayName = 'TaskCard';
