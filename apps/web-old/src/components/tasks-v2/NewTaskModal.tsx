'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FormModal, FormGroup, FormRow, FormDivider } from '@/components/linear/FormModal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, GitBranch, Plus, X } from 'lucide-react';
import type { TaskPriority, TaskStatus } from './TaskItem';

// ====================================================================
// NewTaskModal - Create new task form
// ====================================================================

export interface NewTaskFormData {
  title: string;
  description: string;
  caseId?: string;
  caseRef?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId?: string;
  subtasks: string[];
}

export interface AssigneeOption {
  id: string;
  name: string;
  initials: string;
  color?: string;
}

export interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

export interface NewTaskModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void;
  /** Available assignees */
  assignees?: AssigneeOption[];
  /** Available cases */
  cases?: CaseOption[];
  /** Callback when task is created */
  onSubmit: (data: NewTaskFormData) => void | Promise<void>;
  /** Initial values */
  initialValues?: Partial<NewTaskFormData>;
  /** Loading state */
  loading?: boolean;
}

const priorities: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgenta', color: '#ef4444' },
  { value: 'high', label: 'Inalta', color: '#f97316' },
  { value: 'medium', label: 'Medie', color: '#eab308' },
  { value: 'low', label: 'Scazuta', color: '#22c55e' },
];

const statuses: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planificat', color: '#71717a' },
  { value: 'in-progress', label: 'In lucru', color: '#6366f1' },
  { value: 'review', label: 'Review', color: '#a855f7' },
  { value: 'completed', label: 'Finalizat', color: '#22c55e' },
];

/**
 * NewTaskModal provides a form for creating new tasks:
 * - Title input (larger)
 * - Description textarea
 * - Case selector
 * - Due date picker
 * - Priority selector
 * - Status selector
 * - Assignee selector
 * - Subtasks list with add/remove
 */
export function NewTaskModal({
  open,
  onOpenChange,
  assignees = [],
  cases = [],
  onSubmit,
  initialValues,
  loading,
}: NewTaskModalProps) {
  const [formData, setFormData] = React.useState<NewTaskFormData>({
    title: initialValues?.title || '',
    description: initialValues?.description || '',
    caseId: initialValues?.caseId,
    caseRef: initialValues?.caseRef,
    dueDate: initialValues?.dueDate,
    priority: initialValues?.priority || 'high',
    status: initialValues?.status || 'planned',
    assigneeId: initialValues?.assigneeId,
    subtasks: initialValues?.subtasks || [],
  });

  const [newSubtask, setNewSubtask] = React.useState('');
  const [caseSearch, setCaseSearch] = React.useState('');
  const [showCaseDropdown, setShowCaseDropdown] = React.useState(false);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setFormData({
        title: '',
        description: '',
        caseId: undefined,
        caseRef: undefined,
        dueDate: undefined,
        priority: 'high',
        status: 'planned',
        assigneeId: undefined,
        subtasks: [],
      });
      setNewSubtask('');
      setCaseSearch('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    await onSubmit(formData);
  };

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setFormData((prev) => ({
        ...prev,
        subtasks: [...prev.subtasks, newSubtask.trim()],
      }));
      setNewSubtask('');
    }
  };

  const handleRemoveSubtask = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index),
    }));
  };

  const handleSelectCase = (caseOption: CaseOption) => {
    setFormData((prev) => ({
      ...prev,
      caseId: caseOption.id,
      caseRef: caseOption.caseNumber,
    }));
    setCaseSearch(caseOption.caseNumber);
    setShowCaseDropdown(false);
  };

  const filteredCases = cases.filter(
    (c) =>
      c.caseNumber.toLowerCase().includes(caseSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(caseSearch.toLowerCase())
  );

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Sarcina noua"
      submitLabel="Creeaza sarcina"
      onSubmit={handleSubmit}
      loading={loading}
      width="md"
    >
      {/* Title Input - Larger */}
      <FormGroup>
        <Input
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Titlu sarcina..."
          className="text-base font-medium py-3"
          autoFocus
        />
      </FormGroup>

      {/* Description */}
      <FormGroup>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Adauga o descriere..."
          rows={3}
        />
      </FormGroup>

      <FormDivider />

      {/* Case & Due Date */}
      <FormRow>
        <FormGroup label="Caz">
          <div className="relative">
            <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-tertiary" />
            <Input
              value={caseSearch}
              onChange={(e) => {
                setCaseSearch(e.target.value);
                setShowCaseDropdown(true);
              }}
              onFocus={() => setShowCaseDropdown(true)}
              placeholder="Cauta caz..."
              className="pl-9"
            />
            {showCaseDropdown && filteredCases.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-linear-border-subtle bg-linear-bg-secondary shadow-lg">
                {filteredCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCase(c)}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-linear-bg-hover"
                  >
                    <span className="text-sm font-medium text-linear-accent">{c.caseNumber}</span>
                    <span className="text-xs text-linear-text-tertiary line-clamp-1">
                      {c.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </FormGroup>

        <FormGroup label="Scadenta">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-tertiary pointer-events-none" />
            <Input
              type="date"
              value={formData.dueDate || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="pl-9"
            />
          </div>
        </FormGroup>
      </FormRow>

      {/* Priority */}
      <FormGroup label="Prioritate">
        <div className="flex gap-2">
          {priorities.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, priority: p.value }))}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-[13px] transition-all',
                formData.priority === p.value
                  ? 'border-linear-accent bg-linear-accent-muted text-linear-text-primary'
                  : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </FormGroup>

      {/* Status */}
      <FormGroup label="Status">
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, status: s.value }))}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-all',
                formData.status === s.value
                  ? 'border-linear-accent bg-linear-accent-muted text-linear-text-primary'
                  : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </FormGroup>

      {/* Assignee */}
      {assignees.length > 0 && (
        <FormGroup label="Responsabil">
          <div className="flex flex-wrap gap-2">
            {assignees.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, assigneeId: a.id }))}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-all',
                  formData.assigneeId === a.id
                    ? 'border-linear-accent bg-linear-accent-muted text-linear-text-primary'
                    : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary'
                )}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: a.color || 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {a.initials}
                </span>
                {a.name}
              </button>
            ))}
          </div>
        </FormGroup>
      )}

      <FormDivider />

      {/* Subtasks */}
      <FormGroup label="Subtask-uri">
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary p-3">
          {formData.subtasks.map((subtask, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 border-b border-linear-border-subtle py-2 last:border-b-0"
            >
              <div className="h-4 w-4 flex-shrink-0 rounded border border-linear-border-default" />
              <span className="flex-1 text-[13px] text-linear-text-primary">{subtask}</span>
              <button
                type="button"
                onClick={() => handleRemoveSubtask(index)}
                className="flex h-5 w-5 items-center justify-center rounded text-linear-text-muted opacity-0 transition-opacity hover:bg-linear-bg-hover hover:text-linear-text-primary group-hover:opacity-100"
                style={{ opacity: 1 }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Add subtask input */}
          <div className="flex items-center gap-2.5 py-2">
            <div className="h-4 w-4 flex-shrink-0" />
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
              placeholder="Adauga subtask..."
              className="flex-1 bg-transparent text-[13px] text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none"
            />
          </div>

          {/* Add button */}
          <button
            type="button"
            onClick={handleAddSubtask}
            className="flex items-center gap-2 py-2 text-[13px] text-linear-text-tertiary transition-colors hover:text-linear-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Adauga subtask
          </button>
        </div>
      </FormGroup>
    </FormModal>
  );
}
