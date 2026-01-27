'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckSquare, Calendar } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface SlotPreviewGhostProps {
  type: 'task' | 'event';
  title: string;
  duration: number; // minutes
  startTime: string; // HH:MM format
  itemType: string; // TaskType or EventType
  startHour: number; // Calendar start hour for position calculation
  caseTitle?: string;
}

// ============================================
// CONSTANTS
// ============================================

const HOUR_HEIGHT = 60; // Must match DayColumn

// Task type colors (matching TaskCard)
const TASK_TYPE_COLORS: Record<string, string> = {
  Research: '#8B5CF6', // Purple
  DocumentCreation: '#8B5CF6',
  DocumentRetrieval: '#8B5CF6',
  CourtDate: '#EF4444', // Red
  Meeting: '#3B82F6', // Blue
  BusinessTrip: '#22C55E', // Green
};

// Event type colors (matching DayColumn)
const EVENT_TYPE_COLORS: Record<string, string> = {
  CourtDate: '#EF4444', // Red
  Hearing: '#EC4899', // Pink
  LegalDeadline: '#F59E0B', // Amber
  Meeting: '#3B82F6', // Blue
  Reminder: '#22C55E', // Green
};

// ============================================
// HELPERS
// ============================================

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

function calculatePosition(startTime: string, startHour: number): number {
  const { hours, minutes } = parseTime(startTime);
  const hoursFromStart = hours - startHour;
  return hoursFromStart * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

function calculateHeight(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24); // Minimum 24px height
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ============================================
// COMPONENT
// ============================================

/**
 * SlotPreviewGhost - A semi-transparent preview card rendered in DayColumn
 *
 * Shows a real-time preview of the task/event being created,
 * updating as the user fills out the form.
 */
export function SlotPreviewGhost({
  type,
  title,
  duration,
  startTime,
  itemType,
  startHour,
  caseTitle,
}: SlotPreviewGhostProps) {
  const top = calculatePosition(startTime, startHour);
  const height = calculateHeight(duration);

  // Get color based on type
  const borderColor =
    type === 'task'
      ? TASK_TYPE_COLORS[itemType] || '#8B5CF6'
      : EVENT_TYPE_COLORS[itemType] || '#3B82F6';

  const displayTitle = title || (type === 'task' ? 'Sarcină nouă' : 'Eveniment nou');

  return (
    <div
      className={cn(
        'absolute left-0 right-0 rounded-linear-sm px-2 py-1.5 overflow-hidden z-[4]',
        'border border-dashed',
        'bg-linear-bg-secondary/70 backdrop-blur-sm',
        'animate-in fade-in duration-150',
        'pointer-events-none'
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        borderLeftWidth: '3px',
        borderLeftStyle: 'solid',
        borderLeftColor: borderColor,
        borderColor: `${borderColor}40`,
      }}
    >
      {/* Type indicator */}
      <div className="flex items-center gap-1.5 mb-0.5">
        {type === 'task' ? (
          <CheckSquare className="w-3 h-3" style={{ color: borderColor }} />
        ) : (
          <Calendar className="w-3 h-3" style={{ color: borderColor }} />
        )}
        <span className="text-[10px] font-medium" style={{ color: borderColor }}>
          {type === 'task' ? 'Task' : 'Event'}
        </span>
      </div>

      {/* Title */}
      <div className="text-xs font-light text-linear-text-primary truncate">{displayTitle}</div>

      {/* Duration and case info */}
      <div className="flex items-center gap-2 text-[10px] text-linear-text-tertiary mt-0.5">
        <span className="rounded-linear-sm bg-linear-bg-tertiary px-1 py-px">
          {formatDuration(duration)}
        </span>
        {caseTitle && <span className="truncate opacity-70">{caseTitle}</span>}
      </div>
    </div>
  );
}
