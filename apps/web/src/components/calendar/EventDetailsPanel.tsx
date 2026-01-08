'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from './DayColumn';

export interface EventDetailsPanelProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

/**
 * Event type badge styles - colored background with matching text
 */
const eventTypeStyles: Record<CalendarEvent['type'], string> = {
  court: 'bg-[rgba(239,68,68,0.15)] text-[#EF4444]',
  hearing: 'bg-[rgba(236,72,153,0.15)] text-[#EC4899]',
  deadline: 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]',
  meeting: 'bg-[rgba(59,130,246,0.15)] text-[#3B82F6]',
  reminder: 'bg-[rgba(34,197,94,0.15)] text-[#22C55E]',
};

/**
 * Event type labels in Romanian
 */
const eventTypeLabels: Record<CalendarEvent['type'], string> = {
  court: 'Instanță',
  hearing: 'Audiență',
  deadline: 'Termen limită',
  meeting: 'Întâlnire',
  reminder: 'Reminder',
};

/**
 * EventDetailsPanel - Side panel showing details of a selected calendar event
 *
 * Features:
 * - Fixed width panel with left border
 * - Empty state when no event selected
 * - Event details with type badge, time, location, and description
 * - Close button in header
 */
export function EventDetailsPanel({ event, onClose }: EventDetailsPanelProps) {
  // Empty state when no event is selected
  if (!event) {
    return (
      <div className="w-[280px] xl:w-[400px] border-l border-linear-border-default bg-linear-bg-secondary h-full flex items-center justify-center">
        <p className="text-linear-text-tertiary">Selectați un eveniment</p>
      </div>
    );
  }

  return (
    <div className="w-[280px] xl:w-[400px] border-l border-linear-border-default bg-linear-bg-secondary h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-6 border-b border-linear-border-subtle">
        <h2 className="text-lg font-medium text-linear-text-primary">{event.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'p-1.5 rounded-linear-sm text-linear-text-secondary',
            'hover:bg-linear-bg-tertiary hover:text-linear-text-primary',
            'transition-colors'
          )}
          aria-label="Închide panoul"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Type badge */}
        <div>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium',
              eventTypeStyles[event.type]
            )}
          >
            {eventTypeLabels[event.type]}
          </span>
        </div>

        {/* Time section */}
        <div>
          <h3 className="text-sm font-medium text-linear-text-secondary mb-1">Ora</h3>
          <p className="text-linear-text-primary">
            {event.startTime} - {event.endTime}
          </p>
        </div>

        {/* Location section (only if present) */}
        {event.location && (
          <div>
            <h3 className="text-sm font-medium text-linear-text-secondary mb-1">Locație</h3>
            <p className="text-linear-text-primary">{event.location}</p>
          </div>
        )}

        {/* Details section */}
        <div>
          <h3 className="text-sm font-medium text-linear-text-secondary mb-1">Detalii</h3>
          <p className="text-linear-text-tertiary">Fără descriere adițională</p>
        </div>
      </div>
    </div>
  );
}
