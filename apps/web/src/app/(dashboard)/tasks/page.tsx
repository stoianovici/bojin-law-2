'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  List,
  LayoutGrid,
  Calendar,
  Clock,
  Check,
  User,
  Zap,
  Eye,
  Briefcase,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTasksStore,
  type TaskStatus,
  type TaskPriority,
  type TaskGroupBy,
  type DueDateFilter,
} from '@/store/tasksStore';
import { TeamActivityFeed, type Activity } from '@/components/tasks/TeamActivityFeed';
import { TaskDrawer, type TaskDetail } from '@/components/tasks/TaskDrawer';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { TaskActionPopover } from '@/components/tasks/TaskActionPopover';
import { GET_TASKS } from '@/graphql/queries';
import { UPDATE_TASK } from '@/graphql/mutations';

// ============================================================================
// TYPES & DATA TRANSFORMATION
// ============================================================================

// GraphQL response types
interface GQLAssignee {
  id: string;
  firstName: string;
  lastName: string;
}

interface GQLCase {
  id: string;
  caseNumber: string;
  title: string;
}

interface GQLSubtask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  estimatedHours: number | null;
  assignee: GQLAssignee;
}

interface GQLTask {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  dueTime: string | null;
  estimatedHours: number | null;
  parentTaskId: string | null;
  case: GQLCase | null;
  assignee: GQLAssignee;
  subtasks: GQLSubtask[];
  createdAt: string;
  completedAt: string | null;
}

// UI types (used by components)
interface UITask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  estimatedDuration?: string;
  assignee: GQLAssignee;
  case?: GQLCase;
  parentTaskId?: string;
  subtasks?: UITask[];
  activities: never[]; // No activities from DB yet
}

// Status mapping: DB -> UI
const STATUS_MAP: Record<string, TaskStatus> = {
  Pending: 'planificat',
  InProgress: 'in_lucru',
  Completed: 'finalizat',
  Cancelled: 'finalizat', // Treat cancelled as completed for UI
};

// Priority mapping: DB -> UI (just lowercase)
const PRIORITY_MAP: Record<string, 'urgent' | 'high' | 'medium' | 'low'> = {
  Urgent: 'urgent',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
};

// Format date for display
function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if same day
  if (date.toDateString() === now.toDateString()) {
    return 'Astăzi';
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Mâine';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ieri';
  }

  // Format as "DD Mon" in Romanian
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// Format hours to duration string
function formatDuration(hours: number | null): string | undefined {
  if (!hours) return undefined;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours === 1) return '1h';
  return `${hours}h`;
}

// Transform GraphQL task to UI task
function transformTask(gqlTask: GQLTask): UITask {
  return {
    id: gqlTask.id,
    title: gqlTask.title,
    description: gqlTask.description || undefined,
    status: STATUS_MAP[gqlTask.status] || 'planificat',
    priority: PRIORITY_MAP[gqlTask.priority] || 'medium',
    dueDate: formatDueDate(gqlTask.dueDate),
    estimatedDuration: formatDuration(gqlTask.estimatedHours),
    assignee: gqlTask.assignee,
    case: gqlTask.case || undefined,
    parentTaskId: gqlTask.parentTaskId || undefined,
    subtasks: gqlTask.subtasks.map((st) => ({
      id: st.id,
      title: st.title,
      status: STATUS_MAP[st.status] || 'planificat',
      priority: PRIORITY_MAP[st.priority] || 'medium',
      dueDate: formatDueDate(st.dueDate),
      estimatedDuration: formatDuration(st.estimatedHours),
      assignee: st.assignee,
      activities: [],
    })),
    activities: [],
  };
}


