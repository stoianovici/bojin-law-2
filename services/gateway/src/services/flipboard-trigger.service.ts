/**
 * Flipboard Trigger Service
 *
 * Handles event-driven regeneration of Flipboard items.
 * Triggers regeneration when high-priority events occur.
 */

import { prisma } from '@legal-platform/database';
import { flipboardAgentService } from './flipboard-agent.service';
import { FlipboardTriggerEvent } from './flipboard-agent.types';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FlipboardTriggerPayload {
  eventType: FlipboardTriggerEvent;
  caseId?: string;
  userId?: string; // Optional: specific user to trigger for
  entityId?: string;
  entityType?: string;
}

// ============================================================================
// Service
// ============================================================================

class FlipboardTriggerService {
  /**
   * Handle a high-priority event that should trigger Flipboard regeneration.
   * Identifies affected users and triggers regeneration for each.
   */
  async handleEvent(payload: FlipboardTriggerPayload): Promise<void> {
    const { eventType, caseId, userId, entityId } = payload;

    logger.info('[FlipboardTrigger] Handling event', {
      eventType,
      caseId,
      userId,
      entityId,
    });

    try {
      // If specific user is provided, only trigger for them
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, firmId: true },
        });

        if (user?.firmId) {
          await flipboardAgentService.triggerForEvent(user.id, user.firmId, eventType);
        }
        return;
      }

      // Otherwise, find affected users from the case
      if (caseId) {
        await this.triggerForCaseUsers(caseId, eventType);
      }
    } catch (error) {
      logger.error('[FlipboardTrigger] Failed to handle event', {
        eventType,
        caseId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Trigger regeneration for all users assigned to a case.
   */
  private async triggerForCaseUsers(
    caseId: string,
    eventType: FlipboardTriggerEvent
  ): Promise<void> {
    // Get case with team members
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        firmId: true,
        teamMembers: {
          select: { userId: true },
        },
      },
    });

    if (!caseData) {
      logger.warn('[FlipboardTrigger] Case not found', { caseId });
      return;
    }

    // Trigger for each team member
    const userIds = caseData.teamMembers.map((m) => m.userId);
    logger.info('[FlipboardTrigger] Triggering for case users', {
      caseId,
      eventType,
      userCount: userIds.length,
    });

    for (const userId of userIds) {
      await flipboardAgentService.triggerForEvent(userId, caseData.firmId, eventType);
    }
  }

  // ==========================================================================
  // Specific Event Handlers
  // ==========================================================================

  /**
   * Called when an email from court is received.
   */
  async onCourtEmailReceived(caseId: string, emailId: string): Promise<void> {
    await this.handleEvent({
      eventType: 'email_from_court',
      caseId,
      entityId: emailId,
      entityType: 'email',
    });
  }

  /**
   * Called when a task becomes overdue.
   */
  async onTaskOverdue(taskId: string, assigneeId: string): Promise<void> {
    await this.handleEvent({
      eventType: 'task_overdue',
      userId: assigneeId,
      entityId: taskId,
      entityType: 'task',
    });
  }

  /**
   * Called when a deadline is within 48 hours.
   */
  async onDeadlineApproaching(caseId: string, taskId: string): Promise<void> {
    await this.handleEvent({
      eventType: 'deadline_within_48h',
      caseId,
      entityId: taskId,
      entityType: 'task',
    });
  }

  /**
   * Called when an urgent document is uploaded.
   */
  async onUrgentDocument(caseId: string, documentId: string): Promise<void> {
    await this.handleEvent({
      eventType: 'urgent_document',
      caseId,
      entityId: documentId,
      entityType: 'document',
    });
  }

  /**
   * Called when a case health score drops to critical.
   */
  async onCaseHealthCritical(caseId: string): Promise<void> {
    await this.handleEvent({
      eventType: 'case_health_critical',
      caseId,
    });
  }

  // ==========================================================================
  // Batch Check (for scheduled jobs)
  // ==========================================================================

  /**
   * Check all cases for overdue tasks and approaching deadlines.
   * Called by a scheduled job.
   */
  async checkAllForTriggers(): Promise<void> {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    logger.info('[FlipboardTrigger] Running scheduled trigger check');

    try {
      // Find tasks that just became overdue (due in last hour)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const newlyOverdueTasks = await prisma.task.findMany({
        where: {
          status: { not: 'Completed' },
          dueDate: {
            gte: oneHourAgo,
            lt: now,
          },
          assignedTo: { not: undefined },
        },
        select: { id: true, assignedTo: true },
      });

      for (const task of newlyOverdueTasks) {
        if (task.assignedTo) {
          await this.onTaskOverdue(task.id, task.assignedTo);
        }
      }

      // Find tasks with deadlines approaching (within 48h, not yet triggered)
      // We'd need a flag to track which deadlines we've already alerted on
      // For simplicity, we'll just check deadlines due in 47-48 hours (the "just entered" window)
      const in47Hours = new Date(now.getTime() + 47 * 60 * 60 * 1000);
      const approachingDeadlines = await prisma.task.findMany({
        where: {
          status: { not: 'Completed' },
          dueDate: {
            gte: in47Hours,
            lt: in48Hours,
          },
        },
        select: { id: true, caseId: true },
      });

      for (const task of approachingDeadlines) {
        await this.onDeadlineApproaching(task.caseId, task.id);
      }

      logger.info('[FlipboardTrigger] Scheduled check completed', {
        overdueTasks: newlyOverdueTasks.length,
        approachingDeadlines: approachingDeadlines.length,
      });
    } catch (error) {
      logger.error('[FlipboardTrigger] Scheduled check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton
export const flipboardTriggerService = new FlipboardTriggerService();
