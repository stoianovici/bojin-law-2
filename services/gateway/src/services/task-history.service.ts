// @ts-nocheck
/**
 * Task History Service
 * Story 4.6: Task Collaboration and Updates (AC: 5)
 *
 * Tracks all task modifications with attribution for audit trail and activity display
 */

import { prisma } from '@legal-platform/database';
import { TaskHistoryAction } from '@prisma/client';

// Local types for task history service
interface TaskHistoryEntry {
  id: string;
  taskId: string;
  actorId: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  actor?: any;
}

interface HistoryDetails {
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

interface HistoryOptions {
  limit?: number;
  actions?: string[];
  since?: Date;
  until?: Date;
}

export class TaskHistoryService {
  /**
   * Record a history entry for a task change
   * @param taskId - ID of the task
   * @param actorId - ID of the user who made the change
   * @param action - Type of action performed
   * @param details - Additional details about the change
   */
  async recordHistory(
    taskId: string,
    actorId: string,
    action: TaskHistoryAction | keyof typeof TaskHistoryAction,
    details?: HistoryDetails
  ): Promise<TaskHistoryEntry> {
    // Convert string to enum if necessary
    const actionEnum =
      typeof action === 'string'
        ? TaskHistoryAction[action as keyof typeof TaskHistoryAction]
        : action;

    const history = await prisma.taskHistory.create({
      data: {
        taskId,
        actorId,
        action: actionEnum,
        field: details?.field,
        oldValue: details?.oldValue,
        newValue: details?.newValue,
        metadata: details?.metadata || undefined,
      },
      include: {
        actor: true,
      },
    });

    return this.mapToTaskHistoryEntry(history);
  }

  /**
   * Get history for a task with optional filtering
   * @param taskId - ID of the task
   * @param options - Filter options
   */
  async getHistory(taskId: string, options?: HistoryOptions): Promise<TaskHistoryEntry[]> {
    const where: any = { taskId };

    // Filter by action types
    if (options?.actions && options.actions.length > 0) {
      where.action = {
        in: options.actions.map((a) => TaskHistoryAction[a as keyof typeof TaskHistoryAction]),
      };
    }

    // Filter by date range
    if (options?.since) {
      where.createdAt = {
        ...where.createdAt,
        gte: options.since,
      };
    }

    if (options?.until) {
      where.createdAt = {
        ...where.createdAt,
        lte: options.until,
      };
    }

    const history = await prisma.taskHistory.findMany({
      where,
      include: {
        actor: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 50,
    });

    return history.map((h) => this.mapToTaskHistoryEntry(h));
  }

  /**
   * Get recent history entries for a task
   * @param taskId - ID of the task
   * @param limit - Maximum number of entries to return
   */
  async getRecentHistory(taskId: string, limit: number = 10): Promise<TaskHistoryEntry[]> {
    return this.getHistory(taskId, { limit });
  }

  /**
   * Record task creation
   */
  async recordTaskCreated(
    taskId: string,
    actorId: string,
    taskTitle: string,
    taskType: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'Created', {
      metadata: {
        title: taskTitle,
        type: taskType,
      },
    });
  }

  /**
   * Record status change with before/after values
   */
  async recordStatusChange(
    taskId: string,
    actorId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'StatusChanged', {
      field: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
    });
  }

  /**
   * Record assignee change
   */
  async recordAssigneeChange(
    taskId: string,
    actorId: string,
    oldAssigneeId: string | null,
    newAssigneeId: string,
    oldAssigneeName?: string,
    newAssigneeName?: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'AssigneeChanged', {
      field: 'assignedTo',
      oldValue: oldAssigneeId || undefined,
      newValue: newAssigneeId,
      metadata: {
        oldAssigneeName,
        newAssigneeName,
      },
    });
  }

  /**
   * Record priority change
   */
  async recordPriorityChange(
    taskId: string,
    actorId: string,
    oldPriority: string,
    newPriority: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'PriorityChanged', {
      field: 'priority',
      oldValue: oldPriority,
      newValue: newPriority,
    });
  }

  /**
   * Record due date change
   */
  async recordDueDateChange(
    taskId: string,
    actorId: string,
    oldDueDate: Date | null,
    newDueDate: Date
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'DueDateChanged', {
      field: 'dueDate',
      oldValue: oldDueDate?.toISOString(),
      newValue: newDueDate.toISOString(),
    });
  }

  /**
   * Record subtask creation
   */
  async recordSubtaskCreated(
    parentTaskId: string,
    actorId: string,
    subtaskId: string,
    subtaskTitle: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(parentTaskId, actorId, 'SubtaskCreated', {
      metadata: {
        subtaskId,
        subtaskTitle,
      },
    });
  }

  /**
   * Record subtask completion
   */
  async recordSubtaskCompleted(
    parentTaskId: string,
    actorId: string,
    subtaskId: string,
    subtaskTitle: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(parentTaskId, actorId, 'SubtaskCompleted', {
      metadata: {
        subtaskId,
        subtaskTitle,
      },
    });
  }

  /**
   * Record dependency added
   */
  async recordDependencyAdded(
    taskId: string,
    actorId: string,
    predecessorTaskId: string,
    predecessorTitle: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'DependencyAdded', {
      metadata: {
        predecessorTaskId,
        predecessorTitle,
      },
    });
  }

  /**
   * Record dependency removed
   */
  async recordDependencyRemoved(
    taskId: string,
    actorId: string,
    predecessorTaskId: string,
    predecessorTitle: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'DependencyRemoved', {
      metadata: {
        predecessorTaskId,
        predecessorTitle,
      },
    });
  }

  /**
   * Record task delegation
   */
  async recordDelegated(
    taskId: string,
    actorId: string,
    delegateId: string,
    delegateName: string
  ): Promise<TaskHistoryEntry> {
    return this.recordHistory(taskId, actorId, 'Delegated', {
      metadata: {
        delegateId,
        delegateName,
      },
    });
  }

  /**
   * Map Prisma result to TaskHistoryEntry type
   */
  private mapToTaskHistoryEntry(history: any): TaskHistoryEntry {
    return {
      id: history.id,
      taskId: history.taskId,
      actorId: history.actorId,
      action: history.action as TaskHistoryEntry['action'],
      field: history.field || undefined,
      oldValue: history.oldValue || undefined,
      newValue: history.newValue || undefined,
      metadata: history.metadata || undefined,
      createdAt: history.createdAt,
      actor: history.actor
        ? {
            id: history.actor.id,
            email: history.actor.email,
            firstName: history.actor.firstName,
            lastName: history.actor.lastName,
            role: history.actor.role,
            status: history.actor.status,
            firmId: history.actor.firmId,
            azureAdId: history.actor.azureAdId,
            preferences: history.actor.preferences || {},
            createdAt: history.actor.createdAt,
            lastActive: history.actor.lastActive,
          }
        : undefined,
    };
  }
}

// Export singleton instance
export const taskHistoryService = new TaskHistoryService();
