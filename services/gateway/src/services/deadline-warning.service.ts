// @ts-nocheck
/**
 * Deadline Warning Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Generates deadline warnings with severity levels and suggested actions
 * for upcoming tasks and deadlines.
 */

import { prisma } from '@legal-platform/database';
import {
  DeadlineWarning,
  SuggestedAction,
} from '@legal-platform/types';
import { Logger } from 'winston';
import logger from '../lib/logger';

// Warning threshold days
const CRITICAL_THRESHOLD_DAYS = 3;
const WARNING_THRESHOLD_DAYS = 7;
const INFO_THRESHOLD_DAYS = 14;

// Default lookhead days
const DEFAULT_LOOKAHEAD_DAYS = 14;

export class DeadlineWarningService {
  private logger: Logger;

  constructor() {
    this.logger = logger.child({ service: 'DeadlineWarningService' });
  }

  /**
   * Get upcoming deadline warnings for a user
   */
  async getUpcomingDeadlineWarnings(
    userId: string,
    firmId: string,
    options?: {
      caseId?: string;
      lookaheadDays?: number;
      includeDependencies?: boolean;
    }
  ): Promise<DeadlineWarning[]> {
    const lookaheadDays = options?.lookaheadDays || DEFAULT_LOOKAHEAD_DAYS;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + lookaheadDays);

    this.logger.info('Fetching deadline warnings', {
      userId,
      firmId,
      caseId: options?.caseId,
      lookaheadDays,
    });

    // Build where clause
    const where: Record<string, unknown> = {
      assignedToId: userId,
      firmId,
      status: { in: ['Pending', 'InProgress'] },
      dueDate: {
        lte: futureDate,
      },
    };

    if (options?.caseId) {
      where.caseId = options.caseId;
    }

