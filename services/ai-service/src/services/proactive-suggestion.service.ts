/**
 * Proactive Suggestion Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Generates context-aware AI suggestions for users based on their current activity,
 * pending tasks, deadlines, and learned patterns.
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import {
  SuggestionContext,
  GeneratedSuggestion,
  SuggestionType,
  SuggestionCategory,
  SuggestionPriority,
  CONTEXTUAL_SUGGESTION_PROMPT,
} from '@legal-platform/types';
import { ClaudeModel, AIOperationType } from '@legal-platform/types';
import logger from '../lib/logger';
import { config } from '../config';
import { providerManager, ProviderRequest } from './provider-manager.service';

// Cache TTL in seconds (5 minutes as per story requirements)
const SUGGESTION_CACHE_TTL = 300;

// Maximum suggestions per context
const MAX_SUGGESTIONS_PER_CONTEXT = 5;

// Confidence threshold for showing suggestions based on user preference
const CONFIDENCE_THRESHOLDS = {
  aggressive: 0.3,
  moderate: 0.5,
  minimal: 0.7,
};

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

export class ProactiveSuggestionService {
  /**
   * Generate contextual suggestions based on user context
   */
  async generateContextualSuggestions(context: SuggestionContext): Promise<GeneratedSuggestion[]> {
    const cacheKey = this.buildCacheKey(context);

    // Try to get from cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Suggestion cache hit', { userId: context.userId, firmId: context.firmId });
      return cached;
    }

    logger.info('Generating contextual suggestions', {
      userId: context.userId,
      firmId: context.firmId,
      currentScreen: context.currentScreen,
    });

    const startTime = Date.now();

    try {
      // Gather context data in parallel
      const [pendingTasks, upcomingDeadlines, unreadEmailCount, userPatterns] = await Promise.all([
        this.getPendingTasks(context.userId, context.firmId, context.currentCaseId),
        this.getUpcomingDeadlines(context.userId, context.firmId),
        this.getUnreadEmailCount(context.userId, context.firmId),
        this.getUserPatterns(context.userId),
      ]);

      // Build prompt with context
      const prompt = this.buildPrompt(context, {
        pendingTasks,
        upcomingDeadlines,
        unreadEmailCount,
        userPatterns,
      });

      // Get user info for role
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { role: true, firstName: true, lastName: true },
      });

      // Call AI to generate suggestions
      const request: ProviderRequest = {
        systemPrompt: 'You are an AI assistant for a Romanian law firm platform. Generate helpful, actionable suggestions based on the user context. Always respond with valid JSON.',
        prompt,
        model: ClaudeModel.Haiku, // Use Haiku for fast suggestions (< 500ms target)
        maxTokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent suggestions
      };

      const response = await providerManager.execute(request);
      const suggestions = this.parseSuggestions(response.content);

      // Filter suggestions based on user preference
      const confidenceThreshold = CONFIDENCE_THRESHOLDS[context.userPreferences.aiSuggestionLevel];
      const filteredSuggestions = suggestions
        .filter(s => s.confidence >= confidenceThreshold)
        .slice(0, MAX_SUGGESTIONS_PER_CONTEXT);

      // Cache the results
      await this.setCache(cacheKey, filteredSuggestions);

      const duration = Date.now() - startTime;
      logger.info('Contextual suggestions generated', {
        userId: context.userId,
        firmId: context.firmId,
        suggestionCount: filteredSuggestions.length,
        durationMs: duration,
        tokensUsed: response.inputTokens + response.outputTokens,
      });

      return filteredSuggestions;
    } catch (error) {
      logger.error('Failed to generate contextual suggestions', {
        userId: context.userId,
        firmId: context.firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty array on failure to avoid blocking user
      return [];
    }
  }

  /**
   * Store a generated suggestion in the database
   */
  async storeSuggestion(
    firmId: string,
    userId: string,
    suggestion: GeneratedSuggestion,
    caseId?: string
  ): Promise<string> {
    const stored = await prisma.aISuggestion.create({
      data: {
        firmId,
        userId,
        caseId,
        type: suggestion.type,
        category: suggestion.category,
        title: suggestion.title,
        description: suggestion.description,
        suggestedAction: suggestion.suggestedAction,
        actionPayload: suggestion.actionPayload,
        confidence: suggestion.confidence,
        priority: suggestion.priority,
        expiresAt: suggestion.expiresAt,
        status: 'Pending',
      },
    });

    logger.info('Suggestion stored', {
      suggestionId: stored.id,
      userId,
      firmId,
      type: suggestion.type,
    });

    return stored.id;
  }

  /**
   * Get pending suggestions for a user
   */
  async getPendingSuggestions(
    userId: string,
    firmId: string,
    limit: number = 10,
    offset: number = 0
  ) {
    return prisma.aISuggestion.findMany({
      where: {
        userId,
        firmId,
        status: 'Pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
      },
    });
  }

  /**
   * Accept a suggestion
   */
  async acceptSuggestion(suggestionId: string, userId: string, firmId: string) {
    const suggestion = await prisma.aISuggestion.update({
      where: {
        id: suggestionId,
        userId,
        firmId,
      },
      data: {
        status: 'Accepted',
        acceptedAt: new Date(),
      },
    });

    logger.info('Suggestion accepted', {
      suggestionId,
      userId,
      firmId,
      type: suggestion.type,
    });

    return suggestion;
  }

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(suggestionId: string, userId: string, firmId: string, reason?: string) {
    const suggestion = await prisma.aISuggestion.update({
      where: {
        id: suggestionId,
        userId,
        firmId,
      },
      data: {
        status: 'Dismissed',
        dismissedAt: new Date(),
        dismissReason: reason,
      },
    });

    logger.info('Suggestion dismissed', {
      suggestionId,
      userId,
      firmId,
      type: suggestion.type,
      reason,
    });

    return suggestion;
  }

  /**
   * Get pending tasks for context
   */
  private async getPendingTasks(userId: string, firmId: string, caseId?: string) {
    const where: Record<string, unknown> = {
      assignedToId: userId,
      firmId,
      status: { in: ['Pending', 'InProgress'] },
    };

    if (caseId) {
      where.caseId = caseId;
    }

    return prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
      ],
      take: 10,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        type: true,
      },
    });
  }

  /**
   * Get upcoming deadlines
   */
  private async getUpcomingDeadlines(userId: string, firmId: string) {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return prisma.task.findMany({
      where: {
        assignedToId: userId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: {
          gte: new Date(),
          lte: sevenDaysFromNow,
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
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
   * Get unread email count
   */
  private async getUnreadEmailCount(userId: string, firmId: string): Promise<number> {
    return prisma.email.count({
      where: {
        userId,
        firmId,
        isRead: false,
      },
    });
  }

  /**
   * Get user patterns for pattern-based suggestions
   */
  private async getUserPatterns(userId: string) {
    return prisma.userActionPattern.findMany({
      where: {
        userId,
        isActive: true,
        confidence: { gte: 0.6 },
      },
      orderBy: { confidence: 'desc' },
      take: 5,
    });
  }

  /**
   * Build the AI prompt with context
   */
  private buildPrompt(
    context: SuggestionContext,
    data: {
      pendingTasks: Array<{ id: string; title: string; dueDate: Date | null; priority: string; status: string; type: string }>;
      upcomingDeadlines: Array<{ id: string; title: string; dueDate: Date | null; priority: string; case: { id: string; title: string } | null }>;
      unreadEmailCount: number;
      userPatterns: Array<{ patternType: string; confidence: number }>;
    }
  ): string {
    const now = new Date();
    const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';

    const pendingTasksSummary = data.pendingTasks.length > 0
      ? data.pendingTasks.map(t => `- ${t.title} (${t.priority}, due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'no date'})`).join('\n')
      : 'No pending tasks';

    const upcomingDeadlinesSummary = data.upcomingDeadlines.length > 0
      ? data.upcomingDeadlines.map(d => `- ${d.title} (${d.case?.title || 'No case'}, due: ${d.dueDate ? new Date(d.dueDate).toLocaleDateString() : 'no date'})`).join('\n')
      : 'No upcoming deadlines';

    const recentActionsSummary = context.recentActions.length > 0
      ? context.recentActions.slice(0, 5).map(a => `- ${a.type}`).join('\n')
      : 'No recent actions';

    return `
USER CONTEXT:
- Current screen: ${context.currentScreen || 'dashboard'}
- Current case: ${context.currentCaseId || 'none'}
- Recent actions:
${recentActionsSummary}
- Time of day: ${timeOfDay}

USER PREFERENCES:
- Suggestion level: ${context.userPreferences.aiSuggestionLevel}
- Language: ${context.userPreferences.language}

ACTIVE ITEMS:
- Pending tasks:
${pendingTasksSummary}
- Upcoming deadlines:
${upcomingDeadlinesSummary}
- Unread emails: ${data.unreadEmailCount}

USER PATTERNS:
${data.userPatterns.length > 0 ? data.userPatterns.map(p => `- ${p.patternType} (confidence: ${p.confidence.toFixed(2)})`).join('\n') : 'No learned patterns yet'}

Generate 1-3 relevant suggestions. Each suggestion should:
1. Be actionable and specific
2. Include clear benefit
3. Consider user's current context
4. Respect the suggestion level preference (${context.userPreferences.aiSuggestionLevel})

Return as JSON array:
[{
  "type": "TaskSuggestion" | "PatternMatch" | "DeadlineWarning" | "DocumentCheck" | "FollowUp",
  "category": "Task" | "Communication" | "Document" | "Calendar" | "Compliance",
  "title": string,
  "description": string,
  "suggestedAction": string,
  "actionPayload": {},
  "confidence": number (0-1),
  "priority": "Low" | "Normal" | "High" | "Urgent"
}]

Respond ONLY with the JSON array, no additional text.
`.trim();
  }

  /**
   * Parse AI response into suggestions
   */
  private parseSuggestions(response: string): GeneratedSuggestion[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        logger.warn('AI response was not an array', { response: jsonStr.substring(0, 200) });
        return [];
      }

      return parsed.map(s => ({
        type: s.type as SuggestionType,
        category: s.category as SuggestionCategory,
        title: String(s.title || ''),
        description: String(s.description || ''),
        suggestedAction: String(s.suggestedAction || ''),
        actionPayload: s.actionPayload || {},
        confidence: Number(s.confidence) || 0.5,
        priority: (s.priority || 'Normal') as SuggestionPriority,
      }));
    } catch (error) {
      logger.error('Failed to parse AI suggestions', {
        error: error instanceof Error ? error.message : String(error),
        response: response.substring(0, 500),
      });
      return [];
    }
  }

  /**
   * Build cache key for context
   */
  private buildCacheKey(context: SuggestionContext): string {
    return `suggestions:${context.firmId}:${context.userId}:${context.currentScreen || 'default'}:${context.currentCaseId || 'none'}`;
  }

  /**
   * Get suggestions from cache
   */
  private async getFromCache(key: string): Promise<GeneratedSuggestion[] | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as GeneratedSuggestion[];
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
   * Set suggestions in cache
   */
  private async setCache(key: string, suggestions: GeneratedSuggestion[]): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(key, SUGGESTION_CACHE_TTL, JSON.stringify(suggestions));
    } catch (error) {
      logger.warn('Cache write failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate suggestion cache for a user
   */
  async invalidateCache(userId: string, firmId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const pattern = `suggestions:${firmId}:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.debug('Suggestion cache invalidated', { userId, firmId, keysDeleted: keys.length });
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        userId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Mark expired suggestions
   */
  async markExpiredSuggestions(): Promise<number> {
    const result = await prisma.aISuggestion.updateMany({
      where: {
        status: 'Pending',
        expiresAt: { lte: new Date() },
      },
      data: {
        status: 'Expired',
      },
    });

    logger.info('Marked expired suggestions', { count: result.count });
    return result.count;
  }
}

// Singleton instance
export const proactiveSuggestionService = new ProactiveSuggestionService();
