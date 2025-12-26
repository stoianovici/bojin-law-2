/**
 * Morning Briefings Batch Processor
 * OPS-238: Morning Briefings Processor (Pre-compute)
 *
 * Pre-generates morning briefings at 5 AM daily for instant loading.
 * Processes all active users who logged in within the last 7 days.
 */

import { prisma } from '@legal-platform/database';
import { aiClient } from '../../services/ai-client.service';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';

// ============================================================================
// Types
// ============================================================================

interface PrioritizedTask {
  taskId: string;
  title: string;
  caseTitle: string | null;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

interface KeyDeadline {
  type: 'task' | 'court_date' | 'filing';
  title: string;
  caseId: string | null;
  caseTitle: string | null;
  dueAt: string;
  daysUntil: number;
}

interface RiskAlert {
  type: 'overdue' | 'approaching_deadline' | 'unanswered_email' | 'stale_case';
  severity: 'high' | 'medium';
  title: string;
  caseId?: string;
  caseTitle?: string;
  description: string;
}

interface AISuggestion {
  type: 'follow_up' | 'review' | 'prepare' | 'delegate';
  title: string;
  description: string;
  caseId?: string;
  priority: 'high' | 'medium' | 'low';
}

interface UserBriefingData {
  userId: string;
  firmId: string;
  prioritizedTasks: PrioritizedTask[];
  keyDeadlines: KeyDeadline[];
  riskAlerts: RiskAlert[];
  suggestions: AISuggestion[];
}

// ============================================================================
// Processor
// ============================================================================

export class MorningBriefingsProcessor implements BatchProcessor {
  readonly name = 'Morning Briefings Generator';
  readonly feature = 'morning_briefings';

  /**
   * Process morning briefings for all active users in a firm.
   */
  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    const { firmId, batchJobId, onProgress } = ctx;

    console.log(`[MorningBriefings] Starting briefing generation for firm ${firmId}`);

    // Get active users (logged in within last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        lastActive: { gte: sevenDaysAgo },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    console.log(`[MorningBriefings] Found ${users.length} active users`);

