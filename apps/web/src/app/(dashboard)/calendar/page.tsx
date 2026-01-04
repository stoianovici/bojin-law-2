'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarFilters } from '@/components/calendar/CalendarFilters';
import {
  CalendarWeekHeader,
  getWeekDays,
  isSameDay,
} from '@/components/calendar/CalendarWeekHeader';
import {
  AllDayRow,
  formatDateKey,
  type AllDayEvent,
  type AllDayTask,
} from '@/components/calendar/AllDayRow';
import { TimeGrid } from '@/components/calendar/TimeGrid';
import { DayColumn, type CalendarEvent, type CalendarTask } from '@/components/calendar/DayColumn';
import { DayView } from '@/components/calendar/DayView';
import { MonthView } from '@/components/calendar/MonthView';
import { AgendaView, type AgendaTask } from '@/components/calendar/AgendaView';
import { useCalendarStore } from '@/store/calendarStore';
import { SlotContextMenu } from '@/components/popovers/SlotContextMenu';
import { CreateFormPopover } from '@/components/popovers/CreateFormPopover';
import { TaskForm } from '@/components/forms/TaskForm';
import { EventForm } from '@/components/forms/EventForm';

// ============================================
// MOCK DATA
// ============================================

// Extended event type with assignedTo for filtering
interface ExtendedCalendarEvent extends CalendarEvent {
  assignedTo?: string; // team member id
}

const MOCK_EVENTS: Record<string, ExtendedCalendarEvent[]> = {
  '2025-12-29': [
    {
      id: 'e1',
      title: 'Sedinta Tribunalul Bucuresti',
      startTime: '09:00',
      endTime: '10:30',
      type: 'court',
      location: 'Sala 5, Sectia Civila',
      assignedTo: 'ab',
    },
    {
      id: 'e2',
      title: 'Intalnire client - SC Alpha',
      startTime: '14:00',
      endTime: '15:00',
      type: 'meeting',
      assignedTo: 'mp',
    },
  ],
  '2025-12-30': [
    {
      id: 'e3',
      title: 'Audiere martori - Dosar 1892',
      startTime: '10:00',
      endTime: '12:00',
      type: 'hearing',
      location: 'Judecatoria Sector 1',
      assignedTo: 'ed',
    },
  ],
  '2025-12-31': [
    {
      id: 'e4',
      title: 'Call cu client - Beta SRL',
      startTime: '10:00',
      endTime: '11:00',
      type: 'meeting',
      assignedTo: 'ab',
    },
    {
      id: 'e5',
      title: 'Pronuntare - Dosar 3421',
      startTime: '14:00',
      endTime: '15:30',
      type: 'court',
      location: 'Curtea de Apel',
      assignedTo: 'mp',
    },
  ],
  '2026-01-01': [
    {
      id: 'e6',
      title: 'Termen: raspuns intampinare',
      startTime: '08:00',
      endTime: '08:45',
      type: 'deadline',
      assignedTo: 'ab',
    },
    {
      id: 'e7',
      title: 'Proces verbal executare',
      startTime: '10:00',
      endTime: '12:00',
      type: 'court',
      location: 'Sediu executor',
      assignedTo: 'ai',
    },
    {
      id: 'e8',
      title: 'Sedinta interna echipa',
      startTime: '17:00',
      endTime: '18:00',
      type: 'meeting',
      assignedTo: 'cv',
    },
  ],
  '2026-01-02': [
    {
      id: 'e9',
      title: 'Sedinta mediere',
      startTime: '09:00',
      endTime: '10:30',
      type: 'hearing',
      location: 'Centrul de Mediere',
      assignedTo: 'ed',
    },
  ],
};

// Extended task type with assignedTo for filtering
interface ExtendedCalendarTask extends CalendarTask {
  assignedTo?: string;
}

