/**
 * Morning Briefing Service
 * OPS-077: Service Wrappers for AI Assistant Handlers
 *
 * Synchronous wrapper around the morning briefing worker for
 * use by AI assistant intent handlers. Provides on-demand
 * briefing generation without relying on the cron job.
 */

import { prisma } from '@legal-platform/database';
import { AIOperationType } from '@legal-platform/types';
import { aiService } from './ai.service';

// ============================================================================
// Types
// ============================================================================

export interface UserContext {
  userId: string;
  firmId: string;
}

export interface BriefingTask {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  caseTitle: string | null;
  caseNumber: string | null;
  isOverdue: boolean;
}

export interface BriefingDeadline {
  id: string;
  title: string;
  dueDate: Date;
  caseTitle: string | null;
  caseNumber: string | null;
  daysUntilDue: number;
}

export interface BriefingEmail {
  id: string;
  subject: string;
  from: string;
  receivedAt: Date;
  caseTitle: string | null;
  requiresAction: boolean;
}

export interface MorningBriefing {
  urgentTasks: BriefingTask[];
  todayTasks: BriefingTask[];
  upcomingDeadlines: BriefingDeadline[];
  unreadEmailsCount: number;
  importantEmails: BriefingEmail[];
  generatedAt: Date;
  aiSummary?: string;
}

// ============================================================================
// Service
// ============================================================================

export class MorningBriefingService {
  /**
   * Generate a morning briefing for a user.
   * Synchronous wrapper around the worker logic.
   */
  async generateBriefing(userContext: UserContext): Promise<MorningBriefing> {
    const { userId, firmId } = userContext;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Gather data in parallel
    const [urgentTasks, todayTasks, upcomingDeadlines, emailStats, importantEmails] =
      await Promise.all([
        this.getUrgentTasks(userId, firmId),
        this.getTodayTasks(userId, firmId, startOfToday, endOfToday),
        this.getUpcomingDeadlines(userId, firmId, now, sevenDaysFromNow),
        this.getEmailStats(userId),
        this.getImportantEmails(userId, firmId),
      ]);

    // Optionally generate AI summary
    let aiSummary: string | undefined;
    if (
      urgentTasks.length > 0 ||
      todayTasks.length > 0 ||
      upcomingDeadlines.length > 0 ||
      importantEmails.length > 0
    ) {
      aiSummary = await this.generateAISummary(
        { urgentTasks, todayTasks, upcomingDeadlines, importantEmails },
        firmId
      );
    }

    return {
      urgentTasks,
      todayTasks,
      upcomingDeadlines,
      unreadEmailsCount: emailStats.unreadCount,
      importantEmails,
      generatedAt: new Date(),
      aiSummary,
    };
  }

