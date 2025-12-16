/**
 * ListView Component
 * Displays tasks in a sortable table format with pagination
 * Romanian language support throughout
 */

'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Task, TaskType, TaskSortConfig } from '@legal-platform/types';

// TODO: Replace with real user data from API
const USERS: { id: string; name: string; initials: string }[] = [];
import { QuickTimeLog } from '@/components/time/QuickTimeLog';
import { useLogTimeAgainstTask } from '@/hooks/useTimeEntries';
import { Clock } from 'lucide-react';

/**
 * Task type color mapping (same as CalendarView and KanbanBoard)
 */
const TASK_TYPE_COLORS: Record<TaskType, string> = {
  Research: '#3B82F6',
  DocumentCreation: '#10B981',
  DocumentRetrieval: '#8B5CF6',
  CourtDate: '#EF4444',
  Meeting: '#F59E0B',
  BusinessTrip: '#6366F1',
};

/**
 * Task type labels in Romanian
 */
const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Research: 'Cercetare',
  DocumentCreation: 'Creare Document',
  DocumentRetrieval: 'Recuperare Document',
  CourtDate: 'Termen Instanță',
  Meeting: 'Întâlnire',
  BusinessTrip: 'Deplasare',
};

/**
 * Status labels in Romanian
 */
const STATUS_LABELS: Record<Task['status'], string> = {
  Pending: 'În Așteptare',
  InProgress: 'În Progres',
  Completed: 'Finalizat',
  Cancelled: 'Anulat',
};

/**
 * Priority labels in Romanian
 */
const PRIORITY_LABELS: Record<Task['priority'], string> = {
  Low: 'Scăzută',
  Medium: 'Medie',
  High: 'Ridicată',
  Urgent: 'Urgentă',
};

/**
 * Priority indicator colors
 */
const PRIORITY_COLORS: Record<Task['priority'], string> = {
  Low: '#10B981',
  Medium: '#F59E0B',
  High: '#EF4444',
  Urgent: '#DC2626',
};

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
          className="w-4 h-4 text-gray-400"
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
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="list-view-container h-full flex flex-col">
      {/* Table container with horizontal scroll on mobile */}
      <div className="flex-1 overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table header */}
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-2">
                  <span>Titlu</span>
                  <SortIcon field="title" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center gap-2">
                  <span>Tip</span>
                  <SortIcon field="type" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('assignedTo')}
              >
                <div className="flex items-center gap-2">
                  <span>Asignat</span>
                  <SortIcon field="assignedTo" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('dueDate')}
              >
                <div className="flex items-center gap-2">
                  <span>Termen</span>
                  <SortIcon field="dueDate" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-2">
                  <span>Prioritate</span>
                  <SortIcon field="priority" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <SortIcon field="status" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                Acțiuni
              </th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
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
              paginatedTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Title */}
                  <td className="px-6 py-4 whitespace-normal">
                    <div className="text-sm font-medium text-gray-900 line-clamp-2">
                      {task.title}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: TASK_TYPE_COLORS[task.type] }}
                    >
                      {TASK_TYPE_LABELS[task.type]}
                    </span>
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
                            <span className="text-sm text-gray-700">
                              {user?.name || task.assignedTo}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </td>

                  {/* Due Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(task.dueDate), 'dd.MM.yyyy', { locale: ro })}
                    </div>
                    <div className="text-xs text-gray-500">
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
                      <span className="text-sm text-gray-700">
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{STATUS_LABELS[task.status]}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors font-medium"
                      >
                        <Clock className="h-4 w-4" />
                        <span>Înregistrează</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200 rounded-b-lg">
          <div className="text-sm text-gray-700">
            Afișare {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, sortedTasks.length)} din {sortedTasks.length}{' '}
            sarcini
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
