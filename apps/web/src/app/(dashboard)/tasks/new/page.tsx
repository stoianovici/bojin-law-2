'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  AlertCircle,
  Plus,
  X,
  ListTodo,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, TextArea } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CaseSearchField } from '@/components/forms/fields/CaseSearchField';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { useCreateTask, type TaskType, type TaskPriority } from '@/hooks/mobile/useCreateTask';
import { useTeamMembers } from '@/hooks/mobile/useTeamMembers';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Constants
// ============================================================================

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface PendingSubtask {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  priority: TaskPriority;
  type: TaskType;
  estimatedDuration: string;
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
  Research: 'Cercetare',
  DocumentCreation: 'Creare Document',
  DocumentRetrieval: 'Obținere Document',
  CourtDate: 'Termen Instanță',
  Meeting: 'Întâlnire',
  BusinessTrip: 'Deplasare',
};

const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  Low: 'Scăzută',
  Medium: 'Medie',
  High: 'Ridicată',
  Urgent: 'Urgentă',
};

const ESTIMATED_DURATION_OPTIONS = [
  { value: '0.5', label: '30 min' },
  { value: '1', label: '1 oră' },
  { value: '2', label: '2 ore' },
  { value: '4', label: '4 ore' },
  { value: '8', label: '1 zi' },
  { value: '16', label: '2 zile' },
  { value: '24', label: '3 zile' },
  { value: '40', label: '1 săptămână' },
];

// ============================================================================
// Components
// ============================================================================

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-linear-text-secondary">
      {children}
      {required && <span className="text-linear-error ml-0.5">*</span>}
    </label>
  );
}

function PriorityPill({
  priority,
  selected,
  onClick,
}: {
  priority: TaskPriority;
  selected: boolean;
  onClick: () => void;
}) {
  const colors: Record<
    TaskPriority,
    { bg: string; border: string; text: string; selectedBg: string }
  > = {
    Low: {
      bg: 'bg-transparent',
      border: 'border-linear-border-subtle',
      text: 'text-linear-text-tertiary',
      selectedBg: 'bg-gray-500/20',
    },
    Medium: {
      bg: 'bg-transparent',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      selectedBg: 'bg-blue-500/20',
    },
    High: {
      bg: 'bg-transparent',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      selectedBg: 'bg-amber-500/20',
    },
    Urgent: {
      bg: 'bg-transparent',
      border: 'border-red-500/30',
      text: 'text-red-400',
      selectedBg: 'bg-red-500/20',
    },
  };
  const c = colors[priority];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
        selected
          ? `${c.selectedBg} ${c.border} ${c.text} ring-1 ring-offset-1 ring-offset-linear-bg-primary`
          : `${c.bg} ${c.border} ${c.text} opacity-60 hover:opacity-100`,
        selected && priority === 'Low' && 'ring-gray-500/50',
        selected && priority === 'Medium' && 'ring-blue-500/50',
        selected && priority === 'High' && 'ring-amber-500/50',
        selected && priority === 'Urgent' && 'ring-red-500/50'
      )}
    >
      {PRIORITY_LABELS[priority]}
    </button>
  );
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-linear-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 py-4 text-left hover:bg-linear-bg-hover/50 transition-colors -mx-1 px-1 rounded-lg"
      >
        <div className="w-7 h-7 rounded-lg bg-linear-bg-tertiary flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <span className="flex-1 text-sm font-medium text-linear-text-primary">{title}</span>
        {badge}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-linear-text-tertiary transition-transform',
            !isOpen && '-rotate-90'
          )}
        />
      </button>
      {isOpen && <div className="pb-4 pl-10">{children}</div>}
    </div>
  );
}

