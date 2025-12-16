/**
 * TaskHistoryTimeline Component
 * Story 4.6: Task Collaboration and Updates (AC: 5)
 *
 * Displays chronological history of all task changes
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  useTaskHistory,
  getHistoryActionLabel,
  getHistoryActionIcon,
  type TaskHistoryEntry,
  type TaskHistoryAction,
} from '@/hooks/useTaskHistory';

interface TaskHistoryTimelineProps {
  taskId: string;
}

const ACTION_FILTER_OPTIONS: Array<{ value: TaskHistoryAction | 'all'; label: string }> = [
  { value: 'all', label: 'Toate' },
  { value: 'StatusChanged', label: 'Schimbări status' },
  { value: 'AssigneeChanged', label: 'Schimbări asignare' },
  { value: 'CommentAdded', label: 'Comentarii' },
  { value: 'AttachmentAdded', label: 'Atașamente' },
  { value: 'SubtaskCreated', label: 'Sub-sarcini' },
];

export function TaskHistoryTimeline({ taskId }: TaskHistoryTimelineProps) {
  const [actionFilter, setActionFilter] = useState<TaskHistoryAction | 'all'>('all');
  const [limit, setLimit] = useState(20);

  const options = actionFilter === 'all' ? { limit } : { limit, actions: [actionFilter] };
  const { data, loading, error, fetchMore } = useTaskHistory(taskId, options);

  const history = data?.taskHistory || [];

  const loadMore = () => {
    setLimit((prev) => prev + 20);
    fetchMore({
      variables: { taskId, options: { ...options, limit: limit + 20 } },
    });
  };

  if (loading && history.length === 0) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">Eroare la încărcarea istoricului</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Istoric Modificări</h3>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as TaskHistoryAction | 'all')}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {ACTION_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {history.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">Niciun istoric de afișat</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {history.map((entry) => (
              <HistoryEntryItem key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Load more button */}
          {history.length >= limit && (
            <div className="mt-4 text-center">
              <button onClick={loadMore} className="text-sm text-blue-600 hover:text-blue-800">
                Încarcă mai multe
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface HistoryEntryItemProps {
  entry: TaskHistoryEntry;
}

function HistoryEntryItem({ entry }: HistoryEntryItemProps) {
  const icon = getHistoryActionIcon(entry.action);
  const label = getHistoryActionLabel(entry.action);
  const actorName = `${entry.actor.firstName} ${entry.actor.lastName}`;

  return (
    <div className="relative flex gap-3 pl-1">
      {/* Icon */}
      <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-sm">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900">{actorName}</span>
          <span className="text-gray-600">{label}</span>
        </div>

        {/* Show field changes */}
        {entry.field && (entry.oldValue || entry.newValue) && (
          <div className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{formatFieldName(entry.field)}:</span>{' '}
            {entry.oldValue && (
              <span className="line-through text-red-600 mr-1">
                {formatFieldValue(entry.field, entry.oldValue)}
              </span>
            )}
            {entry.newValue && (
              <span className="text-green-600">
                {formatFieldValue(entry.field, entry.newValue)}
              </span>
            )}
          </div>
        )}

        {/* Metadata */}
        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <div className="mt-1 text-xs text-gray-400">{JSON.stringify(entry.metadata)}</div>
        )}

        {/* Timestamp */}
        <div
          className="mt-1 text-xs text-gray-400"
          title={format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm', { locale: ro })}
        >
          {formatDistanceToNow(new Date(entry.createdAt), {
            addSuffix: true,
            locale: ro,
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Format field name for display
 */
function formatFieldName(field: string): string {
  const fieldLabels: Record<string, string> = {
    status: 'Status',
    assignedTo: 'Asignat',
    priority: 'Prioritate',
    dueDate: 'Data scadenței',
    title: 'Titlu',
    description: 'Descriere',
    estimatedHours: 'Ore estimate',
  };
  return fieldLabels[field] || field;
}

/**
 * Format field value for display
 */
function formatFieldValue(field: string, value: string): string {
  const statusLabels: Record<string, string> = {
    Pending: 'În Așteptare',
    InProgress: 'În Progres',
    Completed: 'Finalizat',
    Cancelled: 'Anulat',
  };

  const priorityLabels: Record<string, string> = {
    Low: 'Scăzută',
    Medium: 'Medie',
    High: 'Ridicată',
    Urgent: 'Urgentă',
  };

  if (field === 'status') return statusLabels[value] || value;
  if (field === 'priority') return priorityLabels[value] || value;
  if (field === 'dueDate') {
    try {
      return format(new Date(value), 'dd MMM yyyy', { locale: ro });
    } catch {
      return value;
    }
  }

  return value;
}

export default TaskHistoryTimeline;
