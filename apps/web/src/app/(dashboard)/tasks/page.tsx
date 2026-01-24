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
  Building2,
  Users,
  Layers,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  useTasksStore,
  type TaskStatus,
  type TaskPriority,
  type TaskGroupBy,
  type DueDateFilter,
  type TaskScope,
} from '@/store/tasksStore';
import { UrgentTasksPanel } from '@/components/tasks/UrgentTasksPanel';
import { TaskActionsPanel, type TaskDetail } from '@/components/tasks/TaskActionsPanel';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TaskActionPopover } from '@/components/tasks/TaskActionPopover';
import { GET_TASKS } from '@/graphql/queries';
import { UPDATE_TASK, LOG_TIME_AGAINST_TASK } from '@/graphql/mutations';

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
  referenceNumbers?: string[];
}

interface GQLClient {
  id: string;
  name: string;
}

interface GQLSubtask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  estimatedHours: number | null;
  loggedTime: number | null;
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
  loggedTime: number | null;
  parentTaskId: string | null;
  case: GQLCase | null;
  client: GQLClient | null;
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
  rawDueDate: string; // ISO date for editing (YYYY-MM-DD)
  estimatedDuration?: string;
  loggedTime?: number;
  assignee: GQLAssignee;
  case?: GQLCase;
  client?: GQLClient;
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
  // Extract YYYY-MM-DD from ISO date string
  const rawDate = gqlTask.dueDate.split('T')[0];

  return {
    id: gqlTask.id,
    title: gqlTask.title,
    description: gqlTask.description || undefined,
    status: STATUS_MAP[gqlTask.status] || 'planificat',
    priority: PRIORITY_MAP[gqlTask.priority] || 'medium',
    dueDate: formatDueDate(gqlTask.dueDate),
    rawDueDate: rawDate,
    estimatedDuration: formatDuration(gqlTask.estimatedHours),
    loggedTime: gqlTask.loggedTime || undefined,
    assignee: gqlTask.assignee,
    case: gqlTask.case || undefined,
    client: gqlTask.client || undefined,
    parentTaskId: gqlTask.parentTaskId || undefined,
    subtasks: gqlTask.subtasks.map((st) => ({
      id: st.id,
      title: st.title,
      status: STATUS_MAP[st.status] || 'planificat',
      priority: PRIORITY_MAP[st.priority] || 'medium',
      dueDate: formatDueDate(st.dueDate),
      rawDueDate: st.dueDate.split('T')[0],
      estimatedDuration: formatDuration(st.estimatedHours),
      loggedTime: st.loggedTime || undefined,
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

const SCOPE_OPTIONS: { value: TaskScope; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'Toate', icon: <Layers className="h-3.5 w-3.5" /> },
  { value: 'case', label: 'Dosar', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { value: 'client', label: 'Client', icon: <Building2 className="h-3.5 w-3.5" /> },
  { value: 'firm', label: 'Firmă', icon: <Users className="h-3.5 w-3.5" /> },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
  onComplete: (taskId: string, options?: { timeJustLogged?: boolean }) => void;
  // Subtask display properties
  isSubtask?: boolean;
  indentLevel?: number;
}

function TaskRow({
  task,
  isSelected,
  isCompleted,
  onSelect: _onSelect,
  onToggleComplete,
  onAddNote,
  onLogTime,
  onComplete,
  isSubtask = false,
  indentLevel: _indentLevel = 0,
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

  return (
    <TaskActionPopover
      taskId={task.id}
      taskTitle={task.title}
      onAddNote={onAddNote}
      onLogTime={onLogTime}
      onComplete={onComplete}
      estimatedTime={task.estimatedDuration}
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
        <TaskActionPopover
          taskId={task.id}
          taskTitle={task.title}
          onLogTime={onLogTime}
          onComplete={onComplete}
          completeOnly
          estimatedTime={task.estimatedDuration}
        >
          <div
            className={cn(
              'w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-all',
              isCompleted
                ? 'bg-linear-accent border-linear-accent'
                : 'border-linear-border-strong hover:border-linear-accent'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isCompleted && <Check className="h-3 w-3 text-white" />}
          </div>
        </TaskActionPopover>

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
            {task.case?.referenceNumbers?.[0] && !isSubtask && (
              <>
                <span className="text-[11px] font-normal font-mono text-linear-accent">
                  {task.case.referenceNumbers[0]}
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
  onComplete: (taskId: string, options?: { timeJustLogged?: boolean }) => void;
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
  availableCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    referenceNumbers?: string[];
  }>;
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
                {caseItem.referenceNumbers?.[0] && (
                  <span className="text-xs font-mono text-linear-accent">
                    {caseItem.referenceNumbers[0]}
                  </span>
                )}
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

interface ScopeFilterProps {
  value: TaskScope;
  onChange: (value: TaskScope) => void;
}

function ScopeFilter({ value, onChange }: ScopeFilterProps) {
  const hasFilter = value !== 'all';
  const currentOption = SCOPE_OPTIONS.find((o) => o.value === value);

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
          <Layers className="h-3.5 w-3.5" />
          {hasFilter ? currentOption?.label : 'Nivel'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="text-xs font-normal text-linear-text-secondary px-2 py-1.5 mb-1">
          Filtreaza dupa nivel
        </div>
        <div className="space-y-0.5">
          {SCOPE_OPTIONS.map((option) => (
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
              {option.icon}
              <span className="text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ClientFilterProps {
  availableClients: Array<{ id: string; name: string }>;
  selectedClients: string[];
  onToggle: (clientId: string) => void;
}

function ClientFilter({ availableClients, selectedClients, onToggle }: ClientFilterProps) {
  const hasFilters = selectedClients.length > 0;

  if (availableClients.length === 0) return null;

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
          <Building2 className="h-3.5 w-3.5" />
          Client
          {hasFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-linear-accent/20 rounded-full">
              {selectedClients.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="text-xs font-normal text-linear-text-secondary px-2 py-1.5 mb-1">
          Filtreaza dupa client
        </div>
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {availableClients.map((clientItem) => (
            <label
              key={clientItem.id}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-linear-bg-hover cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedClients.includes(clientItem.id)}
                onCheckedChange={() => onToggle(clientItem.id)}
              />
              <span className="text-sm text-linear-text-primary truncate">{clientItem.name}</span>
            </label>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={() => selectedClients.forEach((c) => onToggle(c))}
            className="w-full mt-2 px-2 py-1.5 text-xs text-linear-text-secondary hover:text-linear-text-primary transition-colors"
          >
            Sterge filtrele
          </button>
        )}
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
  availableCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    referenceNumbers?: string[];
  }>;
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
    selectedClients,
    selectedScope,
    dueDateFilter,
    toggleStatus,
    togglePriority,
    toggleCase,
    toggleClient,
    setScope,
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

  // Mutation for logging time against a task
  const [logTimeAgainstTaskMutation] = useMutation(LOG_TIME_AGAINST_TASK, {
    refetchQueries: [{ query: GET_TASKS, variables: { limit: 100 } }],
    awaitRefetchQueries: true,
  });

  // Transform GraphQL data to UI format
  const tasksData = data?.tasks;
  const tasks: UITask[] = useMemo(() => {
    if (!tasksData) return [];
    // Only show parent tasks (not subtasks) at top level
    return tasksData.filter((t: GQLTask) => !t.parentTaskId).map(transformTask);
  }, [tasksData]);

  // Local state for task completion (visual only, resets on refresh)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Time logging dialog state for completing tasks without logged time
  const [timeLogDialogOpen, setTimeLogDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<{ id: string; title: string } | null>(null);
  const [timeInput, setTimeInput] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [isCompletingTask, setIsCompletingTask] = useState(false);

  // Current user ID for "My Tasks" filter
  // TODO: Get from auth context
  const currentUserId = data?.tasks?.[0]?.assignee?.id || '';

  // Extract unique cases from tasks for the case filter
  const availableCases = useMemo(() => {
    const casesMap = new Map<
      string,
      { id: string; caseNumber: string; title: string; referenceNumbers?: string[] }
    >();
    tasks.forEach((task) => {
      if (task.case && !casesMap.has(task.case.id)) {
        casesMap.set(task.case.id, task.case);
      }
    });
    return Array.from(casesMap.values());
  }, [tasks]);

  // Extract unique clients from tasks for the client filter
  const availableClients = useMemo(() => {
    const clientsMap = new Map<string, { id: string; name: string }>();
    tasks.forEach((task) => {
      if (task.client && !clientsMap.has(task.client.id)) {
        clientsMap.set(task.client.id, task.client);
      }
    });
    return Array.from(clientsMap.values());
  }, [tasks]);

  // Extract unique team members from tasks for the assignee picker
  const teamMembers = useMemo(() => {
    const membersMap = new Map<string, GQLAssignee>();
    tasks.forEach((task) => {
      if (task.assignee && !membersMap.has(task.assignee.id)) {
        membersMap.set(task.assignee.id, task.assignee);
      }
      // Also include assignees from subtasks
      task.subtasks?.forEach((st) => {
        if (st.assignee && !membersMap.has(st.assignee.id)) {
          membersMap.set(st.assignee.id, st.assignee);
        }
      });
    });
    return Array.from(membersMap.values());
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

    // Client filter
    if (selectedClients.length > 0) {
      filtered = filtered.filter((task) => task.client && selectedClients.includes(task.client.id));
    }

    // Scope filter
    if (selectedScope !== 'all') {
      filtered = filtered.filter((task) => {
        switch (selectedScope) {
          case 'case':
            return task.case !== undefined;
          case 'client':
            return task.client !== undefined && task.case === undefined;
          case 'firm':
            return task.case === undefined && task.client === undefined;
          default:
            return true;
        }
      });
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
    selectedClients,
    selectedScope,
    dueDateFilter,
  ]);

  // Check if any filters are active
  const hasActiveFilters =
    showMyTasks ||
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedCases.length > 0 ||
    selectedClients.length > 0 ||
    selectedScope !== 'all' ||
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
      description: task.description,
      status: STATUS_CONFIG[task.status].label,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      rawDueDate: task.rawDueDate,
      estimatedDuration: task.estimatedDuration,
      case: task.case,
      fullSubtasks, // Enhanced subtask data with all fields
    };
    return taskDetail;
  }, [selectedTaskId, tasks]);

  const handleSelectTask = (taskId: string) => {
    selectTask(selectedTaskId === taskId ? null : taskId);
  };

  const handleToggleComplete = async (taskId: string) => {
    // Find the task to determine current status
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const isCurrentlyCompleted = task.status === 'finalizat' || completedTasks.has(taskId);

    // If uncompleting, just update status
    if (isCurrentlyCompleted) {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });

      try {
        await updateTaskMutation({
          variables: {
            id: taskId,
            input: { status: 'InProgress' },
          },
        });
      } catch (err) {
        // Revert optimistic update on error
        setCompletedTasks((prev) => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });
        toast.error('Eroare', 'Nu s-a putut actualiza statusul sarcinii.');
      }
      return;
    }

    // If completing, check if actual time has been logged
    if (!task.loggedTime || task.loggedTime === 0) {
      // Show time logging dialog
      setTaskToComplete({ id: taskId, title: task.title });
      setTimeInput('');
      setTimeDescription('');
      setTimeLogDialogOpen(true);
      return;
    }

    // Time logged, complete directly
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    try {
      await updateTaskMutation({
        variables: {
          id: taskId,
          input: { status: 'Completed' },
        },
      });
    } catch (err) {
      // Revert optimistic update on error
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      toast.error('Eroare', 'Nu s-a putut actualiza statusul sarcinii.');
    }
  };

  // Handle completing task with time logging from dialog
  const handleCompleteWithTimeLog = async () => {
    if (!taskToComplete || !timeInput.trim() || !timeDescription.trim()) return;

    // Parse time input (e.g., "1h 30m" -> 1.5 hours)
    const parseTime = (input: string): number | null => {
      const trimmed = input.trim().toLowerCase();

      // Try decimal hours (e.g., "1.5")
      if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed);
      }

      // Try "Xh Ym" format
      let hours = 0;
      const hourMatch = trimmed.match(/(\d+(\.\d+)?)\s*h/);
      const minMatch = trimmed.match(/(\d+)\s*m/);

      if (hourMatch) hours += parseFloat(hourMatch[1]);
      if (minMatch) hours += parseInt(minMatch[1]) / 60;

      return hours > 0 ? hours : null;
    };

    const hours = parseTime(timeInput);
    if (!hours) {
      toast.error('Format invalid', 'Introduceți timpul în format: 1.5 sau 1h 30m');
      return;
    }

    setIsCompletingTask(true);

    // Optimistic UI update
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      next.add(taskToComplete.id);
      return next;
    });

    try {
      // First, log the time
      await logTimeAgainstTaskMutation({
        variables: {
          taskId: taskToComplete.id,
          hours,
          description: timeDescription.trim(),
          billable: true,
        },
      });

      // Then complete the task
      await updateTaskMutation({
        variables: {
          id: taskToComplete.id,
          input: { status: 'Completed' },
        },
      });

      setTimeLogDialogOpen(false);
      setTaskToComplete(null);
      setTimeInput('');
      setTimeDescription('');
    } catch (err) {
      // Revert optimistic update on error
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskToComplete.id);
        return next;
      });

      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ACTUAL_TIME_REQUIRED')) {
        toast.error('Eroare', 'Nu s-a putut înregistra timpul. Verificați datele introduse.');
      } else {
        toast.error('Eroare', 'Nu s-a putut finaliza sarcina.');
      }
    } finally {
      setIsCompletingTask(false);
    }
  };

  // Check if task is visually completed (either status or toggled)
  const isTaskCompleted = (task: UITask) => {
    return task.status === 'finalizat' || completedTasks.has(task.id);
  };

  const handleCloseDrawer = () => {
    selectTask(null);
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

  const handleCompleteTask = async (taskId: string, options?: { timeJustLogged?: boolean }) => {
    // Find the task to check if time has been logged
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // If no time logged and not just logged from popover, show the dialog
    if (!options?.timeJustLogged && (!task.loggedTime || task.loggedTime === 0)) {
      setTaskToComplete({ id: taskId, title: task.title });
      setTimeInput('');
      setTimeDescription('');
      setTimeLogDialogOpen(true);
      return;
    }

    // Time logged, complete directly
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    try {
      await updateTaskMutation({
        variables: {
          id: taskId,
          input: { status: 'Completed' },
        },
      });
    } catch (err) {
      // Revert optimistic update on error
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      toast.error('Eroare', 'Nu s-a putut actualiza statusul sarcinii.');
    }
  };

  // Handle subtask completion - toggles between Completed and InProgress
  const handleSubtaskComplete = async (subtaskId: string) => {
    // Find the subtask to determine current status and logged time
    let subtaskInfo: { status: string; title: string; loggedTime?: number } | null = null;
    for (const task of tasks) {
      const subtask = task.subtasks?.find((st) => st.id === subtaskId);
      if (subtask) {
        subtaskInfo = {
          status: subtask.status,
          title: subtask.title,
          loggedTime: subtask.loggedTime,
        };
        break;
      }
    }

    if (!subtaskInfo) return;

    const isCurrentlyCompleted = subtaskInfo.status === 'finalizat';

    // If uncompleting, just update status
    if (isCurrentlyCompleted) {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(subtaskId);
        return next;
      });

      try {
        await updateTaskMutation({
          variables: {
            id: subtaskId,
            input: { status: 'InProgress' },
          },
        });
      } catch (err) {
        // Revert optimistic update on error
        setCompletedTasks((prev) => {
          const next = new Set(prev);
          next.add(subtaskId);
          return next;
        });
        toast.error('Eroare', 'Nu s-a putut actualiza statusul sub-sarcinii.');
      }
      return;
    }

    // If completing, check if time has been logged
    if (!subtaskInfo.loggedTime || subtaskInfo.loggedTime === 0) {
      // Show time logging dialog
      setTaskToComplete({ id: subtaskId, title: subtaskInfo.title });
      setTimeInput('');
      setTimeDescription('');
      setTimeLogDialogOpen(true);
      return;
    }

    // Time logged, complete directly
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      next.add(subtaskId);
      return next;
    });

    try {
      await updateTaskMutation({
        variables: {
          id: subtaskId,
          input: { status: 'Completed' },
        },
      });
    } catch (err) {
      // Revert optimistic update on error
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        next.delete(subtaskId);
        return next;
      });
      toast.error('Eroare', 'Nu s-a putut actualiza statusul sub-sarcinii.');
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
      <header className="bg-linear-bg-secondary border-b border-linear-border-subtle px-4 xl:px-6 py-3 xl:py-4">
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

          {/* Scope Filter */}
          <ScopeFilter value={selectedScope} onChange={setScope} />

          {/* Client Filter */}
          <ClientFilter
            availableClients={availableClients}
            selectedClients={selectedClients}
            onToggle={toggleClient}
          />

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

      {/* Main Container - Three panel layout with drawer animation */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tasks List Panel - shrinks to make room for drawer */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ScrollArea className="h-full p-4 xl:p-6">
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
        </div>

        {/* Right Panel - UrgentTasksPanel - always visible */}
        <aside className="w-[340px] xl:w-[400px] h-full bg-linear-bg-secondary border-l border-linear-border-subtle flex flex-col shrink-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-linear-border-subtle">
            <span className="text-sm font-medium text-linear-text-primary">Sarcini Urgente</span>
          </div>
          <ScrollArea className="flex-1 p-5">
            <UrgentTasksPanel
              tasks={tasks.map((t) => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                dueDate: t.dueDate,
                estimatedDuration: t.estimatedDuration,
                assignee: t.assignee,
                case: t.case,
              }))}
              onTaskClick={handleSelectTask}
            />
          </ScrollArea>
        </aside>

        {/* Task Actions Panel - slides in from right, part of flex layout */}
        <aside
          className={cn(
            'bg-linear-bg-secondary border-l border-linear-border-subtle shrink-0',
            'transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden',
            selectedTask ? 'w-[320px] xl:w-[380px]' : 'w-0'
          )}
        >
          <div className="w-[320px] xl:w-[380px] h-full">
            <TaskActionsPanel
            task={selectedTask}
            onClose={handleCloseDrawer}
            onSubtaskClick={(subtaskId) => {
              selectTask(subtaskId);
            }}
            onSubtaskComplete={handleSubtaskComplete}
            optimisticCompletedIds={completedTasks}
            onMarkComplete={async () => {
              if (!selectedTask) return;
              // Direct completion without time check
              setCompletedTasks((prev) => {
                const next = new Set(prev);
                next.add(selectedTask.id);
                return next;
              });
              try {
                await updateTaskMutation({
                  variables: {
                    id: selectedTask.id,
                    input: { status: 'Completed' },
                  },
                });
              } catch (err) {
                // Revert on error
                setCompletedTasks((prev) => {
                  const next = new Set(prev);
                  next.delete(selectedTask.id);
                  return next;
                });
                toast.error('Eroare', 'Nu s-a putut finaliza sarcina.');
              }
            }}
            onSubtaskCreated={() => {
              refetch();
            }}
            onDurationChange={(taskId, hours) => {
              console.log('Update duration:', taskId, hours);
              // TODO: Implement mutation to update estimated hours
            }}
            onDueDateChange={async (taskId, newDate) => {
              try {
                await updateTaskMutation({
                  variables: {
                    id: taskId,
                    input: { dueDate: newDate },
                  },
                });
              } catch (err) {
                toast.error('Eroare', 'Nu s-a putut actualiza data scadentă.');
              }
            }}
            onAssigneeChange={async (taskId, assigneeId) => {
              try {
                await updateTaskMutation({
                  variables: {
                    id: taskId,
                    input: { assignedTo: assigneeId },
                  },
                });
              } catch (err) {
                toast.error('Eroare', 'Nu s-a putut actualiza responsabilul.');
              }
            }}
            teamMembers={teamMembers}
          />
          </div>
        </aside>
      </div>

      {/* Time logging dialog for completing tasks without logged time */}
      <Dialog open={timeLogDialogOpen} onOpenChange={setTimeLogDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Pontează timpul lucrat</DialogTitle>
            <DialogDescription>
              Pentru a finaliza sarcina, trebuie să înregistrați timpul efectiv lucrat.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="text-sm text-linear-text-secondary truncate">
              {taskToComplete?.title}
            </div>
            <div>
              <label className="block text-xs text-linear-text-tertiary mb-1.5">
                Timp lucrat *
              </label>
              <Input
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="ex: 1.5 sau 1h 30m"
                className="w-full"
                autoFocus
              />
              <p className="mt-1 text-xs text-linear-text-tertiary">
                Format: ore zecimale (1.5) sau ore și minute (1h 30m)
              </p>
            </div>
            <div>
              <label className="block text-xs text-linear-text-tertiary mb-1.5">
                Descriere activitate *
              </label>
              <textarea
                value={timeDescription}
                onChange={(e) => setTimeDescription(e.target.value)}
                placeholder="Ce activități ați efectuat..."
                className="w-full h-20 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey && timeInput.trim() && timeDescription.trim()) {
                    handleCompleteWithTimeLog();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setTimeLogDialogOpen(false)}
              className="px-4 py-2 text-sm text-linear-text-secondary hover:text-linear-text-primary transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={handleCompleteWithTimeLog}
              disabled={!timeInput.trim() || !timeDescription.trim() || isCompletingTask}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-light rounded-lg transition-colors',
                timeInput.trim() && timeDescription.trim() && !isCompletingTask
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
              )}
            >
              {isCompletingTask ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se finalizează...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  Pontează și finalizează
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
