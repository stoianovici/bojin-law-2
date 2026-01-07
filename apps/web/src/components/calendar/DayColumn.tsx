'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TaskCard, CalendarTask as TaskCardCalendarTask } from './TaskCard';
import { ParentTaskCard } from './ParentTaskCard';
import { TaskActionPopover } from '@/components/tasks/TaskActionPopover';
import { DropZoneIndicator } from './DropZoneIndicator';
import { CalendarItemDetailPopover } from './CalendarItemDetailPopover';
import type { CalendarSubtaskData } from '@/hooks/useCalendarEvents';

/**
 * Calendar event data structure
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  type: 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';
  location?: string;
  assigneeName?: string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
}

/**
 * Calendar task data structure (unified calendar)
 */
export interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  estimatedDuration?: string;
  remainingDuration?: number; // Hours for height calculation
  dueDate: string;
  dueDateRaw?: string; // ISO date for positioning
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  isAutoScheduled?: boolean; // true if time was auto-calculated
  variant: 'on-track' | 'due-today' | 'overdue' | 'locked';
  status?: string;
  assigneeName?: string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
  // Nested subtasks support
  subtasks?: CalendarSubtaskData[];
  isParentTask?: boolean;
}

export interface DayColumnProps {
  date: Date;
  events: CalendarEvent[];
  tasks: CalendarTask[];
  isToday: boolean;
  startHour?: number; // default 8
  endHour?: number; // default 18
  onTaskClick?: (taskId: string) => void;
  onEventClick?: (eventId: string) => void;
  onTaskAddNote?: (taskId: string, note: string) => void;
  onTaskLogTime?: (taskId: string, duration: string, description: string) => void;
  onTaskComplete?: (taskId: string, note?: string) => void;
  /** Callback when edit button clicked in detail popover */
  onTaskEdit?: (taskId: string) => void;
  /** Callback when delete button clicked in detail popover */
  onTaskDelete?: (taskId: string) => void;
  /** Callback when edit button clicked in event detail popover */
  onEventEdit?: (eventId: string) => void;
  /** Callback when delete button clicked in event detail popover */
  onEventDelete?: (eventId: string) => void;
  /** Callback when a subtask checkbox is toggled */
  onSubtaskToggle?: (subtaskId: string) => void;
  /** Callback when clicking an empty slot area */
  onSlotClick?: (
    date: Date,
    hour: number,
    minute: number,
    position: { x: number; y: number }
  ) => void;
  /** Unified calendar: Render tasks in time grid instead of bottom panel */
  unifiedCalendarMode?: boolean;
  // Drag and drop props
  /** Enable drag and drop functionality */
  enableDragDrop?: boolean;
  /** Currently dragging task ID */
  draggingTaskId?: string | null;
  /** Drop zone indicator position (for this column) */
  dropZone?: { top: number; height: number; isValid: boolean; timeLabel: string } | null;
  /** Called when a task starts being dragged */
  onTaskDragStart?: (task: CalendarTask, position: { x: number; y: number }) => void;
  /** Called during drag to update drop target */
  onTaskDrag?: (date: Date, position: { x: number; y: number }) => void;
  /** Called when drag ends */
  onTaskDragEnd?: () => void;
}

/**
 * Parses a time string (HH:MM) and returns hours and minutes as numbers
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Converts time string to minutes from midnight for easier comparison
 */
function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

/**
 * Item with time range for overlap calculation
 */
interface TimeRangeItem {
  id: string;
  startMinutes: number;
  endMinutes: number;
  type: 'event' | 'task';
}

/**
 * Layout position for an item after overlap calculation
 */
interface ItemLayout {
  column: number;
  totalColumns: number;
}

/**
 * Calculate layout positions for overlapping items using a greedy column assignment algorithm.
 * Items that overlap are placed in adjacent columns to prevent visual stacking.
 */
