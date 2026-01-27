'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CALENDAR_EVENTS } from '@/graphql/queries';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from 'date-fns';
import { ro } from 'date-fns/locale';

// ============================================
// Types
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  case: {
    id: string;
    caseNumber: string;
    title: string;
    referenceNumbers: string[] | null;
  } | null;
}

interface CalendarData {
  tasks: CalendarEvent[];
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

// ============================================
// Hook
// ============================================

export function useCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculate date range for the query (full month view including partial weeks)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data, loading, error, refetch } = useQuery<CalendarData>(GET_CALENDAR_EVENTS, {
    variables: {
      filters: {
        dateRange: {
          start: format(calendarStart, 'yyyy-MM-dd'),
          end: format(calendarEnd, 'yyyy-MM-dd'),
        },
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  // Build calendar days grid
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const events = data?.tasks ?? [];

    return days.map((date): CalendarDay => {
      // Find events for this day (check both dueDate and scheduledDate)
      const dayEvents = events.filter((event) => {
        const eventDate = event.scheduledDate || event.dueDate;
        if (!eventDate) return false;
        return isSameDay(parseISO(eventDate), date);
      });

      return {
        date,
        isCurrentMonth: isSameMonth(date, currentMonth),
        isToday: isToday(date),
        events: dayEvents,
      };
    });
  }, [data?.tasks, currentMonth, calendarStart, calendarEnd]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const day = calendarDays.find((d) => isSameDay(d.date, selectedDate));
    return day?.events ?? [];
  }, [selectedDate, calendarDays]);

  // Navigation
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // Formatted month name
  const monthName = format(currentMonth, 'LLLL yyyy', { locale: ro });

  // Week day headers (Monday first)
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return {
    currentMonth,
    monthName,
    weekDays,
    calendarDays,
    selectedDate,
    setSelectedDate,
    selectedDateEvents,
    loading,
    error,
    refetch,
    goToNextMonth,
    goToPreviousMonth,
    goToToday,
  };
}