// Subtask Modal Component
function SubtaskModal({
  isOpen,
  onClose,
  onAdd,
  teamMembers,
  teamLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (subtask: Omit<PendingSubtask, 'id'>) => void;
  teamMembers: Array<{ id: string; firstName: string; lastName: string }>;
  teamLoading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [type, setType] = useState<TaskType>('Research');
  const [duration, setDuration] = useState('1');

  const handleAdd = useCallback(() => {
    if (!title.trim() || !assigneeId || !dueDate) return;

    const assignee = teamMembers.find((m) => m.id === assigneeId);
    const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : '';

    onAdd({
      title: title.trim(),
      assigneeId,
      assigneeName,
      dueDate,
      priority,
      type,
      estimatedDuration: duration,
    });

    // Reset for next subtask
    setTitle('');
    setAssigneeId('');
    setDueDate('');
    setPriority('Medium');
    setType('Research');
    setDuration('1');
  }, [title, assigneeId, dueDate, priority, type, duration, teamMembers, onAdd]);

  const handleClose = useCallback(() => {
    setTitle('');
    setAssigneeId('');
    setDueDate('');
    setPriority('Medium');
    setType('Research');
    setDuration('1');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const canAdd = title.trim() && assigneeId && dueDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-linear-bg-secondary rounded-2xl border border-linear-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-linear-border-subtle">
          <h3 className="text-base font-semibold text-linear-text-primary">Adaugă subtask</h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-linear-bg-hover transition-colors"
          >
            <X className="w-4 h-4 text-linear-text-tertiary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <FieldLabel required>Titlu</FieldLabel>
            <Input
              size="md"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ce trebuie făcut?"
              autoFocus
            />
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <FieldLabel required>Responsabil</FieldLabel>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={teamLoading ? 'Se încarcă...' : 'Alege persoana'} />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date + Duration Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel required>Termen</FieldLabel>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={cn(
                  'flex w-full rounded-lg bg-linear-bg-elevated border text-linear-text-primary',
                  'border-linear-border-subtle',
                  'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
                  'transition-colors duration-150',
                  'h-10 text-sm px-3'
                )}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Durată</FieldLabel>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  {ESTIMATED_DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <FieldLabel>Tip</FieldLabel>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TASK_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Pills */}
          <div className="space-y-1.5">
            <FieldLabel>Prioritate</FieldLabel>
            <div className="flex gap-2">
              {TASK_PRIORITIES.map((p) => (
                <PriorityPill
                  key={p}
                  priority={p}
                  selected={priority === p}
                  onClick={() => setPriority(p)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-linear-border-subtle bg-linear-bg-tertiary/50 rounded-b-2xl">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Anulează
          </Button>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={!canAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adaugă
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedCaseId = searchParams.get('caseId');

  // Form state
  const [title, setTitle] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [assignees, setAssignees] = useState<TeamAssignment[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('1');
  const [taskType, setTaskType] = useState<TaskType>('Research');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [description, setDescription] = useState('');

  // Subtask state
  const [pendingSubtasks, setPendingSubtasks] = useState<PendingSubtask[]>([]);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);

  // Fetch team members for subtask assignment
  const { members: teamMembers, loading: teamLoading } = useTeamMembers();

  // Validation state
  const [showErrors, setShowErrors] = useState(false);

  // Hook for creating tasks
  const { createTask, loading: submitting, error: submitError } = useCreateTask();

  // Validation
  const errors = {
    title: !title.trim() ? 'Titlul este obligatoriu' : undefined,
    case: !selectedCase ? 'Dosarul este obligatoriu' : undefined,
    assignee: assignees.length === 0 ? 'Cel puțin un responsabil este obligatoriu' : undefined,
    dueDate: !dueDate ? 'Data scadentă este obligatorie' : undefined,
  };

  const hasErrors = Object.values(errors).some(Boolean);
  const isValid = !hasErrors;

  // Count completed required fields for progress indicator
  const completedFields = [!!title.trim(), !!selectedCase, assignees.length > 0, !!dueDate].filter(
    Boolean
  ).length;
  const totalRequiredFields = 4;

  // Add a pending subtask
  const handleAddSubtask = useCallback((subtask: Omit<PendingSubtask, 'id'>) => {
    setPendingSubtasks((prev) => [...prev, { ...subtask, id: `pending-${Date.now()}` }]);
  }, []);

  // Remove a pending subtask
  const handleRemoveSubtask = (id: string) => {
    setPendingSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!isValid || submitting || !selectedCase) return;

    // Get the lead assignee (or first assignee if no lead)
    const leadAssignee = assignees.find((a) => a.role === 'Lead') ?? assignees[0];

    try {
      // Create the main task
      const result = await createTask({
        caseId: selectedCase.id,
        title: title.trim(),
        type: taskType,
        assignedTo: leadAssignee.userId,
        dueDate,
        estimatedHours: parseFloat(estimatedDuration),
        description: description.trim() || undefined,
        priority,
      });

      if (result) {
        // Create subtasks if any, linking them to parent task
        for (const subtask of pendingSubtasks) {
          try {
            await createTask({
              caseId: selectedCase.id,
              title: subtask.title,
              type: subtask.type,
              assignedTo: subtask.assigneeId,
              dueDate: subtask.dueDate,
              estimatedHours: parseFloat(subtask.estimatedDuration),
              priority: subtask.priority,
              parentTaskId: result.id, // Link subtask to parent
            });
          } catch (subtaskErr) {
            console.error('Failed to create subtask:', subtaskErr);
          }
        }

        router.push('/tasks');
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary">
      {/* Sticky Header */}
      <div className="px-8 py-4 border-b border-linear-border-subtle flex-shrink-0 bg-linear-bg-primary/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/tasks')}
              className="p-2 -ml-2 rounded-lg hover:bg-linear-bg-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-linear-text-secondary" />
            </button>
            <h1 className="text-base font-semibold text-linear-text-primary">Sarcină nouă</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mr-2">
              <div className="flex gap-1">
                {[...Array(totalRequiredFields)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-colors',
                      i < completedFields ? 'bg-linear-accent' : 'bg-linear-border-subtle'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-linear-text-tertiary">
                {completedFields}/{totalRequiredFields}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => router.push('/tasks')}>
              Anulează
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              leftIcon={submitting ? undefined : <ClipboardList className="w-4 h-4" />}
            >
              {submitting ? 'Se creează...' : 'Creează'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 w-full">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {/* Main Form Card */}
          <div className="rounded-xl border border-linear-border-subtle bg-linear-bg-secondary overflow-hidden">
            {/* Title Input - Hero style */}
            <div className="px-6 pt-6 pb-4 border-b border-linear-border-subtle">
              <Input
                size="lg"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ce trebuie făcut?"
                error={showErrors && !!errors.title}
                className="text-lg font-medium border-0 bg-transparent px-0 focus:ring-0 placeholder:text-linear-text-muted"
              />
              {showErrors && errors.title && (
                <p className="text-xs text-linear-error mt-1">{errors.title}</p>
              )}
            </div>

            {/* Quick Actions Row */}
            <div className="px-6 py-3 border-b border-linear-border-subtle bg-linear-bg-tertiary/30">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Priority Pills */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-linear-text-tertiary">Prioritate:</span>
                  <div className="flex gap-1.5">
                    {TASK_PRIORITIES.map((p) => (
                      <PriorityPill
                        key={p}
                        priority={p}
                        selected={priority === p}
                        onClick={() => setPriority(p)}
                      />
                    ))}
                  </div>
                </div>

                <div className="w-px h-5 bg-linear-border-subtle" />

                {/* Task Type */}
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-linear-text-tertiary" />
                  <Select
                    value={taskType}
                    onValueChange={(value) => setTaskType(value as TaskType)}
                  >
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover min-w-[100px]">
                      <SelectValue />
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

                <div className="w-px h-5 bg-linear-border-subtle" />

                {/* Estimated Duration */}
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-linear-text-tertiary" />
                  <Select value={estimatedDuration} onValueChange={setEstimatedDuration}>
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover min-w-[70px]">
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
            </div>

            {/* Form Sections */}
            <div className="px-6 py-2">
              {/* Case Selection */}
              <CollapsibleSection
                title="Dosar"
                icon={<Briefcase className="w-4 h-4 text-linear-text-tertiary" />}
                badge={
                  selectedCase ? (
                    <span className="text-xs text-linear-accent bg-linear-accent/10 px-2 py-0.5 rounded-full">
                      {selectedCase.caseNumber}
                    </span>
                  ) : showErrors && errors.case ? (
                    <span className="text-xs text-linear-error">Obligatoriu</span>
                  ) : null
                }
              >
                <CaseSearchField
                  value={selectedCase}
                  onChange={setSelectedCase}
                  error={showErrors && !!errors.case}
                  placeholder="Caută un dosar..."
                />
              </CollapsibleSection>

              {/* Assignees */}
              <CollapsibleSection
                title="Responsabil"
                icon={<User className="w-4 h-4 text-linear-text-tertiary" />}
                badge={
                  assignees.length > 0 ? (
                    <span className="text-xs text-linear-text-secondary bg-linear-bg-elevated px-2 py-0.5 rounded-full">
                      {assignees.length} {assignees.length === 1 ? 'persoană' : 'persoane'}
                    </span>
                  ) : showErrors && errors.assignee ? (
                    <span className="text-xs text-linear-error">Obligatoriu</span>
                  ) : null
                }
              >
                <TeamMemberSelect
                  value={assignees}
                  onChange={setAssignees}
                  error={showErrors ? errors.assignee : undefined}
                />
              </CollapsibleSection>

              {/* Due Date */}
              <CollapsibleSection
                title="Termen"
                icon={<Clock className="w-4 h-4 text-linear-text-tertiary" />}
                badge={
                  dueDate ? (
                    <span className="text-xs text-linear-text-secondary">
                      {new Date(dueDate).toLocaleDateString('ro-RO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  ) : showErrors && errors.dueDate ? (
                    <span className="text-xs text-linear-error">Obligatoriu</span>
                  ) : null
                }
              >
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={cn(
                    'flex w-full rounded-lg bg-linear-bg-elevated border text-linear-text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
                    'transition-colors duration-150',
                    'h-10 text-sm px-3',
                    showErrors && errors.dueDate
                      ? 'border-linear-error'
                      : 'border-linear-border-subtle'
                  )}
                />
              </CollapsibleSection>

              {/* Description - Collapsible, default closed */}
              <CollapsibleSection
                title="Descriere"
                icon={<ListTodo className="w-4 h-4 text-linear-text-tertiary" />}
                defaultOpen={false}
                badge={
                  description.trim() ? (
                    <span className="text-xs text-linear-text-tertiary truncate max-w-[150px]">
                      {description.slice(0, 30)}
                      {description.length > 30 ? '...' : ''}
                    </span>
                  ) : null
                }
              >
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalii suplimentare..."
                  rows={3}
                />
              </CollapsibleSection>

              {/* Subtasks Section */}
              <CollapsibleSection
                title="Subtask-uri"
                icon={<ListTodo className="w-4 h-4 text-linear-text-tertiary" />}
                defaultOpen={pendingSubtasks.length > 0}
                badge={
                  pendingSubtasks.length > 0 ? (
                    <span className="text-xs text-linear-accent bg-linear-accent/10 px-2 py-0.5 rounded-full">
                      {pendingSubtasks.length}
                    </span>
                  ) : null
                }
              >
                <div className="space-y-2">
                  {/* Subtask List */}
                  {pendingSubtasks.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {pendingSubtasks.map((subtask, index) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-linear-bg-tertiary border border-linear-border-subtle group"
                        >
                          <div className="w-5 h-5 rounded-full border-2 border-linear-border-subtle flex items-center justify-center text-[10px] text-linear-text-tertiary">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-linear-text-primary truncate">
                              {subtask.title}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-linear-text-muted mt-0.5">
                              <span>{subtask.assigneeName}</span>
                              <span>•</span>
                              <span>
                                {new Date(subtask.dueDate).toLocaleDateString('ro-RO', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                              <span>•</span>
                              <span
                                className={cn(
                                  subtask.priority === 'Urgent' && 'text-red-400',
                                  subtask.priority === 'High' && 'text-amber-400',
                                  subtask.priority === 'Medium' && 'text-blue-400'
                                )}
                              >
                                {PRIORITY_LABELS[subtask.priority]}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtask(subtask.id)}
                            className="p-1.5 rounded-lg text-linear-text-muted hover:text-linear-error hover:bg-linear-error/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Subtask Button */}
                  <button
                    type="button"
                    onClick={() => setShowSubtaskModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-linear-border-subtle text-sm font-medium text-linear-text-secondary hover:border-linear-accent hover:text-linear-accent hover:bg-linear-accent/5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adaugă subtask
                  </button>
                </div>
              </CollapsibleSection>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="mt-4 p-4 rounded-xl bg-linear-error/10 border border-linear-error/20 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-linear-error flex-shrink-0" />
              <p className="text-sm text-linear-error">
                Nu s-a putut crea sarcina. Încercați din nou.
              </p>
            </div>
          )}

          {/* Validation Summary - shows when trying to submit with errors */}
          {showErrors && hasErrors && (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-500 mb-1">
                  Completează câmpurile obligatorii
                </p>
                <ul className="text-xs text-amber-400/80 space-y-0.5">
                  {errors.title && <li>• {errors.title}</li>}
                  {errors.case && <li>• {errors.case}</li>}
                  {errors.assignee && <li>• {errors.assignee}</li>}
                  {errors.dueDate && <li>• {errors.dueDate}</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Subtask Modal */}
      <SubtaskModal
        isOpen={showSubtaskModal}
        onClose={() => setShowSubtaskModal(false)}
        onAdd={handleAddSubtask}
        teamMembers={teamMembers}
        teamLoading={teamLoading}
      />
    </div>
  );
}
