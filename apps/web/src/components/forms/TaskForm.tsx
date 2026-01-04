'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Input, TextArea } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CaseSearchField } from '@/components/forms/fields/CaseSearchField';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { useCreateTask, type TaskType, type TaskPriority } from '@/hooks/mobile/useCreateTask';
import { SubtaskModal } from './SubtaskModal';
import { cn } from '@/lib/utils';

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface PendingSubtask {
  id: string; // temp ID
  title: string;
  priority: TaskPriority;
  estimatedDuration: string;
  assigneeId: string;
}

interface TaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaults?: {
    date?: string;
    assigneeId?: string;
  };
  // NEW PROPS:
  editingTaskId?: string; // If set, we're editing, not creating
  parentTaskId?: string; // If set, this is a subtask
  inheritedCase?: {
    // Case inherited from parent (for subtasks)
    id: string;
    caseNumber: string;
    title: string;
  };
}

const ESTIMATED_DURATION_OPTIONS = [
  { value: '0.5', label: '30 min' },
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '1 day' },
  { value: '16', label: '2 days' },
  { value: '24', label: '3 days' },
  { value: '40', label: '1 week' },
];

interface FormErrors {
  title?: string;
  case?: string;
  assignee?: string;
  date?: string;
}

const TASK_TYPES: TaskType[] = [
  'Research',
  'DocumentCreation',
  'DocumentRetrieval',
  'CourtDate',
  'Meeting',
  'BusinessTrip',
];

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Research: 'Research',
  DocumentCreation: 'Document Creation',
  DocumentRetrieval: 'Document Retrieval',
  CourtDate: 'Court Date',
  Meeting: 'Meeting',
  BusinessTrip: 'Business Trip',
};

const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export function TaskForm({
  onSuccess,
  onCancel,
  defaults,
  editingTaskId,
  parentTaskId,
  inheritedCase,
}: TaskFormProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(inheritedCase ?? null);
  const [assignees, setAssignees] = useState<TeamAssignment[]>(
    defaults?.assigneeId ? [{ userId: defaults.assigneeId, role: 'Lead' }] : []
  );
  const [date, setDate] = useState(defaults?.date ?? '');
  const [estimatedDuration, setEstimatedDuration] = useState('1'); // Default 1 hour
  const [taskType, setTaskType] = useState<TaskType>('Research');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [description, setDescription] = useState('');

  // Subtask state
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [pendingSubtasks, setPendingSubtasks] = useState<PendingSubtask[]>([]);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Hook for creating tasks
  const { createTask, loading } = useCreateTask();

  // Determine form mode
  const isCreatingSubtask = !!parentTaskId;
  const isEditingTask = !!editingTaskId;
  const showAddSubtaskButton = isEditingTask && !isCreatingSubtask;

  // Auto-set case from inheritedCase when creating a subtask
  useEffect(() => {
    if (inheritedCase && !selectedCase) {
      setSelectedCase(inheritedCase);
    }
  }, [inheritedCase, selectedCase]);

  // Helper to remove pending subtasks
  const removePendingSubtask = useCallback((id: string) => {
    setPendingSubtasks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Handler for when subtask modal creates a subtask
  const handleSubtaskCreated = useCallback(() => {
    // For now, we just close the modal
    // In the future, this could add to pendingSubtasks or refresh the list
    setSubtaskModalOpen(false);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!selectedCase) {
      newErrors.case = 'Case is required';
    }

    if (assignees.length === 0) {
      newErrors.assignee = 'At least one assignee is required';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, selectedCase, assignees, date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!validateForm()) {
      return;
    }

    // Get the lead assignee (or first assignee if no lead)
    const leadAssignee = assignees.find((a) => a.role === 'Lead') ?? assignees[0];

    try {
      await createTask({
        caseId: selectedCase!.id,
        title: title.trim(),
        type: taskType,
        assignedTo: leadAssignee.userId,
        dueDate: date,
        estimatedHours: parseFloat(estimatedDuration),
        description: description.trim() || undefined,
        priority,
      });

      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
      console.error('Failed to create task:', error);
    }
  };

  // Re-validate on field changes if user has attempted submit
  React.useEffect(() => {
    if (hasAttemptedSubmit) {
      validateForm();
    }
  }, [hasAttemptedSubmit, validateForm]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Title<span className="ml-0.5 text-linear-error">*</span>
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title"
          error={!!errors.title}
          errorMessage={errors.title}
        />
      </div>

      {/* Case - read-only when creating subtask with inherited case */}
      {isCreatingSubtask && inheritedCase ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
            Case<span className="ml-0.5 text-linear-error">*</span>
          </label>
          <div className="flex w-full rounded-md bg-linear-bg-tertiary border border-linear-border-subtle text-linear-text-primary h-8 text-sm px-3 items-center">
            <span className="text-linear-accent mr-2">{inheritedCase.caseNumber}</span>
            <span className="text-linear-text-secondary truncate">{inheritedCase.title}</span>
          </div>
          <p className="mt-1.5 text-xs text-linear-text-tertiary">Inherited from parent task</p>
        </div>
      ) : (
        <CaseSearchField
          label="Case"
          required
          value={selectedCase}
          onChange={setSelectedCase}
          error={!!errors.case}
          errorMessage={errors.case}
          placeholder="Search for a case..."
        />
      )}

      {/* Assignee */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Assignee<span className="ml-0.5 text-linear-error">*</span>
        </label>
        <TeamMemberSelect value={assignees} onChange={setAssignees} error={errors.assignee} />
      </div>

      {/* Due Date and Estimated Duration - same row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
            Due Date<span className="ml-0.5 text-linear-error">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(
              'flex w-full rounded-md bg-linear-bg-elevated border text-linear-text-primary',
              'placeholder:text-linear-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150',
              'h-8 text-sm px-3',
              errors.date
                ? 'border-linear-error focus:ring-linear-error'
                : 'border-linear-border-subtle'
            )}
          />
          {errors.date && <p className="mt-1.5 text-xs text-linear-error">{errors.date}</p>}
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
            Estimated Time
          </label>
          <Select value={estimatedDuration} onValueChange={setEstimatedDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTIMATED_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Type */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">Type</label>
        <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TASK_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Priority
        </label>
        <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
          <SelectTrigger>
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Description
        </label>
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter task description (optional)"
          rows={3}
        />
      </div>

      {/* Add Subtask Button - only show when editing existing task (not when creating subtask) */}
      {showAddSubtaskButton && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSubtaskModalOpen(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Subtask
          </Button>

          {/* Pending subtasks display */}
          {pendingSubtasks.length > 0 && (
            <div className="space-y-2 mt-3">
              <span className="text-xs text-linear-text-tertiary">
                Pending subtasks ({pendingSubtasks.length})
              </span>
              {pendingSubtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 p-2 bg-linear-bg-tertiary rounded-md"
                >
                  <span className="flex-1 text-sm text-linear-text-primary">{subtask.title}</span>
                  <button
                    type="button"
                    onClick={() => removePendingSubtask(subtask.id)}
                    className="text-linear-text-tertiary hover:text-linear-error"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Button Row */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isCreatingSubtask ? 'Create Subtask' : isEditingTask ? 'Save Task' : 'Create Task'}
        </Button>
      </div>

      {/* Subtask Modal */}
      {showAddSubtaskButton && editingTaskId && selectedCase && (
        <SubtaskModal
          open={subtaskModalOpen}
          onOpenChange={setSubtaskModalOpen}
          parentTask={{
            id: editingTaskId,
            title: title,
            case: selectedCase,
          }}
          onSuccess={handleSubtaskCreated}
        />
      )}
    </form>
  );
}
