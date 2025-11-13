/**
 * DeadlineCalendarWidget - Paralegal Dashboard Deadline Calendar
 * Mini monthly calendar view showing deadlines with tooltips
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { CalendarWidget as CalendarWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ro } from 'date-fns/locale';
import * as Tooltip from '@radix-ui/react-tooltip';

export interface DeadlineCalendarWidgetProps {
  widget: CalendarWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Calendar Day Cell Component
 */
function CalendarDay({
  date,
  deadlines,
  isCurrentMonth,
  isToday,
}: {
  date: Date;
  deadlines: CalendarWidgetType['events'];
  isCurrentMonth: boolean;
  isToday: boolean;
}) {
  const dayDeadlines = deadlines.filter((event) => isSameDay(new Date(event.date), date));
  const hasDeadlines = dayDeadlines.length > 0;
  const hasUrgent = dayDeadlines.some((d) => d.urgency === 'Urgent');

  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={showTooltip && hasDeadlines} onOpenChange={setShowTooltip}>
        <Tooltip.Trigger asChild>
          <div
            className={clsx(
              'relative p-2 text-center text-sm cursor-pointer transition-colors',
              isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
              isToday && 'bg-blue-50 font-bold',
              hasDeadlines && !isToday && 'hover:bg-gray-50'
            )}
            onMouseEnter={() => hasDeadlines && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div>{format(date, 'd')}</div>
            {hasDeadlines && (
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                {hasUrgent ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </div>
            )}
          </div>
        </Tooltip.Trigger>
        {hasDeadlines && (
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              className="max-w-xs bg-gray-900 text-white text-xs p-3 rounded-lg shadow-lg z-50"
              sideOffset={5}
            >
              <div className="space-y-2">
                <div className="font-semibold">{format(date, 'd MMMM yyyy', { locale: ro })}</div>
                {dayDeadlines.map((deadline) => (
                  <div key={deadline.id} className="border-t border-gray-700 pt-2">
                    <div className="font-medium">{deadline.title}</div>
                    {deadline.description && (
                      <div className="text-gray-300 mt-1">{deadline.description}</div>
                    )}
                    {deadline.caseContext && (
                      <div className="text-gray-400 mt-1 text-xs">Caz: {deadline.caseContext}</div>
                    )}
                  </div>
                ))}
              </div>
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * DeadlineCalendarWidget - Displays mini monthly calendar with deadline highlights
 *
 * Shows calendar with colored dots for deadlines, tooltips on hover.
 * Includes previous/next month navigation.
 */
export function DeadlineCalendarWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: DeadlineCalendarWidgetProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date();

  // Generate calendar grid (6 weeks)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={handlePreviousMonth}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Luna anterioară"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: ro })}
          </h3>
          <button
            onClick={handleToday}
            className="px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          >
            Astăzi
          </button>
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Luna următoare"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-600 p-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {calendarDays.map((day, index) => (
            <CalendarDay
              key={index}
              date={day}
              deadlines={widget.events}
              isCurrentMonth={isSameMonth(day, currentMonth)}
              isToday={isSameDay(day, today)}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Termen normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Termen urgent</span>
          </div>
        </div>
      </div>
    </WidgetContainer>
  );
}

DeadlineCalendarWidget.displayName = 'DeadlineCalendarWidget';
