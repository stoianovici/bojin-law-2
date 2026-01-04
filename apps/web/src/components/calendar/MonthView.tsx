'use client';

import * as React from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import { MonthDayCell } from './MonthDayCell';

/**
 * Props for the MonthView component
 */
export interface MonthViewProps {
  eventsByDate: Record<string, Array<{ id: string; title: string; type: string }>>;
  tasksByDate: Record<string, Array<{ id: string; title: string }>>;
}

/**
 * Represents a single day in the calendar grid
 */
interface CalendarDay {
  date: Date;
  fullDate: string; // YYYY-MM-DD format
  day: number;
  month: 'prev' | 'current' | 'next';
}

/**
 * Formats a Date object to YYYY-MM-DD string format
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates an array of 42 calendar days (6 weeks) for the month view
 * The week starts on Monday (European standard)
 */
function generateCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the day of week for first day (0=Sun, need to adjust for Mon start)
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Monday = 0

  const days: CalendarDay[] = [];

  // Previous month days
  const prevMonthLastDay = new Date(year, month, 0);
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay.getDate() - i;
    const date = new Date(year, month - 1, day);
    days.push({
      date,
      fullDate: formatDateKey(date),
      day,
      month: 'prev',
    });
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      fullDate: formatDateKey(date),
      day,
      month: 'current',
    });
  }

  // Next month days (fill to 42 total)
  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      fullDate: formatDateKey(date),
      day,
      month: 'next',
    });
  }

  return days;
}

/**
 * Checks if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Weekday labels in Romanian (Monday-start week)
 */
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

/**
 * MonthView - Calendar month view component displaying a 6-week grid
 *
 * Features:
 * - 42-day grid (6 weeks) with Monday-start weeks
 * - Shows previous/next month days for context
 * - Highlights today's date
 * - Displays events and tasks via MonthDayCell components
 * - Clicking a day navigates to day view
 *
 * @example
 * ```tsx
 * <MonthView
 *   eventsByDate={{
 *     '2025-01-15': [{ id: '1', title: 'Meeting', type: 'meeting' }],
 *   }}
 *   tasksByDate={{
 *     '2025-01-15': [{ id: '1', title: 'Review docs' }],
 *   }}
 * />
 * ```
 */
export function MonthView({ eventsByDate, tasksByDate }: MonthViewProps) {
  const { currentDate, setCurrentDate, setView } = useCalendarStore();

  // Today's date for highlighting
  const today = React.useMemo(() => new Date(), []);

  // Generate calendar days for the current month
  const calendarDays = React.useMemo(() => {
    return generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate]);

  // Handle day click - navigate to day view
  const handleDayClick = React.useCallback(
    (date: Date) => {
      setCurrentDate(date);
      setView('day');
    },
    [setCurrentDate, setView]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="text-center text-xs text-linear-text-secondary py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {calendarDays.map((calendarDay) => (
          <MonthDayCell
            key={calendarDay.fullDate}
            date={calendarDay.date}
            isCurrentMonth={calendarDay.month === 'current'}
            isToday={isSameDay(calendarDay.date, today)}
            events={eventsByDate[calendarDay.fullDate] || []}
            tasks={tasksByDate[calendarDay.fullDate] || []}
            onClick={() => handleDayClick(calendarDay.date)}
          />
        ))}
      </div>
    </div>
  );
}

MonthView.displayName = 'MonthView';
