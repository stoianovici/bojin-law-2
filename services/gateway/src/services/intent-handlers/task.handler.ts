/**
 * Task & Calendar Intent Handler
 * OPS-072: Task & Calendar Intent Handler
 *
 * Handles task creation, task queries, and calendar scheduling intents.
 * Uses NaturalLanguageCommandService for parsing and TaskService for execution.
 */

import { prisma } from '@legal-platform/database';
import { Task as PrismaTask, TaskStatus } from '@prisma/client';
import { TaskService } from '../task.service';
import { NaturalLanguageCommandService, CommandIntent } from '../natural-language-command.service';
import { createCalendarSuggestionService } from '../calendar-suggestion.service';
import type { AssistantContext, UserContext, HandlerResult, IntentHandler } from './types';

// ============================================================================
// Handler-specific Types
// ============================================================================

export interface TaskHandlerParams {
  // For CreateTask
  rawText?: string;
  title?: string;
  dueDate?: string;
  priority?: string;
  assigneeId?: string;
  caseId?: string;

  // For QueryTasks
  timeRange?: 'today' | 'week' | 'month' | 'all';
  status?: 'pending' | 'completed' | 'overdue';

  // For ScheduleEvent
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  attendees?: string[];
}

// ============================================================================
// Handler
// ============================================================================

export class TaskIntentHandler implements IntentHandler {
  readonly name = 'TaskIntentHandler';

  /**
   * Handle natural language task creation.
   * Parses raw text using NaturalLanguageCommandService and returns a proposed action.
   */
  async handleCreateTask(
    params: TaskHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    // Use natural language command service if raw text provided
    if (params.rawText) {
      const nlService = new NaturalLanguageCommandService();
      const caseId = params.caseId || context.currentCaseId;

      if (!caseId) {
        return {
          success: false,
          message: 'Nu am putut determina dosarul. Te rog selectează un dosar.',
        };
      }

      const parsed = await nlService.processCommand(
        {
          input: params.rawText,
          caseId: caseId,
        },
        { userId: userContext.userId, firmId: userContext.firmId }
      );

      // Verify intent is CREATE_TASK
      if (parsed.intent !== CommandIntent.CREATE_TASK) {
        return {
          success: false,
          message: 'Nu am putut interpreta cererea ca o sarcină nouă.',
        };
      }

      // extractedParams contains the parsed task data
      const taskData = parsed.extractedParams;

      // Build preview from parsed data
      const preview = {
        titlu: taskData?.title || 'Sarcină nouă',
        termen: taskData?.dueDate ? this.formatDate(taskData.dueDate) : 'Nespecificat',
        prioritate: this.translatePriority(String(taskData?.priority || 'Medium')),
        dosar: await this.getCaseTitle(caseId),
        atribuit: 'Tu',
      };

      return {
        success: true,
        proposedAction: {
          type: 'CreateTask',
          displayText: `Creează sarcină: ${taskData?.title || 'Sarcină nouă'}`,
          payload: {
            title: taskData?.title,
            description: taskData?.description,
            dueDate: taskData?.dueDate?.toISOString(),
            priority: taskData?.priority || 'Medium',
            caseId: caseId,
            assignedTo: userContext.userId,
            type: taskData?.taskType || 'Research',
          },
          requiresConfirmation: true,
          confirmationPrompt: 'Creez această sarcină?',
          entityPreview: preview,
        },
      };
    }

    // Direct params provided (from confirmed action or structured input)
    const title = params.title || 'Sarcină nouă';
    const caseId = params.caseId || context.currentCaseId;

    if (!caseId) {
      return {
        success: false,
        message: 'Nu am putut determina dosarul. Te rog selectează un dosar.',
      };
    }

    const preview = {
      titlu: title,
      termen: params.dueDate ? this.formatDate(new Date(params.dueDate)) : 'Nespecificat',
      prioritate: this.translatePriority(params.priority || 'Medium'),
      dosar: await this.getCaseTitle(caseId),
      atribuit: params.assigneeId ? await this.getUserName(params.assigneeId) : 'Tu',
    };

    return {
      success: true,
      proposedAction: {
        type: 'CreateTask',
        displayText: `Creează sarcină: ${title}`,
        payload: {
          title,
          dueDate: params.dueDate,
          priority: params.priority || 'Medium',
          caseId,
          assignedTo: params.assigneeId || userContext.userId,
        },
        requiresConfirmation: true,
        confirmationPrompt: 'Creez această sarcină?',
        entityPreview: preview,
      },
    };
  }

