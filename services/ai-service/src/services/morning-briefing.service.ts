/**
 * Morning Briefing Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Generates daily AI-powered morning briefings for users with prioritized tasks,
 * key deadlines, risk alerts, and proactive suggestions.
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import {
  MorningBriefingContent,
  PrioritizedTask,
  DeadlineInfo,
  RiskAlert,
  GeneratedSuggestion,
  MORNING_BRIEFING_PROMPT,
} from '@legal-platform/types';
import { ClaudeModel } from '@legal-platform/types';
import logger from '../lib/logger';
import { config } from '../config';
import { providerManager, ProviderRequest } from './provider-manager.service';

// Cache TTL in seconds (24 hours as per story requirements)
const BRIEFING_CACHE_TTL = 86400;

// Maximum items for briefing sections
const MAX_PRIORITIZED_TASKS = 10;
const MAX_DEADLINES = 5;
const MAX_RISK_ALERTS = 5;
const MAX_SUGGESTIONS = 5;

// Priority weight factors (must sum to 1.0)
const PRIORITY_WEIGHTS = {
  dueDate: 0.3,
  priority: 0.25,
  clientImportance: 0.15,
  dependencies: 0.15,
  historicalPatterns: 0.15,
};

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

export class MorningBriefingService {
  /**
   * Generate a morning briefing for a user
   */
  async generateMorningBriefing(
    userId: string,
    firmId: string,
    date?: Date
  ): Promise<MorningBriefingContent> {
    const briefingDate = date || new Date();
    const dateKey = this.formatDateKey(briefingDate);
    const cacheKey = this.buildCacheKey(userId, firmId, dateKey);

    // Check if already generated today
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Morning briefing cache hit', { userId, firmId, date: dateKey });
      return cached;
    }

    logger.info('Generating morning briefing', { userId, firmId, date: dateKey });
    const startTime = Date.now();

    try {
      // Gather all data needed for briefing in parallel
      const [
        user,
        tasksDueToday,
        tasksDueThisWeek,
        overdueTasks,
        upcomingDeadlines,
        pendingExtractions,
        activeRisks,
      ] = await Promise.all([
        this.getUser(userId),
        this.getTasksDueToday(userId, firmId, briefingDate),
        this.getTasksDueThisWeek(userId, firmId, briefingDate),
        this.getOverdueTasks(userId, firmId, briefingDate),
        this.getUpcomingDeadlines(userId, firmId, briefingDate),
        this.getPendingExtractions(userId, firmId),
        this.getActiveRisks(userId, firmId),
      ]);

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Build the AI prompt
      const prompt = this.buildPrompt({
        date: briefingDate,
        userName: `${user.firstName} ${user.lastName}`,
        userRole: user.role,
        tasksDueToday,
        tasksDueThisWeek,
        overdueTasks,
        upcomingDeadlines,
        pendingExtractions,
        activeRisks,
      });

      // Call AI to generate briefing
      const request: ProviderRequest = {
        systemPrompt: `You are an AI assistant for a Romanian law firm platform. Generate a comprehensive morning briefing that helps legal professionals start their day effectively. Always respond with valid JSON.`,
        prompt,
        model: ClaudeModel.Sonnet, // Use Sonnet for comprehensive analysis
        maxTokens: 2000,
        temperature: 0.4,
      };

      const response = await providerManager.execute(request);
      const briefing = this.parseBriefingResponse(response.content, {
        tasksDueToday,
        tasksDueThisWeek,
        overdueTasks,
        upcomingDeadlines,
      });

      // Add token usage
      briefing.tokensUsed = response.inputTokens + response.outputTokens;

      // Store in database
      await this.storeBriefing(userId, firmId, briefingDate, briefing);

      // Cache the result
      await this.setCache(cacheKey, briefing);

      const duration = Date.now() - startTime;
      logger.info('Morning briefing generated', {
        userId,
        firmId,
        date: dateKey,
        durationMs: duration,
        tokensUsed: briefing.tokensUsed,
        prioritizedTaskCount: briefing.prioritizedTasks.length,
        deadlineCount: briefing.keyDeadlines.length,
      });

      return briefing;
    } catch (error) {
      logger.error('Failed to generate morning briefing', {
        userId,
        firmId,
        date: dateKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get today's briefing for a user (from cache or generate)
   */
  async getTodaysBriefing(userId: string, firmId: string): Promise<MorningBriefingContent | null> {
    const today = new Date();
    const dateKey = this.formatDateKey(today);

    // Check database first
    const existing = await prisma.morningBriefing.findUnique({
      where: {
        userId_briefingDate: {
          userId,
          briefingDate: this.startOfDay(today),
        },
      },
    });

    if (existing) {
      return {
        prioritizedTasks: existing.prioritizedTasks as unknown as PrioritizedTask[],
        keyDeadlines: existing.keyDeadlines as unknown as DeadlineInfo[],
        riskAlerts: existing.riskAlerts as unknown as RiskAlert[],
        suggestions: existing.suggestions as unknown as GeneratedSuggestion[],
        summary: existing.summary,
        tokensUsed: existing.tokensUsed,
      };
    }

    // Generate if not exists
    return this.generateMorningBriefing(userId, firmId, today);
  }

  /**
   * Mark briefing as viewed
   */
  async markBriefingViewed(briefingId: string, userId: string, firmId: string) {
    return prisma.morningBriefing.update({
      where: {
        id: briefingId,
        userId,
        firmId,
      },
      data: {
        isViewed: true,
        viewedAt: new Date(),
      },
    });
  }

  /**
   * Get user info
   */
  private async getUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        preferences: true,
      },
    });
  }

  /**
   * Get tasks due today
   */
  private async getTasksDueToday(userId: string, firmId: string, date: Date) {
    const startOfDay = this.startOfDay(date);
    const endOfDay = this.endOfDay(date);

    return prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 20,
    });
  }

  /**
   * Get tasks due this week
   */
  private async getTasksDueThisWeek(userId: string, firmId: string, date: Date) {
    const startOfDay = this.endOfDay(date);
    const endOfWeek = new Date(date);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: {
          gt: startOfDay,
          lte: endOfWeek,
        },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });
  }

  /**
   * Get overdue tasks
   */
  private async getOverdueTasks(userId: string, firmId: string, date: Date) {
    const startOfDay = this.startOfDay(date);

    return prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { lt: startOfDay },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });
  }

  /**
   * Get upcoming deadlines (tasks with urgent priority or court dates)
   */
  private async getUpcomingDeadlines(userId: string, firmId: string, date: Date) {
    const twoWeeksFromNow = new Date(date);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    return prisma.task.findMany({
      where: {
        assignedTo: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: {
          gte: this.startOfDay(date),
          lte: twoWeeksFromNow,
        },
        OR: [{ priority: 'Urgent' }, { type: 'CourtDate' }],
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: MAX_DEADLINES,
    });
  }

  /**
   * Get pending extracted items from emails
   */
  private async getPendingExtractions(userId: string, firmId: string) {
    // Get pending deadlines, commitments, and action items from extracted items
    const [deadlines, actionItems] = await Promise.all([
      prisma.extractedDeadline.findMany({
        where: { firmId, status: 'Pending' },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          id: true,
          description: true,
          dueDate: true,
          confidence: true,
        },
      }),
      prisma.extractedActionItem.findMany({
        where: { firmId, status: 'Pending' },
        orderBy: { priority: 'desc' },
        take: 5,
        select: {
          id: true,
          description: true,
          priority: true,
          confidence: true,
        },
      }),
    ]);

    return { deadlines, actionItems };
  }

  /**
   * Get active risk indicators
   */
  private async getActiveRisks(userId: string, firmId: string) {
    return prisma.riskIndicator.findMany({
      where: {
        firmId,
        isResolved: false,
        severity: { in: ['Medium', 'High'] },
      },
      orderBy: { severity: 'desc' },
      take: MAX_RISK_ALERTS,
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Build the AI prompt
   */
  private buildPrompt(data: {
    date: Date;
    userName: string;
    userRole: string;
    tasksDueToday: Array<{
      id: string;
      title: string;
      priority: string;
      case: { title: string; client?: { name: string } | null } | null;
    }>;
    tasksDueThisWeek: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      case: { title: string } | null;
    }>;
    overdueTasks: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      case: { title: string } | null;
    }>;
    upcomingDeadlines: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      type: string;
      case: { title: string } | null;
    }>;
    pendingExtractions: {
      deadlines: Array<{ description: string; dueDate: Date | null }>;
      actionItems: Array<{ description: string; priority: string }>;
    };
    activeRisks: Array<{
      type: string;
      description: string;
      severity: string;
      case: { title: string } | null;
    }>;
  }): string {
    const tasksDueTodayStr =
      data.tasksDueToday.length > 0
        ? data.tasksDueToday
            .map((t) => `- ${t.title} (${t.priority}) - ${t.case?.title || 'No case'}`)
            .join('\n')
        : 'No tasks due today';

    const tasksDueThisWeekStr =
      data.tasksDueThisWeek.length > 0
        ? data.tasksDueThisWeek
            .map(
              (t) =>
                `- ${t.title} (${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'no date'}) - ${t.case?.title || 'No case'}`
            )
            .join('\n')
        : 'No tasks due this week';

    const overdueTasksStr =
      data.overdueTasks.length > 0
        ? data.overdueTasks
            .map(
              (t) =>
                `- ${t.title} (due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'unknown'}) - ${t.case?.title || 'No case'}`
            )
            .join('\n')
        : 'No overdue tasks';

    const upcomingDeadlinesStr =
      data.upcomingDeadlines.length > 0
        ? data.upcomingDeadlines
            .map(
              (d) =>
                `- ${d.title} (${d.type}, ${d.dueDate ? new Date(d.dueDate).toLocaleDateString() : 'no date'}) - ${d.case?.title || 'No case'}`
            )
            .join('\n')
        : 'No urgent deadlines';

    const pendingExtractionsStr =
      [
        ...data.pendingExtractions.deadlines.map(
          (d) =>
            `- Deadline: ${d.description} (${d.dueDate ? new Date(d.dueDate).toLocaleDateString() : 'no date'})`
        ),
        ...data.pendingExtractions.actionItems.map(
          (a) => `- Action: ${a.description} (${a.priority})`
        ),
      ].join('\n') || 'No pending extractions';

    const activeRisksStr =
      data.activeRisks.length > 0
        ? data.activeRisks
            .map(
              (r) => `- ${r.type}: ${r.description} (${r.severity}) - ${r.case?.title || 'General'}`
            )
            .join('\n')
        : 'No active risk indicators';

    return `
Generate a morning briefing for a legal professional. Prioritize their tasks and highlight key items for today.

TODAY'S DATE: ${data.date.toISOString().split('T')[0]}
USER: ${data.userName} (${data.userRole})

TASKS DUE TODAY:
${tasksDueTodayStr}

TASKS DUE THIS WEEK:
${tasksDueThisWeekStr}

OVERDUE TASKS:
${overdueTasksStr}

UPCOMING DEADLINES:
${upcomingDeadlinesStr}

PENDING EXTRACTED ITEMS:
${pendingExtractionsStr}

RISK INDICATORS:
${activeRisksStr}

Generate a briefing with:
1. Summary paragraph (2-3 sentences, encouraging tone)
2. Prioritized task list (top 5) with priority scores (1-10) and reasons
3. Key deadlines to watch with severity levels
4. Risk alerts requiring attention
5. Proactive suggestions for the day

Prioritize tasks based on:
- Due date urgency (30%)
- Task priority level (25%)
- Client importance (15%)
- Blocking dependencies (15%)
- Historical patterns (15%)

Return as JSON:
{
  "summary": string,
  "prioritizedTasks": [{ "taskId": string, "priority": number (1-10), "priorityReason": string, "suggestedTimeSlot": string }],
  "keyDeadlines": [{ "id": string, "title": string, "dueDate": string, "daysUntilDue": number, "severity": "info" | "warning" | "critical", "suggestedActions": [] }],
  "riskAlerts": [{ "type": string, "description": string, "suggestedAction": string, "severity": "low" | "medium" | "high" }],
  "suggestions": [{ "type": string, "category": string, "title": string, "description": string, "suggestedAction": string, "actionPayload": {}, "confidence": number, "priority": string }]
}

Respond ONLY with the JSON object, no additional text.
`.trim();
  }

  /**
   * Parse AI response into briefing content
   */
  private parseBriefingResponse(
    response: string,
    taskData: {
      tasksDueToday: Array<{ id: string; title: string }>;
      tasksDueThisWeek: Array<{ id: string; title: string }>;
      overdueTasks: Array<{ id: string; title: string }>;
      upcomingDeadlines: Array<{ id: string; title: string; dueDate: Date | null }>;
    }
  ): MorningBriefingContent {
    try {
      // Extract JSON from response
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr
          .replace(/```json?\n?/g, '')
          .replace(/```/g, '')
          .trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Map task IDs from actual data
      const allTasks = [
        ...taskData.overdueTasks,
        ...taskData.tasksDueToday,
        ...taskData.tasksDueThisWeek,
      ];

      const prioritizedTasks: PrioritizedTask[] = (parsed.prioritizedTasks || [])
        .slice(0, MAX_PRIORITIZED_TASKS)
        .map(
          (
            pt: {
              taskId?: string;
              priority?: number;
              priorityReason?: string;
              suggestedTimeSlot?: string;
            },
            index: number
          ) => {
            // Try to match task ID or use from actual data
            const task = allTasks[index];
            return {
              taskId: pt.taskId || task?.id || `unknown-${index}`,
              priority: Number(pt.priority) || 10 - index,
              priorityReason: pt.priorityReason || 'Based on due date and priority',
              suggestedTimeSlot: pt.suggestedTimeSlot,
            };
          }
        );

      const keyDeadlines: DeadlineInfo[] = (parsed.keyDeadlines || []).slice(0, MAX_DEADLINES).map(
        (d: {
          id?: string;
          title?: string;
          dueDate?: string;
          daysUntilDue?: number;
          severity?: string;
          suggestedActions?: Array<{
            action: string;
            description: string;
            actionType: string;
            payload: Record<string, unknown>;
          }>;
        }) => ({
          id: d.id || '',
          title: d.title || '',
          dueDate: d.dueDate ? new Date(d.dueDate) : new Date(),
          daysUntilDue: d.daysUntilDue || 0,
          severity: (d.severity || 'info') as 'info' | 'warning' | 'critical',
          suggestedActions: d.suggestedActions || [],
        })
      );

      const riskAlerts: RiskAlert[] = (parsed.riskAlerts || [])
        .slice(0, MAX_RISK_ALERTS)
        .map(
          (r: {
            type?: string;
            description?: string;
            suggestedAction?: string;
            severity?: string;
          }) => ({
            type: r.type || '',
            description: r.description || '',
            suggestedAction: r.suggestedAction || '',
            severity: (r.severity || 'medium') as 'low' | 'medium' | 'high',
          })
        );

      const suggestions: GeneratedSuggestion[] = (parsed.suggestions || [])
        .slice(0, MAX_SUGGESTIONS)
        .map(
          (s: {
            type?: string;
            category?: string;
            title?: string;
            description?: string;
            suggestedAction?: string;
            actionPayload?: Record<string, unknown>;
            confidence?: number;
            priority?: string;
          }) => ({
            type: (s.type || 'TaskSuggestion') as GeneratedSuggestion['type'],
            category: (s.category || 'Task') as GeneratedSuggestion['category'],
            title: s.title || '',
            description: s.description || '',
            suggestedAction: s.suggestedAction || '',
            actionPayload: s.actionPayload || {},
            confidence: Number(s.confidence) || 0.7,
            priority: (s.priority || 'Normal') as GeneratedSuggestion['priority'],
          })
        );

      return {
        prioritizedTasks,
        keyDeadlines,
        riskAlerts,
        suggestions,
        summary: parsed.summary || 'Good morning! Here is your daily briefing.',
        tokensUsed: 0, // Will be set by caller
      };
    } catch (error) {
      logger.error('Failed to parse briefing response', {
        error: error instanceof Error ? error.message : String(error),
        response: response.substring(0, 500),
      });

      // Return minimal briefing on parse failure
      return {
        prioritizedTasks: [],
        keyDeadlines: [],
        riskAlerts: [],
        suggestions: [],
        summary:
          'Good morning! Unable to generate full briefing. Please check your tasks manually.',
        tokensUsed: 0,
      };
    }
  }

  /**
   * Store briefing in database
   */
  private async storeBriefing(
    userId: string,
    firmId: string,
    date: Date,
    briefing: MorningBriefingContent
  ) {
    const briefingDate = this.startOfDay(date);

    await prisma.morningBriefing.upsert({
      where: {
        userId_briefingDate: {
          userId,
          briefingDate,
        },
      },
      create: {
        firmId,
        userId,
        briefingDate,
        prioritizedTasks: JSON.parse(JSON.stringify(briefing.prioritizedTasks)),
        keyDeadlines: JSON.parse(JSON.stringify(briefing.keyDeadlines)),
        riskAlerts: JSON.parse(JSON.stringify(briefing.riskAlerts)),
        suggestions: JSON.parse(JSON.stringify(briefing.suggestions)),
        summary: briefing.summary,
        tokensUsed: briefing.tokensUsed,
      },
      update: {
        prioritizedTasks: JSON.parse(JSON.stringify(briefing.prioritizedTasks)),
        keyDeadlines: JSON.parse(JSON.stringify(briefing.keyDeadlines)),
        riskAlerts: JSON.parse(JSON.stringify(briefing.riskAlerts)),
        suggestions: JSON.parse(JSON.stringify(briefing.suggestions)),
        summary: briefing.summary,
        tokensUsed: briefing.tokensUsed,
      },
    });
  }

  /**
   * Helper: Format date key for caching
   */
  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Helper: Get start of day
   */
  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Helper: Get end of day
   */
  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Build cache key
   */
  private buildCacheKey(userId: string, firmId: string, dateKey: string): string {
    return `briefing:${firmId}:${userId}:${dateKey}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<MorningBriefingContent | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as MorningBriefingContent;
      }
      return null;
    } catch (error) {
      logger.warn('Cache read failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set cache
   */
  private async setCache(key: string, briefing: MorningBriefingContent): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(key, BRIEFING_CACHE_TTL, JSON.stringify(briefing));
    } catch (error) {
      logger.warn('Cache write failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate briefing cache for a user
   */
  async invalidateCache(userId: string, firmId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const pattern = `briefing:${firmId}:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.debug('Briefing cache invalidated', { userId, firmId, keysDeleted: keys.length });
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        userId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Singleton instance
export const morningBriefingService = new MorningBriefingService();
