/**
 * SpanningTaskLayer Component
 * OPS-098: Duration-Based Calendar Card Spanning
 *
 * An overlay layer that renders spanning task cards with proper positioning.
 * Uses absolute positioning within the week grid.
 */

'use client';

import React, { useMemo } from 'react';
import type { Task } from '@legal-platform/types';
import {
  buildSpanningTasksInfo,
  assignRowsToSpanningTasks,
  calculateCardPosition,
  getTotalRowsHeight,
  CARD_HEIGHT,
  CARD_GAP,
} from '@/utils/workloadDistribution';
import { SpanningTaskCard } from './SpanningTaskCard';

// ============================================================================
// Constants
// ============================================================================

// Header height (day name + date number + optional "today" label)
const DAY_HEADER_HEIGHT = 60; // pixels

// ============================================================================
// Props
// ============================================================================

interface SpanningTaskLayerProps {
  tasks: Task[];
  weekStartDate: Date;
  onTaskClick: (task: Task) => void;
}

// ============================================================================
// Component
// ============================================================================

export function SpanningTaskLayer({ tasks, weekStartDate, onTaskClick }: SpanningTaskLayerProps) {
  // Build spanning info and row assignments
  const { assignments, totalHeight } = useMemo(() => {
    const spanningInfo = buildSpanningTasksInfo(tasks);
    const rowAssignments = assignRowsToSpanningTasks(spanningInfo, weekStartDate);
    const height = getTotalRowsHeight(rowAssignments);

    return {
      assignments: rowAssignments,
      totalHeight: Math.max(height, CARD_HEIGHT + CARD_GAP), // Minimum one row height
    };
  }, [tasks, weekStartDate]);

  // Don't render if no tasks
  if (assignments.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        top: DAY_HEADER_HEIGHT,
        height: `calc(100% - ${DAY_HEADER_HEIGHT}px)`,
        minHeight: totalHeight,
      }}
    >
      {assignments.map((assignment) => {
        const position = calculateCardPosition(
          assignment.startDay,
          assignment.endDay,
          assignment.row
        );

        return (
          <SpanningTaskCard
            key={assignment.task.id}
            task={assignment.task}
            span={assignment.span}
            startDay={assignment.startDay}
            endDay={assignment.endDay}
            position={position}
            onClick={() => onTaskClick(assignment.task)}
          />
        );
      })}
    </div>
  );
}

SpanningTaskLayer.displayName = 'SpanningTaskLayer';

export default SpanningTaskLayer;