// ============================================================================
// CONFIGURATION
// ============================================================================

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; order: number; variant: 'default' | 'info' | 'warning' | 'success' }
> = {
  planificat: { label: 'Planificat', order: 0, variant: 'default' },
  in_lucru: { label: 'In lucru', order: 1, variant: 'info' },
  review: { label: 'Review', order: 2, variant: 'warning' },
  finalizat: { label: 'Finalizat', order: 3, variant: 'success' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500', order: 0 },
  high: { label: 'Ridicata', color: 'bg-amber-500', order: 1 },
  medium: { label: 'Medie', color: 'bg-blue-500', order: 2 },
  low: { label: 'Scazuta', color: 'bg-zinc-500', order: 3 },
};

const GROUP_BY_OPTIONS: { value: TaskGroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Prioritate' },
  { value: 'assignee', label: 'Responsabil' },
  { value: 'dueDate', label: 'Scadenta' },
  { value: 'none', label: 'Fara grupare' },
];

const ALL_STATUSES: TaskStatus[] = ['planificat', 'in_lucru', 'review', 'finalizat'];
const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const DUE_DATE_OPTIONS: { value: DueDateFilter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'overdue', label: 'Intarziate' },
  { value: 'today', label: 'Astazi' },
  { value: 'thisWeek', label: 'Saptamana aceasta' },
  { value: 'nextWeek', label: 'Saptamana viitoare' },
  { value: 'noDate', label: 'Fara data' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case 'planificat':
      return <Clock className="h-3 w-3" />;
    case 'in_lucru':
      return <Zap className="h-3 w-3" />;
    case 'review':
      return <Eye className="h-3 w-3" />;
    case 'finalizat':
      return <Check className="h-3 w-3" />;
    default:
      return null;
  }
}

function groupTasks(tasks: UITask[], groupBy: TaskGroupBy): Map<string, UITask[]> {
  const groups = new Map<string, UITask[]>();

  if (groupBy === 'none') {
    groups.set('all', tasks);
    return groups;
  }

  tasks.forEach((task) => {
    let key: string;
    switch (groupBy) {
      case 'status':
        key = task.status;
        break;
      case 'priority':
        key = task.priority;
        break;
      case 'assignee':
        key = task.assignee.id;
        break;
      case 'dueDate':
        // Simple grouping by due date text
        key = task.dueDate;
        break;
      default:
        key = 'other';
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  });

  return groups;
}

function getGroupLabel(groupBy: TaskGroupBy, key: string, tasks: UITask[]): string {
  switch (groupBy) {
    case 'status':
      return STATUS_CONFIG[key as TaskStatus]?.label || key;
    case 'priority':
      return PRIORITY_CONFIG[key]?.label || key;
    case 'assignee': {
      const task = tasks[0];
      return task ? `${task.assignee.firstName} ${task.assignee.lastName}` : key;
    }
    case 'dueDate':
      return key;
    case 'none':
      return 'Toate sarcinile';
    default:
      return key;
  }
}

function sortGroups(groups: Map<string, UITask[]>, groupBy: TaskGroupBy): [string, UITask[]][] {
  const entries = Array.from(groups.entries());

  if (groupBy === 'status') {
    return entries.sort(
      (a, b) =>
        (STATUS_CONFIG[a[0] as TaskStatus]?.order ?? 99) -
        (STATUS_CONFIG[b[0] as TaskStatus]?.order ?? 99)
    );
  }

  if (groupBy === 'priority') {
    return entries.sort(
      (a, b) => (PRIORITY_CONFIG[a[0]]?.order ?? 99) - (PRIORITY_CONFIG[b[0]]?.order ?? 99)
    );
  }

  return entries;
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface TaskRowProps {
  task: UITask;
  isSelected: boolean;
  isCompleted: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onAddNote: (taskId: string, note: string) => void;
  onLogTime: (taskId: string, duration: string, description: string) => void;
  onComplete: (taskId: string, note?: string) => void;
  // Subtask display properties
  isSubtask?: boolean;
  indentLevel?: number;
}

function TaskRow({
  task,
  isSelected,
  isCompleted,
  onSelect,
  onToggleComplete,
  onAddNote,
  onLogTime,
  onComplete,
  isSubtask = false,
  indentLevel = 0,
}: TaskRowProps) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const statusConfig = STATUS_CONFIG[task.status];

  // Get expanded state from store
  const { expandedTaskIds, toggleTaskExpanded } = useTasksStore();
  const isExpanded = expandedTaskIds.includes(task.id);

  // Calculate subtask progress
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = hasSubtasks
    ? task.subtasks!.filter((st) => st.status === 'finalizat').length
    : 0;
  const totalSubtasks = hasSubtasks ? task.subtasks!.length : 0;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(task.id);
  };

  return (
    <TaskActionPopover
      taskId={task.id}
      taskTitle={task.title}
      onAddNote={onAddNote}
      onLogTime={onLogTime}
      onComplete={onComplete}
    >
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-150',
          'bg-linear-bg-secondary border border-linear-border-subtle',
          'hover:border-linear-border-default hover:shadow-sm',
          isSelected && 'border-linear-accent bg-linear-bg-tertiary',
          isCompleted && 'opacity-60',
          // Subtask styling
          isSubtask && 'ml-8 bg-linear-bg-tertiary/50 border-l-2 border-l-linear-border-default'
        )}
      >
        {/* Expand/Collapse chevron for tasks with subtasks */}
        {hasSubtasks ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskExpanded(task.id);
            }}
            className="w-5 h-5 flex items-center justify-center text-linear-text-tertiary hover:text-linear-text-secondary shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          // Spacer for alignment when no subtasks
          <div className="w-5 shrink-0" />
        )}

        {/* Checkbox */}
        <div
          className={cn(
            'w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-all',
            isCompleted
              ? 'bg-linear-accent border-linear-accent'
              : 'border-linear-border-strong hover:border-linear-accent'
          )}
          onClick={handleCheckboxClick}
        >
          {isCompleted && <Check className="h-3 w-3 text-white" />}
        </div>

        {/* Priority indicator */}
        <div className={cn('w-1 h-4 rounded-sm shrink-0', priorityConfig.color)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-[13px] font-light text-linear-text-primary mb-0.5',
              isCompleted && 'line-through text-linear-text-tertiary',
              isSubtask && 'text-[12px]'
            )}
          >
            {task.title}
          </div>
          <div className="flex items-center gap-2">
            {task.case && !isSubtask && (
              <>
                <span className="text-[11px] font-normal font-mono text-linear-accent">
                  {task.case.caseNumber}
                </span>
                <span className="w-[3px] h-[3px] rounded-full bg-linear-text-muted" />
              </>
            )}
            {task.description && (
              <span className="text-[11px] text-linear-text-tertiary truncate max-w-[300px]">
                {task.description}
              </span>
            )}
          </div>
        </div>

        {/* Subtask progress indicator */}
        {hasSubtasks && (
          <div className="flex items-center gap-2 text-xs text-linear-text-tertiary shrink-0">
            <div className="w-16 h-1 bg-linear-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-accent rounded-full transition-all duration-300"
                style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
              />
            </div>
            <span>
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
        )}

        {/* Duration */}
        {task.estimatedDuration && (
          <span className="text-[11px] text-linear-text-tertiary bg-linear-bg-tertiary px-1.5 py-0.5 rounded shrink-0">
            {task.estimatedDuration} est.
          </span>
        )}

        {/* Status badge */}
        <Badge
          variant={statusConfig.variant}
          size="sm"
          icon={getStatusIcon(task.status)}
          className="shrink-0"
        >
          {statusConfig.label}
        </Badge>

        {/* Due date */}
        <div
          className={cn(
            'flex items-center gap-1 text-xs shrink-0',
            task.dueDate === 'Maine' && 'text-red-400',
            task.dueDate.includes('Dec') && new Date().getMonth() === 11 && 'text-amber-400'
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>{task.dueDate}</span>
        </div>

        {/* Assignee */}
        <Avatar
          size="xs"
          name={`${task.assignee.firstName} ${task.assignee.lastName}`}
          className="shrink-0"
        />
      </div>
    </TaskActionPopover>
  );
}

