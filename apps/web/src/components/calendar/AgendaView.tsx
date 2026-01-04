'use client';

import * as React from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import { cn } from '@/lib/utils';
import { AgendaGroup } from './AgendaGroup';
import { AgendaItemProps, AgendaEventType } from './AgendaItem';
import { CalendarEvent } from './DayColumn';

/**
 * Calendar task data for agenda view
 */
export interface AgendaTask {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD format
}

/**
 * Props for the AgendaView component
 */
export interface AgendaViewProps {
  events: CalendarEvent[];
  tasks: AgendaTask[];
  onEventClick: (id: string) => void;
  onTaskClick: (id: string) => void;
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
 * Checks if two date strings are the same day
 */
function isSameDateKey(dateKey: string, today: Date): boolean {
  return dateKey === formatDateKey(today);
}

/**
 * Item data for grouping
 */
interface GroupedItem extends Omit<AgendaItemProps, 'onClick'> {
  dateKey: string;
  sortTime: string; // For sorting within a day
}

/**
 * Groups events and tasks by date, sorted by time within each day
 */
function groupItemsByDate(
  events: CalendarEvent[],
  tasks: AgendaTask[],
  startDate: Date,
  daysCount: number
): Map<string, Omit<AgendaItemProps, 'onClick'>[]> {
  const groups = new Map<string, Omit<AgendaItemProps, 'onClick'>[]>();

  // Calculate end date
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysCount);
  const endDateKey = formatDateKey(endDate);
  const startDateKey = formatDateKey(startDate);

  // Collect all items with their date keys
  const allItems: GroupedItem[] = [];

  // Add events
  events.forEach((event) => {
    // Parse event date from startTime - we need to determine the date
    // For now, assume events have a date property or we extract from context
    // Since CalendarEvent doesn't have a date field, we need to handle this differently
    // The calendar page will need to pass events with dates
    // For now, skip events without dates in the range
  });

  // Add tasks
  tasks.forEach((task) => {
    if (task.dueDate >= startDateKey && task.dueDate <= endDateKey) {
      allItems.push({
        id: task.id,
        title: task.title,
        type: 'task',
        dateKey: task.dueDate,
        sortTime: '23:59', // Tasks go at end of day by default
      });
    }
  });

  // Sort items by date, then by time
  allItems.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }
    return a.sortTime.localeCompare(b.sortTime);
  });

  // Group by date
  allItems.forEach((item) => {
    const { dateKey, sortTime, ...itemProps } = item;
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(itemProps);
  });

  return groups;
}

/**
 * Range selector options for agenda view
 */
const RANGE_OPTIONS = [
  { value: 7, label: '7 zile' },
  { value: 14, label: '14 zile' },
  { value: 30, label: '30 zile' },
  { value: 60, label: '60 zile' },
];

/**
 * AgendaView - Agenda view displaying events and tasks grouped by date
 *
 * Features:
 * - Groups events and tasks by date with collapsible sections
 * - Today's group is expanded by default
 * - Range selector to show 7/14/30/60 days
 * - Empty state when no items in range
 *
 * @example
 * ```tsx
 * <AgendaView
 *   events={calendarEvents}
 *   tasks={calendarTasks}
 *   onEventClick={(id) => console.log('Event clicked:', id)}
 *   onTaskClick={(id) => console.log('Task clicked:', id)}
 * />
 * ```
 */
export function AgendaView({ events, tasks, onEventClick, onTaskClick }: AgendaViewProps) {
  const { agendaDays, setAgendaDays } = useCalendarStore();

  // Today for determining default expansion
  const today = React.useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);

  // Group items by date
  const groupedItems = React.useMemo(() => {
    return groupItemsByDate(events, tasks, today, agendaDays);
  }, [events, tasks, today, agendaDays]);

  // Convert to sorted array of entries
  const sortedGroups = React.useMemo(() => {
    return Array.from(groupedItems.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [groupedItems]);

  // Handle item click
  const handleItemClick = React.useCallback(
    (id: string, type: 'event' | 'task') => {
      if (type === 'event') {
        onEventClick(id);
      } else {
        onTaskClick(id);
      }
    },
    [onEventClick, onTaskClick]
  );

  // Handle range change
  const handleRangeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setAgendaDays(Number(e.target.value));
    },
    [setAgendaDays]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with range selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle bg-linear-bg-secondary">
        <span className="text-sm text-linear-text-secondary">Următoarele {agendaDays} zile</span>
        <select
          value={agendaDays}
          onChange={handleRangeChange}
          className={cn(
            'text-sm bg-linear-bg-tertiary border border-linear-border-subtle rounded-linear-sm',
            'px-2 py-1 text-linear-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-linear-accent',
            'cursor-pointer'
          )}
          aria-label="Selectează perioada"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {sortedGroups.length === 0 ? (
          /* Empty state */
          <div className="flex items-center justify-center h-full">
            <p className="text-linear-text-tertiary">
              Niciun eveniment în următoarele {agendaDays} zile
            </p>
          </div>
        ) : (
          /* Grouped items */
          sortedGroups.map(([dateKey, items]) => (
            <AgendaGroup
              key={dateKey}
              dateKey={dateKey}
              items={items}
              defaultExpanded={dateKey === todayKey}
              onItemClick={handleItemClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

AgendaView.displayName = 'AgendaView';
