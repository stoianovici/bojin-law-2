/**
 * Task Service
 * Story 4.2: Task Type System Implementation
 * Story 4.4: Task Dependencies and Automation (dependency automation integration)
 *
 * Handles task CRUD operations with type-specific validation and firm isolation
 */

import { prisma } from '@legal-platform/database';
import { Task as PrismaTask, TaskStatus, TaskPriority, TaskTypeEnum, Prisma } from '@prisma/client';
import { validateTaskByType, CreateTaskInput } from './task-validation.service';
import * as DependencyAutomationService from './dependency-automation.service';
import { caseSummaryService } from './case-summary.service';
import { caseBriefingService } from './case-briefing.service';
import { activityEventService } from './activity-event.service';
import { activityEmitter } from './activity-emitter.service';

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: Date;
  dueTime?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedHours?: number;
  typeMetadata?: Record<string, unknown>;
}

export interface TaskFilters {
  types?: TaskTypeEnum[];
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  assignedTo?: string[];
  caseId?: string;
  clientId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  searchQuery?: string;
}

export class TaskService {
  /**
   * Create a new task with type-specific validation
   * Auto-generates subtasks for CourtDate tasks
   */
  async createTask(input: CreateTaskInput, userId: string): Promise<PrismaTask> {
    // Validate task using type-specific rules
    const validation = validateTaskByType(input);
    if (!validation.valid) {
      throw new Error(
        `Task validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Get user's firmId and name for firm isolation and activity tracking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, firstName: true, lastName: true, email: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm to create tasks');
    }

    // Verify case belongs to user's firm (if provided)
    if (input.caseId) {
      const caseRecord = await prisma.case.findFirst({
        where: {
          id: input.caseId,
          firmId: user.firmId,
        },
      });

      if (!caseRecord) {
        throw new Error('Case not found or access denied');
      }
    }

    // Verify client belongs to user's firm (if provided)
    if (input.clientId) {
      const clientRecord = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          firmId: user.firmId,
        },
      });

      if (!clientRecord) {
        throw new Error('Client not found or access denied');
      }
    }

    // Verify assignee belongs to same firm
    const assignee = await prisma.user.findFirst({
      where: {
        id: input.assignedTo,
        firmId: user.firmId,
      },
    });

    if (!assignee) {
      throw new Error('Assignee not found or does not belong to your firm');
    }

    // Create task with scheduledDate = dueDate (appears on calendar day without time slot)
    const task = await prisma.task.create({
      data: {
        firmId: user.firmId,
        caseId: input.caseId || null,
        clientId: input.clientId || null,
        type: input.type as TaskTypeEnum,
        title: input.title,
        description: input.description || null,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
        dueTime: input.dueTime || null,
        priority: (input.priority as TaskPriority) || TaskPriority.Medium,
        estimatedHours: input.estimatedHours || null,
        typeMetadata: (input.typeMetadata ?? null) as Prisma.InputJsonValue,
        parentTaskId: input.parentTaskId || null,
        createdBy: userId,
        scheduledDate: input.dueDate, // Task appears on its due date in calendar
        scheduledStartTime: null, // No time slot until user manually schedules
      },
    });

    // OPS-047: Mark summary stale (only if case-linked)
    if (input.caseId) {
      caseSummaryService.markSummaryStale(input.caseId).catch(() => {});
      // OPS-118: Invalidate case briefing cache
      caseBriefingService.invalidate(input.caseId).catch(() => {});
    }

    // OPS-116: Emit task assigned event (only if assigned to someone other than creator)
    if (input.assignedTo && input.assignedTo !== userId) {
      activityEventService
        .emit({
          userId: input.assignedTo,
          firmId: user.firmId,
          eventType: 'TASK_ASSIGNED',
          entityType: 'TASK',
          entityId: task.id,
          entityTitle: task.title,
          metadata: {
            assignedBy: userId,
            caseId: input.caseId,
            dueDate: input.dueDate?.toISOString(),
            priority: input.priority,
          },
        })
        .catch((err) => console.error('[TaskService] Failed to emit task assigned event:', err));
    }

    // Emit activity to team chat (fire and forget)
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    activityEmitter
      .emitTaskCreated(user.firmId, userName, {
        id: task.id,
        title: task.title,
      })
      .catch((err) => console.error('[ActivityEmitter] Task create event failed:', err));

    return task;
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, input: UpdateTaskInput, userId: string): Promise<PrismaTask> {
    // Get user's firmId and name for firm isolation and activity tracking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, firstName: true, lastName: true, email: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify task belongs to user's firm
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId: user.firmId,
      },
    });

    if (!existingTask) {
      throw new Error('Task not found or access denied');
    }

    // If assignee is being changed, verify they belong to same firm
    if (input.assignedTo) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: input.assignedTo,
          firmId: user.firmId,
        },
      });

      if (!assignee) {
        throw new Error('Assignee not found or does not belong to your firm');
      }
    }

    // Validate actual time logged when completing task
    if (input.status === 'Completed' && existingTask.status !== 'Completed') {
      const loggedTime = await prisma.timeEntry.aggregate({
        where: { taskId },
        _sum: { hours: true },
      });

      if (!loggedTime._sum.hours || loggedTime._sum.hours.equals(0)) {
        throw new Error('ACTUAL_TIME_REQUIRED');
      }
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        status: input.status,
        priority: input.priority,
        estimatedHours: input.estimatedHours,
        typeMetadata: (input.typeMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // OPS-047 & OPS-118: Invalidate case context caches
    if (existingTask.caseId) {
      caseSummaryService.markSummaryStale(existingTask.caseId).catch(() => {});
      caseBriefingService.invalidate(existingTask.caseId).catch(() => {});
    }

    // OPS-116: Emit events for significant changes
    // Task reassigned to different person
    if (
      input.assignedTo &&
      input.assignedTo !== existingTask.assignedTo &&
      input.assignedTo !== userId
    ) {
      activityEventService
        .emit({
          userId: input.assignedTo,
          firmId: user.firmId,
          eventType: 'TASK_ASSIGNED',
          entityType: 'TASK',
          entityId: updatedTask.id,
          entityTitle: updatedTask.title,
          metadata: {
            assignedBy: userId,
            caseId: updatedTask.caseId,
            dueDate: updatedTask.dueDate?.toISOString(),
            priority: updatedTask.priority,
            wasReassigned: true,
          },
        })
        .catch((err) => console.error('[TaskService] Failed to emit task reassigned event:', err));
    }

    // Task completed
    if (
      input.status === 'Completed' &&
      existingTask.status !== 'Completed' &&
      existingTask.assignedTo
    ) {
      activityEventService
        .emit({
          userId: existingTask.assignedTo,
          firmId: user.firmId,
          eventType: 'TASK_COMPLETED',
          entityType: 'TASK',
          entityId: updatedTask.id,
          entityTitle: updatedTask.title,
          metadata: {
            completedBy: userId,
            caseId: updatedTask.caseId,
          },
        })
        .catch((err) => console.error('[TaskService] Failed to emit task completed event:', err));

      // Emit activity to team chat (fire and forget)
      const completedUserName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
      activityEmitter
        .emitTaskCompleted(user.firmId, completedUserName, {
          id: updatedTask.id,
          title: updatedTask.title,
        })
        .catch((err) => console.error('[ActivityEmitter] Task complete event failed:', err));
    }

    // If dueDate changed and task hasn't been placed on calendar yet, update scheduledDate to match
    if (
      input.dueDate &&
      !existingTask.scheduledStartTime &&
      input.dueDate.getTime() !== existingTask.dueDate?.getTime()
    ) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          scheduledDate: input.dueDate,
        },
      });
    }

    return updatedTask;
  }

  /**
   * Get a single task by ID with firm isolation
   */
  async getTaskById(taskId: string, firmId: string): Promise<PrismaTask | null> {
    return await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId,
      },
      include: {
        assignee: true,
        creator: true,
        case: true,
        subtasks: true,
        parentTask: true,
        attendees: true,
        documentLinks: {
          include: {
            document: true,
          },
        },
        delegationsSource: {
          include: {
            delegate: true,
          },
        },
      },
    });
  }

  /**
   * Get all tasks for a case with optional filters
   */
  async getTasksByCase(
    caseId: string,
    firmId: string,
    filters?: TaskFilters
  ): Promise<PrismaTask[]> {
    return await prisma.task.findMany({
      where: {
        caseId,
        firmId,
        ...this.buildFilterWhere(filters),
      },
      include: {
        assignee: true,
        creator: true,
        subtasks: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Get all tasks for a client with optional filters
   */
  async getTasksByClient(
    clientId: string,
    firmId: string,
    filters?: TaskFilters
  ): Promise<PrismaTask[]> {
    return await prisma.task.findMany({
      where: {
        clientId,
        firmId,
        ...this.buildFilterWhere(filters),
      },
      include: {
        assignee: true,
        creator: true,
        case: true,
        subtasks: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Get all tasks assigned to a user with optional filters
   */
  async getTasksByAssignee(
    userId: string,
    firmId: string,
    filters?: TaskFilters
  ): Promise<PrismaTask[]> {
    return await prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        ...this.buildFilterWhere(filters),
      },
      include: {
        case: true,
        creator: true,
        subtasks: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Complete a task (sets status to Completed and completedAt timestamp)
   */
  async completeTask(taskId: string, userId: string): Promise<PrismaTask> {
    // Get user's firmId and name for firm isolation and activity tracking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, firstName: true, lastName: true, email: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify task belongs to user's firm
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId: user.firmId,
      },
    });

    if (!existingTask) {
      throw new Error('Task not found or access denied');
    }

    // Validate that actual time has been logged before completion
    const loggedTime = await prisma.timeEntry.aggregate({
      where: { taskId },
      _sum: { hours: true },
    });

    if (!loggedTime._sum.hours || loggedTime._sum.hours.equals(0)) {
      throw new Error('ACTUAL_TIME_REQUIRED');
    }

    // Update task to completed (using transaction to ensure consistency)
    const completedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.Completed,
        completedAt: new Date(),
      },
    });

    // Story 4.4: Trigger dependency automation to activate successor tasks
    try {
      await DependencyAutomationService.onTaskCompleted(taskId, user.firmId);
    } catch (error) {
      // Log error but don't fail the task completion
      console.error(`Failed to activate successor tasks for ${taskId}:`, error);
    }

    // OPS-047: Mark summary stale
    caseSummaryService.markSummaryStale(existingTask.caseId).catch(() => {});

    // Emit activity to team chat (fire and forget)
    const completedUserName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    activityEmitter
      .emitTaskCompleted(user.firmId, completedUserName, {
        id: completedTask.id,
        title: completedTask.title,
      })
      .catch((err) => console.error('[ActivityEmitter] Task complete event failed:', err));

    return completedTask;
  }

  /**
   * Cancel a task with optional reason
   */
  async cancelTask(taskId: string, userId: string, reason?: string): Promise<PrismaTask> {
    // Get user's firmId for firm isolation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify task belongs to user's firm
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId: user.firmId,
      },
    });

    if (!existingTask) {
      throw new Error('Task not found or access denied');
    }

    // Update task to cancelled
    // Store cancellation reason in typeMetadata if provided
    const updatedMetadata = existingTask.typeMetadata
      ? { ...(existingTask.typeMetadata as Record<string, unknown>), cancellationReason: reason }
      : { cancellationReason: reason };

    return await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.Cancelled,
        typeMetadata: (reason
          ? updatedMetadata
          : existingTask.typeMetadata) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Delete a task (soft delete by setting status to Cancelled)
   */
  async deleteTask(taskId: string, userId: string): Promise<boolean> {
    await this.cancelTask(taskId, userId, 'Deleted by user');
    return true;
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildFilterWhere(filters?: TaskFilters): Record<string, unknown> {
    if (!filters) return {};

    const where: Record<string, unknown> = {};

    if (filters.types && filters.types.length > 0) {
      where.type = { in: filters.types };
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    if (filters.priorities && filters.priorities.length > 0) {
      where.priority = { in: filters.priorities };
    }

    if (filters.assignedTo && filters.assignedTo.length > 0) {
      where.assignedTo = { in: filters.assignedTo };
    }

    if (filters.caseId) {
      where.caseId = filters.caseId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) {
        (where.dueDate as Record<string, unknown>).gte = filters.dueDateFrom;
      }
      if (filters.dueDateTo) {
        (where.dueDate as Record<string, unknown>).lte = filters.dueDateTo;
      }
    }

    if (filters.searchQuery) {
      where.OR = [
        { title: { contains: filters.searchQuery, mode: 'insensitive' } },
        { description: { contains: filters.searchQuery, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
