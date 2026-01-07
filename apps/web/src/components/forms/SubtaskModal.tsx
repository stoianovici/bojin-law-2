'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui';
import { TextArea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { useCreateTask, type TaskType, type TaskPriority } from '@/hooks/mobile/useCreateTask';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ParentTask {
  id: string;
  title: string;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface SubtaskModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Parent task to create subtask for */
  parentTask: ParentTask;
  /** Callback when subtask is successfully created */
  onSuccess?: () => void;
}

interface FormErrors {
  title?: string;
  assignee?: string;
  date?: string;
}

const ESTIMATED_DURATION_OPTIONS = [
  { value: '0.5', label: '30 min' },
  { value: '1', label: '1 oră' },
  { value: '2', label: '2 ore' },
  { value: '4', label: '4 ore' },
  { value: '8', label: '1 zi' },
];

const TASK_TYPES: TaskType[] = [
  'Research',
  'DocumentCreation',
  'DocumentRetrieval',
  'CourtDate',
  'Meeting',
  'BusinessTrip',
];

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Research: 'Cercetare',
  DocumentCreation: 'Creare document',
  DocumentRetrieval: 'Obținere document',
  CourtDate: 'Termen instanță',
  Meeting: 'Întâlnire',
  BusinessTrip: 'Deplasare',
};

const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

// ============================================================================
// SubtaskModal Component
// ============================================================================

export function SubtaskModal({ open, onOpenChange, parentTask, onSuccess }: SubtaskModalProps) {
  const t = useTranslations('validation');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<TeamAssignment[]>([]);
  const [date, setDate] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('1');
  const [taskType, setTaskType] = useState<TaskType>('Research');
  const [priority, setPriority] = useState<TaskPriority>('Medium');

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Hook for creating tasks
  const { createTask, loading } = useCreateTask();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setTitle('');
        setDescription('');
        setAssignees([]);
        setDate('');
        setEstimatedDuration('1');
        setTaskType('Research');
        setPriority('Medium');
        setErrors({});
        setSubmitError(null);
        setHasAttemptedSubmit(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Pre-fill assignee from parent task if available
  useEffect(() => {
    if (open && parentTask.assignee && assignees.length === 0) {
      setAssignees([{ userId: parentTask.assignee.id, role: 'Lead' }]);
    }
  }, [open, parentTask.assignee, assignees.length]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = t('titleRequired');
    }

    if (assignees.length === 0) {
      newErrors.assignee = t('selectAssignee');
    }

    if (!date) {
      newErrors.date = t('dateRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, assignees, date, t]);

  // Re-validate on field changes if user has attempted submit
  useEffect(() => {
    if (hasAttemptedSubmit) {
      validateForm();
    }
  }, [hasAttemptedSubmit, validateForm]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setHasAttemptedSubmit(true);
      setSubmitError(null);

      if (!validateForm()) {
        return;
      }

      // Subtasks require a case (inherited from parent)
      if (!parentTask.case) {
        setSubmitError(
          'Sarcina părinte trebuie să fie asociată cu un dosar pentru a crea subsarcini.'
        );
        return;
      }

      const leadAssignee = assignees.find((a) => a.role === 'Lead') ?? assignees[0];

      try {
        await createTask({
          caseId: parentTask.case.id,
          title: title.trim(),
          type: taskType,
          assignedTo: leadAssignee.userId,
          dueDate: date,
          estimatedHours: parseFloat(estimatedDuration),
          description: description.trim() || undefined,
          priority,
          // Note: parentTaskId will be passed by backend when the mutation supports it
          // For now, the mutation input needs to be extended
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Eroare la crearea subsarcinii');
      }
    },
    [
      validateForm,
      parentTask.case,
      assignees,
      createTask,
      title,
      taskType,
      date,
      estimatedDuration,
      description,
      priority,
      onOpenChange,
      onSuccess,
    ]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Adaugă subsarcină</DialogTitle>
          <DialogDescription>
            Creează o subsarcină pentru &quot;{parentTask.title}&quot;
            {parentTask.case && (
              <span className="text-linear-accent ml-1">({parentTask.case.caseNumber})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 px-6">
            {/* Title Field */}
            <div>
              <label
                htmlFor="subtask-title"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Titlu <span className="text-linear-error">*</span>
              </label>
              <Input
                id="subtask-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Introduceți titlul sarcinii"
                disabled={loading}
                error={!!errors.title}
                errorMessage={errors.title}
                autoFocus
              />
            </div>

            {/* Assignee */}
            <div>
              <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                Responsabil <span className="text-linear-error">*</span>
              </label>
              <TeamMemberSelect value={assignees} onChange={setAssignees} error={errors.assignee} />
            </div>

            {/* Due Date and Estimated Duration - same row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                  Data scadentă <span className="text-linear-error">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={loading}
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
                <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                  Durată estimată
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

            {/* Task Type and Priority - same row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                  Tip
                </label>
                <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează tipul" />
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
              <div className="flex-1">
                <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                  Prioritate
                </label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează prioritatea" />
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
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                Descriere <span className="text-linear-text-muted">(opțional)</span>
              </label>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrieți sarcina..."
                rows={2}
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {submitError && (
              <div
                className={cn(
                  'flex items-start gap-2 p-3 rounded-lg',
                  'bg-linear-error/10 border border-linear-error/30'
                )}
              >
                <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-linear-error">{submitError}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anulează
            </Button>
            <Button type="submit" disabled={loading || !title.trim()} loading={loading}>
              {loading ? (
                'Se creează...'
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adaugă subsarcină
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

SubtaskModal.displayName = 'SubtaskModal';

export default SubtaskModal;
