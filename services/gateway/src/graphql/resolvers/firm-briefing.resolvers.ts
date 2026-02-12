/**
 * Firm Briefing Resolvers V2
 *
 * GraphQL resolvers for the Firm Briefing system.
 * V2: Editor-in-Chief model with editorial slots (lead/secondary/tertiary).
 *
 * Security features:
 * - Rate limiting: 3 generations per user per hour
 * - Concurrent refresh protection: prevents parallel generations
 * - Feature flag: ENABLE_FIRM_BRIEFING env var
 */

import { prisma, redis } from '@legal-platform/database';
import {
  firmOperationsAgentService,
  BriefingResultV2,
} from '../../services/firm-operations-agent.service';
import { firmBriefingFollowupService } from '../../services/firm-briefing-followup.service';
import { isBriefingEligible, isUserPartner } from '../../services/firm-operations-context.service';
import { StoryEntityType } from '../../services/firm-operations.types';
import {
  checkGraphRateLimit,
  type GraphRateLimitConfig,
} from '../../middleware/rate-limit.middleware';
import logger from '../../utils/logger';

// ============================================================================
// Feature Flag & Rate Limiting Configuration
// ============================================================================

const FEATURE_ENABLED = process.env.ENABLE_FIRM_BRIEFING !== 'false';

const BRIEFING_GENERATION_RATE_LIMIT: GraphRateLimitConfig = {
  maxRequests: parseInt(process.env.BRIEFING_GENERATION_RATE_LIMIT_REQUESTS || '3', 10),
  windowSeconds: parseInt(process.env.BRIEFING_GENERATION_RATE_LIMIT_WINDOW || '3600', 10), // 1 hour
  keyPrefix: 'rate:briefing-gen:user',
  perUser: true,
};

const REFRESH_LOCK_PREFIX = 'briefing:refresh:lock:';
const REFRESH_LOCK_TTL_SECONDS = 5; // Short TTL for initial lock check
const IN_PROGRESS_PREFIX = 'briefing:generation:in_progress:';
const IN_PROGRESS_TTL_SECONDS = 300; // 5 minutes max for generation

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

interface BriefingFollowUpInput {
  briefingItemId: string;
  question: string;
  entityType: 'CLIENT' | 'USER' | 'CASE' | 'EMAIL_THREAD';
  entityId: string;
}

// ============================================================================
// Helpers
// ============================================================================

function requireAuth(context: Context): { userId: string; firmId: string } {
  if (!context.user?.id || !context.user?.firmId) {
    throw new Error('Authentication required');
  }
  return { userId: context.user.id, firmId: context.user.firmId };
}

/**
 * Check if feature is enabled.
 */
function requireFeatureEnabled(): void {
  if (!FEATURE_ENABLED) {
    throw new Error('Firm briefing feature is not enabled');
  }
}

/**
 * Rate limit info returned when regeneration is blocked.
 */
interface RateLimitInfo {
  limited: boolean;
  message?: string;
  retryAfterMinutes?: number;
}

/**
 * Check rate limit for briefing generation.
 * Returns rate limit info instead of throwing.
 */
async function checkGenerationRateLimit(userId: string): Promise<RateLimitInfo> {
  const info = await checkGraphRateLimit(userId, BRIEFING_GENERATION_RATE_LIMIT);

  if (info.remaining <= 0) {
    const retryAfterSeconds = info.reset - Math.floor(Date.now() / 1000);
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
    return {
      limited: true,
      message: `Briefing-ul este deja actualizat. Poti regenera in ${retryAfterMinutes} ${retryAfterMinutes === 1 ? 'minut' : 'minute'}.`,
      retryAfterMinutes,
    };
  }

  return { limited: false };
}

/**
 * Two-phase locking for concurrent generation protection:
 * 1. Short lock (5s) to check and set in-progress flag atomically
 * 2. In-progress flag (5 min) that persists until generation completes
 *
 * This prevents race conditions where the short lock expires but generation
 * is still running.
 */

/**
 * Check if generation is already in progress for this user.
 */
async function isGenerationInProgress(userId: string): Promise<boolean> {
  const key = `${IN_PROGRESS_PREFIX}${userId}`;
  const result = await redis.get(key);
  return result !== null;
}

/**
 * Set the in-progress flag for generation.
 */
