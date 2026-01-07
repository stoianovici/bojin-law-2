'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Event type for agenda items
 */
export type AgendaEventType = 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';

/**
 * Props for the AgendaItem component
 */
export interface AgendaItemProps {
  id: string;
  title: string;
  type: 'event' | 'task';
  eventType?: AgendaEventType;
  startTime?: string;
  endTime?: string;
  location?: string;
  onClick: () => void;
}

/**
 * Color mapping for event types
 */
const typeColors: Record<AgendaEventType, string> = {
  court: 'bg-[#EF4444]',
  hearing: 'bg-[#EC4899]',
  deadline: 'bg-[#F59E0B]',
  meeting: 'bg-[#3B82F6]',
  reminder: 'bg-[#22C55E]',
};

/**
 * Get the indicator color class based on type and eventType
 */
function getIndicatorColor(type: 'event' | 'task', eventType?: AgendaEventType): string {
  if (type === 'task') {
    return 'bg-[#8B5CF6]';
  }
  return eventType ? typeColors[eventType] : typeColors.meeting;
}

/**
 * Format the time display string
 */
function formatTimeDisplay(startTime?: string, endTime?: string): string | null {
  if (!startTime) return null;
  if (endTime) {
    return `${startTime} - ${endTime}`;
  }
  return startTime;
}

/**
 * AgendaItem - A list item for the calendar agenda view
 *
 * Displays calendar events and tasks in a list format with:
 * - Color-coded left indicator bar based on event type
 * - Title and time information
 * - Optional location display
 *
 * @example
 * ```tsx
 * <AgendaItem
 *   id="1"
 *   title="Team Meeting"
 *   type="event"
 *   eventType="meeting"
 *   startTime="09:00"
 *   endTime="10:30"
 *   location="Conference Room A"
 *   onClick={() => console.log('Item clicked')}
 * />
 * ```
 */
const AgendaItem = React.forwardRef<HTMLDivElement, AgendaItemProps>(
  ({ id, title, type, eventType, startTime, endTime, location, onClick }, ref) => {
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

    const indicatorColor = getIndicatorColor(type, eventType);
    const timeDisplay = formatTimeDisplay(startTime, endTime);

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          'py-3 px-4',
          'hover:bg-linear-bg-tertiary',
          'border-b border-linear-border-subtle',
          'cursor-pointer',
          'flex items-start gap-3',
          'transition-colors duration-150'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${type === 'task' ? 'Task' : 'Event'}: ${title}${timeDisplay ? `, ${timeDisplay}` : ''}${location ? `, ${location}` : ''}`}
        data-agenda-item-id={id}
      >
        {/* Left: Color indicator bar */}
        <div
          className={cn('w-1 h-full min-h-[40px] rounded-full', indicatorColor)}
          aria-hidden="true"
        />

        {/* Middle section */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="text-sm font-medium text-linear-text-primary truncate">{title}</div>

          {/* Time */}
          {timeDisplay && <div className="text-xs text-linear-text-secondary">{timeDisplay}</div>}
        </div>

        {/* Right section: Location */}
        {location && <div className="text-xs text-linear-text-tertiary shrink-0">{location}</div>}
      </div>
    );
  }
);

AgendaItem.displayName = 'AgendaItem';

export { AgendaItem };