const MOCK_TASKS_BY_DAY: Record<string, ExtendedCalendarTask[]> = {
  '2025-12-29': [
    {
      id: 't1',
      title: 'Pregatire dosare instanta',
      estimatedDuration: '2h',
      dueDate: '2 Ian',
      variant: 'on-track',
      assignedTo: 'ab',
    },
  ],
  '2025-12-30': [
    {
      id: 't2',
      title: 'Revizuire contract fuziune',
      estimatedDuration: '2h',
      dueDate: 'Astazi',
      variant: 'due-today',
      assignedTo: 'mp',
    },
  ],
  '2025-12-31': [
    {
      id: 't3',
      title: 'Audit documentatie GDPR',
      estimatedDuration: '4h',
      dueDate: '5 Ian',
      variant: 'on-track',
      assignedTo: 'ed',
    },
  ],
  '2026-01-01': [
    {
      id: 't4',
      title: 'Pregatire raspuns intampinare',
      estimatedDuration: '3h',
      dueDate: '29 Dec (intarziat)',
      variant: 'overdue',
      assignedTo: 'ab',
    },
    {
      id: 't5',
      title: 'Intalnire client TechStart',
      estimatedDuration: '1h',
      dueDate: '2 Ian',
      variant: 'on-track',
      assignedTo: 'ai',
    },
  ],
  '2026-01-02': [
    {
      id: 't6',
      title: 'Verificare acte societare',
      estimatedDuration: '1h',
      dueDate: '23 Dec (blocat)',
      variant: 'locked',
      assignedTo: 'cv',
    },
    {
      id: 't7',
      title: 'Actualizare template-uri',
      estimatedDuration: '1.5h',
      dueDate: '10 Ian',
      variant: 'on-track',
      assignedTo: 'mp',
    },
  ],
};

// Extended all-day event type with assignedTo for filtering
interface ExtendedAllDayEvent extends AllDayEvent {
  assignedTo?: string;
}

const MOCK_ALL_DAY_EVENTS: Record<string, ExtendedAllDayEvent[]> = {
  '2025-12-30': [
    {
      id: 'ad1',
      title: 'Termen depunere contestatie',
      type: 'deadline',
      assignedTo: 'ab',
    },
  ],
  '2026-01-02': [
    {
      id: 'ad2',
      title: 'Termen final dosar 2847',
      type: 'court',
      assignedTo: 'mp',
    },
  ],
};

// Extended all-day task type with assignedTo for filtering
interface ExtendedAllDayTask extends AllDayTask {
  assignedTo?: string;
}

