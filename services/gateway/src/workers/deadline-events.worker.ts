/**
 * Deadline Events Worker
 * OPS-116: Event Emission Infrastructure
 *
 * Runs daily to emit deadline-related activity events for:
 * - Tasks due today
 * - Overdue tasks
 * - Case hearings today
 * - Calendar events today
 * - Approaching deadlines
 */

import { prisma } from '@legal-platform/database';
import { TaskStatus } from '@prisma/client';
import { activityEventService } from '../services/activity-event.service';

// ============================================================================
// Configuration
// ============================================================================

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// Track emitted events today to avoid duplicates
// Key format: `${userId}:${eventType}:${entityId}:${date}`
const emittedToday = new Set<string>();

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the deadline events worker
 * @param intervalMs - Check interval (default: 1 hour)
 */
export function startDeadlineEventsWorker(intervalMs: number = 60 * 60 * 1000): void {
  if (isRunning) {
    console.log('[DeadlineEventsWorker] Already running');
    return;
  }

  console.log('[DeadlineEventsWorker] Starting...');
  console.log('[DeadlineEventsWorker] Check interval:', intervalMs / 1000 / 60, 'minutes');

  isRunning = true;

  // Run immediately
  processDeadlineEvents().catch((error) => {
    console.error('[DeadlineEventsWorker] Error in initial processing:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processDeadlineEvents().catch((error) => {
      console.error('[DeadlineEventsWorker] Error in processing:', error);
    });
  }, intervalMs);

  console.log('[DeadlineEventsWorker] Started successfully');
}

/**
 * Stop the deadline events worker
 */
export function stopDeadlineEventsWorker(): void {
  if (!isRunning) {
    console.log('[DeadlineEventsWorker] Not running');
    return;
  }

  console.log('[DeadlineEventsWorker] Stopping...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  emittedToday.clear();

  console.log('[DeadlineEventsWorker] Stopped');
}

export function isDeadlineEventsWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Event Processing
// ============================================================================

/**
 * Main processing function - emits all deadline events
 */
async function processDeadlineEvents(): Promise<void> {
  console.log('[DeadlineEventsWorker] Processing deadline events...');

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const todayStr = today.toISOString().split('T')[0];

  // Clear stale entries (older than today)
  clearStaleEntries(todayStr);

  // Process each type of deadline event
  await Promise.all([
    processTasksDueToday(today, tomorrow, todayStr),
    processOverdueTasks(today, todayStr),
    processCalendarEventsToday(today, tomorrow, todayStr),
    processUpcomingEventReminders(now, todayStr),
  ]);

  console.log('[DeadlineEventsWorker] Processing complete');
}

/**
 * Emit events for tasks due today
 */
async function processTasksDueToday(today: Date, tomorrow: Date, todayStr: string): Promise<void> {
  const tasksDueToday = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
      status: {
        not: TaskStatus.Completed,
      },
      assignedTo: { not: null },
    },
    select: {
      id: true,
      title: true,
      assignedTo: true,
      firmId: true,
      caseId: true,
      dueDate: true,
      priority: true,
    },
  });

  console.log(`[DeadlineEventsWorker] Found ${tasksDueToday.length} tasks due today`);

  for (const task of tasksDueToday) {
    if (!task.assignedTo) continue;

    const key = `${task.assignedTo}:TASK_DUE_TODAY:${task.id}:${todayStr}`;
    if (emittedToday.has(key)) continue;

    await activityEventService
      .emit({
        userId: task.assignedTo,
        firmId: task.firmId,
        eventType: 'TASK_DUE_TODAY',
        entityType: 'TASK',
        entityId: task.id,
        entityTitle: task.title,
        metadata: {
          caseId: task.caseId,
          dueDate: task.dueDate?.toISOString(),
          priority: task.priority,
        },
      })
      .then(() => {
        emittedToday.add(key);
      })
      .catch((err) => {
        console.error('[DeadlineEventsWorker] Failed to emit TASK_DUE_TODAY:', err);
      });
  }
}

/**
 * Emit events for overdue tasks
 */
