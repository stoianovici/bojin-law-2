'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarSubtaskData } from '@/hooks/useCalendarEvents';

// ============================================================================
// Types
// ============================================================================

export interface ParentTaskCardProps {
  /** Parent task ID */
  id: string;
  /** Parent task title - displays as header */
  title: string;
  /** Case number for reference */
  caseNumber?: string;
  /** Subtasks to display nested */
  subtasks: CalendarSubtaskData[];
  /** Whether this is positioned in time grid (unified calendar mode) */
  isTimeGridMode?: boolean;
  /** Position from top (pixels) - for time grid mode */
  top?: number;
  /** Total height including all subtasks (pixels) */
  height?: number;
  /** Callback when a subtask is clicked */
  onSubtaskClick?: (subtaskId: string, e: React.MouseEvent) => void;
  /** Callback when a subtask checkbox is toggled */
  onSubtaskToggle?: (subtaskId: string) => void;
  /** Callback when parent header is clicked */
  onParentClick?: (e: React.MouseEvent) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Subtask Variants - Border colors
// ============================================================================

const subtaskBorderColors = {
  'on-track': 'border-l-[#8B5CF6]',
  'due-today': 'border-l-[#F59E0B]',
  overdue: 'border-l-[#EF4444]',
  locked: 'border-l-[#EF4444]',
};

const subtaskBgColors = {
  'on-track': '',
  'due-today': '',
  overdue: 'bg-[rgba(239,68,68,0.05)]',
  locked: 'bg-[rgba(239,68,68,0.1)] opacity-70',
};

// ============================================================================
// Component
// ============================================================================

/**
 * ParentTaskCard - A container for parent tasks with nested subtasks
 *
 * Displays the parent task as a full-width title header with subtasks
 * indented below. Used when a task has subtasks and we want to show
 * them as a grouped unit on the calendar.
 */
export function ParentTaskCard({
  id,
  title,
  caseNumber,
  subtasks,
  isTimeGridMode = false,
  top,
  height,
  onSubtaskClick,
  onSubtaskToggle,
  onParentClick,
  className,
}: ParentTaskCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Calculate completed subtasks
  const completedCount = subtasks.filter(
    (st) => st.status === 'Completed' || st.status === 'Cancelled'
  ).length;
  const totalCount = subtasks.length;

  // Build positioning styles for time grid mode
  const positionStyles: React.CSSProperties = isTimeGridMode
    ? {
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        right: 0,
        minHeight: '24px',
        zIndex: 1,
      }
    : {};

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={cn('flex flex-col', className)} style={positionStyles}>
      {/* Parent Task - Full width title row (24px height) */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'flex items-center gap-1.5 px-2 h-6', // h-6 = 24px
          'bg-linear-bg-tertiary/80 rounded-t-linear-sm',
          'cursor-pointer hover:bg-linear-bg-tertiary transition-colors',
          !isExpanded && 'rounded-b-linear-sm'
        )}
        onClick={onParentClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onParentClick?.(e as unknown as React.MouseEvent);
          }
        }}
        aria-label={`Parent task: ${title}`}
      >
        {/* Expand/Collapse button */}
        <button
          className="w-4 h-4 flex items-center justify-center text-linear-text-tertiary hover:text-linear-text-secondary shrink-0"
          onClick={handleToggleExpand}
          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Parent title */}
        <span className="flex-1 text-[11px] font-medium text-linear-text-secondary truncate">
          {title}
        </span>

        {/* Progress badge */}
        <span className="text-[9px] text-linear-text-muted shrink-0">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Nested Subtasks - Indented */}
      {isExpanded && (
        <div className="flex flex-col gap-0.5 pl-3">
          {subtasks.map((subtask) => {
            const isCompleted = subtask.status === 'Completed' || subtask.status === 'Cancelled';

            return (
              <div
                key={subtask.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'flex items-center gap-2 px-2 h-8', // h-8 = 32px
                  'bg-linear-bg-secondary border border-linear-border-subtle',
                  'border-l-[3px] rounded-linear-sm',
                  subtaskBorderColors[subtask.variant],
                  subtaskBgColors[subtask.variant],
                  'cursor-pointer hover:border-linear-border-default hover:shadow-linear-sm transition-all',
                  isCompleted && 'opacity-60'
                )}
                onClick={(e) => onSubtaskClick?.(subtask.id, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSubtaskClick?.(subtask.id, e as unknown as React.MouseEvent);
                  }
                }}
                aria-label={`Subtask: ${subtask.title}`}
              >
                {/* Completion checkbox indicator */}
                <div
                  role={onSubtaskToggle ? 'button' : undefined}
                  tabIndex={onSubtaskToggle ? 0 : undefined}
                  className={cn(
                    'w-3 h-3 rounded-sm border flex items-center justify-center shrink-0',
                    isCompleted
                      ? 'bg-linear-accent border-linear-accent'
                      : 'border-linear-border-strong',
                    onSubtaskToggle &&
                      'cursor-pointer hover:border-linear-accent hover:bg-linear-accent/10 transition-colors'
                  )}
                  onClick={
                    onSubtaskToggle
                      ? (e) => {
                          e.stopPropagation();
                          onSubtaskToggle(subtask.id);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onSubtaskToggle
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onSubtaskToggle(subtask.id);
                          }
                        }
                      : undefined
                  }
                  aria-label={onSubtaskToggle ? `Toggle ${subtask.title} completion` : undefined}
                >
                  {isCompleted && <Check className="h-2 w-2 text-white" />}
                </div>

                {/* Subtask title */}
                <span
                  className={cn(
                    'flex-1 text-xs text-linear-text-primary truncate',
                    isCompleted && 'line-through text-linear-text-tertiary'
                  )}
                >
                  {subtask.title}
                </span>

                {/* Duration badge */}
                {subtask.estimatedDuration && (
                  <span className="text-[10px] text-linear-text-tertiary bg-linear-bg-tertiary px-1 py-px rounded shrink-0">
                    {subtask.estimatedDuration}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ParentTaskCard;
