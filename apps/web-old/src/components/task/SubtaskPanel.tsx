/**
 * SubtaskPanel Component
 * Story 4.6: Task Collaboration and Updates (AC: 4)
 *
 * Panel for managing task subtasks with quick-add functionality
 */

'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Task } from '@legal-platform/types';
import {
  useSubtasks,
  useCreateSubtask,
  useToggleSubtask,
  getSubtaskProgress,
  getSubtaskSummary,
  type CreateSubtaskInput,
} from '@/hooks/useSubtasks';

// Extended Task type for subtasks with assignee info from GraphQL
interface Subtask extends Task {
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface SubtaskPanelProps {
  parentTaskId: string;
  caseId: string;
  canEdit?: boolean;
}

const PRIORITY_OPTIONS: Array<{ value: Task['priority']; label: string }> = [
  { value: 'Low', label: 'Scăzută' },
  { value: 'Medium', label: 'Medie' },
  { value: 'High', label: 'Ridicată' },
  { value: 'Urgent', label: 'Urgentă' },
];

export function SubtaskPanel({ parentTaskId, caseId: _caseId, canEdit = true }: SubtaskPanelProps) {
  const { data, loading, error } = useSubtasks(parentTaskId);
  const [createSubtask, { loading: creating }] = useCreateSubtask();
  const [toggleSubtask] = useToggleSubtask();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubtask, setNewSubtask] = useState<Partial<CreateSubtaskInput>>({
    title: '',
    description: '',
    priority: 'Medium',
  });

  const subtasks = (data?.subtasks || []) as Subtask[];
  const progress = getSubtaskProgress(subtasks);
  const summary = getSubtaskSummary(subtasks);

  const handleCreate = async () => {
    if (!newSubtask.title?.trim()) return;

    await createSubtask({
      variables: {
        input: {
          parentTaskId,
          title: newSubtask.title.trim(),
          description: newSubtask.description?.trim(),
          priority: newSubtask.priority as Task['priority'],
          dueDate: newSubtask.dueDate,
        },
      },
    });

    setNewSubtask({ title: '', description: '', priority: 'Medium' });
    setShowAddForm(false);
  };

  const handleToggle = async (subtaskId: string) => {
    await toggleSubtask({ variables: { subtaskId } });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-linear-bg-hover rounded w-1/4" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-linear-bg-hover rounded" />
              <div className="h-4 bg-linear-bg-hover rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-linear-error text-sm">Eroare la încărcarea sub-sarcinilor</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-linear-text-primary">Sub-sarcini</h3>
          <p className="text-xs text-linear-text-tertiary">{summary}</p>
        </div>
        {subtasks.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-linear-bg-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-success transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-linear-text-tertiary">{progress}%</span>
          </div>
        )}
      </div>

      {/* Subtasks list */}
      {subtasks.length > 0 && (
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              canEdit={canEdit}
              onToggle={() => handleToggle(subtask.id)}
            />
          ))}
        </div>
      )}

      {/* Add subtask form */}
      {canEdit && (
        <>
          {showAddForm ? (
            <div className="p-3 bg-linear-bg-tertiary rounded-lg space-y-3">
              <input
                type="text"
                value={newSubtask.title}
                onChange={(e) => setNewSubtask((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Titlu sub-sarcină"
                className="w-full px-3 py-2 border border-linear-border rounded-md text-sm focus:ring-2 focus:ring-linear-accent focus:border-transparent"
                autoFocus
              />

              <textarea
                value={newSubtask.description}
                onChange={(e) =>
                  setNewSubtask((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Descriere (opțional)"
                rows={2}
                className="w-full px-3 py-2 border border-linear-border rounded-md text-sm focus:ring-2 focus:ring-linear-accent focus:border-transparent resize-none"
              />

              <div className="flex gap-3">
                <select
                  value={newSubtask.priority}
                  onChange={(e) =>
                    setNewSubtask((prev) => ({
                      ...prev,
                      priority: e.target.value as Task['priority'],
                    }))
                  }
                  className="flex-1 px-3 py-2 border border-linear-border rounded-md text-sm focus:ring-2 focus:ring-linear-accent focus:border-transparent"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={newSubtask.dueDate || ''}
                  onChange={(e) => setNewSubtask((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-linear-border rounded-md text-sm focus:ring-2 focus:ring-linear-accent focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSubtask({ title: '', description: '', priority: 'Medium' });
                  }}
                  className="px-3 py-1.5 text-sm text-linear-text-secondary hover:text-linear-text-primary"
                >
                  Anulează
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newSubtask.title?.trim()}
                  className="px-3 py-1.5 text-sm bg-linear-accent text-white rounded-md hover:bg-linear-accent-hover disabled:opacity-50"
                >
                  {creating ? 'Se adaugă...' : 'Adaugă'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 border-2 border-dashed border-linear-border-subtle rounded-lg text-sm text-linear-text-tertiary hover:text-linear-accent hover:border-linear-accent/50 transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Adaugă sub-sarcină
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface SubtaskItemProps {
  subtask: Subtask;
  canEdit: boolean;
  onToggle: () => void;
}

function SubtaskItem({ subtask, canEdit, onToggle }: SubtaskItemProps) {
  const isCompleted = subtask.status === 'Completed';

  const priorityColors: Record<string, string> = {
    Low: 'bg-linear-bg-tertiary text-linear-text-secondary',
    Medium: 'bg-linear-accent/15 text-linear-accent',
    High: 'bg-linear-warning/15 text-linear-warning',
    Urgent: 'bg-linear-error/15 text-linear-error',
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isCompleted
          ? 'bg-linear-bg-tertiary border-linear-border-subtle/50'
          : 'bg-linear-bg-secondary border-linear-border-subtle'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={!canEdit}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 transition-colors mt-0.5 ${
          isCompleted
            ? 'bg-linear-success border-linear-success text-white'
            : 'border-linear-border hover:border-linear-accent'
        } disabled:cursor-not-allowed`}
      >
        {isCompleted && (
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isCompleted ? 'text-linear-text-muted line-through' : 'text-linear-text-primary'}`}
          >
            {subtask.title}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[subtask.priority]}`}>
            {PRIORITY_OPTIONS.find((p) => p.value === subtask.priority)?.label}
          </span>
        </div>

        {subtask.description && (
          <p
            className={`text-xs mt-1 ${isCompleted ? 'text-linear-text-muted' : 'text-linear-text-tertiary'}`}
          >
            {subtask.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1 text-xs text-linear-text-muted">
          {subtask.assignee && (
            <span>
              {subtask.assignee.firstName} {subtask.assignee.lastName}
            </span>
          )}
          {subtask.dueDate && (
            <span>{format(new Date(subtask.dueDate), 'dd MMM', { locale: ro })}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubtaskPanel;
