'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './types';
import { eventColors } from './types';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
  differenceInMinutes,
} from 'date-fns';
import { ro } from 'date-fns/locale';

// ====================================================================
// WeekView - 5-day week calendar with time grid
// ====================================================================

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date, hour: number) => void;
  className?: string;
}

// Working hours configuration
const HOUR_START = 7;
const HOUR_END = 19;
const HOUR_HEIGHT = 60; // pixels per hour

export function WeekView({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  className,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  // Only Monday to Friday
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  // Current time indicator
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Separate all-day events from timed events
  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEvents = events.filter((e) => !e.isAllDay);

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return timedEvents.filter((event) => isSameDay(event.startTime, day));
  };

  // Get all-day events for a specific day
  const getAllDayEventsForDay = (day: Date): CalendarEvent[] => {
    return allDayEvents.filter((event) => isSameDay(event.startTime, day));
  };

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
      height: `${Math.max(height, 24)}px`, // Minimum height for visibility
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
  const showTimeIndicator = weekDays.some((day) => isToday(day)) && timeIndicatorTop >= 0;
  const todayIndex = weekDays.findIndex((day) => isToday(day));

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      {/* Day Headers */}
      <div className="grid flex-shrink-0 grid-cols-[60px_repeat(5,1fr)] border-b border-linear-border-subtle bg-linear-bg-secondary">
        <div className="border-r border-linear-border-subtle" />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="border-l border-linear-border-subtle px-2 py-3 text-center"
          >
            <div className="text-[11px] uppercase tracking-wide text-linear-text-muted">
              {format(day, 'EEE', { locale: ro })}
            </div>
            <div
              className={cn(
                'mt-1 inline-flex h-9 w-9 items-center justify-center text-xl font-medium',
                isToday(day)
                  ? 'rounded-full bg-linear-accent text-white'
                  : 'text-linear-text-primary'
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All Day Events Row */}
      {allDayEvents.length > 0 && (
        <div className="grid flex-shrink-0 grid-cols-[60px_repeat(5,1fr)] border-b border-linear-border-subtle bg-linear-bg-secondary">
          <div className="border-r border-linear-border-subtle p-2 text-right text-[10px] text-linear-text-muted">
            Toată
            <br />
            ziua
          </div>
          {weekDays.map((day) => {
            const dayEvents = getAllDayEventsForDay(day);
            return (
              <div key={day.toISOString()} className="border-l border-linear-border-subtle p-1">
                {dayEvents.map((event) => {
                  const colors = eventColors[event.type];
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      className={cn(
                        'mb-0.5 w-full truncate rounded px-2 py-1 text-left text-[11px] font-medium',
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
            );
          })}
        </div>
      )}

      {/* Time Grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Time Column */}
        <div className="w-[60px] flex-shrink-0 border-r border-linear-border-subtle">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[60px] pr-2 pt-1 text-right text-[11px] text-linear-text-muted"
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="relative flex flex-1">
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative flex-1 border-l border-linear-border-subtle',
                  dayIndex === 0 && 'border-l-0'
                )}
              >
                {/* Hour Lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-linear-border-subtle"
                    onClick={() => onTimeSlotClick?.(day, hour)}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick?.(event)}
                    className={cn(
                      'absolute left-1 right-1 overflow-hidden rounded border-l-[3px] px-2 py-1',
                      'transition-all duration-100 hover:scale-[1.02] hover:shadow-lg hover:z-10',
                      'text-left'
                    )}
                    style={getEventStyle(event)}
                  >
                    <div className="truncate text-[11px] font-medium" style={{ color: 'inherit' }}>
                      {event.title}
                    </div>
                    <div className="truncate text-[10px] opacity-80">
                      {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                    </div>
                    {event.location && (
                      <div className="truncate text-[10px] opacity-70">{event.location}</div>
                    )}
                  </button>
                ))}

                {/* Current Time Indicator - only show on today's column */}
                {showTimeIndicator && dayIndex === todayIndex && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 h-0.5 bg-red-500"
                    style={{ top: `${timeIndicatorTop}px` }}
                  >
                    <div className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