interface TaskGroupProps {
  title: string;
  count: number;
  tasks: UITask[];
  selectedTaskId: string | null;
  isTaskCompleted: (task: UITask) => boolean;
  onSelectTask: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onAddNote: (taskId: string, note: string) => void;
  onLogTime: (taskId: string, duration: string, description: string) => void;
  onComplete: (taskId: string, note?: string) => void;
  defaultExpanded?: boolean;
}

function TaskGroup({
  title,
  count,
  tasks,
  selectedTaskId,
  isTaskCompleted,
  onSelectTask,
  onToggleComplete,
  onAddNote,
  onLogTime,
  onComplete,
  defaultExpanded = true,
}: TaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Get expanded task IDs from store
  const { expandedTaskIds } = useTasksStore();

  // Filter out tasks that are subtasks (have parentTaskId) - they render as children of their parent
  const parentTasks = tasks.filter((t) => !t.parentTaskId);

  return (
    <div className="mb-6">
      {/* Group Header */}
      <div
        className="flex items-center gap-3 py-2 mb-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-5 h-5 flex items-center justify-center text-linear-text-tertiary transition-transform">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
        <span className="text-xs font-normal uppercase tracking-wider text-linear-text-tertiary">
          {title}
        </span>
        <span className="text-[11px] text-linear-text-muted bg-linear-bg-tertiary px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* Tasks */}
      {isExpanded && (
        <div className="space-y-2">
          {parentTasks.map((task) => (
            <React.Fragment key={task.id}>
              <TaskRow
                task={task}
                isSelected={selectedTaskId === task.id}
                isCompleted={isTaskCompleted(task)}
                onSelect={onSelectTask}
                onToggleComplete={onToggleComplete}
                onAddNote={onAddNote}
                onLogTime={onLogTime}
                onComplete={onComplete}
              />
              {/* Render subtasks when parent is expanded */}
              {expandedTaskIds.includes(task.id) &&
                task.subtasks?.map((subtask) => (
                  <TaskRow
                    key={subtask.id}
                    task={subtask}
                    isSelected={selectedTaskId === subtask.id}
                    isCompleted={isTaskCompleted(subtask)}
                    onSelect={onSelectTask}
                    onToggleComplete={onToggleComplete}
                    onAddNote={onAddNote}
                    onLogTime={onLogTime}
                    onComplete={onComplete}
                    isSubtask
                    indentLevel={1}
                  />
                ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

interface ViewToggleProps {
  view: 'list' | 'kanban' | 'calendar';
  onChange: (view: 'list' | 'kanban' | 'calendar') => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex bg-linear-bg-tertiary rounded-lg p-0.5">
      <button
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-md transition-all',
          view === 'list'
            ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
            : 'text-linear-text-tertiary hover:text-linear-text-secondary'
        )}
        onClick={() => onChange('list')}
        title="Lista"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-md transition-all',
          view === 'kanban'
            ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
            : 'text-linear-text-tertiary hover:text-linear-text-secondary'
        )}
        onClick={() => onChange('kanban')}
        title="Kanban"
        disabled
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-md transition-all',
          view === 'calendar'
            ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
            : 'text-linear-text-tertiary hover:text-linear-text-secondary'
        )}
        onClick={() => onChange('calendar')}
        title="Calendar"
        disabled
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// FILTER COMPONENTS
// ============================================================================

interface StatusFilterProps {
  selectedStatuses: TaskStatus[];
  onToggle: (status: TaskStatus) => void;
}

function StatusFilter({ selectedStatuses, onToggle }: StatusFilterProps) {
  const hasFilters = selectedStatuses.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-normal rounded-lg border transition-all',
            hasFilters
              ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'
              : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:bg-linear-bg-hover hover:border-linear-border-default hover:text-linear-text-primary'
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          Status
          {hasFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-linear-accent/20 rounded-full">
              {selectedStatuses.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="text-xs font-normal text-linear-text-secondary px-2 py-1.5 mb-1">
          Filtreaza dupa status
        </div>
        <div className="space-y-0.5">
          {ALL_STATUSES.map((status) => (
            <label
              key={status}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-linear-bg-hover cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedStatuses.includes(status)}
                onCheckedChange={() => onToggle(status)}
              />
              <span className="text-sm text-linear-text-primary">
                {STATUS_CONFIG[status].label}
              </span>
            </label>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={() => selectedStatuses.forEach((s) => onToggle(s))}
            className="w-full mt-2 px-2 py-1.5 text-xs text-linear-text-secondary hover:text-linear-text-primary transition-colors"
          >
            Sterge filtrele
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface PriorityFilterProps {
  selectedPriorities: TaskPriority[];
  onToggle: (priority: TaskPriority) => void;
}

function PriorityFilter({ selectedPriorities, onToggle }: PriorityFilterProps) {
  const hasFilters = selectedPriorities.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-normal rounded-lg border transition-all',
            hasFilters
              ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'
              : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:bg-linear-bg-hover hover:border-linear-border-default hover:text-linear-text-primary'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Prioritate
          {hasFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-linear-accent/20 rounded-full">
              {selectedPriorities.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="text-xs font-normal text-linear-text-secondary px-2 py-1.5 mb-1">
          Filtreaza dupa prioritate
        </div>
        <div className="space-y-0.5">
          {ALL_PRIORITIES.map((priority) => (
            <label
              key={priority}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-linear-bg-hover cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedPriorities.includes(priority)}
                onCheckedChange={() => onToggle(priority)}
              />
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', PRIORITY_CONFIG[priority].color)} />
                <span className="text-sm text-linear-text-primary">
                  {PRIORITY_CONFIG[priority].label}
                </span>
              </div>
            </label>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={() => selectedPriorities.forEach((p) => onToggle(p))}
            className="w-full mt-2 px-2 py-1.5 text-xs text-linear-text-secondary hover:text-linear-text-primary transition-colors"
          >
            Sterge filtrele
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface CaseFilterProps {
  availableCases: Array<{ id: string; caseNumber: string; title: string }>;
  selectedCases: string[];
  onToggle: (caseId: string) => void;
}

function CaseFilter({ availableCases, selectedCases, onToggle }: CaseFilterProps) {
  const hasFilters = selectedCases.length > 0;

  if (availableCases.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-normal rounded-lg border transition-all',
            hasFilters
              ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'
              : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:bg-linear-bg-hover hover:border-linear-border-default hover:text-linear-text-primary'
          )}
        >
          <Briefcase className="h-3.5 w-3.5" />
          Caz
          {hasFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-linear-accent/20 rounded-full">
              {selectedCases.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="text-xs font-normal text-linear-text-secondary px-2 py-1.5 mb-1">
          Filtreaza dupa caz
        </div>
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {availableCases.map((caseItem) => (
            <label
              key={caseItem.id}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-linear-bg-hover cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedCases.includes(caseItem.id)}
                onCheckedChange={() => onToggle(caseItem.id)}
              />
              <div className="min-w-0">
                <span className="text-xs font-mono text-linear-accent">{caseItem.caseNumber}</span>
                <p className="text-sm text-linear-text-primary truncate">{caseItem.title}</p>
              </div>
            </label>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={() => selectedCases.forEach((c) => onToggle(c))}
            className="w-full mt-2 px-2 py-1.5 text-xs text-linear-text-secondary hover:text-linear-text-primary transition-colors"
          >
            Sterge filtrele
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DueDateFilterProps {
  value: DueDateFilter;
  onChange: (value: DueDateFilter) => void;
}

function DueDateFilterComponent({ value, onChange }: DueDateFilterProps) {
  const hasFilter = value !== 'all';
  const currentLabel = DUE_DATE_OPTIONS.find((o) => o.value === value)?.label || 'Scadenta';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-normal rounded-lg border transition-all',
            hasFilter
              ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'
              : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:bg-linear-bg-hover hover:border-linear-border-default hover:text-linear-text-primary'
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {hasFilter ? currentLabel : 'Scadenta'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="text-xs font-normal text-linear-text-secondary px-2 py-1.5 mb-1">
          Filtreaza dupa scadenta
        </div>
        <div className="space-y-0.5">
          {DUE_DATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors',
                value === option.value
                  ? 'bg-linear-accent/15 text-linear-accent'
                  : 'hover:bg-linear-bg-hover text-linear-text-primary'
              )}
            >
              <span className="text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ActiveFiltersProps {
  showMyTasks: boolean;
  selectedStatuses: TaskStatus[];
  selectedPriorities: TaskPriority[];
  selectedCases: string[];
  dueDateFilter: DueDateFilter;
  availableCases: Array<{ id: string; caseNumber: string; title: string }>;
  onClearMyTasks: () => void;
  onClearStatus: (status: TaskStatus) => void;
  onClearPriority: (priority: TaskPriority) => void;
  onClearCase: (caseId: string) => void;
  onClearDueDate: () => void;
  onClearAll: () => void;
}

function ActiveFilters({
  showMyTasks,
  selectedStatuses,
  selectedPriorities,
  selectedCases,
  dueDateFilter,
  availableCases,
  onClearMyTasks,
  onClearStatus,
  onClearPriority,
  onClearCase,
  onClearDueDate,
  onClearAll,
}: ActiveFiltersProps) {
  const hasFilters =
    showMyTasks ||
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedCases.length > 0 ||
    dueDateFilter !== 'all';

  if (!hasFilters) return null;

  const getCaseLabel = (caseId: string) => {
    const c = availableCases.find((c) => c.id === caseId);
    return c?.caseNumber || caseId;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showMyTasks && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-linear-accent/15 text-linear-accent rounded-md">
          Sarcinile mele
          <button onClick={onClearMyTasks} className="hover:text-linear-accent-hover">
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      {selectedStatuses.map((status) => (
        <span
          key={status}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-linear-accent/15 text-linear-accent rounded-md"
        >
          {STATUS_CONFIG[status].label}
          <button onClick={() => onClearStatus(status)} className="hover:text-linear-accent-hover">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {selectedPriorities.map((priority) => (
        <span
          key={priority}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-linear-accent/15 text-linear-accent rounded-md"
        >
          {PRIORITY_CONFIG[priority].label}
          <button
            onClick={() => onClearPriority(priority)}
            className="hover:text-linear-accent-hover"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {selectedCases.map((caseId) => (
        <span
          key={caseId}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-linear-accent/15 text-linear-accent rounded-md"
        >
          {getCaseLabel(caseId)}
          <button onClick={() => onClearCase(caseId)} className="hover:text-linear-accent-hover">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {dueDateFilter !== 'all' && (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-linear-accent/15 text-linear-accent rounded-md">
          {DUE_DATE_OPTIONS.find((o) => o.value === dueDateFilter)?.label}
          <button onClick={onClearDueDate} className="hover:text-linear-accent-hover">
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      <button
        onClick={onClearAll}
        className="text-xs text-linear-text-secondary hover:text-linear-text-primary transition-colors"
      >
        Sterge toate
      </button>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function TasksPage() {
  const {
    viewMode,
    setViewMode,
    groupBy,
    setGroupBy,
    searchQuery,
    setSearchQuery,
    selectedTaskId,
    selectTask,
    showMyTasks,
    setShowMyTasks,
    selectedStatuses,
    selectedPriorities,
    selectedCases,
    dueDateFilter,
    toggleStatus,
    togglePriority,
    toggleCase,
    setDueDateFilter,
    clearFilters,
  } = useTasksStore();

  // Fetch tasks from database
  const { data, loading, error, refetch } = useQuery<{ tasks: GQLTask[] }>(GET_TASKS, {
    variables: { limit: 100 },
    fetchPolicy: 'cache-and-network',
  });

  // Mutation for updating task status (used for subtask completion)
  const [updateTaskMutation] = useMutation(UPDATE_TASK);

  // Transform GraphQL data to UI format
  const tasks: UITask[] = useMemo(() => {
    if (!data?.tasks) return [];
    // Only show parent tasks (not subtasks) at top level
    return data.tasks
      .filter((t: GQLTask) => !t.parentTaskId)
      .map(transformTask);
  }, [data?.tasks]);

  // Local state for task completion (visual only, resets on refresh)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Current user ID for "My Tasks" filter
  // TODO: Get from auth context
  const currentUserId = data?.tasks?.[0]?.assignee?.id || '';

  // Extract unique cases from tasks for the case filter
  const availableCases = useMemo(() => {
    const casesMap = new Map<string, { id: string; caseNumber: string; title: string }>();
    tasks.forEach((task) => {
      if (task.case && !casesMap.has(task.case.id)) {
        casesMap.set(task.case.id, task.case);
      }
    });
    return Array.from(casesMap.values());
  }, [tasks]);

  // Filter tasks based on all filters
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.case?.caseNumber.toLowerCase().includes(query)
      );
    }

    // My Tasks filter
    if (showMyTasks && currentUserId) {
      filtered = filtered.filter((task) => task.assignee.id === currentUserId);
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((task) => selectedStatuses.includes(task.status));
    }

    // Priority filter
    if (selectedPriorities.length > 0) {
      filtered = filtered.filter((task) => selectedPriorities.includes(task.priority));
    }

    // Case filter
    if (selectedCases.length > 0) {
      filtered = filtered.filter((task) => task.case && selectedCases.includes(task.case.id));
    }

    // Due date filter using formatted dates
    if (dueDateFilter !== 'all') {
      filtered = filtered.filter((task) => {
        switch (dueDateFilter) {
          case 'overdue':
            return task.dueDate === 'Ieri';
          case 'today':
            return task.dueDate === 'Astăzi';
          case 'thisWeek':
            return task.dueDate === 'Mâine' || task.dueDate === 'Astăzi';
          case 'nextWeek':
            return task.dueDate.includes('ian');
          case 'noDate':
            return !task.dueDate;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [
    tasks,
    searchQuery,
    showMyTasks,
    currentUserId,
    selectedStatuses,
    selectedPriorities,
    selectedCases,
    dueDateFilter,
  ]);

  // Check if any filters are active
  const hasActiveFilters =
    showMyTasks ||
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedCases.length > 0 ||
    dueDateFilter !== 'all';

  // Group tasks
  const groupedTasks = useMemo(() => {
    return groupTasks(filteredTasks, groupBy);
  }, [filteredTasks, groupBy]);

  // Sort groups
  const sortedGroups = useMemo(() => {
    return sortGroups(groupedTasks, groupBy);
  }, [groupedTasks, groupBy]);

  // Get selected task for drawer
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return null;

    // Transform to TaskDetail format
    // Convert subtasks to simple Subtask format for backward compat
    const drawerSubtasks = (task.subtasks || []).map((st) => ({
      id: st.id,
      title: st.title,
      completed: st.status === 'finalizat',
    }));

    // Full subtasks with all properties for the enhanced display
    const fullSubtasks = (task.subtasks || []).map((st) => ({
      id: st.id,
      title: st.title,
      status: STATUS_CONFIG[st.status].label,
      priority: st.priority,
      dueDate: st.dueDate,
      estimatedDuration: st.estimatedDuration ? parseFloat(st.estimatedDuration) : undefined,
      assignee: st.assignee,
    }));

    const taskDetail: TaskDetail = {
      id: task.id,
      title: task.title,
      status: STATUS_CONFIG[task.status].label,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      estimatedDuration: task.estimatedDuration,
      case: task.case,
      subtasks: drawerSubtasks,
      fullSubtasks, // Enhanced subtask data with all fields
      activities: [], // No activities from DB yet
    };
    return taskDetail;
  }, [selectedTaskId, tasks]);

  const handleSelectTask = (taskId: string) => {
    selectTask(selectedTaskId === taskId ? null : taskId);
  };

  const handleToggleComplete = (taskId: string) => {
    // Visual only toggle - resets on refresh
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Check if task is visually completed (either status or toggled)
  const isTaskCompleted = (task: UITask) => {
    return task.status === 'finalizat' || completedTasks.has(task.id);
  };

  const handleCloseDrawer = () => {
    selectTask(null);
  };

  const handleActivityTaskClick = (taskId: string) => {
    selectTask(taskId);
  };

  // Task action handlers
  const handleAddNote = (taskId: string, note: string) => {
    console.log('Add note to task:', taskId, note);
    // TODO: Integrate with API/store to save note
  };

  const handleLogTime = (taskId: string, duration: string, description: string) => {
    console.log('Log time for task:', taskId, duration, description);
    // TODO: Integrate with API/store to save time entry
  };

  const handleCompleteTask = (taskId: string, note?: string) => {
    console.log('Complete task:', taskId, note);
    // Mark as completed visually
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    // TODO: Integrate with API/store to update status
  };

  // Handle subtask completion - toggles between Completed and InProgress
  const handleSubtaskComplete = async (subtaskId: string) => {
    // Find the subtask to determine current status
    let currentStatus = 'InProgress';
    for (const task of tasks) {
      const subtask = task.subtasks?.find((st) => st.id === subtaskId);
      if (subtask) {
        currentStatus = subtask.status === 'finalizat' ? 'finalizat' : 'InProgress';
        break;
      }
    }

    // Toggle: if completed -> InProgress, else -> Completed
    const newStatus = currentStatus === 'finalizat' ? 'InProgress' : 'Completed';

    // Optimistic UI update - immediately show as completed
    if (newStatus === 'Completed') {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.add(subtaskId);
        return next;
      });
    } else {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(subtaskId);
        return next;
      });
    }

    try {
      await updateTaskMutation({
        variables: {
          id: subtaskId,
          input: { status: newStatus },
        },
      });
      // Refetch to update the UI with server data
      refetch();
    } catch (err) {
      console.error('Failed to update subtask status:', err);
      // Revert optimistic update on error
      if (newStatus === 'Completed') {
        setCompletedTasks((prev) => {
          const next = new Set(prev);
          next.delete(subtaskId);
          return next;
        });
      } else {
        setCompletedTasks((prev) => {
          const next = new Set(prev);
          next.add(subtaskId);
          return next;
        });
      }
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-linear-accent" />
          <p className="text-sm text-linear-text-tertiary">Se încarcă sarcinile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-linear-error">Eroare la încărcarea sarcinilor</p>
          <p className="text-xs text-linear-text-tertiary">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <header className="bg-linear-bg-secondary border-b border-linear-border-subtle px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-normal text-linear-text-primary">Sarcini</h1>
          <div className="flex items-center gap-3">
            <ViewToggle view={viewMode} onChange={setViewMode} />
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-light text-white bg-linear-accent rounded-lg hover:bg-linear-accent-hover transition-colors shadow-glow"
            >
              <Plus className="h-4 w-4" />
              Sarcina noua
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-linear-text-tertiary" />
            <Input
              type="text"
              placeholder="Cauta sarcini..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-[13px] bg-linear-bg-tertiary border-linear-border-subtle focus:border-linear-accent"
            />
          </div>

          <div className="w-px h-5 bg-linear-border-subtle" />

          {/* My Tasks Filter */}
          <button
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs font-normal rounded-lg border transition-all',
              showMyTasks
                ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'
                : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:bg-linear-bg-hover hover:border-linear-border-default hover:text-linear-text-primary'
            )}
            onClick={() => setShowMyTasks(!showMyTasks)}
          >
            <User className="h-3.5 w-3.5" />
            Sarcinile mele
          </button>

          {/* Status Filter */}
          <StatusFilter selectedStatuses={selectedStatuses} onToggle={toggleStatus} />

          {/* Priority Filter */}
          <PriorityFilter selectedPriorities={selectedPriorities} onToggle={togglePriority} />

          {/* Case Filter */}
          <CaseFilter
            availableCases={availableCases}
            selectedCases={selectedCases}
            onToggle={toggleCase}
          />

          {/* Due Date Filter */}
          <DueDateFilterComponent value={dueDateFilter} onChange={setDueDateFilter} />

          {/* Group By Dropdown */}
          <div className="ml-auto">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as TaskGroupBy)}
              className="h-9 px-3 text-xs font-normal rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary hover:border-linear-border-default focus:border-linear-accent focus:outline-none transition-all cursor-pointer"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Grupare: {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="mt-3">
            <ActiveFilters
              showMyTasks={showMyTasks}
              selectedStatuses={selectedStatuses}
              selectedPriorities={selectedPriorities}
              selectedCases={selectedCases}
              dueDateFilter={dueDateFilter}
              availableCases={availableCases}
              onClearMyTasks={() => setShowMyTasks(false)}
              onClearStatus={toggleStatus}
              onClearPriority={togglePriority}
              onClearCase={toggleCase}
              onClearDueDate={() => setDueDateFilter('all')}
              onClearAll={clearFilters}
            />
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tasks List Panel */}
        <ScrollArea className="flex-1 p-6">
          {sortedGroups.map(([key, tasks]) => (
            <TaskGroup
              key={key}
              title={getGroupLabel(groupBy, key, tasks)}
              count={tasks.length}
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              isTaskCompleted={isTaskCompleted}
              onSelectTask={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onAddNote={handleAddNote}
              onLogTime={handleLogTime}
              onComplete={handleCompleteTask}
              defaultExpanded={key !== 'finalizat'}
            />
          ))}
        </ScrollArea>

        {/* Right Panel */}
        <aside className="w-[380px] bg-linear-bg-secondary border-l border-linear-border-subtle flex flex-col">
          {selectedTask ? (
            <TaskDrawer
              task={selectedTask}
              onClose={handleCloseDrawer}
              onSubtaskClick={(subtaskId) => {
                // Navigate to the subtask by selecting it
                selectTask(subtaskId);
              }}
              onSubtaskToggle={(subtaskId, _completed) => {
                // Handle legacy simple subtask toggle
                handleSubtaskComplete(subtaskId);
              }}
              onSubtaskComplete={handleSubtaskComplete}
              optimisticCompletedIds={completedTasks}
              onAddSubtask={() => {
                console.log('Add subtask');
              }}
              onMarkComplete={() => {
                handleSubtaskComplete(selectedTask.id);
              }}
              onAssign={() => {
                console.log('Assign');
              }}
              onSubtaskCreated={() => {
                // Refresh task list after subtask created
                refetch();
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-4 border-b border-linear-border-subtle">
                <span className="text-sm font-normal text-linear-text-primary">
                  Activitate Echipa
                </span>
              </div>
              <ScrollArea className="flex-1 p-4">
                <TeamActivityFeed
                  activities={[]} // No activities from DB yet
                  onTaskClick={handleActivityTaskClick}
                />
              </ScrollArea>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