  /**
   * Handle task query intent.
   * Returns a formatted summary of tasks based on filters.
   */
  async handleQueryTasks(
    params: TaskHandlerParams,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const taskService = new TaskService();

    // Get date range based on timeRange parameter
    const dateRange = this.getDateRangeFilter(params.timeRange || 'week');

    // Map status to TaskStatus enum values
    const statusFilter = this.mapStatusFilter(params.status);

    const tasks = await taskService.getTasksByAssignee(userContext.userId, userContext.firmId, {
      statuses: statusFilter,
      dueDateFrom: dateRange.start,
      dueDateTo: dateRange.end,
    });

    // Filter overdue tasks in JS if needed (those with past dueDate and not completed)
    const filteredTasks =
      params.status === 'overdue'
        ? tasks.filter(
            (t) =>
              t.dueDate &&
              t.dueDate < new Date() &&
              t.status !== TaskStatus.Completed &&
              t.status !== TaskStatus.Cancelled
          )
        : tasks;

    const summary = this.summarizeTasks(filteredTasks, params.timeRange || 'week');

    return {
      success: true,
      data: {
        tasks: filteredTasks.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate?.toISOString(),
          priority: t.priority,
          status: t.status,
          caseId: t.caseId,
        })),
        count: filteredTasks.length,
      },
      message: summary,
    };
  }

  /**
   * Handle calendar event scheduling.
   * Creates a calendar suggestion that can be synced to Microsoft Calendar.
   */
  async handleScheduleEvent(
    params: TaskHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    if (!params.eventTitle || !params.eventDate) {
      return {
        success: false,
        message: 'Te rog specifică titlul și data evenimentului.',
      };
    }

    const calendarService = createCalendarSuggestionService(prisma);

    const startDateTime = this.parseDateTime(params.eventDate, params.eventTime);

    // Build preview
    const preview = {
      eveniment: params.eventTitle,
      data: this.formatDate(startDateTime),
      ora: params.eventTime || 'Toată ziua',
      dosar: context.currentCaseId
        ? await this.getCaseTitle(context.currentCaseId)
        : 'Nespecificat',
    };

    return {
      success: true,
      proposedAction: {
        type: 'ScheduleEvent',
        displayText: `Programează: ${params.eventTitle}`,
        payload: {
          title: params.eventTitle,
          startDateTime: startDateTime.toISOString(),
          endDateTime: this.calculateEndTime(startDateTime, params.eventTime).toISOString(),
          isAllDay: !params.eventTime,
          caseId: context.currentCaseId,
          attendees: params.attendees,
        },
        requiresConfirmation: true,
        confirmationPrompt: 'Adaug în calendar?',
        entityPreview: preview,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getDateRangeFilter(timeRange: string): { start?: Date; end?: Date } {
    const now = new Date();

    switch (timeRange) {
      case 'today': {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return { start: startOfDay, end: endOfDay };
      }
      case 'week':
        return {
          start: new Date(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
      case 'month':
        return {
          start: new Date(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
      case 'all':
      default:
        return {};
    }
  }

  private mapStatusFilter(status?: string): TaskStatus[] | undefined {
    switch (status) {
      case 'completed':
        return [TaskStatus.Completed];
      case 'pending':
        return [TaskStatus.Pending, TaskStatus.InProgress];
      case 'overdue':
        // Return pending statuses; we'll filter by date in JS
        return [TaskStatus.Pending, TaskStatus.InProgress];
      default:
        return undefined;
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
      return 'Astăzi';
    }

    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mâine';
    }

    // Otherwise, format as Romanian date
    return date.toLocaleDateString('ro-RO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  private translatePriority(priority: string): string {
    const translations: Record<string, string> = {
      Urgent: 'Urgent',
      High: 'Înaltă',
      Medium: 'Medie',
      Low: 'Scăzută',
    };
    return translations[priority] || priority;
  }

  private summarizeTasks(tasks: PrismaTask[], timeRange: string): string {
    if (tasks.length === 0) {
      const periodText = this.getTimeRangeText(timeRange);
      return `Nu ai sarcini ${periodText}.`;
    }

    // Group by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTasks = tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow);
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today);
    const upcomingTasks = tasks.filter((t) => t.dueDate && t.dueDate >= tomorrow);

    const parts: string[] = [];
    const periodText = this.getTimeRangeText(timeRange);
    parts.push(`${periodText} ai ${tasks.length} sarcini:`);

    if (overdueTasks.length > 0) {
      parts.push(`\n\nRestante (${overdueTasks.length}):`);
      for (const task of overdueTasks.slice(0, 3)) {
        const priorityIcon = this.getPriorityIcon(task.priority);
        parts.push(`${priorityIcon} ${task.title}`);
      }
      if (overdueTasks.length > 3) {
        parts.push(`...și încă ${overdueTasks.length - 3}`);
      }
    }

    if (todayTasks.length > 0) {
      parts.push(`\n\nAstăzi (${todayTasks.length}):`);
      for (const task of todayTasks.slice(0, 3)) {
        const priorityIcon = this.getPriorityIcon(task.priority);
        parts.push(`${priorityIcon} ${task.title}`);
      }
      if (todayTasks.length > 3) {
        parts.push(`...și încă ${todayTasks.length - 3}`);
      }
    }

    if (upcomingTasks.length > 0 && timeRange !== 'today') {
      parts.push(`\n\nUrmătoarele zile (${upcomingTasks.length}):`);
      for (const task of upcomingTasks.slice(0, 3)) {
        const dayText = this.formatDate(task.dueDate!);
        parts.push(`${dayText}: ${task.title}`);
      }
      if (upcomingTasks.length > 3) {
        parts.push(`...și încă ${upcomingTasks.length - 3}`);
      }
    }

    parts.push('\n\nVrei să vezi detalii despre una din ele?');

    return parts.join('\n');
  }

  private getTimeRangeText(timeRange: string): string {
    switch (timeRange) {
      case 'today':
        return 'Astăzi';
      case 'week':
        return 'Săptămâna aceasta';
      case 'month':
        return 'Luna aceasta';
      default:
        return 'În total';
    }
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'Urgent':
        return '🔴';
      case 'High':
        return '🟠';
      case 'Medium':
        return '🟡';
      case 'Low':
        return '🟢';
      default:
        return '•';
    }
  }

  private parseDateTime(dateStr: string, timeStr?: string): Date {
    const date = new Date(dateStr);

    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      date.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      // All-day event, set to start of day
      date.setHours(0, 0, 0, 0);
    }

    return date;
  }

  private calculateEndTime(startDate: Date, timeStr?: string): Date {
    const endDate = new Date(startDate);

    if (timeStr) {
      // Default to 1 hour duration
      endDate.setHours(endDate.getHours() + 1);
    } else {
      // All-day event, set to end of day
      endDate.setHours(23, 59, 59, 999);
    }

    return endDate;
  }

  private async getCaseTitle(caseId: string): Promise<string> {
    try {
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { title: true },
      });
      return caseRecord?.title || 'Dosar necunoscut';
    } catch {
      return 'Dosar necunoscut';
    }
  }

  private async getUserName(userId: string): Promise<string> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      if (!user) return 'Utilizator necunoscut';
      return `${user.firstName} ${user.lastName}`.trim() || 'Utilizator necunoscut';
    } catch {
      return 'Utilizator necunoscut';
    }
  }
}

// Export singleton instance
export const taskIntentHandler = new TaskIntentHandler();