function calculateOverlapLayout(items: TimeRangeItem[]): Map<string, ItemLayout> {
  const layouts = new Map<string, ItemLayout>();

  if (items.length === 0) return layouts;

  // Sort by start time, then by end time (longer items first)
  const sorted = [...items].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return b.endMinutes - a.endMinutes; // Longer items first
  });

  // Track columns: each column has its "end time" (when it becomes free)
  const columns: number[] = [];

  // Group items that overlap with each other
  const groups: TimeRangeItem[][] = [];
  let currentGroup: TimeRangeItem[] = [];
  let groupEnd = 0;

  for (const item of sorted) {
    if (currentGroup.length === 0 || item.startMinutes < groupEnd) {
      // Item overlaps with current group
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, item.endMinutes);
    } else {
      // Start new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [item];
      groupEnd = item.endMinutes;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Process each group independently
  for (const group of groups) {
    const groupColumns: number[] = []; // End times for each column in this group
    const itemColumns: Map<string, number> = new Map();

    for (const item of group) {
      // Find the first column where this item fits (column ends before item starts)
      let col = 0;
      while (col < groupColumns.length && groupColumns[col] > item.startMinutes) {
        col++;
      }

      // Assign to this column
      if (col >= groupColumns.length) {
        groupColumns.push(item.endMinutes);
      } else {
        groupColumns[col] = item.endMinutes;
      }

      itemColumns.set(item.id, col);
    }

    // Now assign layouts with total columns for this group
    const totalColumns = groupColumns.length;
    for (const item of group) {
      layouts.set(item.id, {
        column: itemColumns.get(item.id) || 0,
        totalColumns,
      });
    }
  }

  return layouts;
}

const HOUR_HEIGHT = 60; // Increased to fill available vertical space

/**
 * Calculates the top position in pixels for an event based on its start time
 * Each hour slot is 60px high
 */
function calculateEventPosition(startTime: string, startHour: number): number {
  const { hours, minutes } = parseTime(startTime);
  const hoursFromStart = hours - startHour;
  return hoursFromStart * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

/**
 * Calculates the height in pixels for an event based on its duration
 * Each hour is 48px
 */
function calculateEventHeight(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const durationMinutes = endMinutes - startMinutes;
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24); // Minimum 24px height
}

/**
 * Event type to style mapping - theme-aware colors
 * Light mode: darker text on pastel backgrounds
 * Dark mode: lighter text on semi-transparent backgrounds
 */
const eventTypeStyles: Record<CalendarEvent['type'], string> = {
  court:
    'bg-[rgba(239,68,68,0.15)] dark:bg-[rgba(239,68,68,0.2)] border-l-[3px] border-l-[#EF4444] text-[#B91C1C] dark:text-[#FCA5A5]',
  hearing:
    'bg-[rgba(236,72,153,0.15)] dark:bg-[rgba(236,72,153,0.2)] border-l-[3px] border-l-[#EC4899] text-[#BE185D] dark:text-[#F9A8D4]',
  deadline:
    'bg-[rgba(245,158,11,0.15)] dark:bg-[rgba(245,158,11,0.2)] border-l-[3px] border-l-[#F59E0B] text-[#B45309] dark:text-[#FCD34D]',
  meeting:
    'bg-[rgba(59,130,246,0.15)] dark:bg-[rgba(59,130,246,0.2)] border-l-[3px] border-l-[#3B82F6] text-[#1D4ED8] dark:text-[#93C5FD]',
  reminder:
    'bg-[rgba(34,197,94,0.15)] dark:bg-[rgba(34,197,94,0.2)] border-l-[3px] border-l-[#22C55E] text-[#15803D] dark:text-[#86EFAC]',
};

/**
 * DayColumn - A single day column in the Calendar v2 week grid
 *
 * Features:
 * - Time slots area with hour markers and half-hour dividers
 * - Absolutely positioned events based on time
 * - Unified calendar mode: tasks rendered in time grid
 * - Legacy mode: Tasks area at bottom
 * - Today highlight styling
 */
