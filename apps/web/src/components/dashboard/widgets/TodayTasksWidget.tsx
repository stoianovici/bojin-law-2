/**
 * TodayTasksWidget - Associate Dashboard Today's Tasks List
 * Displays tasks due today with priority indicators and completion checkboxes
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { TaskListWidget as TaskListWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';

export interface TodayTasksWidgetProps {
  widget: TaskListWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Priority Badge Component
 */
function PriorityBadge({ priority }: { priority: 'Low' | 'Medium' | 'High' | 'Urgent' }) {
  const priorityConfig = {
    Low: {
      label: 'Scăzută',
      className: 'bg-green-100 text-green-700',
    },
    Medium: {
      label: 'Medie',
      className: 'bg-orange-100 text-orange-700',
    },
    High: {
      label: 'Ridicată',
      className: 'bg-red-100 text-red-700',
    },
    Urgent: {
      label: 'Urgentă',
      className: 'bg-red-200 text-red-900',
    },
  };

  const config = priorityConfig[priority];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Task List Item Component
 */
function TaskListItem({
  task,
  completed,
  onToggleComplete,
}: {
  task: TaskListWidgetType['tasks'][0];
  completed: boolean;
  onToggleComplete: (taskId: string) => void;
}) {
  return (
    <div className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex items-center pt-1">
          <input
            type="checkbox"
            checked={completed}
            onChange={() => onToggleComplete(task.id)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            aria-label={`Marchează ${task.title} ca finalizat`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={clsx(
                'text-sm font-semibold',
                completed ? 'text-gray-500 line-through' : 'text-gray-900'
              )}
            >
              {task.title}
            </h4>
            <PriorityBadge priority={task.priority} />
          </div>
          {task.caseContext && (
            <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>{task.caseContext}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {task.timeEstimate && (
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{task.timeEstimate}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>Astăzi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TodayTasksWidget - Displays tasks due today for Associate
 *
 * Shows task title, case context, priority indicator, and time estimate.
 * Checkboxes update local state only (no backend integration).
 */
export function TodayTasksWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: TodayTasksWidgetProps) {
  // Local state for completed tasks (visual only)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(
    new Set(widget.tasks.filter((t) => t.completed).map((t) => t.id))
  );

  const handleToggleComplete = (taskId: string) => {
    setCompletedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );

  const completedCount = completedTasks.size;
  const totalCount = widget.tasks.length;

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      {widget.tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <p className="text-sm">Nu există sarcini pentru astăzi</p>
        </div>
      ) : (
        <>
          {/* Progress indicator */}
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Progres</span>
              <span>
                {completedCount} / {totalCount} finalizate
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {(widget.tasks || []).map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                completed={completedTasks.has(task.id)}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </>
      )}
    </WidgetContainer>
  );
}

TodayTasksWidget.displayName = 'TodayTasksWidget';
