'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './types';
import { eventColors } from './types';
import { format, isSameDay, isToday, getHours, getMinutes, differenceInMinutes } from 'date-fns';
import { ro } from 'date-fns/locale';

// ====================================================================
// DayView - Single day calendar with time grid
// ====================================================================

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date, hour: number) => void;
  className?: string;
}

// Working hours configuration
const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_HEIGHT = 64; // pixels per hour

export function DayView({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  className,
}: DayViewProps) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  // Current time indicator
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Separate all-day events from timed events
  const allDayEvents = events.filter((e) => e.isAllDay && isSameDay(e.startTime, currentDate));
  const timedEvents = events.filter((e) => !e.isAllDay && isSameDay(e.startTime, currentDate));

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent): React.CSSProperties => {
    const startHour = getHours(event.startTime);
    const startMinutes = getMinutes(event.startTime);
    const durationMinutes = differenceInMinutes(event.endTime, event.startTime);

    const top = (startHour - HOUR_START) * HOUR_HEIGHT + (startMinutes / 60) * HOUR_HEIGHT;
    const height = (durationMinutes / 60) * HOUR_HEIGHT;

    const colors = eventColors[event.type];

    return {
      top: `${top}px`,
      height: `${Math.max(height, 32)}px`, // Minimum height for visibility
      backgroundColor: colors.bg,
      borderLeftColor: colors.border,
      color: colors.text,
    };
  };

  // Current time indicator position
  const getCurrentTimePosition = (): number => {
    const hour = getHours(currentTime);
    const minutes = getMinutes(currentTime);
    if (hour < HOUR_START || hour >= HOUR_END) return -1;
    return (hour - HOUR_START) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  };

  const timeIndicatorTop = getCurrentTimePosition();
  const showTimeIndicator = isToday(currentDate) && timeIndicatorTop >= 0;

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      {/* Day Header */}
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-linear-border-subtle bg-linear-bg-secondary px-6 py-4">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center text-2xl font-semibold',
            isToday(currentDate)
              ? 'rounded-full bg-linear-accent text-white'
              : 'text-linear-text-primary'
          )}
        >
          {format(currentDate, 'd')}
        </div>
        <div>
          <div className="text-lg font-medium capitalize text-linear-text-primary">
            {format(currentDate, 'EEEE', { locale: ro })}
          </div>
          <div className="text-sm text-linear-text-secondary">
            {format(currentDate, 'd MMMM yyyy', { locale: ro })}
          </div>
        </div>
      </div>

      {/* All Day Events Row */}
      {allDayEvents.length > 0 && (
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-linear-border-subtle bg-linear-bg-secondary px-6 py-3">
          <span className="pt-1 text-[11px] text-linear-text-muted">Toată ziua</span>
          <div className="flex flex-1 flex-wrap gap-2">
            {allDayEvents.map((event) => {
              const colors = eventColors[event.type];
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventClick?.(event)}
                  className={cn(
                    'rounded px-3 py-1.5 text-[12px] font-medium',
                    'transition-transform hover:scale-[1.02]'
                  )}
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                  }}
                >
                  {event.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Time Column */}
        <div className="w-[70px] flex-shrink-0 border-r border-linear-border-subtle">
          {hours.map((hour) => (
            <div
              key={hour}
              className="pr-3 pt-1 text-right text-[11px] text-linear-text-muted"
              style={{ height: `${HOUR_HEIGHT}px` }}
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Events Grid */}
        <div className="relative flex-1">
          {/* Hour Lines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="border-b border-linear-border-subtle hover:bg-linear-bg-hover/20"
              style={{ height: `${HOUR_HEIGHT}px` }}
              onClick={() => onTimeSlotClick?.(currentDate, hour)}
            />
          ))}

          {/* Events */}
          {timedEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onEventClick?.(event)}
              className={cn(
                'absolute left-2 right-4 overflow-hidden rounded-md border-l-[3px] px-3 py-2',
                'transition-all duration-100 hover:scale-[1.01] hover:shadow-lg hover:z-10',
                'text-left'
              )}
              style={getEventStyle(event)}
            >
              <div className="truncate text-sm font-medium" style={{ color: 'inherit' }}>
                {event.title}
              </div>
              <div className="mt-0.5 truncate text-xs opacity-80">
                {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
              </div>
              {event.location && (
                <div className="mt-1 flex items-center gap-1 truncate text-xs opacity-70">
                  <svg
                    className="h-3 w-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                  </svg>
                  {event.location}
                </div>
              )}
            </button>
          ))}

          {/* Current Time Indicator */}
          {showTimeIndicator && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 h-0.5 bg-red-500"
              style={{ top: `${timeIndicatorTop}px` }}
            >
              <div className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
