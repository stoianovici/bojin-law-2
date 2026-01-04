'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { TaskActionPopover } from '@/components/tasks/TaskActionPopover';

/**
 * Calendar event data structure
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  type: 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';
  location?: string;
}

/**
 * Calendar task data structure
 */
export interface CalendarTask {
  id: string;
  title: string;
  estimatedDuration?: string;
  dueDate: string;
  variant: 'on-track' | 'due-today' | 'overdue' | 'locked';
}

export interface DayColumnProps {
  date: Date;
  events: CalendarEvent[];
  tasks: CalendarTask[];
  isToday: boolean;
  startHour?: number; // default 8
  endHour?: number; // default 18
  onTaskDrop?: (taskId: string, date: Date) => void;
  onTaskClick?: (taskId: string) => void;
  onEventClick?: (eventId: string) => void;
  onTaskAddNote?: (taskId: string, note: string) => void;
  onTaskLogTime?: (taskId: string, duration: string, description: string) => void;
  onTaskComplete?: (taskId: string, note?: string) => void;
  /** Callback when clicking an empty slot area */
  onSlotClick?: (
    date: Date,
    hour: number,
    minute: number,
    position: { x: number; y: number }
  ) => void;
}

/**
 * Parses a time string (HH:MM) and returns hours and minutes as numbers
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

const HOUR_HEIGHT = 48; // Reduced from 60px to fit screen

/**
 * Calculates the top position in pixels for an event based on its start time
 * Each hour slot is 48px high
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
 * - Tasks area at bottom with drag-and-drop support
 * - Today highlight styling
 */
export function DayColumn({
  date,
  events,
  tasks,
  isToday,
  startHour = 8,
  endHour = 18,
  onTaskDrop,
  onTaskClick,
  onEventClick,
  onTaskAddNote,
  onTaskLogTime,
  onTaskComplete,
  onSlotClick,
}: DayColumnProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Calculate number of hour slots
  const hourCount = endHour - startHour;
  const hourSlots = Array.from({ length: hourCount }, (_, i) => startHour + i);

  // Drag and drop handlers for tasks area
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    // Only set drag over to false if we're actually leaving the drop zone
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId && onTaskDrop) {
        onTaskDrop(taskId, date);
      }
    },
    [date, onTaskDrop]
  );

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

  return (
    <div
      className={cn(
        'border-r border-linear-border-subtle relative flex flex-col last:border-r-0',
        isToday && 'bg-[rgba(94,106,210,0.03)]'
      )}
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

          return (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              className={cn(
                'absolute left-0.5 right-0.5 rounded-linear-sm px-2 py-1 text-xs cursor-pointer overflow-hidden z-[5]',
                'transition-all duration-150 ease-out',
                'hover:scale-[1.02] hover:shadow-linear-md hover:z-[6]',
                eventTypeStyles[event.type]
              )}
              style={{
                top: `${top}px`,
                height: `${height}px`,
              }}
              onClick={() => handleEventClick(event.id)}
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
      </div>

      {/* Tasks area (drop zone) */}
      <div
        className={cn(
          'border-t border-linear-border-default bg-linear-bg-tertiary p-1.5 min-h-[60px]',
          'flex flex-col gap-0.5',
          isDragOver && 'bg-linear-accent-secondary border border-dashed border-linear-accent'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.map((task) => (
          <TaskActionPopover
            key={task.id}
            taskId={task.id}
            taskTitle={task.title}
            onAddNote={onTaskAddNote}
            onLogTime={onTaskLogTime}
            onComplete={onTaskComplete}
          >
            <TaskCard
              task={{
                id: task.id,
                title: task.title,
                estimatedDuration: task.estimatedDuration,
                dueDate: task.dueDate,
              }}
              variant={task.variant}
              onClick={() => onTaskClick?.(task.id)}
            />
          </TaskActionPopover>
        ))}
      </div>
    </div>
  );
}

export { calculateEventPosition, calculateEventHeight };
