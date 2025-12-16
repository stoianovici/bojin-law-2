// @ts-nocheck
/**
 * Subtask Service
 * Story 4.6: Task Collaboration and Updates (AC: 4)
 *
 * Handles creation and management of subtasks with parent task context propagation
 */

import { prisma } from '@legal-platform/database';
import { NotificationType } from '@prisma/client';
import { taskHistoryService } from './task-history.service';
import { caseActivityService } from './case-activity.service';

// Local types for subtask service
interface Task {
  id: string;
  caseId: string;
  firmId: string;
  type: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: Date;
  dueTime?: string;
  status: string;
  priority: string;
  estimatedHours?: number;
  metadata: Record<string, unknown>;
  typeMetadata?: Record<string, unknown>;
  parentTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface CreateSubtaskInput {
  parentTaskId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
}

interface SubtaskWithContext {
  subtask: Task;
  parentTask: ParentTaskContext;
}

interface ParentTaskContext {
  id: string;
  title: string;
  caseId: string;
  caseTitle: string;
  type: string;
}

export class SubtaskService {
  /**
   * Create a subtask under a parent task
   * Inherits case, firm, and type from parent task
   * @param input - Subtask input data
   * @param userId - ID of the user creating the subtask
   * @param firmId - Firm ID for access control
   */
  async createSubtask(
    input: CreateSubtaskInput,
    userId: string,
    firmId: string
  ): Promise<SubtaskWithContext> {
    // Get parent task
    const parentTask = await prisma.task.findFirst({
      where: {
        id: input.parentTaskId,
        firmId,
      },
      include: {
        case: true,
        assignee: true,
      },
    });

    if (!parentTask) {
      throw new Error('Parent task not found or access denied');
    }

    // Create subtask inheriting from parent
    const subtask = await prisma.task.create({
      data: {
        caseId: parentTask.caseId,
        firmId: parentTask.firmId,
        type: parentTask.type, // Inherit type from parent
        title: input.title,
        description: input.description || '',
        assignedTo: input.assignedTo || parentTask.assignedTo, // Default to parent assignee
        dueDate: input.dueDate ? new Date(input.dueDate) : parentTask.dueDate,
        status: 'Pending',
        priority: input.priority || parentTask.priority,
        estimatedHours: input.estimatedHours,
        parentTaskId: input.parentTaskId,
        metadata: {},
      },
      include: {
        assignee: true,
        case: true,
      },
    });

    // Get creator name for notifications
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown';

    // Record in parent task history
    await taskHistoryService.recordSubtaskCreated(
      input.parentTaskId,
      userId,
      subtask.id,
      subtask.title
    );

    // Also record creation in subtask's own history
    await taskHistoryService.recordTaskCreated(subtask.id, userId, subtask.title, subtask.type);

    // Post to case activity feed
    await caseActivityService.recordTaskCreated(
      subtask.caseId,
      userId,
      subtask.id,
      subtask.title,
      `Subtask of ${parentTask.title}`
    );

    // Notify parent task assignee if different from creator
    if (parentTask.assignedTo !== userId) {
      await this.notifySubtaskCreated(parentTask.assignedTo, {
        parentTaskId: parentTask.id,
        parentTaskTitle: parentTask.title,
        subtaskId: subtask.id,
        subtaskTitle: subtask.title,
        caseId: parentTask.caseId,
        caseTitle: parentTask.case.title,
        creatorId: userId,
        creatorName,
      });
    }

    // Notify subtask assignee if different from parent assignee and creator
    if (subtask.assignedTo !== parentTask.assignedTo && subtask.assignedTo !== userId) {
      await this.notifySubtaskAssigned(subtask.assignedTo, {
        parentTaskId: parentTask.id,
        parentTaskTitle: parentTask.title,
        subtaskId: subtask.id,
        subtaskTitle: subtask.title,
        caseId: parentTask.caseId,
        caseTitle: parentTask.case.title,
        creatorId: userId,
        creatorName,
      });
    }

    return {
      subtask: this.mapToTask(subtask),
      parentTask: {
        id: parentTask.id,
        title: parentTask.title,
        caseId: parentTask.caseId,
        caseTitle: parentTask.case.title,
        type: parentTask.type,
      },
    };
  }

