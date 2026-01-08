'use client';

import * as React from 'react';
import { CalendarDays, CheckSquare, Clock, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent, CalendarTask } from './DayColumn';

// ============================================================================
// Types
// ============================================================================

export interface AgendaSummaryPanelProps {
  currentDate: Date;
  events: CalendarEvent[];
  tasks: CalendarTask[];
  onAddEvent?: () => void;
  onAddTask?: () => void;
  onItemClick?: (type: 'event' | 'task', id: string) => void;
}

interface UpcomingItem {
  id: string;
  type: 'event' | 'task';
  title: string;
  time: string;
  variant?: CalendarTask['variant'];
  eventType?: CalendarEvent['type'];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date in Romanian
 */
function formatDateRomanian(date: Date): string {
  const months = [
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
  const days = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate estimated work hours from tasks
 */
function calculateEstimatedHours(tasks: CalendarTask[]): number {
  let totalHours = 0;
  for (const task of tasks) {
    if (task.remainingDuration) {
      totalHours += task.remainingDuration;
    } else if (task.estimatedDuration) {
      // Parse duration like "2h" or "30m"
      const match = task.estimatedDuration.match(/(\d+)([hm])/);
      if (match) {
        const value = parseInt(match[1], 10);
        totalHours += match[2] === 'h' ? value : value / 60;
      }
    }
  }
  return totalHours;
}

/**
 * Get upcoming items sorted by time
 */
function getUpcomingItems(events: CalendarEvent[], tasks: CalendarTask[]): UpcomingItem[] {
  const items: UpcomingItem[] = [];

  // Add events
  for (const event of events) {
    items.push({
      id: event.id,
      type: 'event',
      title: event.title,
      time: event.startTime,
      eventType: event.type,
    });
  }

  // Add tasks with scheduled time
  for (const task of tasks) {
    if (task.scheduledStartTime) {
      items.push({
        id: task.id,
        type: 'task',
        title: task.title,
        time: task.scheduledStartTime,
        variant: task.variant,
      });
    }
  }

  // Sort by time
  items.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  return items;
}

/**
 * Get overdue tasks
 */
function getOverdueTasks(tasks: CalendarTask[]): CalendarTask[] {
  return tasks.filter((task) => task.variant === 'overdue');
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Stat card for day overview
 */
function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-linear-md bg-linear-bg-tertiary',
        className
      )}
    >
      <Icon className="w-4 h-4 text-linear-text-tertiary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-linear-text-secondary">{label}</p>
        <p className="text-lg font-medium text-linear-text-primary">{value}</p>
      </div>
    </div>
  );
}

/**
 * Event type indicator colors
 */
const eventTypeColors: Record<CalendarEvent['type'], string> = {
  court: 'bg-[#EF4444]',
  hearing: 'bg-[#EC4899]',
  deadline: 'bg-[#F59E0B]',
  meeting: 'bg-[#3B82F6]',
  reminder: 'bg-[#22C55E]',
};

/**
 * Task variant indicator colors
 */
const taskVariantColors: Record<CalendarTask['variant'], string> = {
  'on-track': 'bg-[#3B82F6]',
  'due-today': 'bg-[#F59E0B]',
  overdue: 'bg-[#EF4444]',
  locked: 'bg-[#666666]',
};

/**
 * Single upcoming item row
 */
function UpcomingItemRow({ item, onClick }: { item: UpcomingItem; onClick?: () => void }) {
  const indicatorColor =
    item.type === 'event'
      ? eventTypeColors[item.eventType || 'meeting']
      : taskVariantColors[item.variant || 'on-track'];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-linear-sm text-left',
        'hover:bg-linear-bg-tertiary transition-colors'
      )}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', indicatorColor)} />
      <span className="text-sm text-linear-text-secondary w-12 flex-shrink-0">{item.time}</span>
      <span className="text-sm text-linear-text-primary truncate flex-1">{item.title}</span>
    </button>
  );
}

/**
 * Overdue task row with warning styling
 */
function OverdueTaskRow({ task, onClick }: { task: CalendarTask; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-linear-sm text-left',
        'hover:bg-[rgba(239,68,68,0.1)] transition-colors'
      )}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#EF4444]" />
      <span className="text-sm text-[#EF4444] truncate flex-1">{task.title}</span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * AgendaSummaryPanel - Day agenda overview for calendar right panel
 *
 * Features:
 * - Day statistics (events, tasks, estimated hours)
 * - Upcoming items list (chronological)
 * - Overdue tasks section
 * - Quick add buttons
 */
export function AgendaSummaryPanel({
  currentDate,
  events,
  tasks,
  onAddEvent,
  onAddTask,
  onItemClick,
}: AgendaSummaryPanelProps) {
  const upcomingItems = React.useMemo(
    () => getUpcomingItems(events, tasks).slice(0, 5),
    [events, tasks]
  );

  const overdueTasks = React.useMemo(() => getOverdueTasks(tasks), [tasks]);

  const estimatedHours = React.useMemo(() => calculateEstimatedHours(tasks), [tasks]);

  const handleItemClick = (type: 'event' | 'task', id: string) => {
    onItemClick?.(type, id);
  };

  return (
    <div className="w-[240px] xl:w-[320px] min-w-0 border-l border-linear-border-default bg-linear-bg-secondary h-full flex flex-col overflow-hidden">
      {/* Header - Date */}
      <div className="px-5 pt-5 pb-4 border-b border-linear-border-subtle">
        <h2 className="text-lg font-medium text-linear-text-primary">
          {formatDateRomanian(currentDate)}
        </h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stats section */}
        <div className="p-5 space-y-2">
          <StatCard icon={CalendarDays} label="Evenimente" value={events.length} />
          <StatCard icon={CheckSquare} label="Sarcini" value={tasks.length} />
          <StatCard
            icon={Clock}
            label="Timp estimat"
            value={estimatedHours > 0 ? `~${estimatedHours.toFixed(1)}h` : '-'}
          />
        </div>

        {/* Upcoming section */}
        <div className="px-5 pb-4">
          <h3 className="text-xs font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Următoarele
          </h3>
          {upcomingItems.length > 0 ? (
            <div className="space-y-0.5">
              {upcomingItems.map((item) => (
                <UpcomingItemRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onClick={() => handleItemClick(item.type, item.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-linear-text-tertiary py-2">Nicio programare pentru astăzi</p>
          )}
        </div>

        {/* Overdue section - only show if there are overdue tasks */}
        {overdueTasks.length > 0 && (
          <div className="px-5 pb-4">
            <h3 className="text-xs font-medium text-[#EF4444] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Întârziate ({overdueTasks.length})
            </h3>
            <div className="space-y-0.5">
              {overdueTasks.map((task) => (
                <OverdueTaskRow
                  key={task.id}
                  task={task}
                  onClick={() => handleItemClick('task', task.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick add buttons - fixed at bottom */}
      <div className="p-3 border-t border-linear-border-subtle flex gap-2">
        <button
          type="button"
          onClick={onAddEvent}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-2',
            'rounded-linear-md text-xs font-medium',
            'bg-linear-bg-tertiary text-linear-text-secondary',
            'hover:bg-linear-bg-quaternary hover:text-linear-text-primary',
            'transition-colors'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Eveniment
        </button>
        <button
          type="button"
          onClick={onAddTask}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-2',
            'rounded-linear-md text-xs font-medium',
            'bg-linear-accent text-white',
            'hover:bg-linear-accent/90',
            'transition-colors'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Sarcină
        </button>
      </div>
    </div>
  );
}