  /**
   * Get a quick briefing summary (no AI, faster).
   */
  async getQuickBriefing(userContext: UserContext): Promise<MorningBriefing> {
    const { userId, firmId } = userContext;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [urgentTasks, todayTasks, upcomingDeadlines, emailStats] = await Promise.all([
      this.getUrgentTasks(userId, firmId),
      this.getTodayTasks(userId, firmId, startOfToday, endOfToday),
      this.getUpcomingDeadlines(userId, firmId, now, sevenDaysFromNow),
      this.getEmailStats(userId),
    ]);

    return {
      urgentTasks,
      todayTasks,
      upcomingDeadlines,
      unreadEmailsCount: emailStats.unreadCount,
      importantEmails: [],
      generatedAt: new Date(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get urgent tasks (overdue or high priority due today)
   */
  private async getUrgentTasks(userId: string, firmId: string): Promise<BriefingTask[]> {
    const now = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        firmId,
        assignedTo: userId,
        status: { notIn: ['Completed', 'Cancelled'] },
        OR: [
          { dueDate: { lt: now } }, // Overdue
          {
            AND: [
              { priority: { in: ['Urgent', 'High'] } },
              { dueDate: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
            ],
          },
        ],
      },
      include: {
        case: { select: { title: true, caseNumber: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 10,
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      caseTitle: t.case?.title || null,
      caseNumber: t.case?.caseNumber || null,
      isOverdue: t.dueDate ? t.dueDate < now : false,
    }));
  }

  /**
   * Get tasks due today
   */
  private async getTodayTasks(
    userId: string,
    firmId: string,
    startOfToday: Date,
    endOfToday: Date
  ): Promise<BriefingTask[]> {
    const now = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        firmId,
        assignedTo: userId,
        status: { notIn: ['Completed', 'Cancelled'] },
        dueDate: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
      include: {
        case: { select: { title: true, caseNumber: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 20,
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      caseTitle: t.case?.title || null,
      caseNumber: t.case?.caseNumber || null,
      isOverdue: t.dueDate ? t.dueDate < now : false,
    }));
  }

  /**
   * Get upcoming deadlines (tasks with important deadlines)
   */
  private async getUpcomingDeadlines(
    userId: string,
    firmId: string,
    now: Date,
    until: Date
  ): Promise<BriefingDeadline[]> {
    const tasks = await prisma.task.findMany({
      where: {
        firmId,
        assignedTo: userId,
        status: { notIn: ['Completed', 'Cancelled'] },
        dueDate: {
          gte: now,
          lte: until,
        },
        OR: [
          { priority: { in: ['Urgent', 'High'] } },
          { title: { contains: 'termen', mode: 'insensitive' } },
          { title: { contains: 'deadline', mode: 'insensitive' } },
        ],
      },
      include: {
        case: { select: { title: true, caseNumber: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!,
      caseTitle: t.case?.title || null,
      caseNumber: t.case?.caseNumber || null,
      daysUntilDue: Math.ceil((t.dueDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  }

  /**
   * Get email statistics
   */
  private async getEmailStats(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await prisma.email.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount };
  }

  /**
   * Get important unread emails
   */
  private async getImportantEmails(userId: string, firmId: string): Promise<BriefingEmail[]> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const emails = await prisma.email.findMany({
      where: {
        userId,
        isRead: false,
        receivedDateTime: { gte: yesterday },
      },
      include: {
        caseLinks: {
          where: { isPrimary: true },
          include: {
            case: { select: { title: true } },
          },
        },
      },
      orderBy: { receivedDateTime: 'desc' },
      take: 10,
    });

    return emails.map((e) => {
      const fromData = e.from as { name?: string; address?: string } | null;
      const primaryCase = e.caseLinks[0]?.case;

      return {
        id: e.id,
        subject: e.subject || '(fără subiect)',
        from: fromData?.name || fromData?.address || 'Necunoscut',
        receivedAt: e.receivedDateTime,
        caseTitle: primaryCase?.title || null,
        requiresAction: e.importance === 'high',
      };
    });
  }

  /**
   * Generate AI summary of the briefing
   */
  private async generateAISummary(
    data: {
      urgentTasks: BriefingTask[];
      todayTasks: BriefingTask[];
      upcomingDeadlines: BriefingDeadline[];
      importantEmails: BriefingEmail[];
    },
    firmId: string
  ): Promise<string> {
    try {
      const prompt = this.buildSummaryPrompt(data);

      const response = await aiService.generate({
        prompt,
        systemPrompt: `Ești un asistent juridic AI. Generezi un rezumat scurt și util pentru avocatul care își începe ziua de lucru.

Reguli:
- Fii CONCIS - maxim 3-4 propoziții
- Evidențiază cele mai urgente probleme
- Menționează termenele critice
- Folosește un ton profesional dar prietenos
- Răspunde EXCLUSIV în limba ROMÂNĂ`,
        operationType: AIOperationType.MorningBriefing,
        firmId,
        maxTokens: 300,
        temperature: 0.5,
        useCache: false,
      });

      return response.content;
    } catch (error) {
      console.error('[MorningBriefing] Failed to generate AI summary:', error);
      return '';
    }
  }

  /**
   * Build prompt for AI summary
   */
  private buildSummaryPrompt(data: {
    urgentTasks: BriefingTask[];
    todayTasks: BriefingTask[];
    upcomingDeadlines: BriefingDeadline[];
    importantEmails: BriefingEmail[];
  }): string {
    let prompt = 'Generează un rezumat scurt al zilei pentru avocat:\n\n';

    if (data.urgentTasks.length > 0) {
      prompt += `SARCINI URGENTE (${data.urgentTasks.length}):\n`;
      data.urgentTasks.slice(0, 3).forEach((t) => {
        const status = t.isOverdue ? '⚠️ ÎNTÂRZIAT' : '⏰ URGENT';
        prompt += `- ${status}: ${t.title}`;
        if (t.caseTitle) prompt += ` (${t.caseTitle})`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    if (data.todayTasks.length > 0) {
      prompt += `SARCINI PENTRU AZI (${data.todayTasks.length}):\n`;
      data.todayTasks.slice(0, 3).forEach((t) => {
        prompt += `- ${t.title}`;
        if (t.caseTitle) prompt += ` (${t.caseTitle})`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    if (data.upcomingDeadlines.length > 0) {
      prompt += `TERMENE APROPIATE (${data.upcomingDeadlines.length}):\n`;
      data.upcomingDeadlines.slice(0, 3).forEach((d) => {
        prompt += `- În ${d.daysUntilDue} zile: ${d.title}`;
        if (d.caseTitle) prompt += ` (${d.caseTitle})`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    if (data.importantEmails.length > 0) {
      prompt += `EMAILURI IMPORTANTE (${data.importantEmails.length}):\n`;
      data.importantEmails.slice(0, 3).forEach((e) => {
        prompt += `- De la ${e.from}: ${e.subject}\n`;
      });
    }

    prompt += '\nGenerează un rezumat scurt și util.';

    return prompt;
  }
}

// Export singleton instance
export const morningBriefingService = new MorningBriefingService();
