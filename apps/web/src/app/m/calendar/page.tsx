'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalendar, Task } from '@/hooks/mobile';
import { InlineError } from '@/components/mobile';
import { CalendarDaySkeleton } from '@/components/mobile/skeletons';

// Event types and colors
const eventTypeColors = {
  task: '#f59e0b', // orange/warning - Termene
  meeting: '#3b82f6', // blue/accent - Intalniri
  court: '#a855f7', // purple - Instanta
};

// Map task types to event colors
const getEventColor = (type: string) => {
  switch (type) {
    case 'Meeting':
      return '#3b82f6'; // blue - Intalniri
    case 'CourtDate':
      return '#a855f7'; // purple - Instanta
    case 'BusinessTrip':
      return '#3b82f6'; // blue - Deplasare
    default:
      return '#f59e0b'; // orange - Termene (for tasks)
  }
};

// Helper functions
function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Get the current week's date range for the query
const getWeekRange = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

  return {
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0],
  };
};

// Generate calendar days for a month
function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Convert to Monday = 0

  const days: { date: number; month: 'prev' | 'current' | 'next'; fullDate: string }[] = [];

  // Previous month days
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    days.push({
      date: day,
      month: 'prev',
      fullDate: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: i,
      month: 'current',
      fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
    });
  }

  // Next month days to fill the grid (up to 6 rows)
  const totalDays = days.length;
  const rows = Math.ceil(totalDays / 7);
  const targetRows = rows < 6 ? 6 : rows;
  const remaining = targetRows * 7 - days.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: i,
      month: 'next',
      fullDate: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
    });
  }

  return days;
}

const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const romanianMonths = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

