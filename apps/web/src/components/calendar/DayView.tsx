'use client';

import * as React from 'react';
import { TimeGrid } from './TimeGrid';
import { DayColumn, CalendarEvent, CalendarTask } from './DayColumn';
import { AllDayRow, AllDayEvent, AllDayTask } from './AllDayRow';
import { AgendaSummaryPanel } from './AgendaSummaryPanel';

export interface DayViewProps {
  /** The date to display - passed from parent to ensure sync with task data */
  currentDate: Date;
  events: CalendarEvent[];
  tasks: CalendarTask[];
  allDayEvents: Record<string, AllDayEvent[]>;
  allDayTasks: Record<string, AllDayTask[]>;
  onEventClick?: (eventId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskAddNote?: (taskId: string, note: string) => void;
  onTaskLogTime?: (taskId: string, duration: string, description: string) => void;
  onTaskComplete?: (taskId: string, options?: { timeJustLogged?: boolean }) => void;
  onTaskEdit?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onEventEdit?: (eventId: string) => void;
  onEventDelete?: (eventId: string) => void;
  onSlotClick?: (
    date: Date,
    hour: number,
    minute: number,
    position: { x: number; y: number },
    slotRect: DOMRect
  ) => void;
  /** Unified calendar: Render tasks in time grid instead of bottom panel */
  unifiedCalendarMode?: boolean;
  /** Callback when quick add event button is clicked */
  onAddEvent?: () => void;
  /** Callback when quick add task button is clicked */
  onAddTask?: () => void;
}

/**
 * Checks if two dates are the same day (year, month, and day match)
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * DayView - Single day calendar view with split-view pattern
 *
 * Features:
 * - Left panel: Day schedule with all-day row and time grid
 * - Right panel: Agenda summary panel with stats, upcoming items, and quick actions
 * - Follows the split-view pattern from Cases page
 */
export function DayView({
  currentDate,
  events,
  tasks,
  allDayEvents,
  allDayTasks,
  onEventClick,
  onTaskClick,
  onTaskAddNote,
  onTaskLogTime,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  onEventEdit,
  onEventDelete,
  onSlotClick,
  unifiedCalendarMode = true,
  onAddEvent,
  onAddTask,
}: DayViewProps) {
  // Check if the current date is today
  const isToday = isSameDay(currentDate, new Date());

  // Handle event click
  const handleEventClick = React.useCallback(
    (eventId: string) => {
      onEventClick?.(eventId);
    },
    [onEventClick]
  );

  // Handle item click from agenda panel
  const handleAgendaItemClick = React.useCallback(
    (type: 'event' | 'task', id: string) => {
      if (type === 'event') {
        onEventClick?.(id);
      } else {
        onTaskClick?.(id);
      }
    },
    [onEventClick, onTaskClick]
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Day schedule */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* All-day row for single day */}
        <AllDayRow
          days={[currentDate]}
          allDayEvents={allDayEvents}
          allDayTasks={allDayTasks}
          onEventClick={handleEventClick}
        />

        {/* Time grid + day column */}
        <div className="flex flex-1 overflow-y-auto">
          <TimeGrid startHour={8} endHour={19} showCurrentTime={isToday} />
          <div className="flex-1">
            <DayColumn
              date={currentDate}
              events={events}
              tasks={tasks}
              isToday={isToday}
              startHour={8}
              endHour={19}
              onEventClick={handleEventClick}
              onTaskClick={onTaskClick}
              onTaskAddNote={onTaskAddNote}
              onTaskLogTime={onTaskLogTime}
              onTaskComplete={onTaskComplete}
              onTaskEdit={onTaskEdit}
              onTaskDelete={onTaskDelete}
              onEventEdit={onEventEdit}
              onEventDelete={onEventDelete}
              onSlotClick={onSlotClick}
              unifiedCalendarMode={unifiedCalendarMode}
            />
          </div>
        </div>
      </div>

      {/* Right: Agenda summary panel */}
      <AgendaSummaryPanel
        currentDate={currentDate}
        events={events}
        tasks={tasks}
        onAddEvent={onAddEvent}
        onAddTask={onAddTask}
        onItemClick={handleAgendaItemClick}
      />
    </div>
  );
}
