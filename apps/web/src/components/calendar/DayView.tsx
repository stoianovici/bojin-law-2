'use client';

import * as React from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import { TimeGrid } from './TimeGrid';
import { DayColumn, CalendarEvent, CalendarTask } from './DayColumn';
import { AllDayRow, AllDayEvent, AllDayTask } from './AllDayRow';
import { EventDetailsPanel } from './EventDetailsPanel';

export interface DayViewProps {
  events: CalendarEvent[];
  tasks: CalendarTask[];
  allDayEvents: Record<string, AllDayEvent[]>;
  allDayTasks: Record<string, AllDayTask[]>;
  onEventClick?: (eventId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskDrop?: (taskId: string, date: Date) => void;
  onTaskDragStart?: (e: React.DragEvent, taskId: string) => void;
  onTaskDragEnd?: (e: React.DragEvent) => void;
  onTaskAddNote?: (taskId: string, note: string) => void;
  onTaskLogTime?: (taskId: string, duration: string, description: string) => void;
  onTaskComplete?: (taskId: string, note?: string) => void;
  onSlotClick?: (
    date: Date,
    hour: number,
    minute: number,
    position: { x: number; y: number }
  ) => void;
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
 * - Right panel: Event details panel (shows selected event)
 * - Follows the split-view pattern from Cases page
 */
export function DayView({
  events,
  tasks,
  allDayEvents,
  allDayTasks,
  onEventClick,
  onTaskClick,
  onTaskDrop,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskAddNote,
  onTaskLogTime,
  onTaskComplete,
  onSlotClick,
}: DayViewProps) {
  const { currentDate, selectedEventId, selectEvent } = useCalendarStore();

  // Check if the current date is today
  const isToday = isSameDay(currentDate, new Date());

  // Find the selected event from the events list
  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  // Handle event click - call both the prop callback and store action
  const handleEventClick = React.useCallback(
    (eventId: string) => {
      onEventClick?.(eventId);
      selectEvent(eventId);
    },
    [onEventClick, selectEvent]
  );

  // Handle closing the details panel
  const handleClosePanel = React.useCallback(() => {
    selectEvent(null);
  }, [selectEvent]);

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
          onTaskDragStart={onTaskDragStart}
          onTaskDragEnd={onTaskDragEnd}
        />

        {/* Time grid + day column */}
        <div className="flex flex-1 overflow-y-auto">
          <TimeGrid startHour={8} endHour={18} showCurrentTime={isToday} />
          <div className="flex-1">
            <DayColumn
              date={currentDate}
              events={events}
              tasks={tasks}
              isToday={isToday}
              onEventClick={handleEventClick}
              onTaskClick={onTaskClick}
              onTaskDrop={onTaskDrop}
              onTaskAddNote={onTaskAddNote}
              onTaskLogTime={onTaskLogTime}
              onTaskComplete={onTaskComplete}
              onSlotClick={onSlotClick}
            />
          </div>
        </div>
      </div>

      {/* Right: Event details panel */}
      <EventDetailsPanel event={selectedEvent} onClose={handleClosePanel} />
    </div>
  );
}
