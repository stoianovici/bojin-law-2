/**
 * OOO Reassignment Worker
 * Story 4.5: Team Workload Management
 *
 * AC: 5 - Out-of-office automatically reassigns urgent tasks
 *
 * Runs periodically to:
 * 1. Check for users starting OOO periods
 * 2. Automatically reassign urgent/high priority tasks
 * 3. Send notifications to both original assignee and delegate
 */

import { prisma, TaskStatus, TaskPriority, NotificationType } from '@legal-platform/database';
import type { OOOReassignmentSummary } from '@legal-platform/types';

// ============================================================================
// Configuration
// ============================================================================

interface OOOWorkerConfig {
  checkIntervalMs: number;
  reassignPriorities: TaskPriority[];
  lookAheadDays: number;
  sendNotifications: boolean;
}

const DEFAULT_CONFIG: OOOWorkerConfig = {
  checkIntervalMs: 60 * 60 * 1000, // 1 hour
  reassignPriorities: [TaskPriority.Urgent, TaskPriority.High],
  lookAheadDays: 1, // Check OOO starting within next day
  sendNotifications: true,
};

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// Track processed availabilities to avoid duplicate processing
const processedAvailabilities = new Set<string>();

// ============================================================================
// Worker Lifecycle
// ============================================================================

export function startOOOReassignmentWorker(
  config: Partial<OOOWorkerConfig> = {}
): void {
  if (isRunning) {
    console.log('[OOO Worker] Already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[OOO Worker] Starting...');
  console.log('[OOO Worker] Check interval:', finalConfig.checkIntervalMs / 1000 / 60, 'minutes');
  console.log('[OOO Worker] Reassign priorities:', finalConfig.reassignPriorities);

  isRunning = true;

  // Run immediately
  processOOOPeriods(finalConfig).catch((error) => {
    console.error('[OOO Worker] Error in initial processing:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processOOOPeriods(finalConfig).catch((error) => {
      console.error('[OOO Worker] Error in processing:', error);
    });
  }, finalConfig.checkIntervalMs);

  console.log('[OOO Worker] Started successfully');
}

