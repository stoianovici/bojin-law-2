'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Check, X, Plus, Clock, Calendar, ChevronRight, Edit3, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { SubtaskModal } from '@/components/forms/SubtaskModal';

// ============================================================================
// TYPES
// ============================================================================

export interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TaskCase {
  id: string;
  caseNumber: string;
  title: string;
  referenceNumbers?: string[];
}

export interface FullSubtask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedDuration?: number;
  assignee?: Assignee;
}

export interface TaskDetail {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  status: string;
  priority: string;
  assignee: Assignee;
  dueDate: string;
  rawDueDate?: string; // ISO date string for editing (YYYY-MM-DD)
  estimatedDuration?: string;
  estimatedHours?: number;
  case?: TaskCase;
  fullSubtasks?: FullSubtask[];
}

export interface TaskActionsPanelProps {
  task: TaskDetail | null;
  onClose: () => void;
  onSubtaskClick?: (subtaskId: string) => void;
  onSubtaskComplete?: (subtaskId: string) => void;
  onMarkComplete?: () => void;
  onSubtaskCreated?: () => void;
  onDurationChange?: (taskId: string, hours: number) => void;
  onDueDateChange?: (taskId: string, date: string) => void;
  onAssigneeChange?: (taskId: string, assigneeId: string) => void;
  optimisticCompletedIds?: Set<string>;
  /** Available team members for assignee picker */
  teamMembers?: Assignee[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'info' | 'warning' | 'success' }
> = {
  planificat: { label: 'Planificat', variant: 'default' },
  in_lucru: { label: 'In lucru', variant: 'info' },
  'in lucru': { label: 'In lucru', variant: 'info' },
  review: { label: 'Review', variant: 'warning' },
  finalizat: { label: 'Finalizat', variant: 'success' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500' },
  high: { label: 'Ridicata', color: 'bg-amber-500' },
  medium: { label: 'Medie', color: 'bg-blue-500' },
  low: { label: 'Scazuta', color: 'bg-linear-text-muted' },
};

// ============================================================================
// HELPERS
// ============================================================================

function getStatusConfig(status: string) {
  const normalized = status.toLowerCase().trim();
  return statusConfig[normalized] || { label: status, variant: 'default' as const };
}

function getPriorityConfig(priority: string) {
  const normalized = priority.toLowerCase().trim();
  return priorityConfig[normalized] || { label: priority, color: 'bg-linear-text-muted' };
}

function formatDuration(hours?: number): string {
  if (!hours) return '';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours === 1) return '1h';
  return `${hours}h`;
}

function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Try decimal hours (e.g., "1.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Try "Xh Ym" or "Xh" format
  let hours = 0;
  const hourMatch = trimmed.match(/(\d+(\.\d+)?)\s*h/);
  const minMatch = trimmed.match(/(\d+)\s*m/);

  if (hourMatch) hours += parseFloat(hourMatch[1]);
  if (minMatch) hours += parseInt(minMatch[1]) / 60;

  return hours > 0 ? hours : null;
}

// ============================================================================
// INLINE EDITABLE DURATION COMPONENT
// ============================================================================

interface EditableDurationProps {
  value?: string;
  hours?: number;
  onChange?: (hours: number) => void;
}

function EditableDuration({ value, hours, onChange }: EditableDurationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || formatDuration(hours) || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(value || formatDuration(hours) || '');
  }, [value, hours]);

  const handleSave = () => {
    const parsed = parseDuration(inputValue);
    if (parsed !== null && onChange) {
      onChange(parsed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setInputValue(value || formatDuration(hours) || '');
      setIsEditing(false);
    }
  };

  const displayValue = value || formatDuration(hours);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder="2h, 30m"
        className="h-6 w-20 text-[12px] px-2"
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded transition-colors group',
        displayValue
          ? 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-accent'
          : 'text-linear-text-muted hover:bg-linear-bg-tertiary hover:text-linear-text-secondary'
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      <span className="text-[12px]">{displayValue || 'Adaugă'}</span>
      <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TaskActionsPanel({
  task,
  onClose,
  onSubtaskClick,
  onSubtaskComplete,
  onMarkComplete,
  onSubtaskCreated,
  onDurationChange,
  onDueDateChange,
  onAssigneeChange,
  optimisticCompletedIds,
  teamMembers = [],
}: TaskActionsPanelProps) {
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [editingDate, setEditingDate] = useState('');

  // Sync editingDate when task changes or popover opens
  useEffect(() => {
    if (task?.rawDueDate) {
      setEditingDate(task.rawDueDate);
    }
  }, [task?.rawDueDate, datePopoverOpen]);

  if (!task) {
    return null;
  }

  const handleDateSave = () => {
    if (editingDate && onDueDateChange) {
      onDueDateChange(task.id, editingDate);
    }
    setDatePopoverOpen(false);
  };

  const handleAssigneeSelect = (assigneeId: string) => {
    if (onAssigneeChange) {
      onAssigneeChange(task.id, assigneeId);
    }
    setAssigneePopoverOpen(false);
  };

  const statusConf = getStatusConfig(task.status);
  const priorityConf = getPriorityConfig(task.priority);
  const subtasks = task.fullSubtasks || [];
  const completedSubtasks = subtasks.filter(
    (s) => s.status.toLowerCase() === 'finalizat' || optimisticCompletedIds?.has(s.id)
  ).length;

  const handleSubtaskCreated = () => {
    setSubtaskModalOpen(false);
    onSubtaskCreated?.();
  };

  return (
    <div className="flex h-full flex-col bg-linear-bg-secondary min-w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-linear-border-subtle px-4 py-3 shrink-0 gap-3">
        <h3 className="text-sm font-normal text-linear-text-primary truncate flex-1">
          {task.title}
        </h3>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Description */}
          {task.description && (
            <p className="text-[13px] text-linear-text-secondary leading-relaxed mb-3">
              {task.description}
            </p>
          )}

          {/* Notes */}
          {task.notes && (
            <div className="mb-3 p-2.5 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
              <p className="text-[12px] text-linear-text-tertiary leading-relaxed">{task.notes}</p>
            </div>
          )}

          {/* Compact Info Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4 text-[12px]">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-linear-text-muted w-16">Status</span>
              <Badge variant={statusConf.variant} size="sm">
                {statusConf.label}
              </Badge>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2">
              <span className="text-linear-text-muted w-16">Prioritate</span>
              <div className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', priorityConf.color)} />
                <span className="text-linear-text-secondary">{priorityConf.label}</span>
              </div>
            </div>

            {/* Due Date - Inline Popover */}
            <div className="flex items-center gap-2">
              <span className="text-linear-text-muted w-16">Scadență</span>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 text-linear-text-secondary hover:text-linear-accent transition-colors group">
                    <Calendar className="h-3.5 w-3.5 group-hover:text-linear-accent" />
                    <span>{task.dueDate}</span>
                    <Edit3 className="h-3 w-3 text-linear-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={editingDate}
                      onChange={(e) => setEditingDate(e.target.value)}
                      className="h-8 px-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-md focus:outline-none focus:border-linear-accent text-linear-text-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDateSave();
                        if (e.key === 'Escape') setDatePopoverOpen(false);
                      }}
                    />
                    <button
                      onClick={handleDateSave}
                      className="h-8 w-8 flex items-center justify-center rounded-md bg-linear-accent text-white hover:bg-linear-accent-hover transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Assignee - Inline Popover */}
            <div className="flex items-center gap-2">
              <span className="text-linear-text-muted w-16">Atribuit</span>
              <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 hover:text-linear-accent transition-colors group">
                    <Avatar
                      size="xs"
                      name={`${task.assignee.firstName} ${task.assignee.lastName}`}
                    />
                    <span className="text-linear-text-secondary group-hover:text-linear-accent truncate">
                      {task.assignee.firstName}
                    </span>
                    <Edit3 className="h-3 w-3 text-linear-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-48 p-1">
                  <div className="max-h-48 overflow-y-auto">
                    {teamMembers.length > 0 ? (
                      teamMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleAssigneeSelect(member.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                            member.id === task.assignee.id
                              ? 'bg-linear-accent/15 text-linear-accent'
                              : 'hover:bg-linear-bg-hover text-linear-text-primary'
                          )}
                        >
                          <Avatar size="xs" name={`${member.firstName} ${member.lastName}`} />
                          <span className="text-sm truncate">
                            {member.firstName} {member.lastName}
                          </span>
                          {member.id === task.assignee.id && (
                            <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-center text-sm text-linear-text-tertiary">
                        <User className="h-5 w-5 mx-auto mb-1 opacity-50" />
                        Încărcați echipa
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Duration - Simplified editing */}
            <div className="flex items-center gap-2">
              <span className="text-linear-text-muted w-16">Durată</span>
              <EditableDuration
                value={task.estimatedDuration}
                hours={task.estimatedHours}
                onChange={(hours) => onDurationChange?.(task.id, hours)}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-4">
            <button
              onClick={onMarkComplete}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-[13px] text-linear-text-secondary hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400 transition-colors"
            >
              <Check className="h-4 w-4" />
              Finalizează
            </button>
          </div>

          {/* Subtasks Section */}
          {subtasks.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-linear-text-muted uppercase tracking-wider">
                  Subtask-uri
                </span>
                <span className="text-[11px] text-linear-text-muted">
                  {completedSubtasks}/{subtasks.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full rounded-full bg-linear-bg-tertiary mb-3 overflow-hidden">
                <div
                  className="h-full bg-linear-accent rounded-full transition-all duration-300"
                  style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                />
              </div>

              {/* Subtask list */}
              <div className="flex flex-col gap-1.5">
                {subtasks.map((subtask) => {
                  const isCompleted =
                    subtask.status.toLowerCase() === 'finalizat' ||
                    optimisticCompletedIds?.has(subtask.id);
                  const subtaskPriority = getPriorityConfig(subtask.priority);

                  return (
                    <div
                      key={subtask.id}
                      className={cn(
                        'group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                        'hover:bg-linear-bg-tertiary',
                        isCompleted && 'opacity-60'
                      )}
                      onClick={() => onSubtaskClick?.(subtask.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubtaskComplete?.(subtask.id);
                        }}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                          isCompleted
                            ? 'border-linear-accent bg-linear-accent'
                            : 'border-linear-border-strong hover:border-linear-accent'
                        )}
                      >
                        {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                      </button>
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full shrink-0', subtaskPriority.color)}
                      />
                      <span
                        className={cn(
                          'flex-1 text-[12px] truncate',
                          isCompleted
                            ? 'text-linear-text-tertiary line-through'
                            : 'text-linear-text-primary'
                        )}
                      >
                        {subtask.title}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-linear-text-muted opacity-0 group-hover:opacity-100" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Subtask */}
          <button
            onClick={() => setSubtaskModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-8 rounded-md border border-dashed border-linear-border-subtle text-[12px] text-linear-text-tertiary hover:border-linear-accent hover:text-linear-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Adaugă subtask
          </button>
        </div>
      </ScrollArea>

      {/* Subtask Modal */}
      {task.case && (
        <SubtaskModal
          open={subtaskModalOpen}
          onOpenChange={setSubtaskModalOpen}
          parentTask={{
            id: task.id,
            title: task.title,
            case: task.case,
            assignee: task.assignee,
          }}
          onSuccess={handleSubtaskCreated}
        />
      )}
    </div>
  );
}

export default TaskActionsPanel;