  /**
   * Get all subtasks for a parent task
   * @param parentTaskId - ID of the parent task
   * @param firmId - Firm ID for access control
   */
  async getSubtasks(parentTaskId: string, firmId: string): Promise<Task[]> {
    // Verify parent task belongs to firm
    const parentTask = await prisma.task.findFirst({
      where: {
        id: parentTaskId,
        firmId,
      },
    });

    if (!parentTask) {
      throw new Error('Parent task not found or access denied');
    }

    const subtasks = await prisma.task.findMany({
      where: {
        parentTaskId,
      },
      include: {
        assignee: true,
        case: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return subtasks.map((s) => this.mapToTask(s));
  }

  /**
   * Complete a subtask
   * Records completion in both subtask and parent task history
   * @param subtaskId - ID of the subtask to complete
   * @param userId - ID of the user completing
   * @param firmId - Firm ID for access control
   */
  async completeSubtask(subtaskId: string, userId: string, firmId: string): Promise<Task> {
    // Get subtask with parent
    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        firmId,
        parentTaskId: { not: null },
      },
      include: {
        parent: {
          include: {
            case: true,
          },
        },
        case: true,
      },
    });

    if (!subtask) {
      throw new Error('Subtask not found or access denied');
    }

    if (!subtask.parent) {
      throw new Error('Task is not a subtask');
    }

    // Update subtask status
    const updatedSubtask = await prisma.task.update({
      where: { id: subtaskId },
      data: {
        status: 'Completed',
        completedAt: new Date(),
      },
      include: {
        assignee: true,
        case: true,
      },
    });

    // Record in subtask history
    await taskHistoryService.recordStatusChange(subtaskId, userId, subtask.status, 'Completed');

    // Record in parent task history
    await taskHistoryService.recordSubtaskCompleted(
      subtask.parentTaskId!,
      userId,
      subtaskId,
      subtask.title
    );

    // Post to case activity feed
    await caseActivityService.recordTaskCompleted(subtask.caseId, userId, subtaskId, subtask.title);

    return this.mapToTask(updatedSubtask);
  }

  /**
   * Get subtask progress for a parent task
   * Returns count of completed vs total subtasks
   * @param parentTaskId - ID of the parent task
   */
  async getSubtaskProgress(
    parentTaskId: string
  ): Promise<{ total: number; completed: number; percentage: number }> {
    const subtasks = await prisma.task.findMany({
      where: {
        parentTaskId,
      },
      select: {
        status: true,
      },
    });

    const total = subtasks.length;
    const completed = subtasks.filter((s) => s.status === 'Completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, percentage };
  }

  /**
   * Check if all subtasks are completed
   * @param parentTaskId - ID of the parent task
   */
  async areAllSubtasksComplete(parentTaskId: string): Promise<boolean> {
    const progress = await this.getSubtaskProgress(parentTaskId);
    return progress.total > 0 && progress.completed === progress.total;
  }

  /**
   * Notify parent task assignee that a subtask was created
   */
  private async notifySubtaskCreated(
    userId: string,
    context: {
      parentTaskId: string;
      parentTaskTitle: string;
      subtaskId: string;
      subtaskTitle: string;
      caseId: string;
      caseTitle: string;
      creatorId: string;
      creatorName: string;
    }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SubtaskCreated,
        title: 'New Subtask Created',
        message: `${context.creatorName} added subtask "${context.subtaskTitle}" to "${context.parentTaskTitle}"`,
        link: `/tasks/${context.parentTaskId}#subtask-${context.subtaskId}`,
        caseId: context.caseId,
        taskId: context.parentTaskId,
      },
    });
  }

  /**
   * Notify subtask assignee that they were assigned
   */
  private async notifySubtaskAssigned(
    userId: string,
    context: {
      parentTaskId: string;
      parentTaskTitle: string;
      subtaskId: string;
      subtaskTitle: string;
      caseId: string;
      caseTitle: string;
      creatorId: string;
      creatorName: string;
    }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TaskAssigned,
        title: 'Subtask Assigned to You',
        message: `${context.creatorName} assigned you subtask "${context.subtaskTitle}"`,
        link: `/tasks/${context.subtaskId}`,
        caseId: context.caseId,
        taskId: context.subtaskId,
      },
    });
  }

  /**
   * Map Prisma result to Task type
   */
  private mapToTask(task: any): Task {
    return {
      id: task.id,
      caseId: task.caseId,
      firmId: task.firmId,
      type: task.type,
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      dueTime: task.dueTime || undefined,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimatedHours || undefined,
      metadata: task.metadata || {},
      typeMetadata: task.typeMetadata || undefined,
      parentTaskId: task.parentTaskId || undefined,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt || undefined,
    };
  }
}

// Export singleton instance
export const subtaskService = new SubtaskService();
