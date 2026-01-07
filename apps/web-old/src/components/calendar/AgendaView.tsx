'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './types';
import { eventColors, eventTypeLabels } from './types';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns';
import { ro } from 'date-fns/locale';

// ====================================================================
// AgendaView - List view with date sections
// ====================================================================

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

export function AgendaView({ currentDate, events, onEventClick, className }: AgendaViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group events by date
  const eventsByDate = React.useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    daysInMonth.forEach((day) => {
      const dayEvents = events
        .filter((event) => isSameDay(event.startTime, day))
        .sort((a, b) => {
          // All-day events first, then by start time
          if (a.isAllDay && !b.isAllDay) return -1;
          if (!a.isAllDay && b.isAllDay) return 1;
          return a.startTime.getTime() - b.startTime.getTime();
        });

      if (dayEvents.length > 0) {
        grouped.set(day.toISOString(), dayEvents);
      }
    });

    return grouped;
  }, [events, daysInMonth]);

  // Format date header with relative text for today/tomorrow
  const formatDateHeader = (date: Date): string => {
    if (isToday(date)) {
      return `Astăzi, ${format(date, 'd MMMM', { locale: ro })}`;
    }
    if (isTomorrow(date)) {
      return `Mâine, ${format(date, 'd MMMM', { locale: ro })}`;
    }
    if (isYesterday(date)) {
      return `Ieri, ${format(date, 'd MMMM', { locale: ro })}`;
    }
    return format(date, 'EEEE, d MMMM', { locale: ro });
  };

  if (eventsByDate.size === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-linear-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="mt-3 text-sm text-linear-text-secondary">
            Niciun eveniment în această perioadă
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full overflow-y-auto p-6', className)}>
      <div className="mx-auto max-w-3xl space-y-6">
        {Array.from(eventsByDate.entries()).map(([dateKey, dayEvents]) => {
          const date = new Date(dateKey);
          const isCurrentDay = isToday(date);

          return (
            <div key={dateKey}>
              {/* Date Header */}
              <div
                className={cn(
                  'sticky top-0 z-10 mb-3 flex items-center gap-3 bg-linear-bg-primary py-2',
                  isCurrentDay && 'text-linear-accent'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg font-semibold',
                    isCurrentDay
                      ? 'bg-linear-accent text-white'
                      : 'bg-linear-bg-secondary text-linear-text-primary'
                  )}
                >
                  {format(date, 'd')}
                </div>
                <div>
                  <div
                    className={cn(
                      'text-sm font-medium capitalize',
                      isCurrentDay ? 'text-linear-accent' : 'text-linear-text-primary'
                    )}
                  >
                    {formatDateHeader(date)}
                  </div>
                  <div className="text-xs text-linear-text-muted">
                    {dayEvents.length} eveniment{dayEvents.length !== 1 && 'e'}
                  </div>
                </div>
              </div>

              {/* Events List */}
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const colors = eventColors[event.type];

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      className={cn(
                        'flex w-full items-start gap-4 rounded-lg border border-linear-border-subtle',
                        'bg-linear-bg-secondary p-4 text-left transition-all',
                        'hover:border-linear-border-default hover:shadow-md'
                      )}
                    >
                      {/* Time Column */}
                      <div className="w-16 flex-shrink-0 pt-0.5">
                        {event.isAllDay ? (
                          <span className="text-xs font-medium text-linear-text-muted">
                            Toată ziua
                          </span>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-linear-text-primary">
                              {format(event.startTime, 'HH:mm')}
                            </div>
                            <div className="text-xs text-linear-text-muted">
                              {format(event.endTime, 'HH:mm')}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Event Type Indicator */}
                      <div
                        className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      {/* Event Details */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-linear-text-primary">
                          {event.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-linear-text-secondary">
                          <span
                            className="rounded px-1.5 py-0.5"
                            style={{
                              backgroundColor: colors.bg,
                              color: colors.text,
                            }}
                          >
                            {eventTypeLabels[event.type]}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {event.location}
                            </span>
                          )}
                          {event.caseName && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              {event.caseName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignee Avatar */}
                      {event.assigneeInitials && (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: event.assigneeColor || '#6366f1' }}
                          title={event.assigneeName}
                        >
                          {event.assigneeInitials}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
