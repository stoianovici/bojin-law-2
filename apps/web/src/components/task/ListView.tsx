/**
 * ListView Component
 * Displays tasks in a sortable table format with pagination
 * Romanian language support throughout
 */

'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Task, TaskSortConfig } from '@legal-platform/types';

// TODO: Replace with real user data from API
const USERS: { id: string; name: string; initials: string }[] = [];
import { QuickTimeLog } from '@/components/time/QuickTimeLog';
import { useLogTimeAgainstTask } from '@/hooks/useTimeEntries';
import { Clock } from 'lucide-react';
import {
  TASK_TYPE_COLORS,
  TASK_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '@/utils/task-colors';

/**
 * ListView Props
 */
interface ListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onSortChange?: (config: TaskSortConfig) => void;
}

/**
 * Items per page for pagination
 */
const ITEMS_PER_PAGE = 10;

/**
 * ListView Component
 */
export function ListView({ tasks, onTaskClick, onSortChange }: ListViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<TaskSortConfig>({
    field: 'dueDate',
    direction: 'asc',
  });
  const [logTimeTaskId, setLogTimeTaskId] = useState<string | null>(null);

  // Time tracking hook
  const [logTimeAgainstTask, { loading: loggingTime }] = useLogTimeAgainstTask();

  /**
   * Handle column sort
   */
  const handleSort = (field: keyof Task) => {
    const newDirection =
      sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';

    const newConfig: TaskSortConfig = {
      field,
      direction: newDirection,
    };

    setSortConfig(newConfig);
    onSortChange?.(newConfig);
  };

  /**
   * Sort tasks based on current sort configuration
   */
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a: (typeof tasks)[number], b: (typeof tasks)[number]) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      // Handle date sorting
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Handle string/number sorting
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [tasks, sortConfig]);

  /**
   * Paginate tasks
   */
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedTasks.slice(startIndex, endIndex);
  }, [sortedTasks, currentPage]);

  /**
   * Calculate total pages
   */
  const totalPages = Math.ceil(sortedTasks.length / ITEMS_PER_PAGE);

  /**
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    setLogTimeTaskId(null); // Close any open time log forms
  };

  /**
   * Handle time log submission
   */
  const handleTimeLogSubmit = async (
    taskId: string,
    data: { hours: number; description: string; billable: boolean }
  ) => {
    await logTimeAgainstTask({
      variables: {
        taskId,
        hours: data.hours,
        description: data.description,
        billable: data.billable,
      },
    });

    setLogTimeTaskId(null);
  };

  /**
   * Sort icon component
   */
  const SortIcon = ({ field }: { field: keyof Task }) => {
    if (sortConfig.field !== field) {
      return (
        <svg
          className="w-4 h-4 text-linear-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }

    return sortConfig.direction === 'asc' ? (
      <svg className="w-4 h-4 text-linear-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-linear-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="list-view-container h-full flex flex-col">
      {/* Table container with horizontal scroll on mobile */}
      <div className="flex-1 overflow-x-auto bg-linear-bg-secondary rounded-lg shadow-sm border border-linear-border-subtle">
        <table className="min-w-full divide-y divide-linear-border-subtle">
          {/* Table header */}
          <thead className="bg-linear-bg-tertiary">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover transition-colors"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-2">
                  <span>Titlu</span>
                  <SortIcon field="title" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover transition-colors"
                onClick={() => handleSort('caseId')}
              >
                <div className="flex items-center gap-2">
                  <span>Dosar</span>
                  <SortIcon field="caseId" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover transition-colors"
                onClick={() => handleSort('assignedTo')}
              >
                <div className="flex items-center gap-2">
                  <span>Asignat</span>
                  <SortIcon field="assignedTo" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover transition-colors"
                onClick={() => handleSort('dueDate')}
              >
                <div className="flex items-center gap-2">
                  <span>Termen</span>
                  <SortIcon field="dueDate" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover transition-colors"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-2">
                  <span>Prioritate</span>
                  <SortIcon field="priority" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <SortIcon field="status" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider"
              >
                Acțiuni
              </th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-linear-text-muted">
                    <svg
                      className="w-12 h-12 mb-3 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-sm font-medium">Nu există sarcini de afișat</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTasks.map((task) => {
                const caseName = task.case?.title || task.case?.caseNumber || '';
                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="hover:bg-linear-bg-hover cursor-pointer transition-colors"
                  >
                    {/* Title with type color indicator and optional duration */}
                    <td className="py-4 whitespace-normal">
                      <div
                        className="pl-6 pr-4 border-l-[3px]"
                        style={{ borderLeftColor: TASK_TYPE_COLORS[task.type] }}
                        title={TASK_TYPE_LABELS[task.type]}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-linear-text-primary line-clamp-2">
                            {task.title}
                          </span>
                          {task.estimatedHours && task.estimatedHours > 0 && (
                            <span
                              className="shrink-0 text-[10px] font-medium text-linear-text-tertiary bg-linear-bg-tertiary px-1.5 py-0.5 rounded"
                              title={`Durată estimată: ${task.estimatedHours} ore`}
                            >
                              {task.estimatedHours}h
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Case */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-linear-text-secondary line-clamp-1">{caseName || '—'}</span>
                    </td>

                    {/* Assignee */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const user = USERS.find((u) => u.id === task.assignedTo);
                          return (
                            <>
                              <div
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold"
                                title={user?.name || task.assignedTo}
                              >
                                {user?.initials || 'U'}
                              </div>
                              <span className="text-sm text-linear-text-secondary">
                                {user?.name || task.assignedTo}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-linear-text-primary">
                        {format(new Date(task.dueDate), 'dd.MM.yyyy', { locale: ro })}
                      </div>
                      <div className="text-xs text-linear-text-tertiary">
                        {format(new Date(task.dueDate), 'HH:mm', { locale: ro })}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                        />
                        <span className="text-sm text-linear-text-secondary">
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-linear-text-secondary">{STATUS_LABELS[task.status]}</span>
                    </td>

                    {/* Actions */}
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {logTimeTaskId === task.id ? (
                        <div className="min-w-[300px]">
                          <QuickTimeLog
                            caseId={task.caseId}
                            taskId={task.id}
                            taskTitle={task.title}
                            onSubmit={(data: {
                              hours: number;
                              description: string;
                              billable: boolean;
                            }) => handleTimeLogSubmit(task.id, data)}
                            onCancel={() => setLogTimeTaskId(null)}
                            isLoading={loggingTime}
                            compact={false}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLogTimeTaskId(task.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-linear-accent text-linear-accent rounded-md hover:bg-linear-accent/10 transition-colors font-medium"
                        >
                          <Clock className="h-4 w-4" />
                          <span>Înregistrează</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-linear-bg-secondary border-t border-linear-border-subtle rounded-b-lg">
          <div className="text-sm text-linear-text-secondary">
            Afișare {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, sortedTasks.length)} din {sortedTasks.length}{' '}
            sarcini
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-linear-border rounded-md text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary hover:bg-linear-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 border rounded-md text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-linear-accent text-white border-linear-accent'
                      : 'bg-linear-bg-secondary text-linear-text-secondary border-linear-border hover:bg-linear-bg-hover'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-linear-border rounded-md text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary hover:bg-linear-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Următor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListView;
