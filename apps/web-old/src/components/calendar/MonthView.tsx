'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './types';
import { eventColors } from './types';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

// ====================================================================
// MonthView - Calendar grid with event dots
// ====================================================================

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

export function MonthView({
  currentDate,
  events,
  onDateClick,
  onEventClick,
  className,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build array of weeks, each containing 7 days
  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  // Get events for a specific day (max 3 for display)
  const getEventsForDay = (date: Date): CalendarEvent[] => {
    return events.filter((event) => isSameDay(event.startTime, date)).slice(0, 3);
  };

  // Count total events for a day (for "+X more" indicator)
  const getEventCount = (date: Date): number => {
    return events.filter((event) => isSameDay(event.startTime, date)).length;
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Day Headers */}
      <div className="grid flex-shrink-0 grid-cols-7 border-b border-linear-border-subtle bg-linear-bg-secondary">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={cn(
              'py-3 text-center text-[11px] font-medium uppercase tracking-wide',
              i >= 5 ? 'text-linear-text-muted' : 'text-linear-text-secondary'
            )}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {weeks.map((week) =>
          week.map((date, dayIndex) => {
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isCurrentDay = isToday(date);
            const isWeekend = dayIndex >= 5;
            const dayEvents = getEventsForDay(date);
            const totalEvents = getEventCount(date);
            const hasMoreEvents = totalEvents > 3;

            return (
              <div
                key={date.toISOString()}
                className={cn(
                  'relative flex flex-col border-b border-r border-linear-border-subtle p-1.5',
                  !isCurrentMonth && 'bg-linear-bg-primary/50',
                  isWeekend && isCurrentMonth && 'bg-linear-bg-secondary/30',
                  'hover:bg-linear-bg-hover/30 cursor-pointer transition-colors'
                )}
                onClick={() => onDateClick?.(date)}
              >
                {/* Date Number */}
                <div className="mb-1 flex items-start justify-between">
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center text-sm',
                      isCurrentDay && 'rounded-full bg-linear-accent font-semibold text-white',
                      !isCurrentDay && isCurrentMonth && 'text-linear-text-primary',
                      !isCurrentDay && !isCurrentMonth && 'text-linear-text-muted'
                    )}
                  >
                    {format(date, 'd')}
                  </span>
                </div>

                {/* Events List */}
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayEvents.map((event) => {
                    const colors = eventColors[event.type];
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        className={cn(
                          'truncate rounded px-1.5 py-0.5 text-left text-[11px]',
                          'transition-transform hover:scale-[1.02]'
                        )}
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                        }}
                      >
                        {event.isAllDay ? (
                          event.title
                        ) : (
                          <>
                            <span className="font-medium">{format(event.startTime, 'HH:mm')}</span>{' '}
                            {event.title}
                          </>
                        )}
                      </button>
                    );
                  })}

                  {/* More events indicator */}
                  {hasMoreEvents && (
                    <span className="px-1.5 text-[10px] text-linear-text-muted">
                      +{totalEvents - 3} mai mult
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