const MOCK_ALL_DAY_TASKS: Record<string, ExtendedAllDayTask[]> = {
  '2025-12-29': [
    {
      id: 'adt1',
      title: 'Analiza contract',
      duration: '4h',
      assignedTo: 'ed',
    },
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get Monday of the week containing the given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const MONTH_NAMES = [
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

const SHORT_MONTH_NAMES = [
  'Ian',
  'Feb',
  'Mar',
  'Apr',
  'Mai',
  'Iun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Format date range for display based on view type
 */
function formatDateRangeForView(
  view: 'day' | 'week' | 'month' | 'agenda',
  currentDate: Date,
  weekStart: Date,
  agendaDays: number
): string {
  if (view === 'day') {
    // "2 Ianuarie 2026"
    const day = currentDate.getDate();
    const month = MONTH_NAMES[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    return `${day} ${month} ${year}`;
  }

  if (view === 'week') {
    // "30 Dec - 3 Ian 2026"
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // Friday

    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();

    const startMonth = SHORT_MONTH_NAMES[weekStart.getMonth()];
    const endMonth = SHORT_MONTH_NAMES[weekEnd.getMonth()];
    const endYear = weekEnd.getFullYear();

    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${startDay} - ${endDay} ${endMonth} ${endYear}`;
    }

    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
  }

  if (view === 'month') {
    // "Ianuarie 2026"
    const month = MONTH_NAMES[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    return `${month} ${year}`;
  }

  // agenda
  return `Următoarele ${agendaDays} zile`;
}

// ============================================
// VIEW SWITCHER COMPONENT
// ============================================

interface ViewSwitcherProps {
  activeView: string;
  onViewChange: (view: 'day' | 'week' | 'month' | 'agenda') => void;
}

function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  const views = [
    { id: 'day', label: 'Zi' },
    { id: 'week', label: 'Saptamana' },
    { id: 'month', label: 'Luna' },
    { id: 'agenda', label: 'Agenda' },
  ] as const;

  return (
    <div className="flex bg-linear-bg-tertiary rounded-linear-md p-0.5 border border-linear-border-subtle">
      {views.map((view) => (
        <button
          key={view.id}
          className={cn(
            'px-3 py-2 text-sm rounded-linear-sm transition-all duration-150',
            activeView === view.id
              ? 'bg-linear-bg-elevated text-linear-text-primary shadow-linear-sm'
              : 'text-linear-text-secondary hover:text-linear-text-primary'
          )}
          onClick={() => onViewChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// MAIN CALENDAR PAGE
// ============================================

export default function CalendarPage() {
  const {
    currentDate,
    view,
    selectedCalendars,
    selectedTeamMembers,
    agendaDays,
    setView,
    toggleCalendar,
    toggleTeamMember,
    goToToday,
    navigateWeek,
    navigateDay,
    navigateMonth,
  } = useCalendarStore();

  const today = React.useMemo(() => new Date(), []);
  const weekStart = React.useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Navigation handlers - view-aware
  const handlePrev = React.useCallback(() => {
    if (view === 'day') navigateDay('prev');
    else if (view === 'week') navigateWeek('prev');
    else if (view === 'month') navigateMonth('prev');
    // agenda doesn't navigate
  }, [view, navigateDay, navigateWeek, navigateMonth]);

  const handleNext = React.useCallback(() => {
    if (view === 'day') navigateDay('next');
    else if (view === 'week') navigateWeek('next');
    else if (view === 'month') navigateMonth('next');
    // agenda doesn't navigate
  }, [view, navigateDay, navigateWeek, navigateMonth]);

  const handleNewEvent = React.useCallback(() => {
    // TODO: Implement new event modal
    console.log('Create new event');
  }, []);

  const handleTaskDrop = React.useCallback((taskId: string, date: Date) => {
    // TODO: Implement task drag-and-drop persistence
    console.log('Task dropped:', taskId, 'on', formatDateKey(date));
  }, []);

  const handleTaskClick = React.useCallback((taskId: string) => {
    // TODO: Implement task detail view
    console.log('Task clicked:', taskId);
  }, []);

  const handleEventClick = React.useCallback((eventId: string) => {
    // TODO: Implement event detail view
    console.log('Event clicked:', eventId);
  }, []);

  // Task action handlers
  const handleTaskAddNote = React.useCallback((taskId: string, note: string) => {
    console.log('Add note to task:', taskId, note);
    // TODO: Integrate with API/store to save note
  }, []);

  const handleTaskLogTime = React.useCallback(
    (taskId: string, duration: string, description: string) => {
      console.log('Log time for task:', taskId, duration, description);
      // TODO: Integrate with API/store to save time entry
    },
    []
  );

  const handleTaskComplete = React.useCallback((taskId: string, note?: string) => {
    console.log('Complete task:', taskId, note);
    // TODO: Integrate with API/store to update status
  }, []);

  // ============================================
  // SLOT CLICK & FORM POPOVER STATE
  // ============================================

  const [slotMenuOpen, setSlotMenuOpen] = React.useState(false);
  const [formPopoverOpen, setFormPopoverOpen] = React.useState(false);
  const [popoverPosition, setPopoverPosition] = React.useState({ x: 0, y: 0 });
  const [formType, setFormType] = React.useState<'task' | 'event'>('task');
  const [defaultDateTime, setDefaultDateTime] = React.useState<{
    date: string;
    time: string;
  } | null>(null);

  // Handle slot click - opens context menu
  const handleSlotClick = React.useCallback(
    (date: Date, hour: number, minute: number, position: { x: number; y: number }) => {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];
      // Format time as HH:MM
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      setDefaultDateTime({ date: dateStr, time: timeStr });
      setPopoverPosition(position);
      setSlotMenuOpen(true);
    },
    []
  );

  // Handle task selection from context menu
  const handleSelectTask = React.useCallback(() => {
    setSlotMenuOpen(false);
    setFormType('task');
    setFormPopoverOpen(true);
  }, []);

  // Handle event selection from context menu
  const handleSelectEvent = React.useCallback(() => {
    setSlotMenuOpen(false);
    setFormType('event');
    setFormPopoverOpen(true);
  }, []);

  // Handle form success - close popover
  const handleFormSuccess = React.useCallback(() => {
    setFormPopoverOpen(false);
    setDefaultDateTime(null);
  }, []);

  // Handle form cancel
  const handleFormCancel = React.useCallback(() => {
    setFormPopoverOpen(false);
    setDefaultDateTime(null);
  }, []);

  // Global keyboard listener for T and E keys
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Only handle when no modifiers are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        // Use center of viewport for keyboard-triggered form
        setPopoverPosition({
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 4,
        });
        // Default to today's date
        const now = new Date();
        setDefaultDateTime({
          date: now.toISOString().split('T')[0],
          time: `${now.getHours().toString().padStart(2, '0')}:00`,
        });
        setFormType('task');
        setFormPopoverOpen(true);
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setPopoverPosition({
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 4,
        });
        const now = new Date();
        setDefaultDateTime({
          date: now.toISOString().split('T')[0],
          time: `${now.getHours().toString().padStart(2, '0')}:00`,
        });
        setFormType('event');
        setFormPopoverOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter events based on selected calendars and team members
  const filterEvents = React.useCallback(
    (events: ExtendedCalendarEvent[]): CalendarEvent[] => {
      return events.filter((event) => {
        // Filter by calendar type (event type)
        const typeMatch = selectedCalendars.includes(event.type);
        // Filter by team member (if assigned)
        const teamMatch = !event.assignedTo || selectedTeamMembers.includes(event.assignedTo);
        return typeMatch && teamMatch;
      });
    },
    [selectedCalendars, selectedTeamMembers]
  );

  // Filter tasks based on selected calendars and team members
  const filterTasks = React.useCallback(
    (tasks: ExtendedCalendarTask[]): CalendarTask[] => {
      return tasks.filter((task) => {
        // Tasks are shown if "task" calendar is selected
        const typeMatch = selectedCalendars.includes('task');
        // Filter by team member (if assigned)
        const teamMatch = !task.assignedTo || selectedTeamMembers.includes(task.assignedTo);
        return typeMatch && teamMatch;
      });
    },
    [selectedCalendars, selectedTeamMembers]
  );

  // Create filtered all-day events
  const filteredAllDayEvents = React.useMemo(() => {
    const filtered: Record<string, AllDayEvent[]> = {};
    for (const [dateKey, events] of Object.entries(MOCK_ALL_DAY_EVENTS)) {
      const filteredEvents = events.filter((event) => {
        const typeMatch = selectedCalendars.includes(event.type);
        const teamMatch = !event.assignedTo || selectedTeamMembers.includes(event.assignedTo);
        return typeMatch && teamMatch;
      });
      if (filteredEvents.length > 0) {
        filtered[dateKey] = filteredEvents;
      }
    }
    return filtered;
  }, [selectedCalendars, selectedTeamMembers]);

  // Create filtered all-day tasks
  const filteredAllDayTasks = React.useMemo(() => {
    const filtered: Record<string, AllDayTask[]> = {};
    const showTasks = selectedCalendars.includes('task');
    if (!showTasks) return filtered;

    for (const [dateKey, tasks] of Object.entries(MOCK_ALL_DAY_TASKS)) {
      const filteredTasks = tasks.filter((task) => {
        const teamMatch = !task.assignedTo || selectedTeamMembers.includes(task.assignedTo);
        return teamMatch;
      });
      if (filteredTasks.length > 0) {
        filtered[dateKey] = filteredTasks;
      }
    }
    return filtered;
  }, [selectedCalendars, selectedTeamMembers]);

  // Prepare data for day view (current day only)
  const dayViewData = React.useMemo(() => {
    const dateKey = formatDateKey(currentDate);
    const rawEvents = MOCK_EVENTS[dateKey] || [];
    const rawTasks = MOCK_TASKS_BY_DAY[dateKey] || [];
    return {
      events: filterEvents(rawEvents),
      tasks: filterTasks(rawTasks),
    };
  }, [currentDate, filterEvents, filterTasks]);

  // Prepare data for month view (events/tasks by date for the month)
  const monthViewData = React.useMemo(() => {
    const eventsByDate: Record<string, Array<{ id: string; title: string; type: string }>> = {};
    const tasksByDate: Record<string, Array<{ id: string; title: string }>> = {};

    for (const [dateKey, rawEvents] of Object.entries(MOCK_EVENTS)) {
      const filtered = filterEvents(rawEvents);
      if (filtered.length > 0) {
        eventsByDate[dateKey] = filtered.map((e) => ({ id: e.id, title: e.title, type: e.type }));
      }
    }

    for (const [dateKey, rawTasks] of Object.entries(MOCK_TASKS_BY_DAY)) {
      const filtered = filterTasks(rawTasks);
      if (filtered.length > 0) {
        tasksByDate[dateKey] = filtered.map((t) => ({ id: t.id, title: t.title }));
      }
    }

    return { eventsByDate, tasksByDate };
  }, [filterEvents, filterTasks]);

  // Prepare data for agenda view
  const agendaViewData = React.useMemo(() => {
    // Flatten all events and tasks
    const allEvents: CalendarEvent[] = [];
    const allTasks: AgendaTask[] = [];

    for (const [dateKey, rawEvents] of Object.entries(MOCK_EVENTS)) {
      const filtered = filterEvents(rawEvents);
      allEvents.push(...filtered);
    }

    for (const [dateKey, rawTasks] of Object.entries(MOCK_TASKS_BY_DAY)) {
      const filtered = filterTasks(rawTasks);
      allTasks.push(
        ...filtered.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: dateKey,
        }))
      );
    }

    return { events: allEvents, tasks: allTasks };
  }, [filterEvents, filterTasks]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar - Filters */}
      <aside className="w-60 shrink-0 border-r border-linear-border-subtle bg-linear-bg-secondary overflow-y-auto">
        <CalendarFilters
          selectedCalendars={selectedCalendars}
          selectedTeamMembers={selectedTeamMembers}
          onCalendarToggle={toggleCalendar}
          onTeamToggle={toggleTeamMember}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-12 shrink-0 border-b border-linear-border-subtle bg-linear-bg-secondary flex items-center justify-between px-4">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-normal text-linear-text-primary">Calendar</h1>
            <span className="text-sm text-linear-text-secondary">
              {formatDateRangeForView(view, currentDate, weekStart, agendaDays)}
            </span>
            <ViewSwitcher activeView={view} onViewChange={setView} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-2 text-sm text-linear-text-secondary bg-linear-bg-tertiary border border-linear-border-subtle rounded-linear-md hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
              onClick={goToToday}
            >
              Astazi
            </button>

            {/* Navigation arrows - hidden for agenda view */}
            {view !== 'agenda' && (
              <div className="flex gap-1">
                <button
                  className="w-8 h-8 flex items-center justify-center border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary rounded-linear-md hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
                  onClick={handlePrev}
                  aria-label={
                    view === 'day'
                      ? 'Previous day'
                      : view === 'week'
                        ? 'Previous week'
                        : 'Previous month'
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="w-8 h-8 flex items-center justify-center border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary rounded-linear-md hover:bg-linear-bg-hover hover:text-linear-text-primary transition-colors"
                  onClick={handleNext}
                  aria-label={
                    view === 'day' ? 'Next day' : view === 'week' ? 'Next week' : 'Next month'
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              className="px-4 py-2 text-sm font-light text-white bg-linear-accent rounded-linear-md hover:bg-linear-accent-hover transition-colors flex items-center gap-2 shadow-linear-glow"
              onClick={handleNewEvent}
            >
              <Plus className="w-4 h-4" />
              Eveniment Nou
            </button>
          </div>
        </header>

        {/* Calendar Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Day View */}
          {view === 'day' && (
            <DayView
              events={dayViewData.events}
              tasks={dayViewData.tasks}
              allDayEvents={filteredAllDayEvents}
              allDayTasks={filteredAllDayTasks}
              onEventClick={handleEventClick}
              onTaskClick={handleTaskClick}
              onTaskDrop={handleTaskDrop}
              onTaskAddNote={handleTaskAddNote}
              onTaskLogTime={handleTaskLogTime}
              onTaskComplete={handleTaskComplete}
              onSlotClick={handleSlotClick}
            />
          )}

          {/* Week View */}
          {view === 'week' && (
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Week Header */}
              <CalendarWeekHeader weekStart={weekStart} today={today} />

              {/* All Day Row */}
              <AllDayRow
                days={weekDays}
                allDayEvents={filteredAllDayEvents}
                allDayTasks={filteredAllDayTasks}
                onEventClick={handleEventClick}
              />

              {/* Week Grid */}
              <div className="flex-1 overflow-y-auto w-full">
                <div
                  className="grid min-h-full w-full"
                  style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 1fr' }}
                >
                  {/* Time Column */}
                  <TimeGrid startHour={8} endHour={18} showCurrentTime />

                  {/* Day Columns */}
                  {weekDays.map((day) => {
                    const dateKey = formatDateKey(day);
                    const isDayToday = isSameDay(day, today);
                    const rawEvents = MOCK_EVENTS[dateKey] || [];
                    const rawTasks = MOCK_TASKS_BY_DAY[dateKey] || [];
                    const events = filterEvents(rawEvents);
                    const tasks = filterTasks(rawTasks);

                    return (
                      <DayColumn
                        key={dateKey}
                        date={day}
                        events={events}
                        tasks={tasks}
                        isToday={isDayToday}
                        startHour={8}
                        endHour={18}
                        onTaskDrop={handleTaskDrop}
                        onTaskClick={handleTaskClick}
                        onEventClick={handleEventClick}
                        onTaskAddNote={handleTaskAddNote}
                        onTaskLogTime={handleTaskLogTime}
                        onTaskComplete={handleTaskComplete}
                        onSlotClick={handleSlotClick}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Month View */}
          {view === 'month' && (
            <MonthView
              eventsByDate={monthViewData.eventsByDate}
              tasksByDate={monthViewData.tasksByDate}
            />
          )}

          {/* Agenda View */}
          {view === 'agenda' && (
            <AgendaView
              events={agendaViewData.events}
              tasks={agendaViewData.tasks}
              onEventClick={handleEventClick}
              onTaskClick={handleTaskClick}
            />
          )}
        </div>
      </main>

      {/* Slot Context Menu */}
      <SlotContextMenu
        open={slotMenuOpen}
        onOpenChange={setSlotMenuOpen}
        position={popoverPosition}
        onSelectTask={handleSelectTask}
        onSelectEvent={handleSelectEvent}
      />

      {/* Create Form Popover */}
      <CreateFormPopover
        open={formPopoverOpen}
        onOpenChange={setFormPopoverOpen}
        position={popoverPosition}
        title={formType === 'task' ? 'New Task' : 'New Event'}
      >
        {formType === 'task' ? (
          <TaskForm
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            defaults={defaultDateTime ? { date: defaultDateTime.date } : undefined}
          />
        ) : (
          <EventForm
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            defaults={
              defaultDateTime
                ? { date: defaultDateTime.date, time: defaultDateTime.time }
                : undefined
            }
          />
        )}
      </CreateFormPopover>
    </div>
  );
}
