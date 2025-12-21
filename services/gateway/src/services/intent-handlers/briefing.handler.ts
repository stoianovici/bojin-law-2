/**
 * Briefing Intent Handler
 * OPS-076: Proactive Briefings Integration
 *
 * Handles morning briefing, deadline alerts, and unanswered email detection.
 * Replaces the old SuggestionWidget with proactive alerts in the AI assistant.
 */

import { prisma } from '@legal-platform/database';
import { morningBriefingService } from '../morning-briefing.service';
import type {
  AssistantContext,
  UserContext,
  HandlerResult,
  AIMessage,
  IntentHandler,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface BriefingResult {
  type: 'morning' | 'deadline' | 'email' | 'followup';
  content: string;
  urgency: 'low' | 'medium' | 'high';
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionSuggestion?: string;
}

// ============================================================================
// Handler
// ============================================================================

export class BriefingHandler implements IntentHandler {
  readonly name = 'BriefingHandler';

  /**
   * Get morning briefing for user.
   * Called when assistant opens for the first time each day.
   */
  async getMorningBriefing(userContext: UserContext): Promise<HandlerResult> {
    const briefing = await morningBriefingService.generateBriefing(userContext);

    const sections: string[] = [];

    // Urgent items
    if (briefing.urgentTasks.length > 0) {
      sections.push(
        `**Urgente azi:**\n${briefing.urgentTasks
          .map((t) => `• ${t.title}${t.caseTitle ? ` - ${t.caseTitle}` : ''}`)
          .join('\n')}`
      );
    }

    // Today's tasks
    if (briefing.todayTasks.length > 0) {
      sections.push(
        `**De făcut azi:**\n${briefing.todayTasks.map((t) => `• ${t.title}`).join('\n')}`
      );
    }

    // Upcoming deadlines
    if (briefing.upcomingDeadlines.length > 0) {
      sections.push(
        `**Termene apropiate:**\n${briefing.upcomingDeadlines
          .map(
            (d) =>
              `• În ${d.daysUntilDue} zile: ${d.title}${d.caseTitle ? ` (${d.caseTitle})` : ''}`
          )
          .join('\n')}`
      );
    }

    // New emails
    if (briefing.unreadEmailsCount > 0) {
      sections.push(`**Emailuri noi:** ${briefing.unreadEmailsCount} necitite`);
    }

    if (sections.length === 0) {
      return {
        success: true,
        message: 'Bună dimineața! Nu aveți sarcini urgente sau termene apropiate.',
      };
    }

    return {
      success: true,
      data: briefing,
      message: `Bună dimineața! Iată rezumatul zilei:\n\n${sections.join('\n\n')}`,
    };
  }

  /**
   * Get proactive alerts based on current context.
   * Called periodically or on context change.
   */
  async getProactiveAlerts(
    context: AssistantContext,
    userContext: UserContext
  ): Promise<BriefingResult[]> {
    const alerts: BriefingResult[] = [];

    // Check for deadline alerts
    const upcomingDeadlines = await this.checkDeadlineAlerts(userContext);
    alerts.push(...upcomingDeadlines);

    // Check for unanswered emails
    const unansweredEmails = await this.checkUnansweredEmails(userContext);
    alerts.push(...unansweredEmails);

    // Check for case-specific alerts if in case context
    if (context.currentCaseId) {
      const caseAlerts = await this.checkCaseAlerts(context.currentCaseId, userContext);
      alerts.push(...caseAlerts);
    }

    return alerts;
  }

  /**
   * Generate proactive messages based on alerts.
   * Replaces the old suggestionService.getContextualSuggestions approach.
   */
  async getProactiveMessages(
    context: AssistantContext,
    userContext: UserContext
  ): Promise<AIMessage[]> {
    const alerts = await this.getProactiveAlerts(context, userContext);

    return alerts.map((alert, index) => ({
      id: `proactive-${Date.now()}-${index}`,
      role: 'Assistant' as const,
      content: alert.content,
      intent: this.mapAlertTypeToIntent(alert.type),
      proposedAction: alert.actionSuggestion
        ? {
            type: alert.type,
            displayText: alert.actionSuggestion,
            payload: {
              entityId: alert.relatedEntityId,
              entityType: alert.relatedEntityType,
            },
            status: 'Proposed' as const,
            requiresConfirmation: false, // Proactive alerts are informational
          }
        : undefined,
      createdAt: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private mapAlertTypeToIntent(type: string): string {
    const mapping: Record<string, string> = {
      deadline: 'QueryTasks',
      email: 'SearchEmails',
      followup: 'GeneralChat',
      morning: 'MorningBriefing',
    };
    return mapping[type] || 'GeneralChat';
  }

  private async checkDeadlineAlerts(userContext: UserContext): Promise<BriefingResult[]> {
    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: userContext.userId,
        status: 'Pending',
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        },
      },
      include: { case: true },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    return tasks.map((t) => ({
      type: 'deadline' as const,
      content: `Termen apropiat: ${t.title} (${t.case?.title || 'Fără dosar'}) - ${this.formatDate(t.dueDate)}`,
      urgency: this.getUrgency(t.dueDate),
      relatedEntityId: t.id,
      relatedEntityType: 'Task',
      actionSuggestion: 'Vezi detalii',
    }));
  }

  private async checkUnansweredEmails(userContext: UserContext): Promise<BriefingResult[]> {
    // Step 1: Get user's email address
    const user = await prisma.user.findUnique({
      where: { id: userContext.userId },
      select: { email: true },
    });

    if (!user?.email) return [];

    // Step 2: Get conversations where user has sent a reply
    const conversationsWithReplies = await this.getConversationsWithReplies(
      userContext.userId,
      user.email
    );

    // Step 3: Find old received emails without replies
    const oldEmails = await prisma.email.findMany({
      where: {
        userId: userContext.userId,
        receivedDateTime: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        conversationId: { notIn: conversationsWithReplies },
      },
      take: 10,
    });

    // Filter out emails sent by the user (JavaScript fallback for JSON field)
    const receivedEmails = oldEmails
      .filter((e) => {
        const from = e.from as { address?: string } | null;
        return from?.address?.toLowerCase() !== user.email?.toLowerCase();
      })
      .slice(0, 3);

    return receivedEmails.map((e) => {
      const fromData = e.from as { name?: string; address?: string } | null;
      return {
        type: 'email' as const,
        content: `Email fără răspuns de la ${fromData?.name || fromData?.address || 'Necunoscut'}: "${e.subject || '(fără subiect)'}"`,
        urgency: 'medium' as const,
        relatedEntityId: e.id,
        relatedEntityType: 'Email',
        actionSuggestion: 'Redactează răspuns',
      };
    });
  }

  /**
   * Get conversation IDs where user has sent at least one reply
   */
  private async getConversationsWithReplies(userId: string, userEmail: string): Promise<string[]> {
    // Find emails where user is the sender
    // Note: Prisma JSON path filtering may not work reliably, so we fetch all and filter
    const sentEmails = await prisma.email.findMany({
      where: {
        userId,
        conversationId: { not: '' },
      },
      select: { conversationId: true, from: true },
    });

    // Filter in JS for emails where user is the sender
    const conversationsWithReplies = sentEmails
      .filter((e) => {
        const from = e.from as { address?: string } | null;
        return from?.address?.toLowerCase() === userEmail.toLowerCase();
      })
      .map((e) => e.conversationId);

    return [...new Set(conversationsWithReplies)];
  }

  private async checkCaseAlerts(
    caseId: string,
    _userContext: UserContext
  ): Promise<BriefingResult[]> {
    // Case-specific alerts: overdue tasks, pending documents, etc.
    const overdueTasksCount = await prisma.task.count({
      where: {
        caseId,
        status: 'Pending',
        dueDate: { lt: new Date() },
      },
    });

    const alerts: BriefingResult[] = [];

    if (overdueTasksCount > 0) {
      alerts.push({
        type: 'followup' as const,
        content: `Acest dosar are ${overdueTasksCount} sarcin${overdueTasksCount === 1 ? 'ă' : 'i'} întârziat${overdueTasksCount === 1 ? 'ă' : 'e'}.`,
        urgency: 'high',
        relatedEntityId: caseId,
        relatedEntityType: 'Case',
        actionSuggestion: 'Vezi sarcinile',
      });
    }

    return alerts;
  }

  private getUrgency(dueDate: Date | null): 'low' | 'medium' | 'high' {
    if (!dueDate) return 'low';
    const daysUntil = (dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysUntil <= 1) return 'high';
    if (daysUntil <= 3) return 'medium';
    return 'low';
  }

  private formatDate(date: Date | null): string {
    if (!date) return 'Nespecificat';
    return date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}

// Export singleton instance
export const briefingHandler = new BriefingHandler();
