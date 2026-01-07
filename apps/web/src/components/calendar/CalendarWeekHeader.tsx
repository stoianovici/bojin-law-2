'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CalendarWeekHeaderProps {
  weekStart: Date; // Monday of the week
  today: Date;
}

/**
 * Romanian day name abbreviations (Mon-Fri only)
 */
const ROMANIAN_DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin'] as const;

/**
 * Returns an array of 5 dates (Mon-Fri) starting from the given Monday
 */
function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Checks if two dates represent the same calendar day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * CalendarWeekHeader displays the week header with day names and numbers.
 *
 * Grid layout: 60px spacer + 5 equal columns (Mon-Fri)
 * Highlights today with an accent-colored circle on the day number.
 */
export function CalendarWeekHeader({ weekStart, today }: CalendarWeekHeaderProps) {
  const weekDays = getWeekDays(weekStart);

  return (
    <div
      className="grid shrink-0 border-b border-linear-border-subtle bg-linear-bg-secondary w-full"
      style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 1fr' }}
    >
      {/* Spacer for time column */}
      <div className="border-r border-linear-border-subtle" />

      {/* Day columns */}
      {weekDays.map((day, index) => {
        const isToday = isSameDay(day, today);
        const dayNumber = day.getDate();
        const dayName = ROMANIAN_DAY_NAMES[index];

        return (
          <div
            key={day.toISOString()}
            className={cn(
              'px-2 py-2 text-center border-r border-linear-border-subtle last:border-r-0'
            )}
          >
            {/* Day name */}
            <div
              className={cn(
                'text-[10px] uppercase tracking-[0.5px]',
                isToday ? 'text-linear-accent' : 'text-linear-text-tertiary'
              )}
            >
              {dayName}
            </div>

            {/* Day number */}
            <div
              className={cn(
                'text-base font-normal',
                isToday
                  ? 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-linear-accent text-white'
                  : 'text-linear-text-secondary'
              )}
            >
              {dayNumber}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { getWeekDays, isSameDay };
