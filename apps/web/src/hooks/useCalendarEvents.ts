'use client';

import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import { GET_CALENDAR_EVENTS } from '@/graphql/queries';

interface SubtaskFromAPI {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  estimatedHours: number | null;
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  loggedTime: number | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface TaskFromAPI {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  dueTime: string | null;
  estimatedHours: number | null;
  // Unified calendar scheduling fields
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  loggedTime: number | null;
  parentTaskId: string | null;
  typeMetadata: {
    isEvent?: boolean;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    location?: string;
  } | null;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  };
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  subtasks: SubtaskFromAPI[];
  createdAt: string;
}

export interface CalendarEventData {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  type: 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';
  location?: string;
  assignedTo?: string;
  assigneeName?: string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
}

export interface CalendarSubtaskData {
  id: string;
  title: string;
  estimatedDuration: string;
  remainingDuration: number;
  dueDate: string;
  dueDateRaw: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  variant: 'on-track' | 'due-today' | 'overdue' | 'locked';
  status: string;
  assigneeName?: string;
}

export interface CalendarTaskData {
  id: string;
  title: string;
  description?: string;
  estimatedDuration: string;
  remainingDuration: number; // Hours remaining (for block height)
  dueDate: string;
  dueDateRaw: string; // ISO date for positioning
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  isAutoScheduled: boolean; // true if time was auto-calculated, false if manually set
  variant: 'on-track' | 'due-today' | 'overdue' | 'locked';
  assignedTo?: string;
  assigneeName?: string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
  status: string;
  // Nested subtasks for parent tasks
  subtasks?: CalendarSubtaskData[];
  isParentTask?: boolean; // true if this task has subtasks
}

// Map backend task types to calendar event types
function mapTaskTypeToCalendarType(
  type: string
): 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder' {
  switch (type) {
    case 'CourtDate':
      return 'court';
    case 'Hearing':
      return 'hearing';
    case 'LegalDeadline':
      return 'deadline';
    case 'Meeting':
      return 'meeting';
    case 'Reminder':
      return 'reminder';
    case 'GeneralTask':
    case 'Research':
    case 'DocumentCreation':
    case 'DocumentRetrieval':
    case 'BusinessTrip':
    default:
      // Default to meeting for unrecognized event types
      return 'meeting';
  }
}

// Format date as YYYY-MM-DD using local timezone
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get task variant based on status and due date
function getTaskVariant(
  status: string,
  dueDate: string
): 'on-track' | 'due-today' | 'overdue' | 'locked' {
  if (status === 'Completed' || status === 'Cancelled') {
    return 'on-track';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    return 'overdue';
  }
  if (due.getTime() === today.getTime()) {
    return 'due-today';
  }
  return 'on-track';
}

// Format estimated hours to duration string
function formatDuration(hours: number | null): string {
  if (!hours) return '1h';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours === Math.floor(hours)) return `${hours}h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

// Format due date for display
function formatDueDate(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Astazi';
  if (diffDays === 1) return 'Maine';
  if (diffDays === -1) return 'Ieri';
  if (diffDays < -1) return `${Math.abs(diffDays)} zile intarziere`;

  const day = due.getDate();
  const months = [
    'Ian',
    'Feb',
    'Mar',
    'Apr',
    'Mai',
    'Iun',
    'Iul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${day} ${months[due.getMonth()]}`;
}

// Calculate remaining duration (estimatedHours - loggedTime)
function calculateRemainingDuration(
  estimatedHours: number | null,
  loggedTime: number | null
): number {
  const estimated = estimatedHours || 1; // Default to 1 hour
  const logged = loggedTime || 0;
  return Math.max(0.5, estimated - logged); // Minimum 0.5 hours
}

