/**
 * OOO Auto-Reassignment Service
 * Story 4.5: Team Workload Management
 *
 * Handles automatic task reassignment when users are out-of-office
 * AC: 5 - Out-of-office automatically reassigns urgent tasks
 *
 * Business Logic:
 * - Only reassign tasks with priority Urgent or High
 * - Only reassign tasks with dueDate during OOO period
 * - Prefer user-specified delegate
 * - Fall back to AI-suggested delegate
 * - Never reassign to another OOO user
 */

import { PrismaClient as PrismaClientType, TaskStatus, TaskPriority } from '@prisma/client';
import type {
  OOOReassignmentSummary,
  ReassignmentResult,
  WorkloadDateRange,
} from '@legal-platform/types';
import { WorkloadService } from './workload.service';

/**
 * OOO Reassignment Service
 * Handles automatic task reassignment for OOO users
 */
export class OOOReassignmentService {
  private prisma: PrismaClientType;
  private workloadService: WorkloadService;

  /**
   * Create OOOReassignmentService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   * @param workloadSvc - Optional WorkloadService instance (for testing)
   */
  constructor(prismaClient?: PrismaClientType, workloadSvc?: WorkloadService) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
    this.workloadService = workloadSvc || new WorkloadService(prismaClient);
  }

  /**
   * Process OOO reassignments for a user's availability period
   * AC: 5 - Out-of-office automatically reassigns urgent tasks
   *
   * @param userId - User who is OOO
   * @param availabilityId - Availability record ID
   * @returns Reassignment summary
   */
  async processOOOReassignments(
    userId: string,
    availabilityId: string
  ): Promise<OOOReassignmentSummary> {
    // Get availability record
    const availability = await this.prisma.userAvailability.findUnique({
      where: { id: availabilityId },
      include: {
        user: {
          select: { id: true, firmId: true },
        },
      },
    });

    if (!availability) {
      throw new Error('Availability not found');
    }

    if (availability.userId !== userId) {
      throw new Error('Availability does not belong to this user');
    }

    // Check if auto-reassign is enabled
    if (!availability.autoReassign) {
      return {
        userId,
        period: { start: availability.startDate, end: availability.endDate },
        tasksReassigned: [],
        tasksSkipped: [],
        delegateTo: '',
      };
    }

    const dateRange: WorkloadDateRange = {
      start: availability.startDate,
      end: availability.endDate,
    };

    // Get urgent tasks for reassignment
    const urgentTasks = await this.getUrgentTasksForReassignment(userId, dateRange);

    const tasksReassigned: ReassignmentResult[] = [];
    const tasksSkipped: { taskId: string; reason: string }[] = [];

    // Determine delegate
    let delegateId: string | null = availability.delegateTo;

    // If no delegate specified, find the best one
    if (!delegateId) {
      delegateId = await this.selectBestDelegate(
        userId,
        urgentTasks[0] || null,
        availability.user.firmId!
      );
    }

    if (!delegateId) {
      // No suitable delegate found
      for (const task of urgentTasks) {
        tasksSkipped.push({
          taskId: task.id,
          reason: 'No suitable delegate available',
        });
      }

      return {
        userId,
        period: { start: availability.startDate, end: availability.endDate },
        tasksReassigned: [],
        tasksSkipped,
        delegateTo: '',
      };
    }

    // Verify delegate is not OOO
    const delegateAvailability = await this.prisma.userAvailability.findFirst({
      where: {
        userId: delegateId,
        startDate: { lte: availability.endDate },
        endDate: { gte: availability.startDate },
        availabilityType: { in: ['OutOfOffice', 'Vacation', 'SickLeave'] },
      },
    });

    if (delegateAvailability) {
      for (const task of urgentTasks) {
        tasksSkipped.push({
          taskId: task.id,
          reason: 'Delegate is also unavailable during this period',
        });
      }

      return {
        userId,
        period: { start: availability.startDate, end: availability.endDate },
        tasksReassigned: [],
        tasksSkipped,
        delegateTo: delegateId,
      };
    }

    // Reassign each urgent task
    for (const task of urgentTasks) {
      const result = await this.reassignTask(
        task.id,
        delegateId,
        `Auto-reassigned due to OOO: ${availability.reason || availability.availabilityType}`
      );
      tasksReassigned.push(result);
    }

    // Send notifications
    await this.sendReassignmentNotifications(userId, delegateId, tasksReassigned);

    return {
      userId,
      period: { start: availability.startDate, end: availability.endDate },
      tasksReassigned,
      tasksSkipped,
      delegateTo: delegateId,
    };
  }

  /**
   * Get urgent tasks that need reassignment
   *
   * @param userId - User who is OOO
   * @param dateRange - OOO period
   * @returns Array of tasks to reassign
   */
  async getUrgentTasksForReassignment(
    userId: string,
    dateRange: WorkloadDateRange
  ): Promise<any[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedTo: userId,
        status: { in: [TaskStatus.Pending, TaskStatus.InProgress] },
        priority: { in: [TaskPriority.Urgent, TaskPriority.High] },
        dueDate: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        caseId: true,
        case: {
          select: { title: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    return tasks;
  }

  /**
   * Reassign a task to a new assignee
   *
   * @param taskId - Task ID
   * @param newAssigneeId - New assignee user ID
   * @param reason - Reason for reassignment
   * @returns Reassignment result
   */
  async reassignTask(
    taskId: string,
    newAssigneeId: string,
    reason: string
  ): Promise<ReassignmentResult> {
    try {
      // Get task with current assignee
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!task) {
        return {
          taskId,
          taskTitle: 'Unknown',
          originalAssignee: '',
          newAssignee: newAssigneeId,
          reason,
          success: false,
          error: 'Task not found',
        };
      }

      // Update task assignment
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          assignedTo: newAssigneeId,
        },
      });

      return {
        taskId,
        taskTitle: task.title,
        originalAssignee: task.assignedTo,
        newAssignee: newAssigneeId,
        reason,
        success: true,
      };
    } catch (error) {
      return {
        taskId,
        taskTitle: 'Unknown',
        originalAssignee: '',
        newAssignee: newAssigneeId,
        reason,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Select the best delegate for task reassignment
   * Uses workload-based selection
   *
   * @param originalUserId - Original task owner
   * @param task - Task being reassigned (for skill matching)
   * @param firmId - Firm ID
   * @returns Best delegate user ID or null
   */
  async selectBestDelegate(
    originalUserId: string,
    task: any | null,
    firmId: string
  ): Promise<string | null> {
    // Get all active users in the firm except the original user
    const candidates = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        id: { not: originalUserId },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (candidates.length === 0) {
      return null;
    }

    // Score each candidate by available capacity
    const scoredCandidates: { userId: string; score: number }[] = [];

    for (const candidate of candidates) {
      // Check if candidate is OOO
      const today = new Date();
      const isOOO = await this.prisma.userAvailability.findFirst({
        where: {
          userId: candidate.id,
          startDate: { lte: today },
          endDate: { gte: today },
          availabilityType: { in: ['OutOfOffice', 'Vacation', 'SickLeave'] },
        },
      });

      if (isOOO) {
        continue; // Skip OOO users
      }

      // Get current workload
      const workload = await this.workloadService.getCurrentWorkload(candidate.id);

      // Simple scoring: lower workload = higher score
      const score = Math.max(0, 100 - workload);
      scoredCandidates.push({ userId: candidate.id, score });
    }

    if (scoredCandidates.length === 0) {
      return null;
    }

    // Sort by score descending and return top candidate
    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates[0].userId;
  }

  /**
   * Send notifications for reassigned tasks
   *
   * @param originalUserId - Original task owner
   * @param delegateId - New task owner
   * @param results - Reassignment results
   */
  private async sendReassignmentNotifications(
    originalUserId: string,
    delegateId: string,
    results: ReassignmentResult[]
  ): Promise<void> {
    const successfulReassignments = results.filter((r) => r.success);

    if (successfulReassignments.length === 0) {
      return;
    }

    // Notify delegate
    const taskTitles = successfulReassignments.map((r) => r.taskTitle).join(', ');

    await this.prisma.notification.create({
      data: {
        userId: delegateId,
        type: 'DelegationRequested',
        title: 'Tasks reassigned to you',
        message: `${successfulReassignments.length} task(s) have been reassigned to you due to colleague OOO: ${taskTitles}`,
        link: '/tasks',
      },
    });

    // Notify original user
    await this.prisma.notification.create({
      data: {
        userId: originalUserId,
        type: 'DelegationAccepted',
        title: 'Tasks automatically reassigned',
        message: `${successfulReassignments.length} task(s) were automatically reassigned while you are out of office`,
        link: '/tasks',
      },
    });
  }
}

// Export singleton instance
export const oooReassignmentService = new OOOReassignmentService();
