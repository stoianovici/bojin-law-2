/**
 * SpanningTaskCard Component
 * OPS-098: Duration-Based Calendar Card Spanning
 *
 * A task card that can visually span multiple calendar day columns.
 * Uses absolute positioning within the spanning layer.
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import type { Task } from '@legal-platform/types';
import {
  type CardPosition,
  getDayAbbreviation,
  isTimeSpecificTask,
} from '@/utils/workloadDistribution';
import { TASK_TYPE_COLORS } from '@/utils/task-colors';

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  Low: 'border-l-2',
  Medium: 'border-l-2',
  High: 'border-l-[3px]',
  Urgent: 'border-l-[4px]',
};

// ============================================================================
// Props
// ============================================================================

interface SpanningTaskCardProps {
  task: Task;
  span: number;
  startDay: number;
  endDay: number;
  position: CardPosition;
  onClick: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function SpanningTaskCard({
  task,
  span,
  startDay,
  endDay,
  position,
  onClick,
}: SpanningTaskCardProps) {
  const borderColor = TASK_TYPE_COLORS[task.type];
  // Only show time for time-specific task types (Meeting, CourtDate) with non-zero UTC hour
  const hasTime =
    isTimeSpecificTask(task.type) && task.dueDate && new Date(task.dueDate).getUTCHours() !== 0;
  const priorityBorder = PRIORITY_STYLES[task.priority];
  const caseName = task.case?.title || task.case?.caseNumber || '';
  const hasDuration = task.estimatedHours && task.estimatedHours > 0;
  const isSpanning = span > 1;

  // Build accessible label
  const timeLabel = hasTime ? `${format(new Date(task.dueDate), 'HH:mm')}, ` : '';
  const caseLabel = caseName ? `, Dosar: ${caseName}` : '';
  const durationLabel = hasDuration ? `, Durată: ${task.estimatedHours}h` : '';
  const spanLabel = isSpanning
    ? `, se întinde de la ${getDayAbbreviation(startDay)} până la ${getDayAbbreviation(endDay)}`
    : '';
  const ariaLabel = `${timeLabel}${task.title}${caseLabel}${durationLabel}${spanLabel}, Tip: ${task.type}, Prioritate: ${task.priority}`;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('taskId', task.id);
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      title={task.type}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        absolute rounded-md cursor-move transition-all bg-linear-bg-secondary pointer-events-auto
        hover:shadow-lg hover:scale-[1.01] hover:z-20
        focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-1
        ${priorityBorder}
        ${isSpanning ? 'shadow-md' : 'shadow-sm'}
      `}
      style={{
        left: position.left,
        width: `calc(${position.width} - 8px)`, // Account for padding
        top: position.top,
        height: position.height - 4, // Account for gap
        borderLeftColor: borderColor,
        // Gradient for spanning cards: fades toward due date
        background: isSpanning
          ? `linear-gradient(90deg, rgba(var(--linear-bg-secondary), 0.9) 0%, rgba(var(--linear-bg-secondary), 1) 100%)`
          : 'var(--linear-bg-secondary)',
        marginLeft: '4px',
        zIndex: 10,
      }}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Header row: start day indicator + title + duration badge */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            {/* Start day indicator for spanning cards */}
            {isSpanning && (
              <span className="text-[10px] font-medium text-linear-text-muted shrink-0 mt-0.5">
                [{getDayAbbreviation(startDay)}]
              </span>
            )}
            {/* Time badge for time-specific tasks */}
            {hasTime && (
              <span className="text-xs font-bold text-linear-text-secondary shrink-0">
                {format(new Date(task.dueDate), 'HH:mm')}
              </span>
            )}
            {/* Title */}
            <span
              className={`text-sm font-medium text-linear-text-primary ${isSpanning ? 'line-clamp-1' : 'line-clamp-2'}`}
            >
              {task.title}
            </span>
          </div>
          {/* Duration badge */}
          {hasDuration && (
            <span
              className="shrink-0 text-[10px] font-medium text-linear-text-tertiary bg-linear-bg-tertiary px-1.5 py-0.5 rounded"
              title={`Durată estimată: ${task.estimatedHours} ore`}
            >
              {task.estimatedHours}h
            </span>
          )}
        </div>

        {/* Case name + due day indicator */}
        <div className="mt-1 flex items-center justify-between gap-1">
          {caseName && (
            <span className="text-[11px] text-linear-text-tertiary line-clamp-1 flex-1">{caseName}</span>
          )}
          {/* Due day indicator for spanning cards */}
          {isSpanning && (
            <span className="text-[10px] font-semibold text-linear-text-secondary shrink-0 flex items-center gap-0.5">
              <span className="text-linear-text-muted">▸</span>
              {getDayAbbreviation(endDay)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

SpanningTaskCard.displayName = 'SpanningTaskCard';

export default SpanningTaskCard;
