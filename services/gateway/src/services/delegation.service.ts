/**
 * Delegation Service
 * Story 4.2: Task Type System Implementation
 *
 * Manages task delegation for Business Trip coverage
 */

import { prisma } from '@legal-platform/database';
import { TaskDelegation, DelegationStatus, NotificationType, TaskTypeEnum } from '@prisma/client';
import { NotificationService } from './notification.service';

export interface DelegationInput {
  delegatedTo: string; // User ID to delegate to
  taskIds?: string[]; // Specific tasks to delegate (optional)
  startDate: Date;
  endDate: Date;
  notes?: string;
}

export class DelegationService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Create delegation for Business Trip task
   * Optionally delegates specific tasks or all user's tasks
   */
  async createDelegation(
    sourceTaskId: string,
    input: DelegationInput,
    userId: string
  ): Promise<TaskDelegation[]> {
    // Get user's firmId for firm isolation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, firstName: true, lastName: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify source task is a BusinessTrip type and belongs to firm
    const sourceTask = await prisma.task.findFirst({
      where: {
        id: sourceTaskId,
        firmId: user.firmId,
        type: TaskTypeEnum.BusinessTrip,
        createdBy: userId, // Only task creator can delegate
      },
    });

    if (!sourceTask) {
      throw new Error(
        'Business Trip task not found or you do not have permission to create delegations'
      );
    }

    // Verify delegate belongs to same firm
    const delegate = await prisma.user.findFirst({
      where: {
        id: input.delegatedTo,
        firmId: user.firmId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!delegate) {
      throw new Error('Delegate not found or does not belong to your firm');
    }

    // Validate dates
    if (input.startDate >= input.endDate) {
      throw new Error('Start date must be before end date');
    }

    // Determine which tasks to delegate
    let tasksToDelegate: Array<{ id: string }>;

    if (input.taskIds && input.taskIds.length > 0) {
      // Verify specific tasks belong to user and firm
      tasksToDelegate = await prisma.task.findMany({
        where: {
          id: { in: input.taskIds },
          firmId: user.firmId,
          assignedTo: userId,
        },
        select: { id: true },
      });

      if (tasksToDelegate.length !== input.taskIds.length) {
        throw new Error('One or more tasks not found or not assigned to you');
      }
    } else {
      // Delegate all user's pending/in-progress tasks
      tasksToDelegate = await prisma.task.findMany({
        where: {
          firmId: user.firmId,
          assignedTo: userId,
          status: {
            in: ['Pending', 'InProgress'],
          },
        },
        select: { id: true },
      });
    }

    // Create delegations and notification in a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create all delegations
      const delegationData = tasksToDelegate.map((task) => ({
        sourceTaskId,
        delegatedTaskId: task.id,
        delegatedTo: input.delegatedTo,
        delegatedBy: userId,
        reason: `Business Trip coverage: ${sourceTask.title}`,
        startDate: input.startDate,
        endDate: input.endDate,
        status: DelegationStatus.Pending,
        notes: input.notes || null,
      }));

      // Use createMany for better performance
      await tx.taskDelegation.createMany({
        data: delegationData,
      });

      // Fetch created delegations to return
      const delegations = await tx.taskDelegation.findMany({
        where: {
          sourceTaskId,
          delegatedTo: input.delegatedTo,
          delegatedBy: userId,
          createdAt: {
            gte: new Date(Date.now() - 1000), // Created in last second
          },
        },
      });

      // Send notification to delegate
      await tx.notification.create({
        data: {
          userId: input.delegatedTo,
          type: NotificationType.DelegationRequested,
          title: 'Task Delegation Request',
          message: `${user.firstName} ${user.lastName} has requested you cover ${delegations.length} task(s) during their business trip from ${input.startDate.toLocaleDateString()} to ${input.endDate.toLocaleDateString()}`,
          link: `/delegations`,
        },
      });

      return delegations;
    });

    return result;
  }

  /**
   * Accept a delegation request
   */
  async acceptDelegation(delegationId: string, userId: string): Promise<TaskDelegation> {
    // Get user's firmId for firm isolation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, firstName: true, lastName: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify delegation exists and belongs to user
    const delegation = await prisma.taskDelegation.findFirst({
      where: {
        id: delegationId,
        delegatedTo: userId,
      },
      include: {
        delegator: true,
        delegatedTask: true,
      },
    });

    if (!delegation) {
      throw new Error('Delegation not found or access denied');
    }

    // Update delegation status
    const updatedDelegation = await prisma.taskDelegation.update({
      where: { id: delegationId },
      data: {
        status: DelegationStatus.Accepted,
        acceptedAt: new Date(),
      },
    });

    // Send notification to delegator
    await prisma.notification.create({
      data: {
        userId: delegation.delegatedBy,
        type: NotificationType.DelegationAccepted,
        title: 'Delegation Accepted',
        message: `${user.firstName} ${user.lastName} has accepted delegation of task "${delegation.delegatedTask?.title || 'Unknown task'}"`,
        link: `/tasks/${delegation.delegatedTaskId}`,
      },
    });

    return updatedDelegation;
  }

  /**
   * Decline a delegation request
   */
  async declineDelegation(
    delegationId: string,
    userId: string,
    reason?: string
  ): Promise<TaskDelegation> {
    // Get user's firmId for firm isolation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, firstName: true, lastName: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify delegation exists and belongs to user
    const delegation = await prisma.taskDelegation.findFirst({
      where: {
        id: delegationId,
        delegatedTo: userId,
      },
      include: {
        delegator: true,
        delegatedTask: true,
      },
    });

    if (!delegation) {
      throw new Error('Delegation not found or access denied');
    }

    // Update delegation status with decline reason
    const updatedDelegation = await prisma.taskDelegation.update({
      where: { id: delegationId },
      data: {
        status: DelegationStatus.Declined,
        notes: reason ? `${delegation.notes || ''}\n\nDecline reason: ${reason}` : delegation.notes,
      },
    });

    // Send notification to delegator
    const reasonText = reason ? ` Reason: ${reason}` : '';
    await prisma.notification.create({
      data: {
        userId: delegation.delegatedBy,
        type: NotificationType.DelegationDeclined,
        title: 'Delegation Declined',
        message: `${user.firstName} ${user.lastName} has declined delegation of task "${delegation.delegatedTask?.title || 'Unknown task'}".${reasonText}`,
        link: `/tasks/${delegation.sourceTaskId}`,
      },
    });

    return updatedDelegation;
  }

  /**
   * Get all delegations created by a user
   */
  async getDelegationsForUser(userId: string): Promise<TaskDelegation[]> {
    return await prisma.taskDelegation.findMany({
      where: {
        delegatedBy: userId,
      },
      include: {
        delegate: true,
        delegatedTask: true,
        sourceTask: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get all delegation requests sent to a user
   */
  async getDelegationsToUser(userId: string): Promise<TaskDelegation[]> {
    return await prisma.taskDelegation.findMany({
      where: {
        delegatedTo: userId,
      },
      include: {
        delegator: true,
        delegatedTask: true,
        sourceTask: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get active delegations for a user on a specific date
   */
  async getActiveDelegations(userId: string, date: Date): Promise<TaskDelegation[]> {
    return await prisma.taskDelegation.findMany({
      where: {
        delegatedTo: userId,
        status: DelegationStatus.Accepted,
        startDate: {
          lte: date,
        },
        endDate: {
          gte: date,
        },
      },
      include: {
        delegator: true,
        delegatedTask: true,
        sourceTask: true,
      },
    });
  }
}
