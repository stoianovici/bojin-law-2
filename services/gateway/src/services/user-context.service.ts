/**
 * User Context Service
 * OPS-117: Pre-computed daily context for fast AI access
 *
 * Generates and caches a user's daily context including:
 * - New items since last interaction
 * - Today's schedule
 * - Urgent/overdue items
 * - Active cases summary
 *
 * This context is injected into AI system prompts (~600-800 tokens)
 * to enable faster, more contextual responses.
 */

import { prisma, redis } from '@legal-platform/database';
import { TaskStatus, ActivityEventType as PrismaActivityEventType } from '@prisma/client';
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  differenceInDays,
  differenceInMinutes,
} from 'date-fns';
import { ro } from 'date-fns/locale';
import type {
  UserContextData,
  TodayScheduleEvent,
  UrgentItem,
  RecentActivityEntry,
  ActiveCaseSummary,
  ActivityEventType,
} from '@legal-platform/types';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface CachedContext {
  contextData: UserContextData;
  computedAt: string;
}

interface UserContextOptions {
  forceRefresh?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY_PREFIX = 'user-context:';
const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
const CONTEXT_TOKEN_BUDGET = 800;

// ============================================================================
// Service
// ============================================================================

export class UserContextService {
  /**
   * Get or generate user's daily context
   */
  async getContext(
    userId: string,
    firmId: string,
    options?: UserContextOptions
  ): Promise<UserContextData> {
    // Try cache first (unless force refresh)
    if (!options?.forceRefresh) {
      const cached = await this.getFromCache(userId);
      if (cached && !this.isStale(cached)) {
        return cached.contextData;
      }
    }

    // Generate fresh context
    const context = await this.generateContext(userId, firmId);

    // Cache it (fire and forget - don't block response)
    this.saveToCache(userId, context).catch((err) => {
      console.error('[UserContextService] Error caching context:', err);
    });

    // Save to DB for persistence
    this.saveToDB(userId, firmId, context).catch((err) => {
      console.error('[UserContextService] Error saving context to DB:', err);
    });

    return context;
  }

  /**
   * Get context formatted for AI system prompt injection
   */
  async getContextForPrompt(
    userId: string,
    firmId: string,
    options?: UserContextOptions
  ): Promise<string> {
    const context = await this.getContext(userId, firmId, options);
    return this.formatForPrompt(context);
  }

  /**
   * Invalidate context (called when relevant events occur)
   */
  async invalidate(userId: string): Promise<void> {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    await redis.del(key);
    console.log(`[UserContextService] Invalidated context for user ${userId}`);
  }

  /**
   * Invalidate context for multiple users
   */
  async invalidateMany(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const keys = userIds.map((id) => `${CACHE_KEY_PREFIX}${id}`);
    await redis.del(...keys);
    console.log(`[UserContextService] Invalidated context for ${userIds.length} users`);
  }

  // ============================================================================
  // Context Generation
  // ============================================================================

  /**
   * Generate fresh context from database
   */
  private async generateContext(userId: string, firmId: string): Promise<UserContextData> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterday = subDays(now, 1);

    console.log(`[UserContextService] Generating context for user ${userId}`);
    const startTime = Date.now();

