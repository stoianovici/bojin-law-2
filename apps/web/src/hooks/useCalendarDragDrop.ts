'use client';

/**
 * Calendar Drag and Drop Utilities
 *
 * Helper functions for task drag and drop operations in the calendar.
 * The main drag state is managed in the CalendarPage component.
 */

// ============================================================================
// Types
// ============================================================================

export interface DraggedTask {
  id: string;
  title: string;
  remainingDuration?: number;
  currentDate: string; // YYYY-MM-DD
  currentStartTime: string | null; // HH:MM or null if unscheduled
}

export interface DropTarget {
  date: Date;
  hour: number;
  minute: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const HOUR_HEIGHT = 60; // Must match DayColumn

/**
 * Format date as YYYY-MM-DD using local timezone
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the time from a Y position in the time grid
 */
export function calculateTimeFromPosition(
  y: number,
  containerTop: number,
  startHour: number
): { hour: number; minute: number } {
  const relativeY = y - containerTop;
  const totalMinutes = (relativeY / HOUR_HEIGHT) * 60;
  const hour = Math.floor(totalMinutes / 60) + startHour;
  // Snap to 15-minute intervals
  const minute = Math.floor((totalMinutes % 60) / 15) * 15;
  return { hour: Math.max(startHour, hour), minute };
}

/**
 * Format time as HH:MM
 */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
