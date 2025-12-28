/**
 * TasksTab - Main tasks tab with kanban board and controls
 * Includes filters, sorting, and view toggle
 */

'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import type { Task, TaskColumn, User } from '@legal-platform/types';
import { TaskKanbanBoard } from '../TaskKanbanBoard';

export interface TasksTabProps {
  tasks: Task[];
  users?: User[];
  currentUserId?: string;
  onTaskClick?: (task: Task) => void;
  onTaskMenu?: (task: Task) => void;
  onAddTask?: (column: TaskColumn) => void;
  className?: string;
}

type FilterType = 'all' | 'my-tasks' | 'high-priority';
type SortType = 'due-date' | 'priority' | 'recently-updated';

/**
 * TasksTab Component
 *
 * Displays tasks in a kanban board with filtering and sorting options
 */
export function TasksTab({
  tasks,
  users,
  currentUserId,
  onTaskClick,
  onTaskMenu,
  onAddTask,
  className,
}: TasksTabProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('due-date');

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filter === 'my-tasks' && currentUserId) {
      result = result.filter((t) => t.assignedTo === currentUserId);
    } else if (filter === 'high-priority') {
      result = result.filter((t) => t.priority === 'High');
    }

    return result;
  }, [tasks, filter, currentUserId]);

  // Sort tasks (within each column)
  const sortedTasks = useMemo(() => {
    const result = [...filteredTasks];

    if (sort === 'due-date') {
      result.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    } else if (sort === 'priority') {
      const priorityOrder: Record<string, number> = {
        High: 0,
        Medium: 1,
        Low: 2,
      };
      result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sort === 'recently-updated') {
      result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    return result;
  }, [filteredTasks, sort]);

  return (
    <div className={clsx('flex flex-col h-full bg-linear-bg-secondary', className)}>
      {/* Controls Bar */}
      <div className="px-4 py-3 border-b border-linear-border-subtle bg-linear-bg-tertiary">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* View Toggle (for future) */}
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-linear-accent"
              disabled
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Vizualizare Tablă
            </button>
            <button
              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border hover:bg-linear-bg-hover transition-colors"
              disabled
              title="Vizualizare listă - în dezvoltare"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              Vizualizare Listă
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-select" className="text-sm font-medium text-linear-text-secondary">
                Filtru:
              </label>
              <select
                id="filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent bg-linear-bg-secondary"
              >
                <option value="all">Toate Sarcinile</option>
                <option value="my-tasks">Sarcinile Mele</option>
                <option value="high-priority">Prioritate Înaltă</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-sm font-medium text-linear-text-secondary">
                Sortare:
              </label>
              <select
                id="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
                className="px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent bg-linear-bg-secondary"
              >
                <option value="due-date">Dată Scadență</option>
                <option value="priority">Prioritate</option>
                <option value="recently-updated">Actualizat Recent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task Count */}
        <div className="mt-2 text-xs text-linear-text-tertiary">
          Afișare {sortedTasks.length} din {tasks.length} sarcini
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <TaskKanbanBoard
          tasks={sortedTasks}
          users={users}
          onTaskClick={onTaskClick}
          onTaskMenu={onTaskMenu}
          onAddTask={onAddTask}
        />
      </div>
    </div>
  );
}

TasksTab.displayName = 'TasksTab';
