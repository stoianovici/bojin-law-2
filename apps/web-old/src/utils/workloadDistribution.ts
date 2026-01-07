/**
 * Workload Distribution Utilities
 * OPS-098: Duration-Based Calendar Card Spanning
 *
 * Calculates task spans and row assignments for multi-day calendar cards.
 */

import { isSameDay } from 'date-fns';
import type { Task } from '@legal-platform/types';

// Re-export Task type for convenience
export type { Task };

// ============================================================================
// Constants
// ============================================================================

export const DAILY_CAPACITY_HOURS = 8;
export const MAX_SPAN_DAYS = 3;
export const CARD_HEIGHT = 72; // pixels
export const CARD_GAP = 4; // pixels between rows

export interface SpanningTaskInfo {
  task: Task;
  span: number; // 1, 2, or 3 days
  startDayOffset: number; // Offset from due date (negative for backward span)
}

export interface RowAssignment {
  task: Task;
  span: number;
  startDay: number; // 0-6 (Mon-Sun)
  endDay: number; // 0-6 (Mon-Sun)
  row: number; // Assigned row for vertical stacking
}

export interface CardPosition {
  left: string; // CSS percentage
  width: string; // CSS percentage
  top: number; // pixels
  height: number; // pixels
}

// ============================================================================
// Constants for Time-Specific Tasks
// ============================================================================

/**
 * Task types that can have specific times (Meeting, CourtDate)
 * Other task types are always date-only, regardless of stored time value
 */
const TIME_SPECIFIC_TASK_TYPES = ['Meeting', 'CourtDate'] as const;

// ============================================================================
// Span Calculation
// ============================================================================

/**
 * Determines if a task is time-specific based on its type
 * Only Meeting and CourtDate tasks can have specific times
 */
export function isTimeSpecificTask(taskType: string): boolean {
  return TIME_SPECIFIC_TASK_TYPES.includes(taskType as (typeof TIME_SPECIFIC_TASK_TYPES)[number]);
}

/**
 * Determines if a task has a specific time (not all-day)
 * - Only Meeting and CourtDate tasks can have times
 * - Uses UTC to avoid timezone issues
 */
function hasSpecificTime(task: Task): boolean {
  // Only certain task types can have specific times
  if (!isTimeSpecificTask(task.type)) {
    return false;
  }
  const date = new Date(task.dueDate);
  return date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
}

/**
 * Calculates how many days a task should span based on workload.
 *
 * Rules:
 * 1. Only date-only tasks (no specific time) with estimatedHours can span
 * 2. Time-specific tasks never span
 * 3. If a single task exceeds daily capacity (8h), it spans multiple days
 * 4. If total hours on a day exceed capacity, only the LONGEST task spans
 *
 * @param task - The task to calculate span for
 * @param allTasks - All tasks in the view (for workload calculation)
 * @returns Number of days to span (1-3)
 */
export function calculateTaskSpan(task: Task, allTasks: Task[]): number {
  // Rule 1: Must have estimatedHours
  if (!task.estimatedHours || task.estimatedHours <= 0) {
    return 1;
  }

  // Rule 2: Time-specific tasks don't span
  if (hasSpecificTime(task)) {
    return 1;
  }

  const dueDate = new Date(task.dueDate);

  // Get all date-only tasks on the same due date with duration
  const sameDayTasks = allTasks.filter((t) => {
    if (!t.estimatedHours || t.estimatedHours <= 0) return false;
    if (hasSpecificTime(t)) return false;
    return isSameDay(new Date(t.dueDate), dueDate);
  });

  // Sort by duration descending (larger tasks get spanning priority)
  sameDayTasks.sort((a, b) => (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0));

  // Calculate total hours for all tasks on this day
  const totalHours = sameDayTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
  const hours = task.estimatedHours ?? 0;

  // Case 1: This task alone exceeds daily capacity
  if (hours > DAILY_CAPACITY_HOURS) {
    return Math.min(MAX_SPAN_DAYS, Math.ceil(hours / DAILY_CAPACITY_HOURS));
  }

  // Case 2: Day is overloaded - only the LONGEST task spans
  if (totalHours > DAILY_CAPACITY_HOURS) {
    // Only the first task (longest) should span
    if (sameDayTasks[0]?.id === task.id) {
      const daysNeeded = Math.ceil(hours / DAILY_CAPACITY_HOURS);
      return Math.min(MAX_SPAN_DAYS, Math.max(2, daysNeeded));
    }
    // Other tasks don't span
    return 1;
  }

  // Case 3: Fits within capacity
  return 1;
}

/**
 * Builds spanning information for all tasks
 */
export function buildSpanningTasksInfo(tasks: Task[]): SpanningTaskInfo[] {
  return tasks.map((task) => {
    const span = calculateTaskSpan(task, tasks);
    return {
      task,
      span,
      startDayOffset: -(span - 1), // Spans backward from due date
    };
  });
}