export default function MobileCalendarPage() {
  const todayDate = new Date();
  const todayStr = getTodayDate();
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Get date range for current week and fetch calendar data
  const { startDate, endDate } = useMemo(() => getWeekRange(), []);
  const { events, tasks, loading, error, refetch } = useCalendar(startDate, endDate);

  // Track scroll to collapse/expand calendar
  useEffect(() => {
    const handleScroll = () => {
      if (!calendarRef.current) return;
      const rect = calendarRef.current.getBoundingClientRect();
      // Collapse when bottom of calendar grid is above viewport top (scrolled past)
      setIsCollapsed(rect.bottom < 60);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Combine events and tasks for the calendar
  const allItems = useMemo(() => [...events, ...tasks], [events, tasks]);

  const calendarDays = useMemo(
    () => generateCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Get the current week's days (the row containing today)
  const currentWeekDays = useMemo(() => {
    const todayIndex = calendarDays.findIndex((day) => day.fullDate === todayStr);
    if (todayIndex === -1) {
      // Today not in this month view, show first week
      return calendarDays.slice(0, 7);
    }
    // Calculate which row today is in
    const rowIndex = Math.floor(todayIndex / 7);
    const startIndex = rowIndex * 7;
    return calendarDays.slice(startIndex, startIndex + 7);
  }, [calendarDays, todayStr]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    allItems.forEach((item) => {
      const date = item.dueDate?.split('T')[0];
      if (date) {
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(item);
      }
    });
    return grouped;
  }, [allItems]);

  // Set of dates that have events for the calendar dots
  const datesWithEvents = useMemo(() => new Set(Object.keys(itemsByDate)), [itemsByDate]);

  const monthName = `${romanianMonths[viewMonth]} ${viewYear}`;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Get upcoming dates with events (today and tomorrow only)
  const upcomingDates = useMemo(() => {
    const dates = [todayStr, getTomorrowDate()];
    return dates.filter((date) => itemsByDate[date]?.length > 0);
  }, [itemsByDate, todayStr]);

  const formatDayHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const isToday = dateStr === todayStr;
    const isTomorrow = dateStr === getTomorrowDate();

    const dayNum = date.getDate();
    const monthName = romanianMonths[date.getMonth()].toUpperCase();

    if (isToday) return `AZI · ${dayNum} ${monthName}`;
    if (isTomorrow) return `MÂINE · ${dayNum} ${monthName}`;

    const weekdays = ['DUMINICĂ', 'LUNI', 'MARȚI', 'MIERCURI', 'JOI', 'VINERI', 'SÂMBĂTĂ'];
    const dayName = weekdays[date.getDay()];
    return `${dayName} · ${dayNum} ${monthName}`;
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <h1 className="text-[22px] font-medium tracking-[-0.02em]">Calendar</h1>
        <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary">
          <Menu className="w-5 h-5" strokeWidth={2} />
        </button>
      </header>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-6 py-3">
        <span className="text-[16px] font-normal text-mobile-text-primary">{monthName}</span>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
          >
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
          >
            <ChevronRight className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Collapsed Week Header (sticky when scrolled) */}
      {isCollapsed && (
        <div className="sticky top-0 z-20 bg-mobile-bg-primary border-b border-mobile-border-subtle px-6 py-2">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center mb-1">
            {weekdays.map((day, i) => (
              <span
                key={i}
                className="text-[10px] font-normal uppercase tracking-[0.05em] text-mobile-text-tertiary"
              >
                {day}
              </span>
            ))}
          </div>

          {/* Current week only */}
          <div className="grid grid-cols-7 gap-[2px]">
            {currentWeekDays.map((day, i) => {
              const isToday = day.fullDate === todayStr;
              const hasEvents = datesWithEvents.has(day.fullDate);
              const isOtherMonth = day.month !== 'current';

              return (
                <button
                  key={i}
                  className={cn(
                    'aspect-square flex flex-col items-center justify-center rounded-lg relative',
                    'text-[13px] font-normal transition-colors',
                    isOtherMonth && 'text-mobile-text-tertiary opacity-50',
                    !isOtherMonth && !isToday && 'text-mobile-text-secondary',
                    isToday && 'bg-mobile-text-primary text-mobile-bg-primary font-bold',
                    !isToday && 'hover:bg-mobile-bg-hover cursor-pointer'
                  )}
                >
                  {day.date}
                  {hasEvents && (
                    <span
                      className={cn(
                        'absolute bottom-[4px] w-1 h-1 rounded-full',
                        isToday ? 'bg-mobile-bg-primary' : 'bg-mobile-accent'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Grid (full month) */}
      <div ref={calendarRef} className="px-6 mb-6">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-center mb-2">
          {weekdays.map((day, i) => (
            <span
              key={i}
              className="text-[11px] font-normal uppercase tracking-[0.05em] text-mobile-text-tertiary py-2"
            >
              {day}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-[2px]">
          {calendarDays.map((day, i) => {
            const isToday = day.fullDate === todayStr;
            const hasEvents = datesWithEvents.has(day.fullDate);
            const isOtherMonth = day.month !== 'current';

            return (
              <button
                key={i}
                className={cn(
                  'aspect-square flex flex-col items-center justify-center rounded-lg relative',
                  'text-[14px] font-normal transition-colors',
                  isOtherMonth && 'text-mobile-text-tertiary opacity-50',
                  !isOtherMonth && !isToday && 'text-mobile-text-secondary',
                  isToday && 'bg-mobile-text-primary text-mobile-bg-primary font-bold',
                  !isToday && 'hover:bg-mobile-bg-hover cursor-pointer'
                )}
              >
                {day.date}
                {hasEvents && (
                  <span
                    className={cn(
                      'absolute bottom-[6px] w-1 h-1 rounded-full',
                      isToday ? 'bg-mobile-bg-primary' : 'bg-mobile-accent'
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-6 py-3 border-b border-mobile-border-subtle">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px]" style={{ background: eventTypeColors.task }} />
          <span className="text-[12px] text-mobile-text-secondary">Termene</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px]" style={{ background: eventTypeColors.meeting }} />
          <span className="text-[12px] text-mobile-text-secondary">Întâlniri</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px]" style={{ background: eventTypeColors.court }} />
          <span className="text-[12px] text-mobile-text-secondary">Instanță</span>
        </div>
      </div>

      {/* Events List */}
      <div className="px-6 pb-24 min-h-[80vh]">
        {/* Loading state */}
        {loading && (
          <div className="space-y-4 mt-4">
            <CalendarDaySkeleton />
            <CalendarDaySkeleton />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mt-4">
            <InlineError message="Nu s-au putut încărca evenimentele" onRetry={refetch} />
          </div>
        )}

        {/* Events content */}
        {!loading &&
          !error &&
          upcomingDates.map((dateStr) => {
            const isToday = dateStr === todayStr;
            const dateItems = itemsByDate[dateStr] || [];

            return (
              <div key={dateStr}>
                <div
                  className={cn(
                    'text-[11px] font-normal uppercase tracking-[0.1em] mt-4 mb-4',
                    isToday ? 'text-mobile-accent' : 'text-mobile-text-tertiary'
                  )}
                >
                  {formatDayHeader(dateStr)}
                </div>

                {dateItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 py-3 -mx-6 px-6 hover:bg-mobile-bg-elevated transition-colors cursor-pointer"
                  >
                    <span className="w-[50px] text-[13px] font-normal text-mobile-text-secondary flex-shrink-0">
                      {item.dueTime || '--:--'}
                    </span>
                    <span
                      className="w-[3px] rounded-[2px] flex-shrink-0"
                      style={{ background: getEventColor(item.type) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-normal text-mobile-text-primary mb-0.5">
                        {item.title}
                      </p>
                      {item.case && (
                        <p className="text-[13px] text-mobile-text-secondary">{item.case.title}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

        {/* Empty state */}
        {!loading && !error && upcomingDates.length === 0 && (
          <div className="text-center py-8">
            <p className="text-mobile-text-secondary">Nu sunt evenimente programate</p>
          </div>
        )}
      </div>
    </div>
  );
}
