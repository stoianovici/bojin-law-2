/**
 * CalendarView Component
 * Displays tasks in a weekly calendar view with color-coded task types
 * Uses React Big Calendar with date-fns localizer for Romanian formatting
 */

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addWeeks, subWeeks } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Task, TaskType } from '@legal-platform/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

/**
 * Task type color mapping
 * Colors specified in Story 1.7
 */
const TASK_TYPE_COLORS: Record<TaskType, string> = {
  Research: '#3B82F6', // Blue
  DocumentCreation: '#10B981', // Green
  DocumentRetrieval: '#8B5CF6', // Purple
  CourtDate: '#EF4444', // Red
  Meeting: '#F59E0B', // Yellow
  BusinessTrip: '#6366F1', // Indigo
};

/**
 * Configure date-fns localizer with Romanian locale
 */
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday
  getDay,
  locales: { ro },
});

/**
 * Calendar event interface extending React Big Calendar Event
 */
interface CalendarEvent extends Event {
  resource: Task;
}

/**
 * CalendarView Props
 */
interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskDrop?: (taskId: string, start: Date, end: Date) => void;
}

/**
 * Custom Event Component
 * Displays task as a colored time block with title and metadata
 */
const CustomEvent: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  const task = event.resource;
  const backgroundColor = TASK_TYPE_COLORS[task.type];

  return (
    <div
      className="flex flex-col h-full px-1 py-0.5 overflow-hidden"
      style={{ backgroundColor, borderRadius: '4px' }}
    >
      <div className="text-white text-xs font-semibold truncate">{task.title}</div>
      <div className="text-white text-[10px] opacity-90 truncate">
        {format(new Date(task.dueDate), 'HH:mm', { locale: ro })}
      </div>
    </div>
  );
};

/**
 * CalendarView Component
 */
export function CalendarView({ tasks, onTaskClick, onTaskDrop }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  /**
   * Convert tasks to calendar events
   */
  const events: CalendarEvent[] = useMemo(() => {
    console.log('[CalendarView] Converting tasks to events, task count:', tasks.length);
    console.log('[CalendarView] Current calendar date:', currentDate);
    const converted = tasks.map((task) => {
      const start = new Date(task.dueDate);
      // Default 1-hour duration if not specified in metadata
      const duration = (task.metadata.duration as number) || 60; // minutes
      const end = new Date(start.getTime() + duration * 60 * 1000);

      console.log(`[CalendarView] Event: ${task.title} | Start: ${start.toISOString()} | End: ${end.toISOString()}`);

      return {
        id: task.id,
        title: task.title,
        start,
        end,
        resource: task,
      };
    });
    console.log('[CalendarView] Converted events:', converted.length, converted);
    return converted;
  }, [tasks, currentDate]);

  /**
   * Handle event click (opens task detail modal)
   */
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onTaskClick(event.resource);
    },
    [onTaskClick]
  );

  /**
   * Handle event drag and drop
   */
  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      if (onTaskDrop) {
        onTaskDrop(event.resource.id, start, end);
      }
    },
    [onTaskDrop]
  );

  /**
   * Event style getter (applies background color based on task type)
   */
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const backgroundColor = TASK_TYPE_COLORS[event.resource.type];
    return {
      style: {
        backgroundColor,
        borderColor: backgroundColor,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        padding: '2px 4px',
      },
    };
  }, []);

  /**
   * Navigate to previous week
   */
  const handlePreviousWeek = useCallback(() => {
    setCurrentDate((prev) => subWeeks(prev, 1));
  }, []);

  /**
   * Navigate to next week
   */
  const handleNextWeek = useCallback(() => {
    setCurrentDate((prev) => addWeeks(prev, 1));
  }, []);

  /**
   * Navigate to today
   */
  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  /**
   * Romanian messages for calendar controls
   */
  const messages = {
    today: 'Astăzi',
    previous: 'Anterior',
    next: 'Următor',
    month: 'Lună',
    week: 'Săptămână',
    day: 'Zi',
    agenda: 'Agendă',
    date: 'Data',
    time: 'Ora',
    event: 'Sarcină',
    noEventsInRange: 'Nu există sarcini în această perioadă.',
    showMore: (total: number) => `+${total} mai multe`,
  };

  /**
   * Romanian day and month names
   */
  const formats = {
    dayHeaderFormat: (date: Date) => format(date, 'EEE d MMM', { locale: ro }),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, 'd MMM', { locale: ro })} - ${format(end, 'd MMM yyyy', { locale: ro })}`,
    timeGutterFormat: (date: Date) => format(date, 'HH:mm', { locale: ro }),
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, 'HH:mm', { locale: ro })} - ${format(end, 'HH:mm', { locale: ro })}`,
  };

  return (
    <div className="calendar-view-container h-full">
      {/* Custom toolbar with navigation */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Astăzi
          </button>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handlePreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Săptămâna anterioară"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Săptămâna următoare"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Current week range display */}
        <div className="text-lg font-semibold text-gray-800">
          {format(
            startOfWeek(currentDate, { weekStartsOn: 1 }),
            'd MMM',
            { locale: ro }
          )}{' '}
          -{' '}
          {format(
            new Date(startOfWeek(currentDate, { weekStartsOn: 1 }).getTime() + 6 * 24 * 60 * 60 * 1000),
            'd MMM yyyy',
            { locale: ro }
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          {(Object.entries(TASK_TYPE_COLORS) as [TaskType, string][]).slice(0, 3).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-gray-600">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* React Big Calendar */}
      <div className="calendar-wrapper h-[calc(100%-4rem)] bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          view="week"
          views={['week']}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          eventPropGetter={eventStyleGetter}
          messages={messages}
          formats={formats}
          culture="ro"
          defaultDate={new Date()}
          step={30}
          timeslots={2}
          min={new Date(2025, 0, 1, 8, 0, 0)} // 8:00 AM
          max={new Date(2025, 0, 1, 20, 0, 0)} // 8:00 PM
          draggableAccessor={() => true}
          resizable
          components={{
            event: CustomEvent,
          }}
          className="h-full"
        />
      </div>

      {/* Custom styles for calendar */}
      <style jsx global>{`
        .rbc-calendar {
          font-family: inherit;
        }

        .rbc-header {
          padding: 12px 8px;
          font-weight: 600;
          text-transform: capitalize;
          border-bottom: 2px solid #e5e7eb;
        }

        .rbc-time-view {
          border: none;
        }

        .rbc-time-header-content {
          border-left: none;
        }

        .rbc-time-content {
          border-top: none;
        }

        .rbc-timeslot-group {
          min-height: 60px;
          border-bottom: 1px solid #f3f4f6;
        }

        .rbc-current-time-indicator {
          background-color: #ef4444;
          height: 2px;
        }

        .rbc-event {
          padding: 4px 6px;
          border-radius: 4px;
          cursor: pointer;
        }

        .rbc-event:hover {
          opacity: 0.9;
        }

        .rbc-event-label {
          display: none;
        }

        .rbc-time-slot {
          border-top: 1px solid #f3f4f6;
        }

        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #f3f4f6;
        }

        /* Responsive styles */
        @media (max-width: 768px) {
          .calendar-wrapper {
            overflow-x: auto;
          }

          .rbc-header {
            font-size: 12px;
            padding: 8px 4px;
          }

          .rbc-time-header-content {
            min-width: 600px;
          }
        }
      `}</style>
    </div>
  );
}

export default CalendarView;
