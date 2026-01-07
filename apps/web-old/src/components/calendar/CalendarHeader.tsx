'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CalendarView } from './types';
import { viewLabels } from './types';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from 'date-fns';
import { ro } from 'date-fns/locale';

// ====================================================================
// CalendarHeader - View toggle, navigation, and action button
// ====================================================================

interface CalendarHeaderProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onCreateEvent?: () => void;
  className?: string;
}

export function CalendarHeader({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  onCreateEvent,
  className,
}: CalendarHeaderProps) {
  // Format date range based on view
  const getDateRangeText = (): string => {
    switch (view) {
      case 'day':
        return format(currentDate, 'd MMMM yyyy', { locale: ro });
      case 'week': {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        // Only show 5 days (Mon-Fri)
        const friday = addDays(start, 4);
        if (start.getMonth() === friday.getMonth()) {
          return `${format(start, 'd')} - ${format(friday, 'd MMMM yyyy', { locale: ro })}`;
        }
        return `${format(start, 'd MMM', { locale: ro })} - ${format(friday, 'd MMM yyyy', { locale: ro })}`;
      }
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: ro });
      case 'agenda':
        return format(currentDate, 'MMMM yyyy', { locale: ro });
      default:
        return '';
    }
  };

  // Navigate to previous period
  const handlePrev = () => {
    switch (view) {
      case 'day':
        onDateChange(subDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(subWeeks(currentDate, 1));
        break;
      case 'month':
      case 'agenda':
        onDateChange(subMonths(currentDate, 1));
        break;
    }
  };

  // Navigate to next period
  const handleNext = () => {
    switch (view) {
      case 'day':
        onDateChange(addDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(addWeeks(currentDate, 1));
        break;
      case 'month':
      case 'agenda':
        onDateChange(addMonths(currentDate, 1));
        break;
    }
  };

  // Navigate to today
  const handleToday = () => {
    onDateChange(new Date());
  };

  const views: CalendarView[] = ['day', 'week', 'month', 'agenda'];

  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-linear-border-subtle bg-linear-bg-secondary px-6 py-4',
        className
      )}
    >
      {/* Left side: Title, Date Range, View Toggle */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-linear-text-primary">Calendar</h1>

        <span className="text-sm text-linear-text-secondary">{getDateRangeText()}</span>

        {/* View Toggle */}
        <div className="flex overflow-hidden rounded-md bg-linear-bg-tertiary p-0.5">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={cn(
                'rounded px-3 py-1.5 text-[13px] transition-all',
                view === v
                  ? 'bg-linear-bg-hover text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Right side: Navigation and Create Button */}
      <div className="flex items-center gap-3">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToday}
            className={cn(
              'rounded-md border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-1.5',
              'text-[13px] text-linear-text-secondary transition-colors',
              'hover:bg-linear-bg-hover hover:text-linear-text-primary'
            )}
          >
            Astăzi
          </button>
          <button
            type="button"
            onClick={handlePrev}
            className={cn(
              'rounded-md border border-linear-border-subtle bg-linear-bg-tertiary p-1.5',
              'text-linear-text-secondary transition-colors',
              'hover:bg-linear-bg-hover hover:text-linear-text-primary'
            )}
            aria-label="Anterior"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className={cn(
              'rounded-md border border-linear-border-subtle bg-linear-bg-tertiary p-1.5',
              'text-linear-text-secondary transition-colors',
              'hover:bg-linear-bg-hover hover:text-linear-text-primary'
            )}
            aria-label="Următor"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Create Event Button */}
        {onCreateEvent && (
          <button
            type="button"
            onClick={onCreateEvent}
            className={cn(
              'flex items-center gap-1.5 rounded-md bg-linear-accent px-3.5 py-1.5',
              'text-[13px] font-medium text-white transition-colors',
              'hover:bg-linear-accent-hover'
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Eveniment Nou
          </button>
        )}
      </div>
    </header>
  );
}