export function stopOOOReassignmentWorker(): void {
  if (!isRunning) {
    console.log('[OOO Worker] Not running');
    return;
  }

  console.log('[OOO Worker] Stopping...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  processedAvailabilities.clear();

  console.log('[OOO Worker] Stopped successfully');
}

export function isOOOReassignmentWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// OOO Processing
// ============================================================================

async function processOOOPeriods(config: OOOWorkerConfig): Promise<void> {
  console.log('[OOO Worker] Processing OOO periods...');

  const now = new Date();
  const lookAheadDate = new Date(now);
  lookAheadDate.setDate(lookAheadDate.getDate() + config.lookAheadDays);

  // Find availabilities that:
  // 1. Start today or within look-ahead period
  // 2. Have autoReassign enabled
  // 3. Are OOO, Vacation, or SickLeave type
  const availabilities = await prisma.userAvailability.findMany({
    where: {
      startDate: {
        gte: now,
        lte: lookAheadDate,
      },
      autoReassign: true,
      availabilityType: {
        in: ['OutOfOffice', 'Vacation', 'SickLeave'],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firmId: true,
          firstName: true,
          lastName: true,
        },
      },
      delegate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  console.log(`[OOO Worker] Found ${availabilities.length} upcoming OOO periods`);

  for (const availability of availabilities) {
    // Skip if already processed
    if (processedAvailabilities.has(availability.id)) {
      continue;
    }

    try {
      const result = await processUserOOO(availability, config);

      if (result.tasksReassigned.length > 0) {
        console.log(
          `[OOO Worker] Reassigned ${result.tasksReassigned.length} tasks for user ${availability.user.firstName} ${availability.user.lastName}`
        );

        // Send notifications if enabled
        if (config.sendNotifications) {
          await sendOOONotifications(availability, result);
        }
      }

      // Mark as processed
      processedAvailabilities.add(availability.id);
    } catch (error) {
      console.error(
        `[OOO Worker] Error processing OOO for user ${availability.userId}:`,
        error
      );
    }
  }

  // Also check for OOO periods that started today (for immediate processing)
  await processActiveOOOPeriods(config);

  console.log('[OOO Worker] Processing complete');
}

async function processActiveOOOPeriods(config: OOOWorkerConfig): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find active OOO periods that started today
  const activeOOO = await prisma.userAvailability.findMany({
    where: {
      startDate: {
        gte: today,
        lt: tomorrow,
      },
      endDate: {
        gte: today,
      },
      autoReassign: true,
      availabilityType: {
        in: ['OutOfOffice', 'Vacation', 'SickLeave'],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firmId: true,
          firstName: true,
          lastName: true,
        },
      },
      delegate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  for (const availability of activeOOO) {
    const processingKey = `${availability.id}-active`;
    if (processedAvailabilities.has(processingKey)) {
      continue;
    }

    try {
      const result = await processUserOOO(availability, config);

      if (result.tasksReassigned.length > 0 && config.sendNotifications) {
        await sendOOONotifications(availability, result);
      }

      processedAvailabilities.add(processingKey);
    } catch (error) {
      console.error(
        `[OOO Worker] Error processing active OOO for user ${availability.userId}:`,
        error
      );
    }
  }
}

async function processUserOOO(
  availability: any,
  config: OOOWorkerConfig
): Promise<OOOReassignmentSummary> {
  const { user, delegate } = availability;

  // Find urgent/high priority tasks assigned to this user during OOO period
  const tasksToReassign = await prisma.task.findMany({
    where: {
      assignedTo: user.id,
      status: {
        in: [TaskStatus.Pending, TaskStatus.InProgress],
      },
      priority: {
        in: config.reassignPriorities,
      },
      dueDate: {
        gte: availability.startDate,
        lte: availability.endDate,
      },
    },
    include: {
      case: {
        select: { title: true },
      },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  });

  if (tasksToReassign.length === 0) {
    return {
      userId: user.id,
      period: { start: availability.startDate, end: availability.endDate },
      tasksReassigned: [],
      tasksSkipped: [],
      delegateTo: delegate?.id || '',
    };
  }

  // Determine delegate
  let delegateId = delegate?.id;

  if (!delegateId) {
    // Find best available delegate
    delegateId = await findBestDelegate(user.id, user.firmId, availability);
  }

  if (!delegateId) {
    // No delegate available - skip all tasks
    return {
      userId: user.id,
      period: { start: availability.startDate, end: availability.endDate },
      tasksReassigned: [],
      tasksSkipped: tasksToReassign.map((t) => ({
        taskId: t.id,
        reason: 'No suitable delegate available',
      })),
      delegateTo: '',
    };
  }

  // Verify delegate is not also OOO
  const delegateOOO = await prisma.userAvailability.findFirst({
    where: {
      userId: delegateId,
      startDate: { lte: availability.endDate },
      endDate: { gte: availability.startDate },
      availabilityType: { in: ['OutOfOffice', 'Vacation', 'SickLeave'] },
    },
  });

  if (delegateOOO) {
    return {
      userId: user.id,
      period: { start: availability.startDate, end: availability.endDate },
      tasksReassigned: [],
      tasksSkipped: tasksToReassign.map((t) => ({
        taskId: t.id,
        reason: 'Delegate is also unavailable during this period',
      })),
      delegateTo: delegateId,
    };
  }

  // Reassign tasks
  const tasksReassigned: any[] = [];
  const tasksSkipped: any[] = [];

  for (const task of tasksToReassign) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: { assignedTo: delegateId },
      });

      tasksReassigned.push({
        taskId: task.id,
        taskTitle: task.title,
        originalAssignee: user.id,
        newAssignee: delegateId,
        reason: `Auto-reassigned due to OOO: ${availability.reason || availability.availabilityType}`,
        success: true,
      });
    } catch (error) {
      tasksSkipped.push({
        taskId: task.id,
        reason: error instanceof Error ? error.message : 'Failed to reassign',
      });
    }
  }

  return {
    userId: user.id,
    period: { start: availability.startDate, end: availability.endDate },
    tasksReassigned,
    tasksSkipped,
    delegateTo: delegateId,
  };
}

async function findBestDelegate(
  userId: string,
  firmId: string,
  availability: any
): Promise<string | null> {
  // Get all active users in the firm except the OOO user
  const candidates = await prisma.user.findMany({
    where: {
      firmId,
      status: 'Active',
      id: { not: userId },
    },
    select: { id: true },
  });

  if (candidates.length === 0) {
    return null;
  }

  // Find candidate with lowest workload who is not OOO
  let bestCandidate: string | null = null;
  let lowestWorkload = Infinity;

  for (const candidate of candidates) {
    // Check if candidate is OOO
    const candidateOOO = await prisma.userAvailability.findFirst({
      where: {
        userId: candidate.id,
        startDate: { lte: availability.endDate },
        endDate: { gte: availability.startDate },
        availabilityType: { in: ['OutOfOffice', 'Vacation', 'SickLeave'] },
      },
    });

    if (candidateOOO) {
      continue;
    }

    // Calculate current workload
    const activeTasks = await prisma.task.findMany({
      where: {
        assignedTo: candidate.id,
        status: { notIn: [TaskStatus.Completed, TaskStatus.Cancelled] },
      },
      select: { estimatedHours: true },
    });

    const workload = activeTasks.reduce(
      (sum, t) => sum + (t.estimatedHours ? Number(t.estimatedHours) : 0),
      0
    );

    if (workload < lowestWorkload) {
      lowestWorkload = workload;
      bestCandidate = candidate.id;
    }
  }

  return bestCandidate;
}

async function sendOOONotifications(
  availability: any,
  result: OOOReassignmentSummary
): Promise<void> {
  const { user, delegate } = availability;

  if (result.tasksReassigned.length === 0) {
    return;
  }

  const taskTitles = result.tasksReassigned
    .slice(0, 3)
    .map((t: any) => t.taskTitle)
    .join(', ');
  const moreCount = result.tasksReassigned.length > 3 ? result.tasksReassigned.length - 3 : 0;

  // Notify the delegate
  if (result.delegateTo) {
    await prisma.notification.create({
      data: {
        userId: result.delegateTo,
        type: NotificationType.DelegationRequested,
        title: 'Tasks Reassigned to You',
        message: `${result.tasksReassigned.length} task(s) have been automatically reassigned to you while ${user.firstName} ${user.lastName} is out of office: ${taskTitles}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
        link: '/tasks',
      },
    });
  }

  // Notify the original assignee
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: NotificationType.DelegationAccepted,
      title: 'Tasks Automatically Reassigned',
      message: `${result.tasksReassigned.length} task(s) were automatically reassigned during your out-of-office period: ${taskTitles}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
      link: '/tasks',
    },
  });
}

// ============================================================================
// Cleanup
// ============================================================================

// Clean up old processed availability IDs
setInterval(
  () => {
    if (processedAvailabilities.size > 1000) {
      processedAvailabilities.clear();
      console.log('[OOO Worker] Cleared processed availabilities cache');
    }
  },
  24 * 60 * 60 * 1000
); // Once per day

// Export for testing
export { processOOOPeriods, processUserOOO, findBestDelegate };