    let processed = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users) {
      try {
        const result = await this.generateBriefingForUser(user.id, firmId, today, batchJobId);
        totalTokens += result.tokensUsed;
        totalCost += result.costEur;
        processed++;
        console.log(
          `[MorningBriefings] Generated briefing for ${user.email} (${result.tokensUsed} tokens)`
        );
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${user.id}: ${errorMsg}`);
        console.error(`[MorningBriefings] Failed for ${user.email}:`, errorMsg);
      }

      onProgress?.(processed + failed, users.length);
    }

    console.log(`[MorningBriefings] Completed: ${processed} generated, ${failed} failed`);

    return {
      itemsProcessed: processed,
      itemsFailed: failed,
      totalTokens,
      totalCost,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate a briefing for a single user.
   */
  private async generateBriefingForUser(
    userId: string,
    firmId: string,
    today: Date,
    batchJobId: string
  ): Promise<{ tokensUsed: number; costEur: number }> {
    // Gather all data in parallel
    const [prioritizedTasks, keyDeadlines, riskAlerts, suggestions] = await Promise.all([
      this.getPrioritizedTasks(userId, firmId, today),
      this.getKeyDeadlines(userId, firmId, today),
      this.getRiskAlerts(userId, firmId, today),
      this.getSuggestions(userId, firmId, today),
    ]);

    // Determine if we should generate AI summary
    const hasContent =
      prioritizedTasks.length > 0 || keyDeadlines.length > 0 || riskAlerts.length > 0;

    let summary = 'Bună dimineața! Nu aveți sarcini urgente sau termene apropiate.';
    let tokensUsed = 0;
    let costEur = 0;

    if (hasContent) {
      // Generate AI summary
      const aiResult = await this.generateAISummary(
        { userId, firmId, prioritizedTasks, keyDeadlines, riskAlerts, suggestions },
        firmId,
        batchJobId
      );
      summary = aiResult.summary;
      tokensUsed = aiResult.inputTokens + aiResult.outputTokens;
      costEur = aiResult.costEur;
    }

    // Upsert the briefing
    await prisma.morningBriefing.upsert({
      where: {
        userId_briefingDate: {
          userId,
          briefingDate: today,
        },
      },
      create: {
        userId,
        firmId,
        briefingDate: today,
        summary,
        prioritizedTasks: JSON.parse(JSON.stringify(prioritizedTasks)),
        keyDeadlines: JSON.parse(JSON.stringify(keyDeadlines)),
        riskAlerts: JSON.parse(JSON.stringify(riskAlerts)),
        suggestions: JSON.parse(JSON.stringify(suggestions)),
        tokensUsed,
      },
      update: {
        summary,
        prioritizedTasks: JSON.parse(JSON.stringify(prioritizedTasks)),
        keyDeadlines: JSON.parse(JSON.stringify(keyDeadlines)),
        riskAlerts: JSON.parse(JSON.stringify(riskAlerts)),
        suggestions: JSON.parse(JSON.stringify(suggestions)),
        tokensUsed,
        generatedAt: new Date(),
      },
    });

    return { tokensUsed, costEur };
  }

  // ============================================================================
  // Data Gathering
  // ============================================================================

  /**
   * Get prioritized tasks for the user.
   * Priority order: overdue, due today, due this week.
   */
  private async getPrioritizedTasks(
    userId: string,
    firmId: string,
    today: Date
  ): Promise<PrioritizedTask[]> {
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get tasks in priority order
    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { lte: endOfWeek },
      },
      include: {
        case: { select: { title: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 10,
    });

    return tasks.map((task) => {
      const isOverdue = task.dueDate && task.dueDate < today;
      const isToday = task.dueDate && task.dueDate >= today && task.dueDate <= endOfToday;

      let priority: 'high' | 'medium' | 'low' = 'low';
      let reason: string;

      if (isOverdue) {
        priority = 'high';
        reason = 'Sarcină întârziată - necesită atenție imediată';
      } else if (isToday) {
        priority = task.priority === 'Urgent' || task.priority === 'High' ? 'high' : 'medium';
        reason = 'Termen astăzi';
      } else if (task.priority === 'Urgent' || task.priority === 'High') {
        priority = 'medium';
        reason = 'Prioritate ridicată';
      } else {
        priority = 'low';
        reason = 'Termen săptămâna aceasta';
      }

      return {
        taskId: task.id,
        title: task.title,
        caseTitle: task.case?.title || null,
        dueAt: task.dueDate?.toISOString() || null,
        priority,
        reason,
      };
    });
  }

  /**
   * Get key deadlines for the user.
   */
  private async getKeyDeadlines(
    userId: string,
    firmId: string,
    today: Date
  ): Promise<KeyDeadline[]> {
    const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { gte: today, lte: endOfWeek },
        OR: [
          { priority: { in: ['Urgent', 'High'] } },
          { title: { contains: 'termen', mode: 'insensitive' } },
          { title: { contains: 'deadline', mode: 'insensitive' } },
          { title: { contains: 'instanță', mode: 'insensitive' } },
        ],
      },
      include: {
        case: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    return tasks.map((task) => ({
      type: 'task' as const,
      title: task.title,
      caseId: task.caseId,
      caseTitle: task.case?.title || null,
      dueAt: task.dueDate!.toISOString(),
      daysUntil: Math.ceil((task.dueDate!.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  }

  /**
   * Get risk alerts for the user.
   */
  private async getRiskAlerts(userId: string, firmId: string, today: Date): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];

    // Overdue tasks
    const overdueTasks = await prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { lt: today },
      },
      include: {
        case: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 3,
    });

    for (const task of overdueTasks) {
      alerts.push({
        type: 'overdue',
        severity: 'high',
        title: `Sarcină întârziată: ${task.title}`,
        caseId: task.caseId || undefined,
        caseTitle: task.case?.title || undefined,
        description: `Această sarcină a depășit termenul limită`,
      });
    }

    // Approaching deadlines (within 2 days)
    const twoDaysFromNow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const approachingTasks = await prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { gte: today, lt: twoDaysFromNow },
      },
      include: {
        case: { select: { id: true, title: true } },
      },
      take: 3,
    });

    for (const task of approachingTasks) {
      alerts.push({
        type: 'approaching_deadline',
        severity: 'medium',
        title: `Termen apropiat: ${task.title}`,
        caseId: task.caseId || undefined,
        caseTitle: task.case?.title || undefined,
        description: `Termen în mai puțin de 48 de ore`,
      });
    }

    return alerts.slice(0, 5);
  }

  /**
   * Get AI suggestions for the day.
   */
  private async getSuggestions(
    userId: string,
    firmId: string,
    today: Date
  ): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];

    // Check for stale cases (no activity in 14 days)
    const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const staleCases = await prisma.case.findMany({
      where: {
        firmId,
        status: 'Active',
        teamMembers: { some: { userId } },
        updatedAt: { lt: fourteenDaysAgo },
      },
      select: { id: true, title: true },
      take: 3,
    });

    for (const caseData of staleCases) {
      suggestions.push({
        type: 'review',
        title: `Revizuire dosar: ${caseData.title}`,
        description: 'Acest dosar nu a avut activitate în ultimele 2 săptămâni',
        caseId: caseData.id,
        priority: 'medium',
      });
    }

    return suggestions;
  }

  // ============================================================================
  // AI Summary Generation
  // ============================================================================

  /**
   * Generate AI summary of the day's briefing.
   */
  private async generateAISummary(
    data: UserBriefingData,
    firmId: string,
    batchJobId: string
  ): Promise<{
    summary: string;
    inputTokens: number;
    outputTokens: number;
    costEur: number;
  }> {
    const prompt = this.buildSummaryPrompt(data);

    const response = await aiClient.complete(
      prompt,
      {
        feature: this.feature,
        firmId,
        batchJobId,
      },
      {
        model: 'claude-3-5-haiku-20241022', // Use Haiku for cost efficiency
        maxTokens: 300,
        temperature: 0.5,
        system: `Ești un asistent juridic AI. Generezi un rezumat scurt și util pentru avocatul care își începe ziua de lucru.

Reguli:
- Fii CONCIS - maxim 3-4 propoziții
- Evidențiază cele mai urgente probleme
- Menționează termenele critice
- Folosește un ton profesional dar prietenos
- Răspunde EXCLUSIV în limba ROMÂNĂ`,
      }
    );

    return {
      summary: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    };
  }

  /**
   * Build prompt for AI summary generation.
   */
  private buildSummaryPrompt(data: UserBriefingData): string {
    let prompt = 'Generează un rezumat scurt al zilei pentru avocat:\n\n';

    // Prioritized tasks
    const highPriority = data.prioritizedTasks.filter((t) => t.priority === 'high');
    if (highPriority.length > 0) {
      prompt += `SARCINI URGENTE (${highPriority.length}):\n`;
      highPriority.slice(0, 3).forEach((t) => {
        prompt += `- ${t.reason}: ${t.title}`;
        if (t.caseTitle) prompt += ` (${t.caseTitle})`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    // Key deadlines
    if (data.keyDeadlines.length > 0) {
      prompt += `TERMENE APROPIATE (${data.keyDeadlines.length}):\n`;
      data.keyDeadlines.slice(0, 3).forEach((d) => {
        prompt += `- În ${d.daysUntil} zile: ${d.title}`;
        if (d.caseTitle) prompt += ` (${d.caseTitle})`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    // Risk alerts
    if (data.riskAlerts.length > 0) {
      prompt += `ALERTE (${data.riskAlerts.length}):\n`;
      data.riskAlerts.slice(0, 2).forEach((a) => {
        prompt += `- ${a.title}\n`;
      });
      prompt += '\n';
    }

    prompt += 'Generează un rezumat scurt și util pentru începutul zilei.';

    return prompt;
  }
}

// Export singleton instance
export const morningBriefingsProcessor = new MorningBriefingsProcessor();
