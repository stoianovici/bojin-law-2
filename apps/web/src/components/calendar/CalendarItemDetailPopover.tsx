'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  User,
  X,
  Edit,
  Trash2,
  CheckCircle2,
  StickyNote,
  Check,
  Timer,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/Popover';
import { GET_TIME_ENTRIES_BY_TASK } from '@/graphql/queries';

// ====================================================================
// TIME ENTRY TYPES & HELPERS
// ====================================================================

interface TimeEntryData {
  id: string;
  date: string;
  hours: number;
  description: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// Format hours to duration string
function formatHoursToDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours === Math.floor(hours)) return `${hours}h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

// Format date for display
function formatEntryDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDate = new Date(date);
  entryDate.setHours(0, 0, 0, 0);

  if (entryDate.getTime() === today.getTime()) return 'Astăzi';
  if (entryDate.getTime() === yesterday.getTime()) return 'Ieri';

  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ====================================================================
// TYPES
// ====================================================================

export interface TaskDetailData {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueDateFormatted: string;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  estimatedDuration?: string;
  remainingDuration?: number;
  loggedTime?: string; // Formatted logged time (e.g., "1h 30m")
  variant: 'on-track' | 'due-today' | 'overdue' | 'locked';
  status?: string;
  caseName?: string;
  caseNumber?: string;
  assigneeName?: string;
}

export interface EventDetailData {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  type: 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';
  location?: string;
  caseName?: string;
  caseNumber?: string;
  assigneeName?: string;
}

interface CalendarItemDetailPopoverProps {
  children: React.ReactNode;
  itemType: 'task' | 'event';
  taskData?: TaskDetailData;
  eventData?: EventDetailData;
  /** Callback when edit is clicked */
  onEdit?: (id: string) => void;
  /** Callback when delete is clicked */
  onDelete?: (id: string) => void;
  /** Callback when complete is clicked (tasks only). If timeJustLogged is true, skip the time check */
  onComplete?: (id: string, options?: { timeJustLogged?: boolean }) => void;
  /** Callback when add note is clicked (tasks only) */
  onAddNote?: (id: string, note: string) => void;
  /** Callback when log time is clicked (tasks only) */
  onLogTime?: (id: string, duration: string, description: string) => void;
  /** When true, popover opens on left-click. Otherwise, the click is passed through */
  enabled?: boolean;
  /** External control of open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fixed position for popover (when used with controlled state) */
  position?: { x: number; y: number };
}

// ====================================================================
// EVENT TYPE LABELS & COLORS
// ====================================================================

const eventTypeLabels: Record<EventDetailData['type'], string> = {
  court: 'Termen instanță',
  hearing: 'Audiere',
  deadline: 'Termen limită',
  meeting: 'Întâlnire',
  reminder: 'Reminder',
};

const eventTypeColors: Record<EventDetailData['type'], string> = {
  court: 'bg-[rgba(239,68,68,0.2)] text-[#FCA5A5] border-[#EF4444]',
  hearing: 'bg-[rgba(236,72,153,0.2)] text-[#F9A8D4] border-[#EC4899]',
  deadline: 'bg-[rgba(245,158,11,0.2)] text-[#FCD34D] border-[#F59E0B]',
  meeting: 'bg-[rgba(59,130,246,0.2)] text-[#93C5FD] border-[#3B82F6]',
  reminder: 'bg-[rgba(34,197,94,0.2)] text-[#86EFAC] border-[#22C55E]',
};

// ====================================================================
// TASK VARIANT LABELS & COLORS
// ====================================================================

const taskVariantLabels: Record<TaskDetailData['variant'], string> = {
  'on-track': 'În termen',
  'due-today': 'Scadent azi',
  overdue: 'Întârziat',
  locked: 'Blocat',
};

const taskVariantColors: Record<TaskDetailData['variant'], string> = {
  'on-track': 'bg-[rgba(139,92,246,0.2)] text-[#A78BFA] border-[#8B5CF6]',
  'due-today': 'bg-[rgba(245,158,11,0.2)] text-[#FCD34D] border-[#F59E0B]',
  overdue: 'bg-[rgba(239,68,68,0.2)] text-[#FCA5A5] border-[#EF4444]',
  locked: 'bg-[rgba(239,68,68,0.2)] text-[#FCA5A5] border-[#EF4444]',
};

// ====================================================================
// COMPONENT
// ====================================================================

export function CalendarItemDetailPopover({
  children,
  itemType,
  taskData,
  eventData,
  onEdit,
  onDelete,
  onComplete,
  onAddNote,
  onLogTime,
  enabled = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  position,
}: CalendarItemDetailPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise internal
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent event from bubbling to parent handlers
      e.stopPropagation();
      setIsOpen(true);
    },
    [setIsOpen]
  );

  const handleEdit = useCallback(() => {
    const id = itemType === 'task' ? taskData?.id : eventData?.id;
    if (id && onEdit) {
      onEdit(id);
      handleClose();
    }
  }, [itemType, taskData, eventData, onEdit, handleClose]);

  const handleDelete = useCallback(() => {
    const id = itemType === 'task' ? taskData?.id : eventData?.id;
    if (id && onDelete) {
      onDelete(id);
      handleClose();
    }
  }, [itemType, taskData, eventData, onDelete, handleClose]);

  const handleComplete = useCallback(
    (options?: { timeJustLogged?: boolean }) => {
      if (taskData?.id && onComplete) {
        onComplete(taskData.id, options);
        handleClose();
      }
    },
    [taskData, onComplete, handleClose]
  );

  const handleAddNote = useCallback(
    (note: string) => {
      if (taskData?.id && onAddNote && note.trim()) {
        onAddNote(taskData.id, note.trim());
        handleClose();
      }
    },
    [taskData, onAddNote, handleClose]
  );

  const handleLogTime = useCallback(
    (duration: string) => {
      if (taskData?.id && onLogTime && duration.trim()) {
        onLogTime(taskData.id, duration.trim(), '');
      }
    },
    [taskData, onLogTime]
  );

  if (!enabled) {
    return <>{children}</>;
  }

  // Clone the child to add click handler - this avoids wrapper divs
  // that might interfere with framer-motion or absolute positioning
  const childWithClick = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
        {
          onClick: handleClick,
        }
      )
    : children;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>{childWithClick}</PopoverAnchor>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={
          position
            ? {
                position: 'fixed',
                left: position.x,
                top: position.y,
              }
            : undefined
        }
      >
        {itemType === 'task' && taskData && (
          <TaskDetailContent
            data={taskData}
            onClose={handleClose}
            onEdit={onEdit ? handleEdit : undefined}
            onDelete={onDelete ? handleDelete : undefined}
            onComplete={onComplete ? handleComplete : undefined}
            onAddNote={onAddNote ? handleAddNote : undefined}
            onLogTime={onLogTime ? handleLogTime : undefined}
          />
        )}
        {itemType === 'event' && eventData && (
          <EventDetailContent
            data={eventData}
            onClose={handleClose}
            onEdit={onEdit ? handleEdit : undefined}
            onDelete={onDelete ? handleDelete : undefined}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ====================================================================
// TASK DETAIL CONTENT
// ====================================================================

interface TaskDetailContentProps {
  data: TaskDetailData;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: (options?: { timeJustLogged?: boolean }) => void;
  onAddNote?: (note: string) => void;
  onLogTime?: (duration: string) => void;
}

function TaskDetailContent({
  data,
  onClose,
  onEdit,
  onDelete,
  onComplete,
  onAddNote,
  onLogTime,
}: TaskDetailContentProps) {
  const [actionView, setActionView] = useState<'default' | 'note' | 'complete' | 'logtime'>(
    'default'
  );
  const [noteText, setNoteText] = useState('');
  // Prefill with logged time if available, otherwise estimated duration
  const [timeInput, setTimeInput] = useState(data.loggedTime || data.estimatedDuration || '');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  // Fetch time entries when in time-related views
  const { data: timeEntriesData } = useQuery<{ timeEntriesByTask: TimeEntryData[] }>(
    GET_TIME_ENTRIES_BY_TASK,
    {
      variables: { taskId: data.id },
      skip: actionView !== 'complete' && actionView !== 'logtime',
      fetchPolicy: 'cache-and-network',
    }
  );
  const timeEntries = timeEntriesData?.timeEntriesByTask || [];

  // Focus inputs when view changes
  useEffect(() => {
    if (actionView === 'note' && noteRef.current) {
      noteRef.current.focus();
    } else if ((actionView === 'complete' || actionView === 'logtime') && timeRef.current) {
      timeRef.current.focus();
    }
  }, [actionView]);

  const handleSubmitNote = () => {
    if (noteText.trim() && onAddNote) {
      onAddNote(noteText.trim());
      setNoteText('');
      setActionView('default');
    }
  };

  const handleSubmitComplete = () => {
    const hasTime = timeInput.trim().length > 0;
    if (hasTime && onLogTime) {
      onLogTime(timeInput.trim());
    }
    if (onComplete) {
      onComplete({ timeJustLogged: hasTime });
    }
  };

  const handleSubmitLogTime = () => {
    if (timeInput.trim() && onLogTime) {
      onLogTime(timeInput.trim());
      setTimeInput('');
      // Delay view change to allow refetchQueries to complete while query is still active
      setTimeout(() => {
        setActionView('default');
      }, 500);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-3 border-b border-linear-border-subtle">
        <div className="flex-1 pr-2">
          <h3 className="text-sm font-medium text-linear-text-primary leading-tight">
            {data.title}
          </h3>
          {/* Status badge */}
          <div className="mt-1.5">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                taskVariantColors[data.variant]
              )}
            >
              {taskVariantLabels[data.variant]}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Details */}
      <div className="p-3 space-y-2.5">
        {/* Due date */}
        <div className="flex items-center gap-2.5 text-sm">
          <Calendar className="h-4 w-4 text-linear-text-tertiary shrink-0" />
          <span className="text-linear-text-secondary">Scadență:</span>
          <span className="text-linear-text-primary">{data.dueDateFormatted}</span>
        </div>

        {/* Scheduled time */}
        {data.scheduledStartTime && (
          <div className="flex items-center gap-2.5 text-sm">
            <Clock className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Programat:</span>
            <span className="text-linear-text-primary">
              {data.scheduledStartTime}
              {data.scheduledEndTime && ` - ${data.scheduledEndTime}`}
            </span>
          </div>
        )}

        {/* Duration */}
        {data.estimatedDuration && (
          <div className="flex items-center gap-2.5 text-sm">
            <Clock className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Durată estimată:</span>
            <span className="text-linear-text-primary">{data.estimatedDuration}</span>
          </div>
        )}

        {/* Case */}
        {data.caseName && (
          <div className="flex items-center gap-2.5 text-sm">
            <Briefcase className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Dosar:</span>
            <span className="text-linear-text-primary truncate">
              {data.caseNumber && (
                <span className="text-linear-text-tertiary">{data.caseNumber} - </span>
              )}
              {data.caseName}
            </span>
          </div>
        )}

        {/* Assignee */}
        {data.assigneeName && (
          <div className="flex items-center gap-2.5 text-sm">
            <User className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Responsabil:</span>
            <span className="text-linear-text-primary">{data.assigneeName}</span>
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div className="mt-3 pt-2.5 border-t border-linear-border-subtle">
            <p className="text-xs text-linear-text-secondary leading-relaxed">{data.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-linear-border-subtle p-2">
        {/* Note input view */}
        {actionView === 'note' && (
          <div className="space-y-2">
            <textarea
              ref={noteRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Scrie o notă..."
              className="w-full h-20 px-2.5 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  handleSubmitNote();
                } else if (e.key === 'Escape') {
                  setActionView('default');
                }
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={() => setActionView('default')}
                className="flex-1 px-2 py-1.5 text-xs text-linear-text-secondary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleSubmitNote}
                disabled={!noteText.trim()}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors',
                  noteText.trim()
                    ? 'text-amber-400 hover:bg-amber-500/10'
                    : 'text-linear-text-muted cursor-not-allowed'
                )}
              >
                <Check className="h-3.5 w-3.5" />
                Salvează
              </button>
            </div>
          </div>
        )}

        {/* Complete with time input view */}
        {actionView === 'complete' && (
          <div className="space-y-2">
            {/* Previous time entries */}
            {timeEntries.length > 0 && (
              <div className="mb-2 pb-2 border-b border-linear-border-subtle">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <History className="h-3 w-3 text-linear-text-tertiary" />
                  <span className="text-[10px] font-medium text-linear-text-tertiary uppercase tracking-wide">
                    Timp pontat
                  </span>
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {timeEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-xs">
                      <span className="text-linear-text-secondary truncate flex-1">
                        {formatEntryDate(entry.date)}
                      </span>
                      <span className="text-linear-text-primary font-medium ml-2">
                        {formatHoursToDuration(entry.hours)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-linear-border-subtle">
                  <span className="text-[10px] text-linear-text-tertiary">Total</span>
                  <span className="text-xs text-linear-text-primary font-medium">
                    {formatHoursToDuration(timeEntries.reduce((sum, e) => sum + e.hours, 0))}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-linear-text-tertiary shrink-0" />
              <input
                ref={timeRef}
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="1h 30m"
                className="flex-1 px-2.5 py-1.5 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-md focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitComplete();
                  } else if (e.key === 'Escape') {
                    setActionView('default');
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-linear-text-tertiary px-1">
              Introdu timpul lucrat (ex: 2h, 1h 30m, 45m)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setActionView('default')}
                className="flex-1 px-2 py-1.5 text-xs text-linear-text-secondary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleSubmitComplete}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-green-400 hover:bg-green-500/10 rounded-md transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Finalizează
              </button>
            </div>
          </div>
        )}

        {/* Log time only view */}
        {actionView === 'logtime' && (
          <div className="space-y-2">
            {/* Previous time entries */}
            {timeEntries.length > 0 && (
              <div className="mb-2 pb-2 border-b border-linear-border-subtle">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <History className="h-3 w-3 text-linear-text-tertiary" />
                  <span className="text-[10px] font-medium text-linear-text-tertiary uppercase tracking-wide">
                    Timp pontat
                  </span>
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {timeEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-xs">
                      <span className="text-linear-text-secondary truncate flex-1">
                        {formatEntryDate(entry.date)}
                      </span>
                      <span className="text-linear-text-primary font-medium ml-2">
                        {formatHoursToDuration(entry.hours)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-linear-border-subtle">
                  <span className="text-[10px] text-linear-text-tertiary">Total</span>
                  <span className="text-xs text-linear-text-primary font-medium">
                    {formatHoursToDuration(timeEntries.reduce((sum, e) => sum + e.hours, 0))}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-linear-text-tertiary shrink-0" />
              <input
                ref={timeRef}
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="1h 30m"
                className="flex-1 px-2.5 py-1.5 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-md focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitLogTime();
                  } else if (e.key === 'Escape') {
                    setActionView('default');
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-linear-text-tertiary px-1">
              Introdu timpul lucrat (ex: 2h, 1h 30m, 45m)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setActionView('default')}
                className="flex-1 px-2 py-1.5 text-xs text-linear-text-secondary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleSubmitLogTime}
                disabled={!timeInput.trim()}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors',
                  timeInput.trim()
                    ? 'text-blue-400 hover:bg-blue-500/10'
                    : 'text-linear-text-muted cursor-not-allowed'
                )}
              >
                <Timer className="h-3.5 w-3.5" />
                Salvează
              </button>
            </div>
          </div>
        )}

        {/* Default action buttons */}
        {actionView === 'default' && (
          <div className="flex gap-1">
            {onComplete && data.status !== 'Completed' && (
              <button
                onClick={() => setActionView('complete')}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-green-400 hover:bg-green-500/10 rounded-md transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Finalizează
              </button>
            )}
            {onLogTime && (
              <button
                onClick={() => setActionView('logtime')}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
              >
                <Timer className="h-3.5 w-3.5" />
                Pontează
              </button>
            )}
            {onAddNote && (
              <button
                onClick={() => setActionView('note')}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
              >
                <StickyNote className="h-3.5 w-3.5" />
                Notă
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-linear-text-secondary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                <Edit className="h-3.5 w-3.5" />
                Editează
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Șterge
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// EVENT DETAIL CONTENT
// ====================================================================

interface EventDetailContentProps {
  data: EventDetailData;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function EventDetailContent({ data, onClose, onEdit, onDelete }: EventDetailContentProps) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-3 border-b border-linear-border-subtle">
        <div className="flex-1 pr-2">
          <h3 className="text-sm font-medium text-linear-text-primary leading-tight">
            {data.title}
          </h3>
          {/* Type badge */}
          <div className="mt-1.5">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                eventTypeColors[data.type]
              )}
            >
              {eventTypeLabels[data.type]}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Details */}
      <div className="p-3 space-y-2.5">
        {/* Time */}
        <div className="flex items-center gap-2.5 text-sm">
          <Clock className="h-4 w-4 text-linear-text-tertiary shrink-0" />
          <span className="text-linear-text-secondary">Ora:</span>
          <span className="text-linear-text-primary">
            {data.startTime} - {data.endTime}
          </span>
        </div>

        {/* Location */}
        {data.location && (
          <div className="flex items-center gap-2.5 text-sm">
            <MapPin className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Locație:</span>
            <span className="text-linear-text-primary">{data.location}</span>
          </div>
        )}

        {/* Case */}
        {data.caseName && (
          <div className="flex items-center gap-2.5 text-sm">
            <Briefcase className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Dosar:</span>
            <span className="text-linear-text-primary truncate">
              {data.caseNumber && (
                <span className="text-linear-text-tertiary">{data.caseNumber} - </span>
              )}
              {data.caseName}
            </span>
          </div>
        )}

        {/* Assignee */}
        {data.assigneeName && (
          <div className="flex items-center gap-2.5 text-sm">
            <User className="h-4 w-4 text-linear-text-tertiary shrink-0" />
            <span className="text-linear-text-secondary">Responsabil:</span>
            <span className="text-linear-text-primary">{data.assigneeName}</span>
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div className="mt-3 pt-2.5 border-t border-linear-border-subtle">
            <p className="text-xs text-linear-text-secondary leading-relaxed">{data.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-linear-border-subtle p-2 flex gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-linear-text-secondary hover:bg-linear-bg-hover rounded-md transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Editează
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Șterge
          </button>
        )}
      </div>
    </div>
  );
}

export default CalendarItemDetailPopover;
