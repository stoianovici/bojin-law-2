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
  events,
  tasks,
  onClick,
}: MonthDayCellProps) {
  const dayNumber = date.getDate();
  const totalItems = events.length + tasks.length;
  const maxVisible = 3;
  const remainingCount = totalItems - maxVisible;

  // Combine events and tasks for display, limited to maxVisible
  const visibleEvents = events.slice(0, maxVisible);
  const remainingSlots = maxVisible - visibleEvents.length;
  const visibleTasks = tasks.slice(0, remainingSlots);

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
        'aspect-square p-2 cursor-pointer rounded-linear-sm',
        'border border-linear-border-subtle',
        'hover:bg-linear-bg-tertiary',
        'transition-colors duration-150'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${date.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}${
        events.length > 0 ? `, ${events.length} evenimente` : ''
      }${tasks.length > 0 ? `, ${tasks.length} taskuri` : ''}`}
    >
      {/* Day number */}
      <div className="mb-1">
        {isToday ? (
          <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
            {dayNumber}
          </div>
        ) : (
          <span
            className={cn(
              'text-sm',
              !isCurrentMonth ? 'text-linear-text-tertiary' : 'text-linear-text-primary'
            )}
          >
            {dayNumber}
          </span>
        )}
      </div>

      {/* Event and task indicators */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {/* Event pills */}
        {visibleEvents.map((event) => (
          <div key={event.id} className="flex items-center gap-1 min-w-0">
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                eventTypeColors[event.type] || eventTypeColors.meeting
              )}
            />
            <span className="text-[10px] text-linear-text-secondary truncate">{event.title}</span>
          </div>
        ))}

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
    </div>
  );
}

MonthDayCell.displayName = 'MonthDayCell';

export { eventTypeColors };