async function setGenerationInProgress(userId: string): Promise<void> {
  const key = `${IN_PROGRESS_PREFIX}${userId}`;
  await redis.setex(key, IN_PROGRESS_TTL_SECONDS, Date.now().toString());
}

/**
 * Clear the in-progress flag when generation completes.
 */
async function clearGenerationInProgress(userId: string): Promise<void> {
  const key = `${IN_PROGRESS_PREFIX}${userId}`;
  await redis.del(key);
}

/**
 * Acquire refresh lock using two-phase locking.
 * Phase 1: Acquire short lock to check/set in-progress flag atomically
 * Phase 2: Set in-progress flag that persists until generation completes
 *
 * Returns true if lock acquired, false if generation already in progress.
 */
async function acquireRefreshLock(userId: string): Promise<boolean> {
  const lockKey = `${REFRESH_LOCK_PREFIX}${userId}`;

  // Phase 1: Quick atomic check - try to acquire short lock
  const result = await redis.set(
    lockKey,
    Date.now().toString(),
    'EX',
    REFRESH_LOCK_TTL_SECONDS,
    'NX'
  );

  if (result !== 'OK') {
    // Another request is checking/setting the in-progress flag
    return false;
  }

  try {
    // Check if generation is already in progress (from a previous request)
    if (await isGenerationInProgress(userId)) {
      // Generation running from a previous request, release our short lock
      await redis.del(lockKey);
      return false;
    }

    // Phase 2: Set the in-progress flag that persists until we're done
    await setGenerationInProgress(userId);
    return true;
  } finally {
    // Release the short lock - in-progress flag will protect against races
    await redis.del(lockKey);
  }
}

/**
 * Release refresh lock and clear in-progress flag.
 */
async function releaseRefreshLock(userId: string): Promise<void> {
  await clearGenerationInProgress(userId);
}

/**
 * Sanitize follow-up question input to prevent prompt injection.
 * - Limits length to 500 characters
 * - Removes control characters
 * - Strips HTML/XML tags
 * - Removes potential injection patterns
 */
