'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, MoreHorizontal, Plus, User, X } from 'lucide-react';
import type { TaskData } from './TasksListView';

// ====================================================================
// TaskDetailPanel - Fixed right panel showing task details
// ====================================================================

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface ActivityItem {
  id: string;
  authorName: string;
  authorInitials: string;
  authorColor?: string;
  action: string;
  message?: string;
  timestamp: string;
}

export interface TaskDetailPanelProps {
  /** The selected task data */
  task?: TaskData | null;
  /** Subtasks for the selected task */
  subtasks?: Subtask[];
  /** Activity items for the selected task */
  activities?: ActivityItem[];
  /** Current user's initials for comment avatar */
  currentUserInitials?: string;
  /** Current user's avatar color */
  currentUserColor?: string;
  /** Callback when panel close is requested */
  onClose?: () => void;
  /** Callback when task is marked complete */
  onMarkComplete?: () => void;
  /** Callback when assignee change is requested */
  onChangeAssignee?: () => void;
  /** Callback when more options menu is requested */
  onMoreOptions?: () => void;
  /** Callback when a subtask is toggled */
  onToggleSubtask?: (subtaskId: string) => void;
  /** Callback when a new subtask is added */
  onAddSubtask?: (title: string) => void;
  /** Callback when a comment is submitted */
  onSubmitComment?: (comment: string) => void;
  /** Additional className */
  className?: string;
}

/**
 * TaskDetailPanel renders the right-side panel:
 * - Header with action buttons
 * - Subtasks section with progress
 * - Activity feed
 * - Comment input
 */
export function TaskDetailPanel({
  task,
  subtasks = [],
  activities = [],
  currentUserInitials = 'AB',
  currentUserColor = 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  onClose,
  onMarkComplete,
  onChangeAssignee,
  onMoreOptions,
  onToggleSubtask,
  onAddSubtask,
  onSubmitComment,
  className,
}: TaskDetailPanelProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [commentText, setCommentText] = React.useState('');
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);

  // Empty state when no task selected
  if (!task) {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
          <div className="mb-4 text-linear-text-muted opacity-50">
            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <p className="text-sm text-linear-text-tertiary">Selecteaza o sarcina pentru detalii</p>
        </div>
      </div>
    );
  }

  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length;
  const totalSubtasks = subtasks.length;

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      onAddSubtask?.(newSubtaskTitle.trim());
      setNewSubtaskTitle('');
      setIsAddingSubtask(false);
    }
  };

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onSubmitComment?.(commentText.trim());
      setCommentText('');
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-linear-border-subtle px-5 py-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMarkComplete}
            className="flex h-8 w-8 items-center justify-center rounded-md text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Marcheaza ca finalizata"
          >
            <Check className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onChangeAssignee}
            className="flex h-8 w-8 items-center justify-center rounded-md text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Schimba responsabil"
          >
            <User className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onMoreOptions}
            className="flex h-8 w-8 items-center justify-center rounded-md text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Mai multe optiuni"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
          title="Inchide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Subtasks Section */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-linear-text-muted">
              Subtask-uri
            </span>
            {totalSubtasks > 0 && (
              <span className="text-[11px] text-linear-text-tertiary">
                {completedSubtasks}/{totalSubtasks} complete
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2.5 py-2">
                <button
                  type="button"
                  onClick={() => onToggleSubtask?.(subtask.id)}
                  className={cn(
                    'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-all',
                    subtask.isCompleted
                      ? 'border-linear-accent bg-linear-accent'
                      : 'border-linear-border-default hover:border-linear-accent'
                  )}
                >
                  {subtask.isCompleted && (
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  )}
                </button>
                <span
                  className={cn(
                    'text-[13px]',
                    subtask.isCompleted
                      ? 'text-linear-text-tertiary line-through'
                      : 'text-linear-text-primary'
                  )}
                >
                  {subtask.title}
                </span>
              </div>
            ))}

            {/* Add Subtask */}
            {isAddingSubtask ? (
              <div className="flex items-center gap-2 py-2">
                <div className="h-4 w-4 flex-shrink-0" />
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubtask();
                    if (e.key === 'Escape') {
                      setIsAddingSubtask(false);
                      setNewSubtaskTitle('');
                    }
                  }}
                  onBlur={() => {
                    if (!newSubtaskTitle.trim()) {
                      setIsAddingSubtask(false);
                    }
                  }}
                  className="flex-1 bg-transparent text-[13px] text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none"
                  placeholder="Titlu subtask..."
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingSubtask(true)}
                className="flex items-center gap-2 py-2 text-[13px] text-linear-text-tertiary transition-colors hover:text-linear-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Adauga subtask
              </button>
            )}
          </div>
        </div>

        {/* Activity Section */}
        <div>
          <div className="mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-linear-text-muted">
              Activitate
            </span>
          </div>

          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{
                    background: activity.authorColor || 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  }}
                >
                  {activity.authorInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-baseline gap-1.5">
                    <span className="text-[13px] font-medium text-linear-text-primary">
                      {activity.authorName}
                    </span>
                    <span className="text-xs text-linear-text-tertiary">{activity.action}</span>
                    <span className="ml-auto text-[11px] text-linear-text-muted">
                      {activity.timestamp}
                    </span>
                  </div>
                  {activity.message && (
                    <div className="mt-1.5 rounded-lg bg-linear-bg-tertiary px-3 py-2.5 text-[13px] leading-relaxed text-linear-text-secondary">
                      {activity.message}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {activities.length === 0 && (
              <p className="py-4 text-center text-xs text-linear-text-muted">
                Nicio activitate inca
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Comment Input */}
      <div className="border-t border-linear-border-subtle p-5">
        <div className="flex gap-2.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: currentUserColor }}
          >
            {currentUserInitials}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Adauga un comentariu..."
              rows={2}
              className="w-full resize-none rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2.5 text-[13px] text-linear-text-primary placeholder:text-linear-text-muted transition-colors focus:border-linear-accent focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="rounded-md bg-linear-accent px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-linear-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Trimite
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