    // Fetch tasks with due dates
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
      ],
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
            client: { select: { name: true } },
          },
        },
        dependsOn: options?.includeDependencies ? {
          include: {
            dependsOnTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        } : undefined,
      },
    });

    // Also fetch extracted deadlines from emails
    const extractedDeadlines = await prisma.extractedDeadline.findMany({
      where: {
        firmId,
        status: 'Pending',
        deadlineDate: {
          gte: today,
          lte: futureDate,
        },
      },
      orderBy: { deadlineDate: 'asc' },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Process tasks into warnings
    const warnings: DeadlineWarning[] = [];

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      const daysUntilDue = this.calculateDaysUntilDue(dueDate);
      const severity = this.calculateSeverity(daysUntilDue);

      // Get blocked by tasks (incomplete dependencies)
      const blockedBy = options?.includeDependencies && task.dependsOn
        ? task.dependsOn
            .filter(dep => dep.dependsOnTask && dep.dependsOnTask.status !== 'Completed')
            .map(dep => dep.dependsOnTask!.title)
        : undefined;

      const warning: DeadlineWarning = {
        taskId: task.id,
        caseId: task.caseId || '',
        title: task.title,
        dueDate,
        daysUntilDue,
        severity,
        suggestedActions: this.generateSuggestedActions(task, severity, blockedBy),
        blockedBy: blockedBy && blockedBy.length > 0 ? blockedBy : undefined,
      };

      warnings.push(warning);
    }

    // Add extracted deadlines as warnings
    for (const deadline of extractedDeadlines) {
      if (!deadline.deadlineDate) continue;

      const dueDate = new Date(deadline.deadlineDate);
      const daysUntilDue = this.calculateDaysUntilDue(dueDate);
      const severity = this.calculateSeverity(daysUntilDue);

      const warning: DeadlineWarning = {
        caseId: deadline.caseId || '',
        title: deadline.description || 'Extracted deadline',
        dueDate,
        daysUntilDue,
        severity,
        suggestedActions: [
          {
            action: 'create_task',
            description: 'Create a task for this deadline',
            actionType: 'create_task',
            payload: {
              title: deadline.description,
              dueDate: deadline.deadlineDate,
              caseId: deadline.caseId,
              extractedDeadlineId: deadline.id,
            },
          },
          {
            action: 'review',
            description: 'Review the original email',
            actionType: 'navigate',
            payload: {
              emailId: deadline.emailId,
            },
          },
        ],
      };

      warnings.push(warning);
    }

    // Sort by severity (critical first) then by due date
    warnings.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.daysUntilDue - b.daysUntilDue;
    });

    this.logger.info('Deadline warnings generated', {
      userId,
      firmId,
      totalWarnings: warnings.length,
      critical: warnings.filter(w => w.severity === 'critical').length,
      warning: warnings.filter(w => w.severity === 'warning').length,
      info: warnings.filter(w => w.severity === 'info').length,
    });

    return warnings;
  }

  /**
   * Get deadline warnings for a specific case
   */
  async getCaseDeadlineWarnings(
    caseId: string,
    firmId: string
  ): Promise<DeadlineWarning[]> {
    // Get all tasks for the case, regardless of assignee
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + DEFAULT_LOOKAHEAD_DAYS);

    const tasks = await prisma.task.findMany({
      where: {
        caseId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { lte: futureDate },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const warnings: DeadlineWarning[] = [];

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      const daysUntilDue = this.calculateDaysUntilDue(dueDate);
      const severity = this.calculateSeverity(daysUntilDue);

      warnings.push({
        taskId: task.id,
        caseId,
        title: task.title,
        dueDate,
        daysUntilDue,
        severity,
        suggestedActions: this.generateSuggestedActions(task, severity),
      });
    }

    return warnings.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get overdue deadlines
   */
  async getOverdueDeadlines(
    userId: string,
    firmId: string
  ): Promise<DeadlineWarning[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { lt: today },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return tasks.map(task => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();
      const daysUntilDue = this.calculateDaysUntilDue(dueDate);

      return {
        taskId: task.id,
        caseId: task.caseId || '',
        title: task.title,
        dueDate,
        daysUntilDue,
        severity: 'critical' as const,
        suggestedActions: [
          {
            action: 'complete',
            description: 'Complete this overdue task',
            actionType: 'navigate' as const,
            payload: { taskId: task.id },
          },
          {
            action: 'reschedule',
            description: 'Reschedule the deadline',
            actionType: 'create_task' as const,
            payload: {
              taskId: task.id,
              action: 'reschedule',
            },
          },
          {
            action: 'delegate',
            description: 'Delegate to another team member',
            actionType: 'create_task' as const,
            payload: {
              taskId: task.id,
              action: 'delegate',
            },
          },
        ],
      };
    });
  }

  /**
   * Calculate days until due date
   */
  private calculateDaysUntilDue(dueDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate severity based on days until due
   */
  private calculateSeverity(daysUntilDue: number): 'info' | 'warning' | 'critical' {
    if (daysUntilDue < 0 || daysUntilDue < CRITICAL_THRESHOLD_DAYS) {
      return 'critical';
    }
    if (daysUntilDue < WARNING_THRESHOLD_DAYS) {
      return 'warning';
    }
    return 'info';
  }

  /**
   * Generate suggested actions based on task and severity
   */
  private generateSuggestedActions(
    task: {
      id: string;
      type: string;
      title: string;
      caseId: string | null;
      priority: string;
    },
    severity: 'info' | 'warning' | 'critical',
    blockedBy?: string[]
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // If blocked by dependencies, suggest completing those first
    if (blockedBy && blockedBy.length > 0) {
      actions.push({
        action: 'resolve_dependencies',
        description: `Complete blocking tasks: ${blockedBy.slice(0, 2).join(', ')}${blockedBy.length > 2 ? '...' : ''}`,
        actionType: 'navigate',
        payload: {
          action: 'view_dependencies',
          taskId: task.id,
        },
      });
    }

    // Common actions based on task type
    switch (task.type) {
      case 'CourtDate':
        actions.push({
          action: 'prepare_documents',
          description: 'Prepare court documents',
          actionType: 'review_document',
          payload: { caseId: task.caseId },
        });
        actions.push({
          action: 'review_case',
          description: 'Review case materials',
          actionType: 'navigate',
          payload: { caseId: task.caseId },
        });
        break;

      case 'DocumentCreation':
        actions.push({
          action: 'start_document',
          description: 'Start drafting the document',
          actionType: 'navigate',
          payload: { taskId: task.id },
        });
        break;

      case 'Meeting':
        actions.push({
          action: 'send_reminder',
          description: 'Send meeting reminder',
          actionType: 'send_email',
          payload: {
            taskId: task.id,
            template: 'meeting_reminder',
          },
        });
        break;

      default:
        // Generic actions
        actions.push({
          action: 'start_task',
          description: 'Start working on this task',
          actionType: 'navigate',
          payload: { taskId: task.id },
        });
    }

    // Severity-based actions
    if (severity === 'critical') {
      actions.push({
        action: 'request_extension',
        description: 'Request deadline extension',
        actionType: 'send_email',
        payload: {
          taskId: task.id,
          template: 'extension_request',
        },
      });

      if (task.priority !== 'Urgent') {
        actions.push({
          action: 'escalate',
          description: 'Escalate priority',
          actionType: 'create_task',
          payload: {
            taskId: task.id,
            action: 'update_priority',
            newPriority: 'Urgent',
          },
        });
      }
    }

    // Client notification for warning/critical
    if (severity !== 'info' && task.caseId) {
      actions.push({
        action: 'notify_client',
        description: 'Send status update to client',
        actionType: 'send_email',
        payload: {
          caseId: task.caseId,
          template: 'deadline_status_update',
        },
      });
    }

    return actions.slice(0, 4); // Limit to 4 actions
  }

  /**
   * Get summary statistics for deadline warnings
   */
  async getDeadlineStats(userId: string, firmId: string): Promise<{
    total: number;
    critical: number;
    warning: number;
    info: number;
    overdue: number;
  }> {
    const warnings = await this.getUpcomingDeadlineWarnings(userId, firmId);
    const overdue = await this.getOverdueDeadlines(userId, firmId);

    return {
      total: warnings.length + overdue.length,
      critical: warnings.filter(w => w.severity === 'critical').length,
      warning: warnings.filter(w => w.severity === 'warning').length,
      info: warnings.filter(w => w.severity === 'info').length,
      overdue: overdue.length,
    };
  }
}

// Singleton instance
export const deadlineWarningService = new DeadlineWarningService();