// ============================================================================
// Row Assignment (Vertical Stacking)
// ============================================================================

/**
 * Converts a date to day-of-week index (Monday = 0, Sunday = 6)
 */
function getDayOfWeekIndex(date: Date): number {
  const day = date.getDay(); // Sunday = 0, Monday = 1, etc.
  return day === 0 ? 6 : day - 1; // Convert to Monday = 0
}

/**
 * Assigns rows to tasks to avoid visual overlap.
 * Uses greedy algorithm: process tasks by start day, assign to first available row.
 *
 * @param spanningTasks - Tasks with span information
 * @param weekStartDate - Start of the week (Monday)
 * @returns Array of row assignments
 */
export function assignRowsToSpanningTasks(
  spanningTasks: SpanningTaskInfo[],
  _weekStartDate: Date
): RowAssignment[] {
  // Calculate day indices for each task
  const tasksWithDays = spanningTasks.map((st) => {
    const dueDate = new Date(st.task.dueDate);
    const dueDayOfWeek = getDayOfWeekIndex(dueDate);
    const startDay = Math.max(0, dueDayOfWeek + st.startDayOffset); // Clip at Monday
    const endDay = Math.min(6, dueDayOfWeek); // Clip at Sunday

    return {
      ...st,
      startDay,
      endDay,
    };
  });

  // Sort by start day, then by span (descending - longer spans first)
  tasksWithDays.sort((a, b) => {
    if (a.startDay !== b.startDay) return a.startDay - b.startDay;
    return b.span - a.span;
  });

  // Track which day-slots are occupied per row
  // rowOccupancy[row][day] = true if occupied
  const rowOccupancy: boolean[][] = [];

  const assignments: RowAssignment[] = [];

  for (const task of tasksWithDays) {
    // Find first available row
    let assignedRow = 0;

    while (true) {
      // Ensure row exists in occupancy tracking
      if (!rowOccupancy[assignedRow]) {
        rowOccupancy[assignedRow] = Array(7).fill(false);
      }

      // Check if this row is free for all days of the span
      let rowIsFree = true;
      for (let day = task.startDay; day <= task.endDay; day++) {
        if (rowOccupancy[assignedRow][day]) {
          rowIsFree = false;
          break;
        }
      }

      if (rowIsFree) {
        // Mark days as occupied
        for (let day = task.startDay; day <= task.endDay; day++) {
          rowOccupancy[assignedRow][day] = true;
        }
        break;
      }

      assignedRow++;

      // Safety: limit to reasonable number of rows
      if (assignedRow > 20) {
        break;
      }
    }

    assignments.push({
      task: task.task,
      span: task.span,
      startDay: task.startDay,
      endDay: task.endDay,
      row: assignedRow,
    });
  }

  return assignments;
}

// ============================================================================
// Card Positioning
// ============================================================================

// Column width percentages
// Weekdays: (100% - 11%) / 5 = 17.8% each
// Weekends: 11% / 2 = 5.5% each
const WEEKDAY_WIDTH_PERCENT = (100 - 11) / 5; // ~17.8%
const WEEKEND_WIDTH_PERCENT = 11 / 2; // ~5.5%

/**
 * Gets the width percentage for a specific day
 */
function getDayWidthPercent(day: number): number {
  return day < 5 ? WEEKDAY_WIDTH_PERCENT : WEEKEND_WIDTH_PERCENT;
}

/**
 * Calculates the CSS position for a spanning card
 *
 * @param startDay - Start day index (0-6)
 * @param endDay - End day index (0-6)
 * @param row - Row index for vertical stacking
 * @returns CSS position values
 */
export function calculateCardPosition(startDay: number, endDay: number, row: number): CardPosition {
  let left = 0;
  let width = 0;

  for (let day = 0; day <= 6; day++) {
    const dayWidth = getDayWidthPercent(day);

    if (day < startDay) {
      left += dayWidth;
    } else if (day >= startDay && day <= endDay) {
      width += dayWidth;
    }
  }

  return {
    left: `${left}%`,
    width: `${width}%`,
    top: row * (CARD_HEIGHT + CARD_GAP),
    height: CARD_HEIGHT,
  };
}

/**
 * Gets the total height needed for a set of row assignments
 */
export function getTotalRowsHeight(assignments: RowAssignment[]): number {
  if (assignments.length === 0) return 0;
  const maxRow = Math.max(...assignments.map((a) => a.row));
  return (maxRow + 1) * (CARD_HEIGHT + CARD_GAP);
}

// ============================================================================
// Day Labels
// ============================================================================

const DAY_ABBREVIATIONS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

/**
 * Gets the abbreviated day name in Romanian
 */
export function getDayAbbreviation(dayIndex: number): string {
  return DAY_ABBREVIATIONS[dayIndex] ?? '';
}
