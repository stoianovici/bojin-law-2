/**
 * Task Warning Service
 * Generates warnings for task scheduling without blocking actions
 *
 * Checks:
 * - Daily capacity exceeded (9h limit, 09:00-18:00)
 * - Conflicts with other tasks/events
 * - Task scheduled past due date (info only)
 */

import { prisma } from '@legal-platform/database';
import { TaskStatus } from '@prisma/client';

// ============================================================================
// Constants
// ============================================================================

export const BUSINESS_HOURS_START = '09:00';
export const BUSINESS_HOURS_END = '18:00';
export const DAILY_CAPACITY_HOURS = 9;
const DEFAULT_TASK_HOURS = 1;

// ============================================================================
// Types
// ============================================================================

interface ScheduleWarningParams {
  taskId: string;
  scheduledDate: Date;
  scheduledStartTime: string;
  assigneeId: string;
  firmId: string;
}

// ============================================================================
// TaskWarningService Class
// ============================================================================

export class TaskWarningService {
  /**
   * Generate warnings for a task being scheduled
   * Does not block the action, just returns informational warnings
   */
  async getScheduleWarnings(params: ScheduleWarningParams): Promise<string[]> {
    const warnings: string[] = [];

    const { taskId, scheduledDate, scheduledStartTime, assigneeId, firmId } = params;

    // Get the task being scheduled
    const task = await prisma.task.findFirst({
      where: { id: taskId, firmId },
      select: {
        id: true,
        title: true,
        dueDate: true,
        estimatedHours: true,
      },
    });

    if (!task) {
      return warnings;
    }

    const taskDuration = task.estimatedHours ? Number(task.estimatedHours) : DEFAULT_TASK_HOURS;

    // Check 1: Capacity exceeded
    const capacityWarning = await this.checkCapacityWarning(
      scheduledDate,
      taskDuration,
      taskId,
      assigneeId,
      firmId
    );
    if (capacityWarning) {
      warnings.push(capacityWarning);
    }

    // Check 2: Conflicts with other tasks
    const conflictWarnings = await this.checkConflictWarnings(
      scheduledDate,
      scheduledStartTime,
      taskDuration,
      taskId,
      assigneeId,
      firmId
    );
    warnings.push(...conflictWarnings);

    // Check 3: Past due date
    const dueDateWarning = this.checkDueDateWarning(scheduledDate, task.dueDate);
    if (dueDateWarning) {
      warnings.push(dueDateWarning);
    }

    return warnings;
  }

  /**
   * Check if scheduling this task would exceed daily capacity
   */
  private async checkCapacityWarning(
    scheduledDate: Date,
    taskDuration: number,
    excludeTaskId: string,
    assigneeId: string,
    firmId: string
  ): Promise<string | null> {
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all scheduled tasks for the day (excluding the one being moved)
    const scheduledTasks = await prisma.task.findMany({
      where: {
        firmId,
        assignedTo: assigneeId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        id: { not: excludeTaskId },
        status: { notIn: [TaskStatus.Completed, TaskStatus.Cancelled] },
      },
      select: {
        estimatedHours: true,
      },
    });

    const existingHours = scheduledTasks.reduce((sum, t) => {
      return sum + (t.estimatedHours ? Number(t.estimatedHours) : DEFAULT_TASK_HOURS);
    }, 0);

    const totalHours = existingHours + taskDuration;

    if (totalHours > DAILY_CAPACITY_HOURS) {
      return `Capacitatea zilei depășită (${totalHours.toFixed(1)} ore programate din ${DAILY_CAPACITY_HOURS} ore disponibile)`;
    }

    return null;
  }

  /**
   * Check for conflicts with other tasks/events at the same time
   */
  private async checkConflictWarnings(
    scheduledDate: Date,
    scheduledStartTime: string,
    taskDuration: number,
    excludeTaskId: string,
    assigneeId: string,
    firmId: string
  ): Promise<string[]> {
    const warnings: string[] = [];

    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get the end time of the task being scheduled
    const taskEndTime = this.addHoursToTime(scheduledStartTime, taskDuration);

    // Get all tasks with scheduled times for the day
    const scheduledTasks = await prisma.task.findMany({
      where: {
        firmId,
        assignedTo: assigneeId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        scheduledStartTime: { not: null },
        id: { not: excludeTaskId },
        status: { notIn: [TaskStatus.Completed, TaskStatus.Cancelled] },
      },
      select: {
        id: true,
        title: true,
        scheduledStartTime: true,
        estimatedHours: true,
      },
    });

    for (const otherTask of scheduledTasks) {
      if (!otherTask.scheduledStartTime) continue;

      const otherDuration = otherTask.estimatedHours
        ? Number(otherTask.estimatedHours)
        : DEFAULT_TASK_HOURS;
      const otherEndTime = this.addHoursToTime(otherTask.scheduledStartTime, otherDuration);

      if (this.timeRangesOverlap(scheduledStartTime, taskEndTime, otherTask.scheduledStartTime, otherEndTime)) {
        warnings.push(`Suprapunere cu: ${otherTask.title} la ${otherTask.scheduledStartTime}`);
      }
    }

    return warnings;
  }

  /**
   * Check if task is being scheduled after its due date
   */
  private checkDueDateWarning(scheduledDate: Date, dueDate: Date | null): string | null {
    if (!dueDate) return null;

    const schedNormalized = new Date(scheduledDate);
    schedNormalized.setHours(0, 0, 0, 0);

    const dueNormalized = new Date(dueDate);
    dueNormalized.setHours(0, 0, 0, 0);

    if (schedNormalized > dueNormalized) {
      return 'Sarcina este programată după termenul limită';
    }

    return null;
  }

  /**
   * Check if two time ranges overlap
   */
  private timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    return s1 < e2 && s2 < e1;
  }

  /**
   * Add hours to a time string
   */
  private addHoursToTime(time: string, hours: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + Math.round(hours * 60);
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${String(Math.min(newHours, 23)).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  }
}

// Export singleton instance
export const taskWarningService = new TaskWarningService();