    // Parallel queries for speed
    const [recentEvents, todayTasks, overdueTasks, upcomingTasks, activeCases, unreadEmailCount] =
      await Promise.all([
        // Recent activity (last 24h)
        prisma.userActivityEvent.findMany({
          where: { userId, occurredAt: { gte: yesterday } },
          orderBy: { occurredAt: 'desc' },
          take: 10,
        }),

        // Tasks due today
        prisma.task.findMany({
          where: {
            assignedTo: userId,
            firmId,
            dueDate: { gte: todayStart, lte: todayEnd },
            status: { not: TaskStatus.Completed },
          },
          include: { case: { select: { id: true, title: true } } },
          orderBy: { dueTime: 'asc' },
          take: 10,
        }),

        // Overdue tasks
        prisma.task.findMany({
          where: {
            assignedTo: userId,
            firmId,
            dueDate: { lt: todayStart },
            status: { not: TaskStatus.Completed },
          },
          include: { case: { select: { id: true, title: true } } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),

        // Upcoming tasks (next 7 days, for active cases reference)
        prisma.task.findMany({
          where: {
            assignedTo: userId,
            firmId,
            dueDate: { gt: todayEnd, lte: subDays(now, -7) },
            status: { not: TaskStatus.Completed },
          },
          include: { case: { select: { id: true } } },
          orderBy: { dueDate: 'asc' },
          take: 20,
        }),

        // Active cases with recent activity
        prisma.case.findMany({
          where: {
            firmId,
            status: 'Active',
            OR: [
              { teamMembers: { some: { userId } } },
              { tasks: { some: { assignedTo: userId } } },
            ],
          },
          include: {
            _count: {
              select: {
                documents: true,
                emailLinks: true,
              },
            },
            tasks: {
              where: { status: { not: TaskStatus.Completed } },
              orderBy: { dueDate: 'asc' },
              take: 1,
              select: { dueDate: true },
            },
          },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),

        // Unread email count
        prisma.email.count({
          where: { userId, isRead: false },
        }),
      ]);

    // Count new items from activity events
    const newEmails = recentEvents.filter(
      (e) =>
        e.eventType === PrismaActivityEventType.EMAIL_RECEIVED ||
        e.eventType === PrismaActivityEventType.EMAIL_FROM_COURT
    ).length;
    const newDocs = recentEvents.filter(
      (e) => e.eventType === PrismaActivityEventType.DOCUMENT_UPLOADED
    ).length;

    // Build today's schedule
    const todayEvents: TodayScheduleEvent[] = todayTasks.map((t) => ({
      id: t.id,
      type: this.mapTaskType(t.type),
      title: t.title,
      time: t.dueTime || undefined,
      caseId: t.caseId || undefined,
      caseName: t.case?.title,
    }));

    // Sort by time if available
    todayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // Build urgent items
    const urgentItems: UrgentItem[] = [
      // Overdue tasks
      ...overdueTasks.map((t) => ({
        type: 'overdue_task' as const,
        title: t.title,
        entityId: t.id,
        caseId: t.caseId || undefined,
        daysOverdue: differenceInDays(now, t.dueDate || now),
      })),
      // Court emails from recent activity
      ...recentEvents
        .filter((e) => e.eventType === PrismaActivityEventType.EMAIL_FROM_COURT)
        .map((e) => ({
          type: 'court_email' as const,
          title: e.entityTitle || 'Email de la instanță',
          entityId: e.entityId,
        })),
    ];

    // Build recent activity (cast Prisma enum to shared type)
    const recentActivity: RecentActivityEntry[] = recentEvents.slice(0, 5).map((e) => ({
      type: e.eventType as unknown as ActivityEventType,
      title: e.entityTitle || '',
      entityId: e.entityId,
      occurredAt: e.occurredAt.toISOString(),
    }));

    // Build active cases summary
    // Compute which cases have recent activity
    const casesWithActivity = new Set<string>();
    recentEvents.forEach((e) => {
      const metadata = e.metadata as { caseId?: string; caseIds?: string[] } | null;
      if (metadata?.caseId) casesWithActivity.add(metadata.caseId);
      if (metadata?.caseIds) metadata.caseIds.forEach((id) => casesWithActivity.add(id));
    });

    const activeCasesSummary: ActiveCaseSummary[] = activeCases.map((c) => ({
      id: c.id,
      name: c.title,
      nextDeadline: c.tasks[0]?.dueDate?.toISOString(),
      unreadEmails: 0, // Would need email-case join to compute accurately
      recentActivity: casesWithActivity.has(c.id),
    }));

    const context: UserContextData = {
      newEmailsCount: newEmails,
      newDocumentsCount: newDocs,
      pendingTasksCount: todayTasks.length,
      overdueTasksCount: overdueTasks.length,
      todayEvents,
      urgentItems,
      recentActivity,
      activeCases: activeCasesSummary,
    };

    const elapsed = Date.now() - startTime;
    console.log(`[UserContextService] Generated context in ${elapsed}ms`);

    return context;
  }

  /**
   * Map task type to schedule event type
   */
  private mapTaskType(taskType: string | null): 'hearing' | 'meeting' | 'deadline' | 'task' {
    switch (taskType) {
      case 'CourtDate':
        return 'hearing';
      case 'Meeting':
        return 'meeting';
      default:
        return 'task';
    }
  }

  // ============================================================================
  // Prompt Formatting
  // ============================================================================

  /**
   * Format context for AI system prompt injection
   * Target: ~600-800 tokens
   */
  private formatForPrompt(context: UserContextData): string {
    const lines: string[] = [];

    // New items summary
    if (context.newEmailsCount || context.newDocumentsCount) {
      lines.push('### Nou de ieri');
      if (context.newEmailsCount) lines.push(`- ${context.newEmailsCount} emailuri noi`);
      if (context.newDocumentsCount) lines.push(`- ${context.newDocumentsCount} documente noi`);
      lines.push('');
    }

    // Urgent items - show first
    if (context.urgentItems.length > 0) {
      lines.push('### ⚠️ Urgente');
      for (const item of context.urgentItems.slice(0, 3)) {
        if (item.type === 'overdue_task') {
          lines.push(`- [ÎNTÂRZIAT ${item.daysOverdue}z] ${item.title}`);
        } else if (item.type === 'court_email') {
          lines.push(`- [INSTANȚĂ] ${item.title}`);
        } else {
          lines.push(`- ${item.title}`);
        }
      }
      if (context.urgentItems.length > 3) {
        lines.push(`- ... și alte ${context.urgentItems.length - 3} urgente`);
      }
      lines.push('');
    }

    // Today's schedule
    if (context.todayEvents.length > 0) {
      lines.push('### Programul de azi');
      for (const event of context.todayEvents.slice(0, 5)) {
        const time = event.time ? `${event.time} ` : '';
        const caseRef = event.caseName ? ` (${event.caseName})` : '';
        lines.push(`- ${time}${event.title}${caseRef}`);
      }
      if (context.todayEvents.length > 5) {
        lines.push(`- ... și alte ${context.todayEvents.length - 5} evenimente`);
      }
      lines.push('');
    }

    // Active cases summary (compact)
    if (context.activeCases.length > 0) {
      lines.push(`### Dosare active (${context.activeCases.length})`);
      for (const c of context.activeCases.slice(0, 5)) {
        const deadline = c.nextDeadline
          ? ` - termen ${format(new Date(c.nextDeadline), 'd MMM', { locale: ro })}`
          : '';
        const activity = c.recentActivity ? ' 🔵' : '';
        lines.push(`- ${c.name}${deadline}${activity}`);
      }
      if (context.activeCases.length > 5) {
        lines.push(`- ... și alte ${context.activeCases.length - 5} dosare`);
      }
    }

    // Summary line at the end
    if (context.overdueTasksCount > 0 || context.pendingTasksCount > 0) {
      lines.push('');
      const parts: string[] = [];
      if (context.overdueTasksCount > 0) {
        parts.push(
          `${context.overdueTasksCount} restant${context.overdueTasksCount === 1 ? 'ă' : 'e'}`
        );
      }
      if (context.pendingTasksCount > 0) {
        parts.push(`${context.pendingTasksCount} pt azi`);
      }
      lines.push(`*Sarcini: ${parts.join(', ')}*`);
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Cache Operations
  // ============================================================================

  private async getFromCache(userId: string): Promise<CachedContext | null> {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = await redis.get(key);
    if (!cached) return null;
    try {
      return JSON.parse(cached) as CachedContext;
    } catch {
      return null;
    }
  }

  private async saveToCache(userId: string, context: UserContextData): Promise<void> {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    const cached: CachedContext = {
      contextData: context,
      computedAt: new Date().toISOString(),
    };
    await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(cached));
  }

  private isStale(cached: CachedContext): boolean {
    const computedAt = new Date(cached.computedAt);
    return differenceInMinutes(new Date(), computedAt) > 30;
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async saveToDB(userId: string, firmId: string, context: UserContextData): Promise<void> {
    const now = new Date();
    const validUntil = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

    await prisma.userDailyContext.upsert({
      where: { userId },
      create: {
        userId,
        firmId,
        contextData: JSON.parse(JSON.stringify(context)) as Prisma.InputJsonValue,
        lastComputedAt: now,
        validUntil,
      },
      update: {
        contextData: JSON.parse(JSON.stringify(context)) as Prisma.InputJsonValue,
        lastComputedAt: now,
        validUntil,
      },
    });
  }
}

// Export singleton instance
export const userContextService = new UserContextService();
