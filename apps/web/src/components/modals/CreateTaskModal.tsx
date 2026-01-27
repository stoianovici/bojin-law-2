'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ClipboardList,
  AlertCircle,
  Plus,
  X,
  ListTodo,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Briefcase,
  Calendar,
  Building2,
  Users,
  FolderKanban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, TextArea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ro } from 'date-fns/locale';
import { CaseSearchField } from '@/components/forms/fields/CaseSearchField';
import { ClientSearchField } from '@/components/forms/fields/ClientSearchField';
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

interface ClientOption {
  id: string;
  name: string;
}

type TaskLevel = 'case' | 'client' | 'internal';

const TASK_LEVELS: { value: TaskLevel; label: string; icon: React.ReactNode }[] = [
  { value: 'case', label: 'Dosar', icon: <FolderKanban className="w-4 h-4" /> },
  { value: 'client', label: 'Client', icon: <Building2 className="w-4 h-4" /> },
  { value: 'internal', label: 'Intern', icon: <Users className="w-4 h-4" /> },
];

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

const HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 24, 40];
const MINUTE_OPTIONS = [0, 15, 30, 45];

function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return '0min';
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) {
    if (hours === 8) return '1 zi';
    if (hours === 16) return '2 zile';
    if (hours === 24) return '3 zile';
    if (hours === 40) return '1 săpt.';
    return `${hours}h`;
  }
  return `${hours}h ${minutes}min`;
}

function DurationPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string; // total hours as string (e.g., "1.5")
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const totalHours = parseFloat(value) || 0;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  const handleHoursChange = (newHours: string) => {
    const h = parseInt(newHours, 10);
    const newTotal = h + minutes / 60;
    onChange(newTotal.toString());
  };

  const handleMinutesChange = (newMinutes: string) => {
    const m = parseInt(newMinutes, 10);
    const newTotal = hours + m / 60;
    onChange(newTotal.toString());
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Select value={hours.toString()} onValueChange={handleHoursChange}>
          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-linear-bg-hover px-1.5 w-[52px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOUR_OPTIONS.map((h) => (
              <SelectItem key={h} value={h.toString()}>
                {h}h
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={minutes.toString()} onValueChange={handleMinutesChange}>
          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-linear-bg-hover px-1.5 w-[58px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTE_OPTIONS.map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {m}min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Clock className="w-3.5 h-3.5 text-linear-text-tertiary" />
      <Select value={hours.toString()} onValueChange={handleHoursChange}>
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover w-[48px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOUR_OPTIONS.map((h) => (
            <SelectItem key={h} value={h.toString()}>
              {h}h
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={minutes.toString()} onValueChange={handleMinutesChange}>
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover w-[56px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTE_OPTIONS.map((m) => (
            <SelectItem key={m} value={m.toString()}>
              {m}min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// Internal Components
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

function DatePickerPopover({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (date: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value) : new Date()));

  const selectedDate = value ? new Date(value) : null;

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const handleSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const handlePrevMonth = () => setViewDate(subMonths(viewDate, 1));
  const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 h-7 px-2 rounded text-xs',
            'hover:bg-linear-bg-hover transition-colors',
            error
              ? 'text-linear-error'
              : value
                ? 'text-linear-text-primary'
                : 'text-linear-text-tertiary'
          )}
        >
          <Calendar
            className={cn('w-3.5 h-3.5', error ? 'text-linear-error' : 'text-linear-text-tertiary')}
          />
          {value ? format(new Date(value), 'd MMM', { locale: ro }) : 'Termen'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-linear-bg-hover"
          >
            <ChevronLeft className="w-4 h-4 text-linear-text-secondary" />
          </button>
          <span className="text-sm font-medium text-linear-text-primary">
            {format(viewDate, 'MMMM yyyy', { locale: ro })}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-linear-bg-hover"
          >
            <ChevronRight className="w-4 h-4 text-linear-text-secondary" />
          </button>
        </div>

        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day, i) => (
            <div key={i} className="text-center text-[10px] text-linear-text-tertiary py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleSelect(day)}
                className={cn(
                  'w-7 h-7 text-xs rounded transition-colors',
                  isSelected
                    ? 'bg-linear-accent text-white'
                    : isTodayDate
                      ? 'bg-linear-accent/20 text-linear-accent'
                      : isCurrentMonth
                        ? 'text-linear-text-primary hover:bg-linear-bg-hover'
                        : 'text-linear-text-muted hover:bg-linear-bg-hover'
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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

// Inline Subtask Form Component
function InlineSubtaskForm({
  onAdd,
  onCancel,
  teamMembers,
  teamLoading,
}: {
  onAdd: (subtask: {
    title: string;
    assigneeId: string;
    assigneeName: string;
    type: TaskType;
    estimatedDuration: string;
  }) => void;
  onCancel: () => void;
  teamMembers: Array<{ id: string; firstName: string; lastName: string }>;
  teamLoading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [type, setType] = useState<TaskType>('Research');
  const [duration, setDuration] = useState('0');

  const handleAdd = useCallback(() => {
    if (!title.trim() || !assigneeId) return;

    const assignee = teamMembers.find((m) => m.id === assigneeId);
    const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : '';

    onAdd({
      title: title.trim(),
      assigneeId,
      assigneeName,
      type,
      estimatedDuration: duration,
    });

    // Reset for next subtask
    setTitle('');
    setAssigneeId('');
    setType('Research');
    setDuration('0');
  }, [title, assigneeId, type, duration, teamMembers, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim() && assigneeId) {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const canAdd = title.trim() && assigneeId;

  return (
    <div className="space-y-3">
      {/* Row 1: Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Titlu subtask..."
        autoFocus
        className="w-full h-8 px-3 text-sm bg-transparent border-b border-linear-border-subtle focus:border-linear-accent outline-none text-linear-text-primary placeholder:text-linear-text-muted transition-colors"
      />

      {/* Row 2: Controls - centered and evenly distributed */}
      <div className="flex items-center justify-center gap-4">
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-linear-bg-hover px-2">
            <User className="w-3 h-3 mr-1.5 text-linear-text-tertiary" />
            <SelectValue placeholder="Responsabil" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-4 bg-linear-border-subtle" />

        <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-linear-bg-hover px-2">
            <Briefcase className="w-3 h-3 mr-1.5 text-linear-text-tertiary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-4 bg-linear-border-subtle" />

        <DurationPicker value={duration} onChange={setDuration} compact />

        <div className="w-px h-4 bg-linear-border-subtle" />

        {/* Action buttons */}
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded text-linear-text-tertiary hover:text-linear-text-primary hover:bg-linear-bg-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={cn(
            'p-1.5 rounded transition-colors',
            canAdd
              ? 'text-linear-accent hover:bg-linear-accent/10'
              : 'text-linear-text-muted cursor-not-allowed'
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaults?: {
    caseId?: string;
    date?: string;
  };
}

export function CreateTaskModal({ open, onOpenChange, onSuccess, defaults }: CreateTaskModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [taskLevel, setTaskLevel] = useState<TaskLevel>('case');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [assignees, setAssignees] = useState<TeamAssignment[]>([]);
  const [dueDate, setDueDate] = useState(defaults?.date ?? '');
  const [estimatedDuration, setEstimatedDuration] = useState('0');
  const [taskType, setTaskType] = useState<TaskType>('Research');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [description, setDescription] = useState('');

  // Subtask state
  const [pendingSubtasks, setPendingSubtasks] = useState<PendingSubtask[]>([]);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);

  // Fetch team members for subtask assignment
  const { members: teamMembers, loading: teamLoading } = useTeamMembers();

  // Validation state
  const [showErrors, setShowErrors] = useState(false);

  // Sync dueDate with defaults when modal opens
  useEffect(() => {
    if (open && defaults?.date) {
      setDueDate(defaults.date);
    }
  }, [open, defaults?.date]);

  // Hook for creating tasks
  const { createTask, loading: submitting, error: submitError } = useCreateTask();

  // Validation (conditional based on task level)
  const errors = {
    title: !title.trim() ? 'Titlul este obligatoriu' : undefined,
    case: taskLevel === 'case' && !selectedCase ? 'Dosarul este obligatoriu' : undefined,
    client: taskLevel === 'client' && !selectedClient ? 'Clientul este obligatoriu' : undefined,
    assignee: assignees.length === 0 ? 'Cel puțin un responsabil este obligatoriu' : undefined,
    dueDate: !dueDate ? 'Data scadentă este obligatorie' : undefined,
  };

  const hasErrors = Object.values(errors).some(Boolean);
  const isValid = !hasErrors;

  // Count completed required fields for progress indicator (varies by task level)
  const targetFieldComplete =
    taskLevel === 'case' ? !!selectedCase : taskLevel === 'client' ? !!selectedClient : true; // internal tasks don't need a target
  const completedFields = [
    !!title.trim(),
    targetFieldComplete,
    assignees.length > 0,
    !!dueDate,
  ].filter(Boolean).length;
  const totalRequiredFields = 4;

  // Reset form when modal closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset form state
        setTitle('');
        setTaskLevel('case');
        setSelectedCase(null);
        setSelectedClient(null);
        setAssignees([]);
        setDueDate('');
        setEstimatedDuration('0');
        setTaskType('Research');
        setPriority('Medium');
        setDescription('');
        setPendingSubtasks([]);
        setShowSubtaskForm(false);
        setShowErrors(false);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Add a pending subtask (inherits dueDate and priority from parent task)
  const handleAddSubtask = useCallback(
    (subtask: {
      title: string;
      assigneeId: string;
      assigneeName: string;
      type: TaskType;
      estimatedDuration: string;
    }) => {
      setPendingSubtasks((prev) => [
        ...prev,
        {
          ...subtask,
          id: `pending-${Date.now()}`,
          dueDate, // Inherited from parent
          priority, // Inherited from parent
        },
      ]);
      setShowSubtaskForm(false);
    },
    [dueDate, priority]
  );

  // Remove a pending subtask
  const handleRemoveSubtask = (id: string) => {
    setPendingSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!isValid || submitting) return;

    // Validate target based on task level
    if (taskLevel === 'case' && !selectedCase) return;
    if (taskLevel === 'client' && !selectedClient) return;

    // Get the lead assignee (or first assignee if no lead)
    const leadAssignee = assignees.find((a) => a.role === 'Lead') ?? assignees[0];

    try {
      // Create the main task with appropriate target
      const result = await createTask({
        caseId: taskLevel === 'case' ? selectedCase!.id : undefined,
        clientId: taskLevel === 'client' ? selectedClient!.id : undefined,
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
              caseId: taskLevel === 'case' ? selectedCase!.id : undefined,
              clientId: taskLevel === 'client' ? selectedClient!.id : undefined,
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

        handleOpenChange(false);
        onSuccess?.();
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl" showCloseButton={false} className="p-0 max-h-[85vh] flex flex-col">
        <DialogTitle className="sr-only">Sarcină nouă</DialogTitle>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Title Input - Hero style */}
          <div className="px-6 pt-4 pb-4 border-b border-linear-border-subtle">
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
            <div className="flex items-center justify-center gap-4">
              {/* Priority */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    priority === 'Low' && 'bg-gray-400',
                    priority === 'Medium' && 'bg-blue-400',
                    priority === 'High' && 'bg-amber-400',
                    priority === 'Urgent' && 'bg-red-400'
                  )}
                />
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TaskPriority)}
                >
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              p === 'Low' && 'bg-gray-400',
                              p === 'Medium' && 'bg-blue-400',
                              p === 'High' && 'bg-amber-400',
                              p === 'Urgent' && 'bg-red-400'
                            )}
                          />
                          {PRIORITY_LABELS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-px h-5 bg-linear-border-subtle flex-shrink-0" />

              {/* Task Type */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Briefcase className="w-3.5 h-3.5 text-linear-text-tertiary" />
                <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover">
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

              <div className="w-px h-5 bg-linear-border-subtle flex-shrink-0" />

              {/* Estimated Duration */}
              <DurationPicker value={estimatedDuration} onChange={setEstimatedDuration} />

              <div className="w-px h-5 bg-linear-border-subtle flex-shrink-0" />

              {/* Due Date */}
              <DatePickerPopover
                value={dueDate}
                onChange={setDueDate}
                error={showErrors && !!errors.dueDate}
              />
            </div>
          </div>

          {/* Description - Now right after Quick Actions */}
          <div className="px-6 py-4 border-b border-linear-border-subtle">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-linear-text-secondary">Descriere</label>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalii suplimentare..."
                rows={2}
              />
            </div>
          </div>

          {/* Form Sections */}
          <div className="px-6 py-2">
            {/* Task Level + Target Selection - unified row */}
            <div className="py-4 border-b border-linear-border-subtle">
              <div className="flex items-center gap-3">
                {/* Task Level Dropdown */}
                <Select
                  value={taskLevel}
                  onValueChange={(value: TaskLevel) => {
                    setTaskLevel(value);
                    // Clear selections when switching levels
                    if (value !== 'case') setSelectedCase(null);
                    if (value !== 'client') setSelectedClient(null);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <span className="flex items-center gap-2">
                          {level.icon}
                          {level.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Case Search - shown for case-level tasks */}
                {taskLevel === 'case' && (
                  <div className="flex-1">
                    <CaseSearchField
                      value={selectedCase}
                      onChange={setSelectedCase}
                      error={showErrors && !!errors.case}
                      placeholder="Caută un dosar..."
                    />
                  </div>
                )}

                {/* Client Search - shown for client-level tasks */}
                {taskLevel === 'client' && (
                  <div className="flex-1">
                    <ClientSearchField
                      value={selectedClient}
                      onChange={setSelectedClient}
                      error={showErrors && !!errors.client}
                      placeholder="Caută un client..."
                    />
                  </div>
                )}

                {/* Internal tasks - no search needed */}
                {taskLevel === 'internal' && (
                  <div className="flex-1 flex items-center h-9 px-3 rounded-lg bg-linear-bg-tertiary border border-linear-border-subtle">
                    <span className="text-sm text-linear-text-tertiary">
                      Sarcină internă (fără client sau dosar)
                    </span>
                  </div>
                )}
              </div>
            </div>

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

                {/* Add Subtask - Inline Form or Button */}
                {showSubtaskForm ? (
                  <InlineSubtaskForm
                    onAdd={handleAddSubtask}
                    onCancel={() => setShowSubtaskForm(false)}
                    teamMembers={teamMembers}
                    teamLoading={teamLoading}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubtaskForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-linear-border-subtle text-sm font-medium text-linear-text-secondary hover:border-linear-accent hover:text-linear-accent hover:bg-linear-accent/5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adaugă subtask
                  </button>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="mx-6 mb-4 p-4 rounded-xl bg-linear-error/10 border border-linear-error/20 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-linear-error flex-shrink-0" />
              <p className="text-sm text-linear-error">
                Nu s-a putut crea sarcina. Încercați din nou.
              </p>
            </div>
          )}

          {/* Validation Summary - shows when trying to submit with errors */}
          {showErrors && hasErrors && (
            <div className="mx-6 mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-500 mb-1">
                  Completează câmpurile obligatorii
                </p>
                <ul className="text-xs text-amber-400/80 space-y-0.5">
                  {errors.title && <li>• {errors.title}</li>}
                  {errors.case && <li>• {errors.case}</li>}
                  {errors.client && <li>• {errors.client}</li>}
                  {errors.assignee && <li>• {errors.assignee}</li>}
                  {errors.dueDate && <li>• {errors.dueDate}</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-linear-border-subtle flex items-center justify-end flex-shrink-0">
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
      </DialogContent>
    </Dialog>
  );
}
