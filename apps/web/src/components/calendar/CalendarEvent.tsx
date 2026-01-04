'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Event type definitions for calendar events
 */
export type CalendarEventType = 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';

/**
 * Calendar event data structure
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  type: CalendarEventType;
  location?: string;
}

/**
 * Props for the CalendarEvent component
 */
export interface CalendarEventProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>,
    VariantProps<typeof calendarEventVariants> {
  event: CalendarEvent;
  top: number; // pixels from top of day column
  height: number; // height in pixels
  onClick?: () => void;
}

/**
 * Event type color variants using cva
 * Colors are theme-aware:
 * - Light mode: darker text on pastel backgrounds
 * - Dark mode: lighter text on semi-transparent backgrounds
 */
const calendarEventVariants = cva(
  [
    'absolute',
    'left-0.5',
    'right-0.5',
    'rounded-[4px]',
    'px-2',
    'py-1',
    'text-[11px]',
    'cursor-pointer',
    'overflow-hidden',
    'z-[5]',
    'transition-all duration-150 ease-out',
    'border-l-[3px]',
    'hover:scale-[1.02]',
    'hover:shadow-linear-md',
    'hover:z-[6]',
  ],
  {
    variants: {
      type: {
        court: [
          'bg-[rgba(239,68,68,0.15)]',
          'dark:bg-[rgba(239,68,68,0.2)]',
          'border-l-[#EF4444]',
          'text-[#B91C1C]',
          'dark:text-[#FCA5A5]',
        ],
        hearing: [
          'bg-[rgba(236,72,153,0.15)]',
          'dark:bg-[rgba(236,72,153,0.2)]',
          'border-l-[#EC4899]',
          'text-[#BE185D]',
          'dark:text-[#F9A8D4]',
        ],
        deadline: [
          'bg-[rgba(245,158,11,0.15)]',
          'dark:bg-[rgba(245,158,11,0.2)]',
          'border-l-[#F59E0B]',
          'text-[#B45309]',
          'dark:text-[#FCD34D]',
        ],
        meeting: [
          'bg-[rgba(59,130,246,0.15)]',
          'dark:bg-[rgba(59,130,246,0.2)]',
          'border-l-[#3B82F6]',
          'text-[#1D4ED8]',
          'dark:text-[#93C5FD]',
        ],
        reminder: [
          'bg-[rgba(34,197,94,0.15)]',
          'dark:bg-[rgba(34,197,94,0.2)]',
          'border-l-[#22C55E]',
          'text-[#15803D]',
          'dark:text-[#86EFAC]',
        ],
      },
    },
    defaultVariants: {
      type: 'meeting',
    },
  }
);

/**
 * Pixels per hour in the time grid (configurable constant)
 */
const PIXELS_PER_HOUR = 60;

/**
 * Hour offset for the time grid start (e.g., 8 for 8:00 AM)
 */
const TIME_GRID_START_HOUR = 8;

/**
 * Parse a time string into hours and minutes
 * @param timeStr - Time string in "HH:MM" format
 * @returns Object with hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Calculate the pixel position from the top of the day column for a given time
 * @param timeStr - Time string in "HH:MM" format
 * @param pixelsPerHour - Pixels per hour (default: 60)
 * @param startHour - Start hour of the time grid (default: 8)
 * @returns Pixel position from top
 */
export function calculateEventTop(
  timeStr: string,
  pixelsPerHour: number = PIXELS_PER_HOUR,
  startHour: number = TIME_GRID_START_HOUR
): number {
  const { hours, minutes } = parseTime(timeStr);
  const hoursFromStart = hours - startHour;
  const minuteFraction = minutes / 60;
  return (hoursFromStart + minuteFraction) * pixelsPerHour;
}

/**
 * Calculate the height in pixels for an event based on its duration
 * @param startTime - Start time in "HH:MM" format
 * @param endTime - End time in "HH:MM" format
 * @param pixelsPerHour - Pixels per hour (default: 60)
 * @returns Height in pixels
 */
export function calculateEventHeight(
  startTime: string,
  endTime: string,
  pixelsPerHour: number = PIXELS_PER_HOUR
): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const durationMinutes = endMinutes - startMinutes;

  return (durationMinutes / 60) * pixelsPerHour;
}

/**
 * Calculate both top position and height for an event
 * @param event - Calendar event with startTime and endTime
 * @param pixelsPerHour - Pixels per hour (default: 60)
 * @param startHour - Start hour of the time grid (default: 8)
 * @returns Object with top and height in pixels
 */
export function calculateEventPosition(
  event: Pick<CalendarEvent, 'startTime' | 'endTime'>,
  pixelsPerHour: number = PIXELS_PER_HOUR,
  startHour: number = TIME_GRID_START_HOUR
): { top: number; height: number } {
  return {
    top: calculateEventTop(event.startTime, pixelsPerHour, startHour),
    height: calculateEventHeight(event.startTime, event.endTime, pixelsPerHour),
  };
}

/**
 * Format the event time display string
 * @param startTime - Start time in "HH:MM" format
 * @param endTime - End time in "HH:MM" format
 * @returns Formatted time string (e.g., "09:00 - 10:30")
 */
export function formatEventTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

/**
 * CalendarEvent - A positioned event block for the Calendar v2 time grid
 *
 * Displays calendar events with type-specific colors and positioning.
 * Events are absolutely positioned within their parent day column.
 *
 * @example
 * ```tsx
 * const event: CalendarEvent = {
 *   id: '1',
 *   title: 'Team Meeting',
 *   startTime: '09:00',
 *   endTime: '10:30',
 *   type: 'meeting',
 *   location: 'Room 5',
 * };
 *
 * const { top, height } = calculateEventPosition(event);
 *
 * <CalendarEvent
 *   event={event}
 *   top={top}
 *   height={height}
 *   onClick={() => console.log('Event clicked')}
 * />
 * ```
 */
const CalendarEventComponent = React.forwardRef<HTMLDivElement, CalendarEventProps>(
  ({ className, event, top, height, onClick, ...props }, ref) => {
    const handleClick = React.useCallback(() => {
      onClick?.();
    }, [onClick]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      },
      [onClick]
    );

    // Determine if we have enough height to show location
    const showLocation = event.location && height >= 60;
    // Determine if we have enough height to show time
    const showTime = height >= 40;

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(calendarEventVariants({ type: event.type }), className)}
        style={{
          top: `${top}px`,
          height: `${height}px`,
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${event.title}, ${event.startTime} to ${event.endTime}${event.location ? `, ${event.location}` : ''}`}
        {...props}
      >
        {/* Event title */}
        <div className="truncate font-medium leading-tight">{event.title}</div>

        {/* Event time */}
        {showTime && (
          <div className="truncate text-[10px] opacity-80">
            {formatEventTimeRange(event.startTime, event.endTime)}
          </div>
        )}

        {/* Event location (optional) */}
        {showLocation && (
          <div className="mt-0.5 truncate text-[10px] opacity-70">{event.location}</div>
        )}
      </div>
    );
  }
);

CalendarEventComponent.displayName = 'CalendarEvent';

export { CalendarEventComponent as CalendarEvent, calendarEventVariants };