async function processOverdueTasks(today: Date, todayStr: string): Promise<void> {
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: {
        lt: today,
      },
      status: {
        not: TaskStatus.Completed,
      },
      assignedTo: { not: null },
    },
    select: {
      id: true,
      title: true,
      assignedTo: true,
      firmId: true,
      caseId: true,
      dueDate: true,
      priority: true,
    },
  });

  console.log(`[DeadlineEventsWorker] Found ${overdueTasks.length} overdue tasks`);

  for (const task of overdueTasks) {
    if (!task.assignedTo || !task.dueDate) continue;

    const key = `${task.assignedTo}:TASK_OVERDUE:${task.id}:${todayStr}`;
    if (emittedToday.has(key)) continue;

    const daysOverdue = Math.floor(
      (today.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    await activityEventService
      .emit({
        userId: task.assignedTo,
        firmId: task.firmId,
        eventType: 'TASK_OVERDUE',
        entityType: 'TASK',
        entityId: task.id,
        entityTitle: task.title,
        metadata: {
          caseId: task.caseId,
          dueDate: task.dueDate.toISOString(),
          priority: task.priority,
          daysOverdue,
        },
      })
      .then(() => {
        emittedToday.add(key);
      })
      .catch((err) => {
        console.error('[DeadlineEventsWorker] Failed to emit TASK_OVERDUE:', err);
      });
  }
}

/**
 * Emit events for calendar events today (meetings, court dates)
 */
async function processCalendarEventsToday(
  today: Date,
  tomorrow: Date,
  todayStr: string
): Promise<void> {
  // Look for tasks that are calendar events (meetings, court dates)
  // TaskTypeEnum: CourtDate, Meeting are the relevant types
  const calendarTasks = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
      type: {
        in: ['CourtDate', 'Meeting'],
      },
      status: {
        not: TaskStatus.Completed,
      },
      assignedTo: { not: null },
    },
    select: {
      id: true,
      title: true,
      assignedTo: true,
      firmId: true,
      caseId: true,
      type: true,
      dueDate: true,
      dueTime: true,
    },
  });

  console.log(`[DeadlineEventsWorker] Found ${calendarTasks.length} calendar events today`);

  for (const event of calendarTasks) {
    if (!event.assignedTo) continue;

    // CourtDate tasks emit CASE_HEARING_TODAY, other meetings emit CALENDAR_EVENT_TODAY
    const eventType = event.type === 'CourtDate' ? 'CASE_HEARING_TODAY' : 'CALENDAR_EVENT_TODAY';
    const key = `${event.assignedTo}:${eventType}:${event.id}:${todayStr}`;
    if (emittedToday.has(key)) continue;

    await activityEventService
      .emit({
        userId: event.assignedTo,
        firmId: event.firmId,
        eventType: eventType as 'CASE_HEARING_TODAY' | 'CALENDAR_EVENT_TODAY',
        entityType: event.type === 'CourtDate' ? 'CASE' : 'CALENDAR_EVENT',
        entityId: event.id,
        entityTitle: event.title,
        metadata: {
          caseId: event.caseId,
          time: event.dueTime,
          taskType: event.type,
        },
      })
      .then(() => {
        emittedToday.add(key);
      })
      .catch((err) => {
        console.error(`[DeadlineEventsWorker] Failed to emit ${eventType}:`, err);
      });
  }
}

/**
 * Emit reminders for calendar events happening in the next hour
 */
async function processUpcomingEventReminders(now: Date, todayStr: string): Promise<void> {
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  // Find meetings/events scheduled in the next hour
  const upcomingEvents = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
      type: {
        in: ['CourtDate', 'Meeting'],
      },
      status: {
        not: TaskStatus.Completed,
      },
      assignedTo: { not: null },
      dueTime: { not: null },
    },
    select: {
      id: true,
      title: true,
      assignedTo: true,
      firmId: true,
      caseId: true,
      type: true,
      dueDate: true,
      dueTime: true,
    },
  });

  // Filter to events starting within the next hour
  const eventsInNextHour = upcomingEvents.filter((event) => {
    if (!event.dueTime || !event.dueDate) return false;

    // Parse time (format: "HH:mm" or "HH:mm:ss")
    const [hours, minutes] = event.dueTime.split(':').map(Number);
    const eventTime = new Date(event.dueDate);
    eventTime.setHours(hours, minutes, 0, 0);

    // Check if event is between now and one hour from now
    return eventTime > now && eventTime <= oneHourFromNow;
  });

  console.log(`[DeadlineEventsWorker] Found ${eventsInNextHour.length} events in the next hour`);

  for (const event of eventsInNextHour) {
    if (!event.assignedTo) continue;

    const key = `${event.assignedTo}:CALENDAR_EVENT_REMINDER:${event.id}:${todayStr}`;
    if (emittedToday.has(key)) continue;

    await activityEventService
      .emit({
        userId: event.assignedTo,
        firmId: event.firmId,
        eventType: 'CALENDAR_EVENT_REMINDER',
        entityType: event.type === 'CourtDate' ? 'CASE' : 'CALENDAR_EVENT',
        entityId: event.id,
        entityTitle: event.title,
        importance: 'HIGH',
        metadata: {
          caseId: event.caseId,
          time: event.dueTime,
          taskType: event.type,
          reminderType: '1hour',
        },
      })
      .then(() => {
        emittedToday.add(key);
      })
      .catch((err) => {
        console.error('[DeadlineEventsWorker] Failed to emit CALENDAR_EVENT_REMINDER:', err);
      });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function clearStaleEntries(todayStr: string): void {
  // Remove entries not from today
  for (const key of emittedToday) {
    if (!key.endsWith(todayStr)) {
      emittedToday.delete(key);
    }
  }
}
