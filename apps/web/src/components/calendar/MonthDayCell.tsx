'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Event type color mapping for the month day cell pills
 */
const eventTypeColors: Record<string, string> = {
  court: 'bg-[#EF4444]',
  hearing: 'bg-[#EC4899]',
  deadline: 'bg-[#F59E0B]',
  meeting: 'bg-[#3B82F6]',
  reminder: 'bg-[#22C55E]',
};

/**
 * Important event types that should be highlighted (Termene Instanta, Termene Legale)
 */
const IMPORTANT_EVENT_TYPES = ['court', 'deadline'];

/**
 * Task color for task pills
 */
const taskColor = 'bg-[#8B5CF6]';

/**
 * Props for the MonthDayCell component
 */
export interface MonthDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend?: boolean;
  events: Array<{ id: string; title: string; type: string }>;
  tasks: Array<{ id: string; title: string }>;
  onClick: () => void;
}

/**
 * MonthDayCell - A day cell component for the month view calendar grid
 *
 * Displays the day number, event indicators as colored pills, and task indicators.
 * Shows a maximum of 3 items with "+N more" indicator for additional items.
 *
 * @example
 * ```tsx
 * <MonthDayCell
 *   date={new Date(2025, 0, 15)}
 *   isCurrentMonth={true}
 *   isToday={false}
 *   events={[
 *     { id: '1', title: 'Team Meeting', type: 'meeting' },
 *     { id: '2', title: 'Court Date', type: 'court' },
 *   ]}
 *   tasks={[
 *     { id: '1', title: 'Review contract' },
 *   ]}
 *   onClick={() => console.log('Day clicked')}
 * />
 * ```
 */
export function MonthDayCell({
  date,
  isCurrentMonth,
  isToday,
  isWeekend = false,
  events,
  tasks,
  onClick,
}: MonthDayCellProps) {
  const dayNumber = date.getDate();
  const totalItems = events.length + tasks.length;
  const maxVisible = 3;
  const remainingCount = totalItems - maxVisible;

  // Separate important events (court, deadline) from regular events
  const importantEvents = events.filter((e) => IMPORTANT_EVENT_TYPES.includes(e.type));
  const regularEvents = events.filter((e) => !IMPORTANT_EVENT_TYPES.includes(e.type));

  // Important events always shown first, then regular events, then tasks
  const sortedEvents = [...importantEvents, ...regularEvents];
  const visibleEvents = sortedEvents.slice(0, maxVisible);
  const remainingSlots = maxVisible - visibleEvents.length;
  const visibleTasks = tasks.slice(0, remainingSlots);

  // Check if day has important events for cell highlighting
  const hasImportantEvents = importantEvents.length > 0;

  const handleClick = React.useCallback(() => {
    onClick();
  }, [onClick]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'min-h-[80px] p-1.5 cursor-pointer rounded-linear-sm',
        'border border-linear-border-subtle',
        'hover:bg-linear-bg-tertiary',
        'transition-colors duration-150',
        // Weekend cells are dimmed
        isWeekend && 'bg-linear-bg-tertiary/50 opacity-60',
        // Highlight cells with important events (overrides weekend dimming)
        hasImportantEvents &&
          isCurrentMonth &&
          'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.3)] opacity-100'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${date.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}${
        events.length > 0 ? `, ${events.length} evenimente` : ''
      }${tasks.length > 0 ? `, ${tasks.length} taskuri` : ''}`}
    >
      {/* Day number */}
      <div className={cn('mb-1', isWeekend && 'text-center')}>
        {isToday ? (
          <div
            className={cn(
              'bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold',
              isWeekend ? 'w-5 h-5 mx-auto' : 'w-6 h-6'
            )}
          >
            {dayNumber}
          </div>
        ) : (
          <span
            className={cn(
              isWeekend ? 'text-xs' : 'text-sm',
              !isCurrentMonth ? 'text-linear-text-tertiary' : 'text-linear-text-primary'
            )}
          >
            {dayNumber}
          </span>
        )}
      </div>

      {/* Weekend: compact view with just dot indicators */}
      {isWeekend ? (
        <div className="flex flex-wrap gap-0.5 justify-center">
          {/* Show dots for important events */}
          {importantEvents.slice(0, 3).map((event) => (
            <div
              key={event.id}
              className={cn(
                'h-2 w-2 rounded-full',
                eventTypeColors[event.type] || eventTypeColors.meeting
              )}
              title={event.title}
            />
          ))}
          {/* Count indicator if more items */}
          {totalItems > 3 && (
            <span className="text-[9px] text-linear-text-tertiary">+{totalItems - 3}</span>
          )}
        </div>
      ) : (
        /* Weekday: full event and task indicators */
        <div className="flex flex-col gap-0.5 overflow-hidden">
          {/* Event pills */}
          {visibleEvents.map((event) => {
            const isImportant = IMPORTANT_EVENT_TYPES.includes(event.type);
            return (
              <div
                key={event.id}
                className={cn(
                  'flex items-center gap-1 min-w-0',
                  // Important events get a badge-style background
                  isImportant && 'px-1 py-0.5 -mx-1 rounded-sm',
                  isImportant && event.type === 'court' && 'bg-[rgba(239,68,68,0.15)]',
                  isImportant && event.type === 'deadline' && 'bg-[rgba(245,158,11,0.15)]'
                )}
              >
                <div
                  className={cn(
                    'rounded-full flex-shrink-0',
                    eventTypeColors[event.type] || eventTypeColors.meeting,
                    // Larger dot for important events
                    isImportant ? 'h-2 w-2' : 'h-1.5 w-1.5'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] truncate',
                    // Important events get emphasized text
                    isImportant
                      ? 'text-linear-text-primary font-medium'
                      : 'text-linear-text-secondary'
                  )}
                >
                  {event.title}
                </span>
              </div>
            );
          })}

          {/* Task pills */}
          {visibleTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-1 min-w-0">
              <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', taskColor)} />
              <span className="text-[10px] text-linear-text-secondary truncate">{task.title}</span>
            </div>
          ))}

          {/* More indicator */}
          {remainingCount > 0 && (
            <span className="text-[10px] text-linear-text-tertiary">+{remainingCount} more</span>
          )}
        </div>
      )}
    </div>
  );
}

MonthDayCell.displayName = 'MonthDayCell';

export { eventTypeColors };
