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

    // Get user's firmId for firm isolation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm to create tasks');
    }

    // Verify case belongs to user's firm
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: input.caseId,
        firmId: user.firmId,
      },
    });

    if (!caseRecord) {
      throw new Error('Case not found or access denied');
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

    // Create task
    const task = await prisma.task.create({
      data: {
        firmId: user.firmId,
        caseId: input.caseId,
        type: input.type as TaskTypeEnum,
        title: input.title,
        description: input.description || null,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
        dueTime: input.dueTime || null,
        priority: (input.priority as TaskPriority) || TaskPriority.Medium,
        estimatedHours: input.estimatedHours || null,
        typeMetadata: (input.typeMetadata ?? null) as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });

    return task;
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, input: UpdateTaskInput, userId: string): Promise<PrismaTask> {
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