export function DayColumn({
  date,
  events,
  tasks,
  isToday,
  startHour = 8,
  endHour = 18,
  onTaskClick,
  onEventClick,
  onTaskAddNote,
  onTaskLogTime,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  onEventEdit,
  onEventDelete,
  onSubtaskToggle,
  onSlotClick,
  unifiedCalendarMode = false,
  enableDragDrop = false,
  draggingTaskId,
  dropZone,
  onTaskDragStart,
  onTaskDrag,
  onTaskDragEnd,
}: DayColumnProps) {
  const columnRef = React.useRef<HTMLDivElement>(null);
  // Calculate number of hour slots
  const hourCount = endHour - startHour;
  const hourSlots = Array.from({ length: hourCount }, (_, i) => startHour + i);

  // State for detail popover
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = React.useState<{ x: number; y: number } | null>(
    null
  );

  // Find selected task/event data
  const selectedTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );
  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  // Handle task click - opens detail popover
  const handleTaskClickForDetail = React.useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEventId(null);
    setSelectedTaskId(taskId);
    setPopoverPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Handle event click for detail popover
  const handleEventClickForDetail = React.useCallback((eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskId(null);
    setSelectedEventId(eventId);
    setPopoverPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Close detail popover
  const handleCloseDetailPopover = React.useCallback(() => {
    setSelectedTaskId(null);
    setSelectedEventId(null);
    setPopoverPosition(null);
  }, []);

  const handleEventClick = React.useCallback(
    (eventId: string) => {
      onEventClick?.(eventId);
    },
    [onEventClick]
  );

  const handleEventKeyDown = React.useCallback(
    (e: React.KeyboardEvent, eventId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEventClick?.(eventId);
      }
    },
    [onEventClick]
  );

  // Handle slot click for creating new tasks/events
  const handleSlotClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>, hour: number) => {
      if (!onSlotClick) return;

      // Prevent if clicking on an event (events have z-index)
      const target = e.target as HTMLElement;
      if (target.closest('[role="button"]')) return;

      // Calculate minute from click Y position within the slot
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const minute = Math.floor((relativeY / HOUR_HEIGHT) * 60);

      onSlotClick(date, hour, minute, { x: e.clientX, y: e.clientY });
    },
    [date, onSlotClick]
  );

  // Calculate task positions for unified calendar mode
  const scheduledTasks = unifiedCalendarMode
    ? tasks.filter(
        (t) => t.scheduledStartTime && t.status !== 'Completed' && t.status !== 'Cancelled'
      )
    : [];

  // Calculate overlap layout for EVENTS ONLY
  // Tasks don't have fixed time slots - they are auto-scheduled sequentially by useCalendarEvents
  // and should never be displayed side-by-side with events
  const eventOverlapLayout = React.useMemo(() => {
    const eventItems: TimeRangeItem[] = [];

    // Only add events to overlap calculation (for event-to-event overlaps)
    for (const event of events) {
      const startMinutes = timeToMinutes(event.startTime);
      const endMinutes = timeToMinutes(event.endTime);
      eventItems.push({
        id: event.id,
        startMinutes,
        endMinutes,
        type: 'event',
      });
    }

    return calculateOverlapLayout(eventItems);
  }, [events]);

  // Handle mouse move for drag tracking
  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!draggingTaskId || !onTaskDrag) return;
      onTaskDrag(date, { x: e.clientX, y: e.clientY });
    },
    [draggingTaskId, onTaskDrag, date]
  );

  // Handle task drag start
  const handleTaskDragStart = React.useCallback(
    (task: TaskCardCalendarTask, position: { x: number; y: number }) => {
      // Convert TaskCard's CalendarTask to DayColumn's CalendarTask
      const fullTask = tasks.find((t) => t.id === task.id);
      if (fullTask && onTaskDragStart) {
        onTaskDragStart(fullTask, position);
      }
    },
    [tasks, onTaskDragStart]
  );

  // Handle drag during movement
  const handleTaskDrag = React.useCallback(
    (position: { x: number; y: number }) => {
      if (onTaskDrag) {
        onTaskDrag(date, position);
      }
    },
    [date, onTaskDrag]
  );

  // Format date as ISO string for data attribute (used by drag detection)
  const dateISOString = date.toISOString().split('T')[0];

  return (
    <div
      ref={columnRef}
      data-column-date={dateISOString}
      className={cn(
        'border-r border-linear-border-subtle relative flex flex-col last:border-r-0',
        isToday && 'bg-[rgba(94,106,210,0.03)]'
      )}
      onMouseMove={handleMouseMove}
    >
      {/* Time slots area */}
      <div className="flex-1 relative">
        {hourSlots.map((hour) => (
          <div
            key={hour}
            className={cn(
              'border-b border-linear-border-subtle relative',
              onSlotClick && 'cursor-pointer hover:bg-linear-bg-tertiary/50 transition-colors'
            )}
            style={{ height: `${HOUR_HEIGHT}px` }}
            onClick={(e) => handleSlotClick(e, hour)}
          >
            {/* Half-hour line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-linear-border-subtle opacity-50 pointer-events-none" />
          </div>
        ))}

        {/* Events positioned absolutely */}
        {events.map((event) => {
          const top = calculateEventPosition(event.startTime, startHour);
          const height = calculateEventHeight(event.startTime, event.endTime);

          // Get layout for overlap handling (events only)
          const layout = eventOverlapLayout.get(event.id);
          const leftPercent = layout ? (layout.column / layout.totalColumns) * 100 : 0;
          const widthPercent = layout ? (1 / layout.totalColumns) * 100 : 100;
          // Add small gap between columns
          const gapPx = layout && layout.totalColumns > 1 ? 2 : 0;

          return (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              className={cn(
                'absolute rounded-linear-sm px-2 py-1 text-xs cursor-pointer overflow-hidden z-[5]',
                'transition-all duration-150 ease-out',
                'hover:scale-[1.02] hover:shadow-linear-md hover:z-[6]',
                eventTypeStyles[event.type]
              )}
              style={{
                top: `${top}px`,
                height: `${height}px`,
                left: `calc(${leftPercent}% + ${gapPx}px)`,
                width: `calc(${widthPercent}% - ${gapPx * 2}px)`,
              }}
              onClick={(e) => handleEventClickForDetail(event.id, e)}
              onKeyDown={(e) => handleEventKeyDown(e, event.id)}
              aria-label={`Event: ${event.title} at ${event.startTime}`}
            >
              {/* Event title */}
              <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {event.title}
              </div>

              {/* Event time */}
              <div className="text-[10px] opacity-80">
                {event.startTime} - {event.endTime}
              </div>

              {/* Event location (if available and there's space) */}
              {event.location && height >= 60 && (
                <div className="text-[10px] opacity-70 mt-0.5">{event.location}</div>
              )}
            </div>
          );
        })}

        {/* Unified calendar: Tasks positioned absolutely in time grid */}
        {/* Tasks are scheduled sequentially by useCalendarEvents (starting 9 AM, avoiding events) */}
        {/* They should always be full-width - never side-by-side with events */}
        {/* Parent tasks with subtasks render as ParentTaskCard, regular tasks as TaskCard */}
        {unifiedCalendarMode &&
          scheduledTasks.map((task) => {
            const top = calculateEventPosition(task.scheduledStartTime!, startHour);
            const isBeingDragged = draggingTaskId === task.id;

            // Check if this is a parent task with subtasks
            if (task.isParentTask && task.subtasks && task.subtasks.length > 0) {
              // Calculate total height for parent + subtasks
              // Must match useCalendarEvents getVisualDuration()
              const headerHeight = 24; // PARENT_HEADER_HEIGHT_PX
              const subtaskHeight = 32; // SUBTASK_HEIGHT_PX
              const totalHeight = headerHeight + task.subtasks.length * subtaskHeight;

              return (
                <ParentTaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  caseNumber={task.caseNumber}
                  subtasks={task.subtasks}
                  isTimeGridMode={true}
                  top={top}
                  height={totalHeight}
                  onParentClick={(e) => handleTaskClickForDetail(task.id, e)}
                  onSubtaskClick={(subtaskId, e) => handleTaskClickForDetail(subtaskId, e)}
                  onSubtaskToggle={onSubtaskToggle}
                />
              );
            }

            // Regular task (no subtasks) - use TaskCard
            const height = task.remainingDuration
              ? Math.max(task.remainingDuration * HOUR_HEIGHT, 24)
              : HOUR_HEIGHT; // Default to 1 hour

            // Tasks are always full-width (no overlap layout)
            // They are auto-scheduled sequentially and placed after events when conflicts arise

            return (
              <TaskActionPopover
                key={task.id}
                taskId={task.id}
                taskTitle={task.title}
                onAddNote={onTaskAddNote}
                onLogTime={onTaskLogTime}
                onComplete={onTaskComplete}
                contextMenuMode={true}
              >
                <TaskCard
                  task={{
                    id: task.id,
                    title: task.title,
                    estimatedDuration: task.estimatedDuration,
                    dueDate: task.dueDate,
                    scheduledStartTime: task.scheduledStartTime,
                    scheduledEndTime: task.scheduledEndTime,
                    remainingDuration: task.remainingDuration,
                  }}
                  variant={task.variant}
                  onClick={(e) => e && handleTaskClickForDetail(task.id, e)}
                  top={top}
                  height={height}
                  left={0}
                  width={100}
                  isDraggable={enableDragDrop}
                  isDragging={isBeingDragged}
                  onDragStart={handleTaskDragStart}
                  onDrag={handleTaskDrag}
                  onDragEnd={onTaskDragEnd}
                />
              </TaskActionPopover>
            );
          })}

        {/* Drop zone indicator */}
        {dropZone && (
          <DropZoneIndicator
            isVisible={true}
            top={dropZone.top}
            height={dropZone.height}
            isValid={dropZone.isValid}
            timeLabel={dropZone.timeLabel}
          />
        )}
      </div>

      {/* Tasks area - Legacy mode or unscheduled tasks */}
      {!unifiedCalendarMode && (
        <div
          className={cn(
            'border-t border-linear-border-default bg-linear-bg-tertiary p-1.5 min-h-[60px]',
            'flex flex-col gap-0.5'
          )}
        >
          {tasks.map((task) => {
            // Parent task with subtasks - use ParentTaskCard
            if (task.isParentTask && task.subtasks && task.subtasks.length > 0) {
              return (
                <ParentTaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  caseNumber={task.caseNumber}
                  subtasks={task.subtasks}
                  isTimeGridMode={false}
                  onParentClick={(e) => handleTaskClickForDetail(task.id, e)}
                  onSubtaskClick={(subtaskId, e) => handleTaskClickForDetail(subtaskId, e)}
                  onSubtaskToggle={onSubtaskToggle}
                />
              );
            }

            // Regular task - use TaskCard
            return (
              <TaskActionPopover
                key={task.id}
                taskId={task.id}
                taskTitle={task.title}
                onAddNote={onTaskAddNote}
                onLogTime={onTaskLogTime}
                onComplete={onTaskComplete}
                contextMenuMode={true}
              >
                <TaskCard
                  task={{
                    id: task.id,
                    title: task.title,
                    estimatedDuration: task.estimatedDuration,
                    dueDate: task.dueDate,
                  }}
                  variant={task.variant}
                  onClick={(e) => e && handleTaskClickForDetail(task.id, e)}
                />
              </TaskActionPopover>
            );
          })}
        </div>
      )}

      {/* Detail popover for tasks - rendered with fixed positioning */}
      {selectedTask && popoverPosition && (
        <CalendarItemDetailPopover
          itemType="task"
          taskData={{
            id: selectedTask.id,
            title: selectedTask.title,
            description: selectedTask.description,
            dueDate: selectedTask.dueDateRaw || '',
            dueDateFormatted: selectedTask.dueDate,
            scheduledStartTime: selectedTask.scheduledStartTime,
            scheduledEndTime: selectedTask.scheduledEndTime,
            estimatedDuration: selectedTask.estimatedDuration,
            remainingDuration: selectedTask.remainingDuration,
            variant: selectedTask.variant,
            status: selectedTask.status,
            caseName: selectedTask.caseTitle,
            caseNumber: selectedTask.caseNumber,
            assigneeName: selectedTask.assigneeName,
          }}
          onEdit={onTaskEdit}
          onDelete={onTaskDelete}
          onComplete={(id) => onTaskComplete?.(id)}
          onAddNote={(id) => onTaskAddNote?.(id, '')}
          open={true}
          onOpenChange={(open) => !open && handleCloseDetailPopover()}
          position={popoverPosition}
        >
          <span style={{ display: 'none' }} />
        </CalendarItemDetailPopover>
      )}

      {/* Detail popover for events - rendered with fixed positioning */}
      {selectedEvent && popoverPosition && (
        <CalendarItemDetailPopover
          itemType="event"
          eventData={{
            id: selectedEvent.id,
            title: selectedEvent.title,
            description: selectedEvent.description,
            startTime: selectedEvent.startTime,
            endTime: selectedEvent.endTime,
            type: selectedEvent.type,
            location: selectedEvent.location,
            caseName: selectedEvent.caseTitle,
            caseNumber: selectedEvent.caseNumber,
            assigneeName: selectedEvent.assigneeName,
          }}
          onEdit={onEventEdit}
          onDelete={onEventDelete}
          open={true}
          onOpenChange={(open) => !open && handleCloseDetailPopover()}
          position={popoverPosition}
        >
          <span style={{ display: 'none' }} />
        </CalendarItemDetailPopover>
      )}
    </div>
  );
}

export { calculateEventPosition, calculateEventHeight };