function sanitizeFollowUpQuestion(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return (
    input
      // Limit length
      .slice(0, 500)
      // Remove control characters (except newlines and tabs)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Strip HTML/XML tags
      .replace(/<[^>]*>/g, '')
      // Remove potential prompt injection patterns
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      .replace(/\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi, '') // System tags
      .replace(/\[INSTRUCTION\][\s\S]*?\[\/INSTRUCTION\]/gi, '') // Instruction tags
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Validate briefing item ID format (must be a reasonable string ID).
 */
function isValidBriefingItemId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // Briefing item IDs are typically like "lead-1", "secondary-2", etc.
  // or UUIDs for backward compatibility
  const validPattern = /^[a-zA-Z0-9_-]{1,50}$/;
  return validPattern.test(id);
}

/**
 * Transform BriefingResultV2 to GraphQL response format.
 */
function toGraphQL(result: BriefingResultV2, rateLimitInfo?: RateLimitInfo) {
  // Transform a StoryItem to GraphQL format
  const transformStoryItem = (item: BriefingResultV2['lead'][0]) => ({
    id: item.id,
    headline: item.headline || '',
    summary: item.summary || '',
    details: (item.details || []).map((detail) => ({
      id: detail.id,
      title: detail.title || '',
      subtitle: detail.subtitle || '',
      dueDate: detail.dueDate,
      dueDateLabel: detail.dueDateLabel,
      status: detail.status?.toUpperCase().replace('-', '_'),
      href: detail.href,
    })),
    category: (item.category || 'CASE').toUpperCase(),
    urgency: item.urgency, // Already uppercase from agent
    href: item.href,
    entityType: item.entityType?.toUpperCase().replace('-', '_'),
    entityId: item.entityId,
    canAskFollowUp: item.canAskFollowUp ?? false,
  });

  return {
    id: result.id,
    edition: {
      date: result.edition.date,
      mood: result.edition.mood.toUpperCase(),
      editorNote: result.edition.editorNote,
    },
    lead: result.lead.map(transformStoryItem),
    secondary: {
      title: result.secondary.title,
      items: result.secondary.items.map(transformStoryItem),
    },
    tertiary: {
      title: result.tertiary.title,
      items: result.tertiary.items.map(transformStoryItem),
    },
    quickStats: result.quickStats,
    totalTokens: result.totalTokens,
    totalCostEur: result.totalCostEur,
    isStale: result.isStale,
    isViewed: result.isViewed ?? false,
    generatedAt: result.generatedAt,
    schemaVersion: result.schemaVersion,
    rateLimitInfo: rateLimitInfo?.limited ? rateLimitInfo : null,
  };
}

// ============================================================================
// MorningBriefing → V2 Format Transformation (for non-partners)
// ============================================================================

interface MorningBriefingTask {
  taskId: string;
  title: string;
  caseTitle: string | null;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

interface MorningBriefingDeadline {
  type: string;
  title: string;
  caseId: string | null;
  caseTitle: string | null;
  dueAt: string;
  daysUntil: number;
}

interface MorningBriefingAlert {
  type: string;
  severity: 'high' | 'medium';
  title: string;
  caseId?: string;
  caseTitle?: string;
  description: string;
}

interface MorningBriefingSuggestion {
  type: string;
  title: string;
  description: string;
  caseId?: string;
  priority: 'high' | 'medium' | 'low';
}

interface MorningBriefingData {
  id: string;
  userId: string;
  firmId: string;
  briefingDate: Date;
  prioritizedTasks: MorningBriefingTask[];
  keyDeadlines: MorningBriefingDeadline[];
  riskAlerts: MorningBriefingAlert[];
  suggestions: MorningBriefingSuggestion[];
  summary: string;
  isViewed: boolean;
  generatedAt: Date;
  tokensUsed: number;
}

/**
 * Transform MorningBriefing to V2 GraphQL format.
 * Maps the simpler personal briefing structure to editorial slots.
 */
function morningBriefingToGraphQL(briefing: MorningBriefingData, rateLimitInfo?: RateLimitInfo) {
  const tasks = briefing.prioritizedTasks || [];
  const deadlines = briefing.keyDeadlines || [];
  const alerts = briefing.riskAlerts || [];
  const suggestions = briefing.suggestions || [];

  // Determine mood based on content
  const hasHighPriorityTasks = tasks.some((t) => t.priority === 'high');
  const hasHighAlerts = alerts.some((a) => a.severity === 'high');
  const mood =
    hasHighAlerts || hasHighPriorityTasks
      ? 'URGENT'
      : tasks.length === 0 && alerts.length === 0
        ? 'STEADY'
        : 'FOCUSED';

  // Lead: High priority tasks and high severity alerts (max 2)
  const leadItems: ReturnType<typeof createStoryItem>[] = [];

  // Add high priority alerts first
  for (const alert of alerts.filter((a) => a.severity === 'high').slice(0, 1)) {
    leadItems.push(
      createStoryItem({
        id: `alert-${alert.type}-${alert.caseId || 'general'}`,
        headline: alert.title,
        summary: alert.description,
        category: 'CASE',
        urgency: 'HIGH',
        href: alert.caseId ? `/cases/${alert.caseId}` : undefined,
        entityType: alert.caseId ? 'CASE' : undefined,
        entityId: alert.caseId,
        details: [],
      })
    );
  }

  // Add high priority tasks
  for (const task of tasks.filter((t) => t.priority === 'high').slice(0, 2 - leadItems.length)) {
    leadItems.push(
      createStoryItem({
        id: `task-${task.taskId}`,
        headline: task.title,
        summary: task.reason + (task.caseTitle ? ` · ${task.caseTitle}` : ''),
        category: 'DEADLINE',
        urgency: 'HIGH',
        href: `/tasks/${task.taskId}`,
        entityType: 'CASE',
        details: [],
      })
    );
  }

  // Secondary: Deadlines and medium priority items
  const secondaryItems: ReturnType<typeof createStoryItem>[] = [];

  // Add deadlines
  for (const deadline of deadlines.slice(0, 3)) {
    const daysLabel =
      deadline.daysUntil === 0
        ? 'Astăzi'
        : deadline.daysUntil === 1
          ? 'Mâine'
          : `În ${deadline.daysUntil} zile`;
    secondaryItems.push(
      createStoryItem({
        id: `deadline-${deadline.caseId || deadline.title}`,
        headline: deadline.title,
        summary: `${daysLabel}${deadline.caseTitle ? ` · ${deadline.caseTitle}` : ''}`,
        category: 'DEADLINE',
        urgency: deadline.daysUntil <= 1 ? 'MEDIUM' : 'LOW',
        href: deadline.caseId ? `/cases/${deadline.caseId}` : undefined,
        entityType: deadline.caseId ? 'CASE' : undefined,
        entityId: deadline.caseId,
        details: [],
      })
    );
  }

  // Add medium alerts
  for (const alert of alerts.filter((a) => a.severity === 'medium').slice(0, 2)) {
    secondaryItems.push(
      createStoryItem({
        id: `alert-${alert.type}-${alert.caseId || 'general'}`,
        headline: alert.title,
        summary: alert.description,
        category: 'CASE',
        urgency: 'MEDIUM',
        href: alert.caseId ? `/cases/${alert.caseId}` : undefined,
        entityType: alert.caseId ? 'CASE' : undefined,
        entityId: alert.caseId,
        details: [],
      })
    );
  }

  // Tertiary: Medium/low priority tasks and suggestions
  const tertiaryItems: ReturnType<typeof createStoryItem>[] = [];

  // Add medium/low tasks not in lead
  const remainingTasks = tasks.filter((t) => t.priority !== 'high').slice(0, 4);
  for (const task of remainingTasks) {
    tertiaryItems.push(
      createStoryItem({
        id: `task-${task.taskId}`,
        headline: task.title,
        summary: task.caseTitle || task.reason,
        category: 'DEADLINE',
        urgency: 'LOW',
        href: `/tasks/${task.taskId}`,
        details: [],
      })
    );
  }

  // Add suggestions
  for (const suggestion of suggestions.slice(0, 2)) {
    tertiaryItems.push(
      createStoryItem({
        id: `suggestion-${suggestion.type}-${suggestion.caseId || 'general'}`,
        headline: suggestion.title,
        summary: suggestion.description,
        category: 'CASE',
        urgency: 'LOW',
        href: suggestion.caseId ? `/cases/${suggestion.caseId}` : undefined,
        entityType: suggestion.caseId ? 'CASE' : undefined,
        entityId: suggestion.caseId,
        details: [],
      })
    );
  }

  // Compute quick stats (simpler version for personal briefing - no firm-wide data)
  const quickStats = {
    activeCases: new Set([
      ...tasks.filter((t) => t.caseTitle).map((t) => t.caseTitle),
      ...deadlines.filter((d) => d.caseId).map((d) => d.caseId),
    ]).size,
    urgentTasks: tasks.filter((t) => t.priority === 'high').length,
    teamUtilization: 0, // Not applicable for personal briefing
    unreadEmails: 0, // Would need separate query
    overdueItems: alerts.filter((a) => a.type === 'overdue').length,
    upcomingDeadlines: deadlines.length,
  };

  return {
    id: briefing.id,
    edition: {
      date: briefing.briefingDate.toISOString().split('T')[0],
      mood,
      editorNote: briefing.summary,
    },
    lead: leadItems,
    secondary: {
      title: secondaryItems.length > 0 ? 'Termene și Atenționări' : 'Actualizări',
      items: secondaryItems,
    },
    tertiary: {
      title: 'Pe Scurt',
      items: tertiaryItems,
    },
    quickStats,
    totalTokens: briefing.tokensUsed,
    totalCostEur: null, // Not tracked for morning briefings
    isStale: false,
    isViewed: briefing.isViewed,
    generatedAt: briefing.generatedAt.toISOString(),
    schemaVersion: 2,
    rateLimitInfo: rateLimitInfo?.limited ? rateLimitInfo : null,
  };
}

/**
 * Helper to create a properly typed story item.
 */
function createStoryItem(params: {
  id: string;
  headline: string;
  summary: string;
  category: string;
  urgency?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  details: Array<{
    id: string;
    title: string;
    subtitle: string;
    status?: string;
    href?: string;
  }>;
}) {
  return {
    id: params.id,
    headline: params.headline,
    summary: params.summary,
    details: params.details,
    category: params.category,
    urgency: params.urgency,
    href: params.href,
    entityType: params.entityType,
    entityId: params.entityId,
    canAskFollowUp: false, // Morning briefings don't support follow-up
  };
}

/**
 * Get today's MorningBriefing for a user.
 */
async function getTodaysMorningBriefing(userId: string): Promise<MorningBriefingData | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const briefing = await prisma.morningBriefing.findUnique({
    where: {
      userId_briefingDate: {
        userId,
        briefingDate: today,
      },
    },
  });

  if (!briefing) {
    return null;
  }

  return {
    id: briefing.id,
    userId: briefing.userId,
    firmId: briefing.firmId,
    briefingDate: briefing.briefingDate,
    prioritizedTasks: briefing.prioritizedTasks as unknown as MorningBriefingTask[],
    keyDeadlines: briefing.keyDeadlines as unknown as MorningBriefingDeadline[],
    riskAlerts: briefing.riskAlerts as unknown as MorningBriefingAlert[],
    suggestions: briefing.suggestions as unknown as MorningBriefingSuggestion[],
    summary: briefing.summary,
    isViewed: briefing.isViewed,
    generatedAt: briefing.generatedAt,
    tokensUsed: briefing.tokensUsed,
  };
}

/**
 * Generate MorningBriefing for a user on-demand.
 * Simplified version of the batch processor logic.
 */
async function generateMorningBriefingForUser(
  userId: string,
  firmId: string,
  force: boolean
): Promise<MorningBriefingData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check for existing if not forcing
  if (!force) {
    const existing = await getTodaysMorningBriefing(userId);
    if (existing) {
      return existing;
    }
  }

  // Gather data in parallel
  const [prioritizedTasks, keyDeadlines, riskAlerts, suggestions] = await Promise.all([
    getPrioritizedTasks(userId, firmId, today),
    getKeyDeadlines(userId, firmId, today),
    getRiskAlerts(userId, firmId, today),
    getSuggestions(userId, firmId, today),
  ]);

  // Generate simple summary (no AI for on-demand - keeps it fast and cheap)
  const urgentCount = prioritizedTasks.filter((t) => t.priority === 'high').length;
  const deadlineCount = keyDeadlines.length;
  const alertCount = riskAlerts.filter((a) => a.severity === 'high').length;

  let summary = 'Bună dimineața!';
  if (urgentCount > 0 || alertCount > 0) {
    summary = `Ai ${urgentCount} sarcini urgente${alertCount > 0 ? ` și ${alertCount} alerte` : ''} de rezolvat.`;
  } else if (deadlineCount > 0) {
    summary = `Ai ${deadlineCount} termene în această săptămână.`;
  } else if (prioritizedTasks.length === 0) {
    summary = 'Nu ai sarcini urgente. O zi bună!';
  }

  // Upsert the briefing
  const briefing = await prisma.morningBriefing.upsert({
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
      tokensUsed: 0, // No AI tokens used for on-demand simple generation
    },
    update: {
      summary,
      prioritizedTasks: JSON.parse(JSON.stringify(prioritizedTasks)),
      keyDeadlines: JSON.parse(JSON.stringify(keyDeadlines)),
      riskAlerts: JSON.parse(JSON.stringify(riskAlerts)),
      suggestions: JSON.parse(JSON.stringify(suggestions)),
      generatedAt: new Date(),
    },
  });

  logger.info('[MorningBriefing] Generated on-demand briefing', {
    userId,
    tasksCount: prioritizedTasks.length,
    deadlinesCount: keyDeadlines.length,
    alertsCount: riskAlerts.length,
  });

  return {
    id: briefing.id,
    userId: briefing.userId,
    firmId: briefing.firmId,
    briefingDate: briefing.briefingDate,
    prioritizedTasks: briefing.prioritizedTasks as unknown as MorningBriefingTask[],
    keyDeadlines: briefing.keyDeadlines as unknown as MorningBriefingDeadline[],
    riskAlerts: briefing.riskAlerts as unknown as MorningBriefingAlert[],
    suggestions: briefing.suggestions as unknown as MorningBriefingSuggestion[],
    summary: briefing.summary,
    isViewed: briefing.isViewed,
    generatedAt: briefing.generatedAt,
    tokensUsed: briefing.tokensUsed,
  };
}

