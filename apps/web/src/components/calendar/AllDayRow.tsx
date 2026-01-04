'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * All-day event data structure
 */
export interface AllDayEvent {
  id: string;
  title: string;
  type: 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';
}

/**
 * All-day task data structure
 */
export interface AllDayTask {
  id: string;
  title: string;
  duration?: string;
}

export interface AllDayRowProps {
  days: Date[]; // 5 days (Mon-Fri)
  allDayEvents: Record<string, AllDayEvent[]>; // keyed by date ISO string
  allDayTasks: Record<string, AllDayTask[]>; // keyed by date ISO string
  onTaskDragStart?: (e: React.DragEvent, taskId: string) => void;
  onTaskDragEnd?: (e: React.DragEvent) => void;
  onEventClick?: (eventId: string) => void;
}

/**
 * Event type color configurations - theme-aware
 * Light mode: darker text on pastel backgrounds
 * Dark mode: lighter text on semi-transparent backgrounds
 */
const EVENT_TYPE_STYLES: Record<AllDayEvent['type'], { bg: string; text: string; border: string }> =
  {
    court: {
      bg: 'bg-[rgba(239,68,68,0.15)] dark:bg-[rgba(239,68,68,0.2)]',
      text: 'text-[#B91C1C] dark:text-[#FCA5A5] font-medium',
      border: 'border-l-[#EF4444]',
    },
    hearing: {
      bg: 'bg-[rgba(236,72,153,0.15)] dark:bg-[rgba(236,72,153,0.2)]',
      text: 'text-[#BE185D] dark:text-[#F9A8D4] font-medium',
      border: 'border-l-[#EC4899]',
    },
    deadline: {
      bg: 'bg-[rgba(245,158,11,0.15)] dark:bg-[rgba(245,158,11,0.2)]',
      text: 'text-[#B45309] dark:text-[#FCD34D] font-medium',
      border: 'border-l-[#F59E0B]',
    },
    meeting: {
      bg: 'bg-[rgba(59,130,246,0.15)] dark:bg-[rgba(59,130,246,0.2)]',
      text: 'text-[#1D4ED8] dark:text-[#93C5FD] font-medium',
      border: 'border-l-[#3B82F6]',
    },
    reminder: {
      bg: 'bg-[rgba(34,197,94,0.15)] dark:bg-[rgba(34,197,94,0.2)]',
      text: 'text-[#15803D] dark:text-[#86EFAC] font-medium',
      border: 'border-l-[#22C55E]',
    },
  };

/**
 * Formats a Date object to an ISO date string (YYYY-MM-DD) for use as a key
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * AllDayEvent component - displays a single all-day event
 */
interface AllDayEventItemProps {
  event: AllDayEvent;
  onClick?: (eventId: string) => void;
}

function AllDayEventItem({ event, onClick }: AllDayEventItemProps) {
  const styles = EVENT_TYPE_STYLES[event.type];

  const handleClick = React.useCallback(() => {
    onClick?.(event.id);
  }, [event.id, onClick]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(event.id);
      }
    },
    [event.id, onClick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'text-[11px] px-2 py-0.5 rounded-linear-sm',
        'whitespace-nowrap overflow-hidden text-ellipsis',
        'cursor-pointer',
        'border-l-[3px]',
        'transition-opacity hover:opacity-80',
        styles.bg,
        styles.text,
        styles.border
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`All-day event: ${event.title}`}
    >
      {event.title}
    </div>
  );
}

/**
 * AllDayTask component - displays a single all-day task (draggable)
 */
interface AllDayTaskItemProps {
  task: AllDayTask;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

function AllDayTaskItem({ task, onDragStart, onDragEnd }: AllDayTaskItemProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragStart = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      onDragStart?.(e, task.id);
    },
    [task.id, onDragStart]
  );

  const handleDragEnd = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setIsDragging(false);
      onDragEnd?.(e);
    },
    [onDragEnd]
  );

  return (
    <div
      draggable
      className={cn(
        'text-[11px] px-2 py-0.5 rounded-linear-sm font-medium',
        'bg-[rgba(139,92,246,0.15)] dark:bg-[rgba(139,92,246,0.2)]',
        'border-l-[3px] border-l-[#8B5CF6]',
        'text-[#6D28D9] dark:text-[#C4B5FD]',
        'cursor-grab active:cursor-grabbing',
        'flex items-center gap-1',
        'transition-opacity',
        isDragging && 'opacity-50'
      )}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      aria-label={`All-day task: ${task.title}`}
    >
      <span className="truncate">{task.title}</span>
      {task.duration && <span className="text-[10px] opacity-70 shrink-0">{task.duration}</span>}
    </div>
  );
}

/**
 * AllDayRow - Displays all-day events and tasks in a row below the week header
 *
 * Grid layout matches the week header: 60px label + 5 equal day columns
 * - Events are styled with type-specific colors (court, hearing, deadline, meeting, reminder)
 * - Tasks have purple left border and are draggable
 */
export function AllDayRow({
  days,
  allDayEvents,
  allDayTasks,
  onTaskDragStart,
  onTaskDragEnd,
  onEventClick,
}: AllDayRowProps) {
  return (
    <div
      className="grid shrink-0 border-b border-linear-border-subtle bg-linear-bg-secondary w-full"
      style={{
        gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 1fr',
        minHeight: '36px',
      }}
    >
      {/* Label column */}
      <div className="text-[10px] text-linear-text-tertiary p-1 border-r border-linear-border-subtle flex items-center justify-center">
        Toata ziua
      </div>

      {/* Day cells */}
      {days.map((day, index) => {
        const dateKey = formatDateKey(day);
        const events = allDayEvents[dateKey] || [];
        const tasks = allDayTasks[dateKey] || [];

        return (
          <div
            key={dateKey}
            className={cn(
              'border-r border-linear-border-subtle p-1',
              'flex flex-col gap-0.5',
              index === days.length - 1 && 'border-r-0'
            )}
          >
            {/* Render all-day events */}
            {events.map((event) => (
              <AllDayEventItem key={event.id} event={event} onClick={onEventClick} />
            ))}

            {/* Render all-day tasks */}
            {tasks.map((task) => (
              <AllDayTaskItem
                key={task.id}
                task={task}
                onDragStart={onTaskDragStart}
                onDragEnd={onTaskDragEnd}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export { AllDayEventItem, AllDayTaskItem };
