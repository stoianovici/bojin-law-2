'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Plus, CheckCircle } from 'lucide-react';
import { useMutation } from '@apollo/client/react';
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
import { DragPreview } from '@/components/calendar/DragPreview';
import { useCalendarStore } from '@/store/calendarStore';
import { SlotContextMenu } from '@/components/popovers/SlotContextMenu';
import { CreateFormPopover } from '@/components/popovers/CreateFormPopover';
import { TaskForm } from '@/components/forms/TaskForm';
import { EventForm } from '@/components/forms/EventForm';
import {
  useCalendarEvents,
  scheduleTasksForDay,
  type CalendarEventData,
  type CalendarTaskData,
} from '@/hooks/useCalendarEvents';
import { UPDATE_TASK } from '@/graphql/mutations';
import { GET_CALENDAR_EVENTS } from '@/graphql/queries';

// ============================================
// TYPES
// ============================================

// Extended event type with assignedTo for filtering
interface ExtendedCalendarEvent extends CalendarEvent {
  assignedTo?: string; // team member id
}

// Extended task type with assignedTo for filtering
interface ExtendedCalendarTask extends CalendarTask {
  assignedTo?: string;
}

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
    showCompletedTasks,
    setView,
    toggleCalendar,
    toggleTeamMember,
    goToToday,
    navigateWeek,
    navigateDay,
    navigateMonth,
    setShowCompletedTasks,
  } = useCalendarStore();

  // Unified calendar: Enable unified calendar mode for time grid rendering
  const unifiedCalendarMode = true;

  const today = React.useMemo(() => new Date(), []);
  const weekStart = React.useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Calculate date range for fetching events (current month +/- 1 month)
  const dateRange = React.useMemo(() => {
    const start = new Date(currentDate);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    const end = new Date(currentDate);
    end.setMonth(end.getMonth() + 2);
    end.setDate(0);
    return { startDate: start, endDate: end };
  }, [currentDate]);

  // Fetch real events from the API
  const {
    eventsByDate,
    tasksByDate,
    refetch: refetchEvents,
  } = useCalendarEvents({
    ...dateRange,
    showCompletedTasks,
  });

  // ============================================
  // SLOT CLICK & FORM POPOVER STATE
  // (Declared early so callbacks can use setters)
  // ============================================

  const [slotMenuOpen, setSlotMenuOpen] = React.useState(false);
  const [formPopoverOpen, setFormPopoverOpen] = React.useState(false);
  const [popoverPosition, setPopoverPosition] = React.useState({ x: 0, y: 0 });
  const [formType, setFormType] = React.useState<'task' | 'event'>('task');
  const [defaultDateTime, setDefaultDateTime] = React.useState<{
    date: string;
    time: string;
  } | null>(null);

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
    // Use center of viewport for button-triggered form
    setPopoverPosition({
      x: window.innerWidth / 2 - 200,
      y: window.innerHeight / 4,
    });
    // Default to current date and current hour
    const now = new Date();
    setDefaultDateTime({
      date: formatDateKey(currentDate),
      time: `${now.getHours().toString().padStart(2, '0')}:00`,
    });
    setFormType('event');
    setFormPopoverOpen(true);
  }, [currentDate]);

  const handleNewTask = React.useCallback(() => {
    // Use center of viewport for button-triggered form
    setPopoverPosition({
      x: window.innerWidth / 2 - 200,
      y: window.innerHeight / 4,
    });
    // Default to current date
    setDefaultDateTime({
      date: formatDateKey(currentDate),
      time: `${new Date().getHours().toString().padStart(2, '0')}:00`,
    });
    setFormType('task');
    setFormPopoverOpen(true);
  }, [currentDate]);

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

  const handleTaskComplete = React.useCallback((taskId: string, options?: { timeJustLogged?: boolean }) => {
    console.log('Complete task:', taskId, options);
    // TODO: Integrate with API/store to update status
  }, []);

  // ============================================
  // DRAG AND DROP STATE
  // ============================================

  const HOUR_HEIGHT = 60; // Must match DayColumn
  const START_HOUR = 8;
  const END_HOUR = 19;

  // Ref to track time grid container for position calculations
  const timeGridRef = React.useRef<HTMLDivElement>(null);
  // Ref to track the week grid container for column position calculations
  const weekGridRef = React.useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingTask, setDraggingTask] = React.useState<{
    id: string;
    title: string;
    remainingDuration: number;
    currentDate: string;
    currentStartTime: string | null;
  } | null>(null);

  const [dragPosition, setDragPosition] = React.useState<{ x: number; y: number } | null>(null);

  const [dropTarget, setDropTarget] = React.useState<{
    date: Date;
    hour: number;
    minute: number;
  } | null>(null);

  // Calculate drop zone for each column
  // Since tasks only have deadlines (no scheduled time), we show a simple indicator
  // The visual positioning is auto-calculated, so all drops are valid
  const getDropZoneForColumn = React.useCallback(
    (
      columnDate: Date
    ): { top: number; height: number; isValid: boolean; timeLabel: string } | null => {
      if (!draggingTask || !dropTarget) return null;

      // Only show drop zone for the column being hovered
      const columnDateKey = formatDateKey(columnDate);
      const dropDateKey = formatDateKey(dropTarget.date);
      if (columnDateKey !== dropDateKey) return null;

      const duration = draggingTask.remainingDuration || 1;
      const top =
        (dropTarget.hour - START_HOUR) * HOUR_HEIGHT + (dropTarget.minute / 60) * HOUR_HEIGHT;
      const height = duration * HOUR_HEIGHT;

      // Format date for display instead of time
      const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
      const dayName = dayNames[dropTarget.date.getDay()];
      const dateLabel = `${dayName} ${dropTarget.date.getDate()}`;

      // All drops are valid - auto-scheduling handles positioning
      return { top, height, isValid: true, timeLabel: dateLabel };
    },
    [draggingTask, dropTarget]
  );

  // GraphQL mutation for updating task
  const [updateTaskMutation] = useMutation(UPDATE_TASK, {
    refetchQueries: [{ query: GET_CALENDAR_EVENTS }],
  });

  // Handle subtask completion toggle in calendar view
  const handleSubtaskToggle = React.useCallback(
    async (subtaskId: string) => {
      // Find the subtask in tasksByDate to get current status
      let currentStatus: string | undefined;
      for (const tasks of Object.values(tasksByDate)) {
        for (const task of tasks) {
          if (task.subtasks) {
            const subtask = task.subtasks.find((st: { id: string }) => st.id === subtaskId);
            if (subtask) {
              currentStatus = subtask.status;
              break;
            }
          }
        }
        if (currentStatus) break;
      }

      // Toggle status: Completed <-> InProgress
      const newStatus = currentStatus === 'Completed' ? 'InProgress' : 'Completed';

      try {
        await updateTaskMutation({
          variables: {
            id: subtaskId,
            input: { status: newStatus },
          },
        });
        refetchEvents();
      } catch (error) {
        console.error('Failed to toggle subtask status:', error);
      }
    },
    [tasksByDate, updateTaskMutation, refetchEvents]
  );

  // Handle task drag start
  // Track the task's current due date (deadline) for comparison on drop
  const handleTaskDragStart = React.useCallback(
    (task: CalendarTask, position: { x: number; y: number }) => {
      console.log('[Calendar] Drag started for task:', task.title, 'at position:', position);
      setDraggingTask({
        id: task.id,
        title: task.title,
        remainingDuration: task.remainingDuration || 1,
        // Use dueDateRaw (the actual date key) as the current date
        currentDate: task.dueDateRaw || formatDateKey(new Date()),
        currentStartTime: task.scheduledStartTime || null,
      });
      setDragPosition(position);

      // Disable text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    },
    []
  );

  // Handle task drag movement - detect which column from position
  const handleTaskDrag = React.useCallback((_date: Date, position: { x: number; y: number }) => {
    console.log('[Calendar] handleTaskDrag called with position:', position);
    setDragPosition(position);

    // Find which column the mouse is over based on X position
    const columnElements = document.querySelectorAll('[data-column-date]');
    let targetDate: Date | null = null;
    console.log('[Calendar] Found', columnElements.length, 'column elements');

    for (const col of columnElements) {
      const rect = col.getBoundingClientRect();
      if (position.x >= rect.left && position.x <= rect.right) {
        const dateAttr = col.getAttribute('data-column-date');
        console.log(
          '[Calendar] Position',
          position.x,
          'is within column',
          dateAttr,
          '(',
          rect.left,
          '-',
          rect.right,
          ')'
        );
        if (dateAttr) {
          // Parse as local date (not UTC)
          const [year, month, day] = dateAttr.split('-').map(Number);
          targetDate = new Date(year, month - 1, day);
          break;
        }
      }
    }

    // Calculate time from Y position
    if (targetDate && timeGridRef.current) {
      const rect = timeGridRef.current.getBoundingClientRect();
      const relativeY = position.y - rect.top;
      const totalMinutes = (relativeY / HOUR_HEIGHT) * 60;
      const hour = Math.floor(totalMinutes / 60) + START_HOUR;
      // Snap to 15-minute intervals
      const minute = Math.floor((totalMinutes % 60) / 15) * 15;

      // Clamp hour within bounds
      const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR - 1, hour));

      setDropTarget({
        date: targetDate,
        hour: clampedHour,
        minute: minute >= 0 ? minute : 0,
      });
    }
  }, []);

  // Handle task drag end
  // Tasks only have deadline (dueDate) - dragging changes the deadline, not a scheduled time
  // Visual positioning is auto-calculated based on when tasks fall on each day
  const handleTaskDragEnd = React.useCallback(async () => {
    // Reset body styles
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // If we have a valid drop target, update the task's deadline
    if (draggingTask && dropTarget) {
      const newDueDate = formatDateKey(dropTarget.date);
      const currentDate = draggingTask.currentDate;

      // Only update if the date actually changed
      if (newDueDate !== currentDate) {
        try {
          await updateTaskMutation({
            variables: {
              id: draggingTask.id,
              input: {
                dueDate: newDueDate,
              },
            },
          });
          refetchEvents();
        } catch (error) {
          console.error('Failed to update task deadline:', error);
        }
      }
    }

    // Clear drag state
    setDraggingTask(null);
    setDragPosition(null);
    setDropTarget(null);
  }, [draggingTask, dropTarget, updateTaskMutation, refetchEvents]);

  // Note: Column detection during drag is now handled in handleTaskDrag
  // using position from framer-motion's onDrag callback

  // Handle slot click - opens context menu
  const handleSlotClick = React.useCallback(
    (date: Date, hour: number, minute: number, position: { x: number; y: number }) => {
      // Format date as YYYY-MM-DD using local timezone (same as formatDateKey)
      const dateStr = formatDateKey(date);
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

  // Handle form success - close popover and refetch events
  const handleFormSuccess = React.useCallback(() => {
    setFormPopoverOpen(false);
    setDefaultDateTime(null);
    refetchEvents();
  }, [refetchEvents]);

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
        // Filter by team member (if assigned) - show all if no team members selected
        const teamMatch =
          selectedTeamMembers.length === 0 ||
          !event.assignedTo ||
          selectedTeamMembers.includes(event.assignedTo);
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
        // Filter by team member (if assigned) - show all if no team members selected
        const teamMatch =
          selectedTeamMembers.length === 0 ||
          !task.assignedTo ||
          selectedTeamMembers.includes(task.assignedTo);
        return typeMatch && teamMatch;
      });
    },
    [selectedCalendars, selectedTeamMembers]
  );

  // Create filtered all-day events (empty for now - all-day events not yet supported from API)
  const filteredAllDayEvents = React.useMemo(() => {
    return {} as Record<string, AllDayEvent[]>;
  }, []);

  // Create filtered all-day tasks (empty for now - all-day tasks not yet supported from API)
  const filteredAllDayTasks = React.useMemo(() => {
    return {} as Record<string, AllDayTask[]>;
  }, []);

  // Prepare data for day view (current day only)
  const dayViewData = React.useMemo(() => {
    const dateKey = formatDateKey(currentDate);
    const rawEvents = (eventsByDate[dateKey] || []) as ExtendedCalendarEvent[];
    const rawTasks = (tasksByDate[dateKey] || []) as ExtendedCalendarTask[];
    const filteredEvents = filterEvents(rawEvents);
    const filteredTasks = filterTasks(rawTasks);
    // Schedule tasks AFTER filtering - tasks start at 9 AM and avoid events
    const scheduledTasks = scheduleTasksForDay(
      [...filteredTasks] as CalendarTaskData[],
      filteredEvents as CalendarEventData[]
    );
    return {
      events: filteredEvents,
      tasks: scheduledTasks,
    };
  }, [currentDate, eventsByDate, tasksByDate, filterEvents, filterTasks]);

  // Prepare data for month view (events/tasks by date for the month)
  const monthViewData = React.useMemo(() => {
    const eventsForMonth: Record<string, Array<{ id: string; title: string; type: string }>> = {};
    const tasksForMonth: Record<string, Array<{ id: string; title: string }>> = {};

    for (const [dateKey, rawEvents] of Object.entries(eventsByDate)) {
      const filtered = filterEvents(rawEvents as ExtendedCalendarEvent[]);
      if (filtered.length > 0) {
        eventsForMonth[dateKey] = filtered.map((e) => ({ id: e.id, title: e.title, type: e.type }));
      }
    }

    for (const [dateKey, rawTasks] of Object.entries(tasksByDate)) {
      const filtered = filterTasks(rawTasks as ExtendedCalendarTask[]);
      if (filtered.length > 0) {
        tasksForMonth[dateKey] = filtered.map((t) => ({ id: t.id, title: t.title }));
      }
    }

    return { eventsByDate: eventsForMonth, tasksByDate: tasksForMonth };
  }, [eventsByDate, tasksByDate, filterEvents, filterTasks]);

  // Prepare data for agenda view
  const agendaViewData = React.useMemo(() => {
    // Flatten all events and tasks
    const allEvents: CalendarEvent[] = [];
    const allTasks: AgendaTask[] = [];

    for (const [_dateKey, rawEvents] of Object.entries(eventsByDate)) {
      const filtered = filterEvents(rawEvents as ExtendedCalendarEvent[]);
      allEvents.push(...filtered);
    }

    for (const [taskDateKey, rawTasks] of Object.entries(tasksByDate)) {
      const filtered = filterTasks(rawTasks as ExtendedCalendarTask[]);
      allTasks.push(
        ...filtered.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: taskDateKey,
        }))
      );
    }

    return { events: allEvents, tasks: allTasks };
  }, [eventsByDate, tasksByDate, filterEvents, filterTasks]);

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

            {/* Show Completed Tasks Toggle */}
            <button
              className={cn(
                'px-3 py-2 text-sm flex items-center gap-2 border border-linear-border-subtle rounded-linear-md transition-colors',
                showCompletedTasks
                  ? 'bg-[rgba(34,197,94,0.1)] text-[#22C55E] border-[#22C55E]/30'
                  : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary'
              )}
              onClick={() => setShowCompletedTasks(!showCompletedTasks)}
              title={
                showCompletedTasks
                  ? 'Ascunde taskurile completate'
                  : 'Afisează taskurile completate'
              }
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden lg:inline">
                {showCompletedTasks ? 'Finalizate' : 'Finalizate'}
              </span>
            </button>

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
              currentDate={currentDate}
              events={dayViewData.events}
              tasks={dayViewData.tasks}
              allDayEvents={filteredAllDayEvents}
              allDayTasks={filteredAllDayTasks}
              onEventClick={handleEventClick}
              onTaskClick={handleTaskClick}
              onTaskAddNote={handleTaskAddNote}
              onTaskLogTime={handleTaskLogTime}
              onTaskComplete={handleTaskComplete}
              onSlotClick={handleSlotClick}
              onAddEvent={handleNewEvent}
              onAddTask={handleNewTask}
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
              <div ref={timeGridRef} className="flex-1 overflow-y-auto w-full">
                <div
                  ref={weekGridRef}
                  className="grid min-h-full w-full"
                  style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr 1fr' }}
                >
                  {/* Time Column */}
                  <TimeGrid startHour={8} endHour={19} showCurrentTime />

                  {/* Day Columns */}
                  {weekDays.map((day) => {
                    const dateKey = formatDateKey(day);
                    const isDayToday = isSameDay(day, today);
                    const rawEvents = (eventsByDate[dateKey] || []) as ExtendedCalendarEvent[];
                    const rawTasks = (tasksByDate[dateKey] || []) as ExtendedCalendarTask[];
                    const events = filterEvents(rawEvents);
                    const filteredTasks = filterTasks(rawTasks);
                    // Schedule tasks AFTER filtering - tasks start at 9 AM and avoid events
                    const tasks = scheduleTasksForDay(
                      [...filteredTasks] as CalendarTaskData[],
                      events as CalendarEventData[]
                    );
                    const dropZone = getDropZoneForColumn(day);

                    return (
                      <DayColumn
                        key={dateKey}
                        date={day}
                        events={events}
                        tasks={tasks}
                        isToday={isDayToday}
                        startHour={8}
                        endHour={19}
                        onTaskClick={handleTaskClick}
                        onEventClick={handleEventClick}
                        onTaskAddNote={handleTaskAddNote}
                        onTaskLogTime={handleTaskLogTime}
                        onTaskComplete={handleTaskComplete}
                        onSubtaskToggle={handleSubtaskToggle}
                        onSlotClick={handleSlotClick}
                        unifiedCalendarMode={unifiedCalendarMode}
                        enableDragDrop={true}
                        draggingTaskId={draggingTask?.id || null}
                        dropZone={dropZone}
                        onTaskDragStart={handleTaskDragStart}
                        onTaskDrag={handleTaskDrag}
                        onTaskDragEnd={handleTaskDragEnd}
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

      {/* Drag Preview */}
      <DragPreview
        isVisible={!!draggingTask}
        title={draggingTask?.title || ''}
        duration={draggingTask?.remainingDuration}
        position={dragPosition}
        isValidDropTarget={true} // All drops valid - auto-scheduling handles positioning
        dropTimePreview={
          dropTarget
            ? (() => {
                const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
                const dayName = dayNames[dropTarget.date.getDay()];
                return `Scadență: ${dayName} ${dropTarget.date.getDate()}`;
              })()
            : undefined
        }
      />

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