// ============================================================================
// MorningBriefing Data Gathering (simplified from batch processor)
// ============================================================================

async function getPrioritizedTasks(
  userId: string,
  firmId: string,
  today: Date
): Promise<MorningBriefingTask[]> {
  const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

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

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

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

async function getKeyDeadlines(
  userId: string,
  firmId: string,
  today: Date
): Promise<MorningBriefingDeadline[]> {
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
      ],
    },
    include: {
      case: { select: { id: true, title: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 5,
  });

  return tasks.map((task) => ({
    type: 'task',
    title: task.title,
    caseId: task.caseId,
    caseTitle: task.case?.title || null,
    dueAt: task.dueDate!.toISOString(),
    daysUntil: Math.ceil((task.dueDate!.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
  }));
}

async function getRiskAlerts(
  userId: string,
  firmId: string,
  today: Date
): Promise<MorningBriefingAlert[]> {
  const alerts: MorningBriefingAlert[] = [];

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
      description: 'Această sarcină a depășit termenul limită',
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
      description: 'Termen în mai puțin de 48 de ore',
    });
  }

  return alerts.slice(0, 5);
}

async function getSuggestions(
  userId: string,
  firmId: string,
  today: Date
): Promise<MorningBriefingSuggestion[]> {
  const suggestions: MorningBriefingSuggestion[] = [];

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
// Query Resolvers
// ============================================================================

export const firmBriefingQueries = {
  /**
   * Get today's briefing for the current user.
   * - Partners: FirmBriefing (firm-wide view with financials)
   * - Non-partners: MorningBriefing (personal tasks only, no financials)
   * Both are returned in V2 format for unified UI.
   */
  firmBriefing: async (_: unknown, __: unknown, context: Context) => {
    const { userId, firmId } = requireAuth(context);

    // Check feature flag
    if (!FEATURE_ENABLED) {
      return null;
    }

    try {
      // Check if user is a partner
      const isPartner = await isUserPartner(userId, firmId);

      if (isPartner) {
        // Partners get FirmBriefing (firm-wide view)
        const result = await firmOperationsAgentService.getOrGenerate(userId, firmId);
        if (!result) {
          return null;
        }
        return toGraphQL(result);
      } else {
        // Non-partners get MorningBriefing (personal tasks only, auto-generated if missing)
        const morningBriefing = await generateMorningBriefingForUser(userId, firmId, false);
        return morningBriefingToGraphQL(morningBriefing);
      }
    } catch (error) {
      logger.error('[FirmBriefing] Failed to get briefing', {
        userId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Check if current user is eligible for briefing.
   * All active users are now eligible (partners get firm view, others get personal).
   */
  firmBriefingEligibility: async (_: unknown, __: unknown, context: Context) => {
    const { userId, firmId } = requireAuth(context);

    // Check feature flag first
    if (!FEATURE_ENABLED) {
      return {
        eligible: false,
        reason: 'Briefing feature is not enabled',
      };
    }

    // All users are now eligible - partners get firm view, others get personal
    const isPartner = await isUserPartner(userId, firmId);

    return {
      eligible: true,
      reason: isPartner
        ? 'Briefing firmă cu vizualizare completă'
        : 'Briefing personal cu sarcinile tale',
    };
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const firmBriefingMutations = {
  /**
   * Generate or regenerate today's briefing.
   * - Partners: Generate FirmBriefing (firm-wide view)
   * - Non-partners: Generate MorningBriefing (personal tasks)
   *
   * Protected by rate limiting and concurrent refresh lock.
   * When rate limited or locked, returns existing briefing with rateLimitInfo.
   */
  generateFirmBriefing: async (_: unknown, args: { force?: boolean }, context: Context) => {
    const { userId, firmId } = requireAuth(context);

    // Check feature flag
    requireFeatureEnabled();

    // Check if user is a partner
    const isPartner = await isUserPartner(userId, firmId);

    logger.info('[Briefing] Mutation: generateBriefing', {
      userId,
      firmId,
      isPartner,
      force: args.force,
    });

    // Check rate limit - returns info instead of throwing
    const rateLimitInfo = await checkGenerationRateLimit(userId);

    if (rateLimitInfo.limited) {
      // Return existing briefing with rate limit info
      if (isPartner) {
        const existing = await firmOperationsAgentService.getOrGenerate(userId, firmId, {
          force: false,
        });
        if (existing) {
          logger.info('[Briefing] Rate limited, returning existing firm briefing', { userId });
          return toGraphQL(existing, rateLimitInfo);
        }
      } else {
        const existing = await getTodaysMorningBriefing(userId);
        if (existing) {
          logger.info('[Briefing] Rate limited, returning existing morning briefing', { userId });
          return morningBriefingToGraphQL(existing, rateLimitInfo);
        }
      }
      throw new Error(rateLimitInfo.message || 'Prea multe cereri. Incearca din nou mai tarziu.');
    }

    // Try to acquire refresh lock
    const lockAcquired = await acquireRefreshLock(userId);
    if (!lockAcquired) {
      // Return existing briefing with a lock message
      const lockRateLimitInfo: RateLimitInfo = {
        limited: true,
        message: 'Briefing-ul se genereaza deja. Te rugam asteapta cateva secunde.',
        retryAfterMinutes: 1,
      };

      if (isPartner) {
        const existing = await firmOperationsAgentService.getOrGenerate(userId, firmId, {
          force: false,
        });
        if (existing) {
          logger.info('[Briefing] Lock not acquired, returning existing firm briefing', { userId });
          return toGraphQL(existing, lockRateLimitInfo);
        }
      } else {
        const existing = await getTodaysMorningBriefing(userId);
        if (existing) {
          logger.info('[Briefing] Lock not acquired, returning existing morning briefing', {
            userId,
          });
          return morningBriefingToGraphQL(existing, lockRateLimitInfo);
        }
      }
      throw new Error('Briefing-ul se genereaza. Te rugam asteapta cateva secunde.');
    }

    try {
      if (isPartner) {
        // Partners: Generate FirmBriefing
        const result = await firmOperationsAgentService.generate(userId, firmId, {
          force: args.force ?? false,
        });
        return toGraphQL(result);
      } else {
        // Non-partners: Generate MorningBriefing on-demand
        const morningBriefing = await generateMorningBriefingForUser(
          userId,
          firmId,
          args.force ?? false
        );
        return morningBriefingToGraphQL(morningBriefing);
      }
    } catch (error) {
      logger.error('[Briefing] Failed to generate briefing', {
        userId,
        firmId,
        isPartner,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // Always release the lock
      await releaseRefreshLock(userId);
    }
  },

  /**
   * Mark firm briefing as viewed.
   */
  markFirmBriefingViewed: async (_: unknown, args: { briefingId: string }, context: Context) => {
    const { userId } = requireAuth(context);

    await firmOperationsAgentService.markViewed(args.briefingId, userId);

    return true;
  },

  /**
   * Ask a follow-up question about a briefing item.
   * Includes input sanitization for security.
   */
  askBriefingFollowUp: async (
    _: unknown,
    args: { input: BriefingFollowUpInput },
    context: Context
  ) => {
    const { userId, firmId } = requireAuth(context);

    // Check feature flag
    requireFeatureEnabled();

    // Validate and sanitize inputs
    const sanitizedQuestion = sanitizeFollowUpQuestion(args.input.question);

    if (!sanitizedQuestion) {
      throw new Error('Întrebarea nu poate fi goală');
    }

    if (!isValidBriefingItemId(args.input.briefingItemId)) {
      throw new Error('ID-ul elementului de briefing este invalid');
    }

    // Map GraphQL entity type to internal type
    const entityTypeMap: Record<string, StoryEntityType> = {
      CLIENT: 'client',
      USER: 'user',
      CASE: 'case',
      EMAIL_THREAD: 'email_thread',
    };
    const entityType = entityTypeMap[args.input.entityType] || 'case';

    logger.info('[FirmBriefing] Follow-up question', {
      userId,
      firmId,
      itemId: args.input.briefingItemId,
      entityType,
      questionLength: sanitizedQuestion.length,
    });

    // Call the follow-up service
    const result = await firmBriefingFollowupService.askFollowUp(
      args.input.briefingItemId,
      sanitizedQuestion,
      entityType,
      args.input.entityId,
      userId,
      firmId
    );

    return result;
  },
};

// ============================================================================
// Combined Resolvers Export
// ============================================================================

export const firmBriefingResolvers = {
  Query: firmBriefingQueries,
  Mutation: firmBriefingMutations,
};
