/**
 * DeadlinesWidget - Associate Dashboard Deadlines Timeline
 * Displays timeline view of deadlines for the current week
 */

'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { DeadlineWidget as DeadlineWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';

export interface DeadlinesWidgetProps {
  widget: DeadlineWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Timeline Item Component
 */
function TimelineItem({
  deadline,
  isLast,
}: {
  deadline: DeadlineWidgetType['deadlines'][0];
  isLast: boolean;
}) {
  const isUrgent = deadline.urgent || deadline.daysRemaining < 2;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ro-RO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getDaysRemainingText = (days: number) => {
    if (days === 0) return 'Astăzi';
    if (days === 1) return 'Mâine';
    if (days < 0) return `${Math.abs(days)} zile întârziat`;
    return `${days} zile`;
  };

  return (
    <div className="relative flex gap-3 pb-4">
      {/* Timeline line */}
      {!isLast && (
        <div
          className={clsx(
            'absolute left-[11px] top-[28px] bottom-0 w-0.5',
            isUrgent ? 'bg-red-300' : 'bg-gray-200'
          )}
        />
      )}

      {/* Timeline dot */}
      <div className="relative flex items-start pt-1">
        <div
          className={clsx(
            'w-6 h-6 rounded-full flex items-center justify-center',
            isUrgent ? 'bg-red-500' : 'bg-blue-500'
          )}
        >
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1">
            <h4
              className={clsx('text-sm font-semibold', isUrgent ? 'text-red-700' : 'text-gray-900')}
            >
              {deadline.description}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-600">{formatDate(deadline.date)}</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-600">Caz #{deadline.caseId}</span>
            </div>
          </div>
          <div
            className={clsx(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap',
              isUrgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
            )}
          >
            {isUrgent && (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {getDaysRemainingText(deadline.daysRemaining)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DeadlinesWidget - Displays timeline of deadlines for current week
 *
 * Shows date, deadline description, associated case, and days remaining.
 * Urgent deadlines (< 2 days) are highlighted with red accent.
 */
export function DeadlinesWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: DeadlinesWidgetProps) {
  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  // Sort deadlines by date (soonest first)
  const sortedDeadlines = [...widget.deadlines].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Count urgent deadlines
  const urgentCount = sortedDeadlines.filter((d) => d.urgent || d.daysRemaining < 2).length;

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
      {sortedDeadlines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">Nu există termene în această săptămână</p>
        </div>
      ) : (
        <>
          {/* Urgent deadlines summary */}
          {urgentCount > 0 && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-100 mb-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  {urgentCount} termen{urgentCount > 1 ? 'e' : ''} urgent
                  {urgentCount > 1 ? 'e' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="px-3">
            {sortedDeadlines.map((deadline, index) => (
              <TimelineItem
                key={deadline.id}
                deadline={deadline}
                isLast={index === sortedDeadlines.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </WidgetContainer>
  );
}

DeadlinesWidget.displayName = 'DeadlinesWidget';
