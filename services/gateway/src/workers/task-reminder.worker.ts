// Story 4.4: Task Reminder Worker
// Sends automated reminders for approaching and overdue task deadlines

import { prisma, TaskStatus, NotificationType } from '@legal-platform/database';
import { sendTaskReminderEmail, sendOverdueNotification } from '../services/email.service';
import { ReminderConfig, EmailReminderPayload } from '@legal-platform/types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: ReminderConfig = {
  enableEmailReminders: true,
  reminderIntervals: [1, 2, 7], // Days before due date
  overdueReminderIntervalHours: 24,
  excludeWeekends: false,
};

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// Track sent reminders to avoid duplicates
const sentReminders = new Set<string>();

// ============================================================================
// Worker Lifecycle (AC: 6)
// ============================================================================

export function startTaskReminderWorker(
  intervalMs: number = 60 * 60 * 1000, // Default: 1 hour
  config: Partial<ReminderConfig> = {}
): void {
  if (isRunning) {
    console.log('Task reminder worker is already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('Starting task reminder worker...');
  console.log('Check interval:', intervalMs / 1000 / 60, 'minutes');
  console.log('Reminder intervals (days):', finalConfig.reminderIntervals);

  isRunning = true;

  // Run immediately
  processReminders(finalConfig).catch((error) => {
    console.error('Error in initial reminder processing:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processReminders(finalConfig).catch((error) => {
      console.error('Error in reminder processing:', error);
    });
  }, intervalMs);

  console.log('Task reminder worker started successfully');
}

export function stopTaskReminderWorker(): void {
  if (!isRunning) {
    console.log('Task reminder worker is not running');
    return;
  }

  console.log('Stopping task reminder worker...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  sentReminders.clear();
  reminderTimestamps.clear();

  console.log('Task reminder worker stopped successfully');
}

export function isTaskReminderWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Reminder Processing (AC: 6)
// ============================================================================

async function processReminders(config: ReminderConfig): Promise<void> {
  console.log('[Task Reminder Worker] Processing reminders...');

  const now = new Date();

  // Process approaching deadlines
  for (const days of config.reminderIntervals) {
    await processReminderInterval(days, now, config);
  }

  // Process overdue tasks
  await processOverdueReminders(now, config);

  console.log('[Task Reminder Worker] Reminder processing complete');
}

async function processReminderInterval(
  daysUntilDue: number,
  now: Date,
  config: ReminderConfig
): Promise<void> {
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntilDue);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Find tasks due in 'daysUntilDue' days
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: targetDate,
        lt: nextDay,
      },
      status: { not: TaskStatus.Completed },
    },
    include: {
      assignee: true,
      case: true,
      client: true,
    },
  });

  console.log(
    `[${daysUntilDue}d] Found ${tasks.length} tasks due on ${targetDate.toLocaleDateString()}`
  );

  for (const task of tasks) {
    const reminderKey = `${task.id}-${daysUntilDue}d`;

    // Skip if reminder already sent
    if (sentReminders.has(reminderKey)) {
      continue;
    }

    // Skip weekends if configured
    if (config.excludeWeekends && isWeekend(targetDate)) {
      continue;
    }

    // Determine context for link and title (case > client > firm)
    const contextTitle = task.case?.title ?? task.client?.name ?? 'Firm Task';
    const taskLink = task.caseId
      ? `/cases/${task.caseId}?task=${task.id}`
      : task.clientId
        ? `/clients/${task.clientId}?task=${task.id}`
        : `/tasks?task=${task.id}`;

    // Send in-app notification
    await prisma.notification.create({
      data: {
        userId: task.assignedTo,
        type: NotificationType.TaskDeadlineReminder,
        title: `Task Due ${daysUntilDue === 0 ? 'Today' : `in ${daysUntilDue} Day${daysUntilDue > 1 ? 's' : ''}`}`,
        message: `Task "${task.title}" is due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`}.`,
        link: taskLink,
        caseId: task.caseId,
      },
    });

    // Send email reminder if enabled
    if (config.enableEmailReminders) {
      const payload: EmailReminderPayload = {
        to: task.assignee.email,
        toName: `${task.assignee.firstName} ${task.assignee.lastName}`,
        taskId: task.id,
        taskTitle: task.title,
        caseTitle: contextTitle,
        dueDate: task.dueDate,
        daysUntilDue,
        isOverdue: false,
        taskUrl: `${process.env.APP_URL}${taskLink}`,
      };

      // Note: In production, you would get access token for the service account
      // For now, this is a placeholder
      const accessToken = process.env.GRAPH_SERVICE_TOKEN || '';
      if (accessToken) {
        await sendTaskReminderEmail(payload, accessToken);
      }
    }

    // Mark as sent with timestamp
    sentReminders.add(reminderKey);
    reminderTimestamps.set(reminderKey, Date.now());
  }
}

async function processOverdueReminders(now: Date, config: ReminderConfig): Promise<void> {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Find overdue tasks
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: {
        lt: yesterday,
      },
      status: { not: TaskStatus.Completed },
    },
    include: {
      assignee: true,
      case: true,
      client: true,
    },
  });

  console.log(`[Overdue] Found ${tasks.length} overdue tasks`);

  for (const task of tasks) {
    const daysPast = Math.floor((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const reminderKey = `${task.id}-overdue-${daysPast}`;

    // Skip if reminder already sent recently
    if (sentReminders.has(reminderKey)) {
      continue;
    }

    // Determine context for link and title (case > client > firm)
    const contextTitle = task.case?.title ?? task.client?.name ?? 'Firm Task';
    const taskLink = task.caseId
      ? `/cases/${task.caseId}?task=${task.id}`
      : task.clientId
        ? `/clients/${task.clientId}?task=${task.id}`
        : `/tasks?task=${task.id}`;

    // Send overdue notification
    await prisma.notification.create({
      data: {
        userId: task.assignedTo,
        type: NotificationType.TaskOverdue,
        title: 'Task Overdue',
        message: `Task "${task.title}" is ${daysPast} day${daysPast > 1 ? 's' : ''} overdue.`,
        link: taskLink,
        caseId: task.caseId,
      },
    });

    // Send overdue email if enabled
    if (config.enableEmailReminders) {
      const payload: EmailReminderPayload = {
        to: task.assignee.email,
        toName: `${task.assignee.firstName} ${task.assignee.lastName}`,
        taskId: task.id,
        taskTitle: task.title,
        caseTitle: contextTitle,
        dueDate: task.dueDate,
        daysUntilDue: -daysPast,
        isOverdue: true,
        taskUrl: `${process.env.APP_URL}${taskLink}`,
      };

      const accessToken = process.env.GRAPH_SERVICE_TOKEN || '';
      if (accessToken) {
        await sendOverdueNotification(payload, accessToken);
      }
    }

    // Mark as sent with timestamp
    sentReminders.add(reminderKey);
    reminderTimestamps.set(reminderKey, Date.now());
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

// Clean up old sent reminder keys (prevent memory leak)
// Store reminders with timestamps for selective cleanup
const reminderTimestamps = new Map<string, number>();

setInterval(
  () => {
    if (sentReminders.size > 10000) {
      // Keep reminders from last 7 days only
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const [key, timestamp] of reminderTimestamps.entries()) {
        if (timestamp < sevenDaysAgo) {
          sentReminders.delete(key);
          reminderTimestamps.delete(key);
        }
      }
      console.log(
        `[Task Reminder Worker] Cleaned up old reminders. Current size: ${sentReminders.size}`
      );
    }
  },
  24 * 60 * 60 * 1000
); // Once per day