// Calculate end time from start time and duration (HH:MM format)
function calculateEndTime(startTime: string, durationHours: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + Math.round(durationHours * 60);
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  // Cap at 18:00 (end of business hours)
  if (endHours >= 18) return '18:00';
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

interface UseCalendarEventsOptions {
  startDate?: Date;
  endDate?: Date;
  showCompletedTasks?: boolean;
}

export function useCalendarEvents(options: UseCalendarEventsOptions = {}) {
  const { startDate, endDate, showCompletedTasks = true } = options;

  // Build filters for date range
  const filters = useMemo(() => {
    const f: { dueDateFrom?: string; dueDateTo?: string } = {};
    if (startDate) {
      f.dueDateFrom = formatDateKey(startDate);
    }
    if (endDate) {
      f.dueDateTo = formatDateKey(endDate);
    }
    return Object.keys(f).length > 0 ? f : undefined;
  }, [startDate, endDate]);

  const { data, loading, error, refetch } = useQuery<{ tasks: TaskFromAPI[] }>(
    GET_CALENDAR_EVENTS,
    {
      variables: { filters, limit: 500 },
      fetchPolicy: 'cache-and-network',
    }
  );

  // Transform API data into calendar format
  const { eventsByDate, tasksByDate } = useMemo(() => {
    const events: Record<string, CalendarEventData[]> = {};
    const tasks: Record<string, CalendarTaskData[]> = {};

    console.log('[useCalendarEvents] Raw data:', data?.tasks?.length, 'tasks');

    if (!data?.tasks) {
      return { eventsByDate: events, tasksByDate: tasks };
    }

    for (const task of data.tasks) {
      const metadata = task.typeMetadata;
      const isEvent = metadata?.isEvent === true;

      // Filter completed tasks if showCompletedTasks is false
      if (!showCompletedTasks && (task.status === 'Completed' || task.status === 'Cancelled')) {
        continue;
      }

      // Skip subtasks at top level - they will be nested within their parent
      if (task.parentTaskId) {
        continue;
      }

      console.log(
        '[useCalendarEvents] Task:',
        task.title,
        'isEvent:',
        isEvent,
        'scheduledDate:',
        task.scheduledDate,
        'scheduledStartTime:',
        task.scheduledStartTime,
        'subtasks:',
        task.subtasks?.length || 0
      );

      if (isEvent && metadata?.startTime) {
        // This is a calendar event with time - use dueDate as the key
        // Normalize to YYYY-MM-DD format (strip time component)
        const dateKey = task.dueDate.split('T')[0];
        const event: CalendarEventData = {
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          startTime: metadata.startTime,
          endTime: metadata.endTime || metadata.startTime,
          type: mapTaskTypeToCalendarType(task.type),
          location: metadata.location,
          assignedTo: task.assignee?.id,
          assigneeName: task.assignee
            ? `${task.assignee.firstName} ${task.assignee.lastName}`
            : undefined,
          caseId: task.case?.id,
          caseNumber: task.case?.caseNumber,
          caseTitle: task.case?.title,
        };

        if (!events[dateKey]) {
          events[dateKey] = [];
        }
        events[dateKey].push(event);
      } else {
        // This is a regular task - use dueDate for positioning (tasks appear on their due date)
        // Normalize to YYYY-MM-DD format (strip time component)
        const dateKey = task.dueDate.split('T')[0];
        const remainingDuration = calculateRemainingDuration(task.estimatedHours, task.loggedTime);
        const hasManualSchedule = !!task.scheduledStartTime;
        const scheduledEndTime = task.scheduledStartTime
          ? calculateEndTime(task.scheduledStartTime, remainingDuration)
          : null;

        // Transform subtasks if present
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const subtasksData: CalendarSubtaskData[] | undefined = hasSubtasks
          ? task.subtasks
              .filter(
                (st) =>
                  showCompletedTasks || (st.status !== 'Completed' && st.status !== 'Cancelled')
              )
              .map((st) => {
                const stRemainingDuration = calculateRemainingDuration(
                  st.estimatedHours,
                  st.loggedTime
                );
                const stDateKey = st.dueDate.split('T')[0];
                return {
                  id: st.id,
                  title: st.title,
                  estimatedDuration: formatDuration(st.estimatedHours),
                  remainingDuration: stRemainingDuration,
                  dueDate: formatDueDate(st.dueDate),
                  dueDateRaw: stDateKey,
                  scheduledStartTime: st.scheduledStartTime,
                  scheduledEndTime: st.scheduledStartTime
                    ? calculateEndTime(st.scheduledStartTime, stRemainingDuration)
                    : null,
                  variant: getTaskVariant(st.status, st.dueDate),
                  status: st.status,
                  assigneeName: st.assignee
                    ? `${st.assignee.firstName} ${st.assignee.lastName}`
                    : undefined,
                };
              })
          : undefined;

        const taskData: CalendarTaskData = {
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          estimatedDuration: formatDuration(task.estimatedHours),
          remainingDuration,
          dueDate: formatDueDate(task.dueDate),
          dueDateRaw: dateKey,
          scheduledDate: task.scheduledDate,
          scheduledStartTime: task.scheduledStartTime,
          scheduledEndTime,
          isAutoScheduled: !hasManualSchedule, // Will be auto-scheduled below
          variant: getTaskVariant(task.status, task.dueDate),
          assignedTo: task.assignee?.id,
          assigneeName: task.assignee
            ? `${task.assignee.firstName} ${task.assignee.lastName}`
            : undefined,
          caseId: task.case?.id,
          caseNumber: task.case?.caseNumber,
          caseTitle: task.case?.title,
          status: task.status,
          // Subtask data
          subtasks: subtasksData,
          isParentTask: hasSubtasks,
        };

        if (!tasks[dateKey]) {
          tasks[dateKey] = [];
        }
        tasks[dateKey].push(taskData);
      }
    }

    // NOTE: Task scheduling is NOT done here anymore.
    // Scheduling happens AFTER team member filtering in the calendar component,
    // so that visible tasks are scheduled based on visible events only.
    // See scheduleTasksForDay() function exported below.

    console.log(
      '[useCalendarEvents] Result - events:',
      Object.keys(events),
      'tasks:',
      Object.keys(tasks)
    );
    return { eventsByDate: events, tasksByDate: tasks };
  }, [data, showCompletedTasks]);

  return {
    eventsByDate,
    tasksByDate,
    loading,
    error,
    refetch,
  };
}

// ====================================================================
// Task Scheduling Helper (called after filtering)
// ====================================================================

const SCHEDULE_START_HOUR = 9;
const SCHEDULE_END_HOUR = 18;

/**
 * Schedule tasks sequentially for a day, avoiding events.
 * This should be called AFTER filtering by team member, so that
 * visible tasks are scheduled based on visible events only.
 *
 * Tasks start at 9 AM and stack sequentially. If an event occupies
 * a time slot, tasks are moved to after the event ends.
 *
 * @param tasks - Array of tasks for the day (will be mutated with scheduledStartTime)
 * @param events - Array of events for the day (used to determine occupied slots)
 * @returns The same tasks array with scheduledStartTime set
 */
// Constants for visual height calculation (px)
const HOUR_HEIGHT_PX = 60; // Must match DayColumn HOUR_HEIGHT
const PARENT_HEADER_HEIGHT_PX = 24; // Parent task title row
const SUBTASK_HEIGHT_PX = 32; // Each subtask row
const MIN_TASK_HEIGHT_PX = 24; // Minimum task height

/**
 * Calculate the visual duration (in hours) a task will occupy on the calendar.
 * For parent tasks with subtasks, this is based on rendered height, not work duration.
 */
function getVisualDuration(task: CalendarTaskData): number {
  if (task.isParentTask && task.subtasks && task.subtasks.length > 0) {
    // Parent task: header + all subtasks
    const heightPx = PARENT_HEADER_HEIGHT_PX + task.subtasks.length * SUBTASK_HEIGHT_PX;
    return heightPx / HOUR_HEIGHT_PX;
  }
  // Regular task: use remaining duration with minimum
  return Math.max(task.remainingDuration, MIN_TASK_HEIGHT_PX / HOUR_HEIGHT_PX);
}

export function scheduleTasksForDay(
  tasks: CalendarTaskData[],
  events: CalendarEventData[]
): CalendarTaskData[] {
  // Build occupied time slots from EVENTS ONLY
  const occupiedSlots: Array<{ start: number; end: number }> = [];

  for (const event of events) {
    const [sh, sm] = event.startTime.split(':').map(Number);
    const [eh, em] = event.endTime.split(':').map(Number);
    occupiedSlots.push({ start: sh * 60 + sm, end: eh * 60 + em });
  }

  // Sort occupied slots by start time
  occupiedSlots.sort((a, b) => a.start - b.start);

  // Schedule all tasks sequentially, avoiding events
  for (const task of tasks) {
    // Use visual duration for scheduling (accounts for subtask height)
    const visualDuration = getVisualDuration(task);
    const durationMinutes = visualDuration * 60;
    let scheduledStartMinutes = SCHEDULE_START_HOUR * 60; // Start at 9:00

    // Find first available slot
    for (const slot of occupiedSlots) {
      if (
        scheduledStartMinutes < slot.end &&
        scheduledStartMinutes + durationMinutes > slot.start
      ) {
        scheduledStartMinutes = slot.end;
      }
    }

    // Check if task fits within business hours
    if (scheduledStartMinutes + durationMinutes > SCHEDULE_END_HOUR * 60) {
      scheduledStartMinutes = Math.max(
        SCHEDULE_START_HOUR * 60,
        SCHEDULE_END_HOUR * 60 - durationMinutes
      );
    }

    // Set the calculated start time
    const hours = Math.floor(scheduledStartMinutes / 60);
    const minutes = scheduledStartMinutes % 60;
    task.scheduledStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    task.scheduledEndTime = calculateEndTime(task.scheduledStartTime, visualDuration);
    task.isAutoScheduled = true;

    // Add this task's slot to occupied slots for next task
    occupiedSlots.push({
      start: scheduledStartMinutes,
      end: scheduledStartMinutes + durationMinutes,
    });
    occupiedSlots.sort((a, b) => a.start - b.start);
  }

  return tasks;
}

// ====================================================================
// Role-based Drag Permission Helpers
// ====================================================================

// SECRETARY role maps to Jr Associate in the UI
type UserRole = 'PARTNER' | 'ASSOCIATE' | 'SECRETARY' | string;

interface TaskForDrag {
  id: string;
  assignedTo?: string;
}

/**
 * Check if a user can drag a task based on their role.
 * - All roles can drag tasks they're assigned to
 * - PARTNER, ASSOCIATE roles can drag any task
 * - SECRETARY (Jr Associate) can drag but has restrictions on WHERE they can drop
 */
export function canDragTask(userRole: UserRole, task: TaskForDrag): boolean {
  // PARTNER and ASSOCIATE can drag any task
  if (userRole === 'PARTNER' || userRole === 'ASSOCIATE') {
    return true;
  }

  // SECRETARY (Jr Associate) can drag tasks (drop restrictions handled separately)
  if (userRole === 'SECRETARY') {
    return true;
  }

  // For unknown roles, default to allowing drag (conservative approach)
  return true;
}

interface DropPermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a user can drop a task at a specific time/date based on their role.
 * - PARTNER, ASSOCIATE: can drop anywhere
 * - SECRETARY (Jr Associate): can only drop to EARLIER date/time
 *
 * @param userRole - The user's role
 * @param task - The task being dragged
 * @param currentDate - The task's current date
 * @param currentTime - The task's current time (HH:MM format)
 * @param targetDate - The target drop date
 * @param targetTime - The target drop time (HH:MM format)
 */
export function canDropAtTime(
  userRole: UserRole,
  task: TaskForDrag,
  currentDate: Date,
  currentTime: string,
  targetDate: Date,
  targetTime: string
): DropPermissionResult {
  // PARTNER and ASSOCIATE can drop anywhere
  if (userRole === 'PARTNER' || userRole === 'ASSOCIATE') {
    return { allowed: true };
  }

  // SECRETARY (Jr Associate) can only drop to earlier date/time
  if (userRole === 'SECRETARY') {
    // Normalize dates to midnight for comparison
    const currentDateNorm = new Date(currentDate);
    currentDateNorm.setHours(0, 0, 0, 0);
    const targetDateNorm = new Date(targetDate);
    targetDateNorm.setHours(0, 0, 0, 0);

    // Check if target date is later than current date
    if (targetDateNorm.getTime() > currentDateNorm.getTime()) {
      return {
        allowed: false,
        reason: 'Nu poți muta sarcina la o dată ulterioară',
      };
    }

    // If same date, check if target time is later than current time
    if (targetDateNorm.getTime() === currentDateNorm.getTime()) {
      if (targetTime > currentTime) {
        return {
          allowed: false,
          reason: 'Nu poți muta sarcina la o oră ulterioară',
        };
      }
    }

    // Target is earlier or same - allowed
    return { allowed: true };
  }

  // For unknown roles, default to allowing (conservative approach)
  return { allowed: true };
}
