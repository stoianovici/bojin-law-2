/**
 * Suggestion Optimization Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Ranks and optimizes suggestions based on historical performance,
 * user preferences, and context relevance. Supports A/B testing
 * of suggestion phrasings and timing optimization.
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import logger from '../lib/logger';
import { config } from '../config';
import { suggestionLearningService } from './suggestion-learning.service';

// Types for suggestion optimization
export interface SuggestionRanking {
  suggestionId: string;
  baseScore: number;
  userPreferenceModifier: number;
  typeSuccessRate: number;
  contextRelevance: number;
  timingScore: number;
  abTestVariant?: string;
  finalScore: number;
}

export interface OptimizedSuggestion {
  id?: string;
  type: string;
  category: string;
  title: string;
  description: string;
  suggestedAction: string;
  actionPayload: Record<string, unknown>;
  confidence: number;
  priority: string;
  ranking: SuggestionRanking;
}

export interface ABTestVariant {
  id: string;
  name: string;
  title: string;
  description: string;
  weight: number; // 0.0 - 1.0 probability
}

export interface ABTest {
  id: string;
  suggestionType: string;
  variants: ABTestVariant[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
}

export interface TimingOptimization {
  userId: string;
  bestHoursOfDay: number[]; // 0-23
  bestDaysOfWeek: number[]; // 0-6 (Sunday = 0)
  averageResponseTimeMs: number;
  peakEngagementWindow: { start: number; end: number };
}

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

// Scoring weights
const SCORING_WEIGHTS = {
  baseScore: 0.25,
  userPreference: 0.2,
  typeSuccessRate: 0.25,
  contextRelevance: 0.2,
  timing: 0.1,
};

// Cache TTL
const OPTIMIZATION_CACHE_TTL = 1800; // 30 minutes

export class SuggestionOptimizationService {
  /**
   * Rank and optimize a list of suggestions for a user
   */
  async optimizeSuggestions(
    userId: string,
    firmId: string,
    suggestions: Array<{
      id?: string;
      type: string;
      category: string;
      title: string;
      description: string;
      suggestedAction: string;
      actionPayload: Record<string, unknown>;
      confidence: number;
      priority: string;
    }>,
    context: {
      currentScreen?: string;
      currentTime?: Date;
      recentActions?: string[];
    } = {}
  ): Promise<OptimizedSuggestion[]> {
    logger.info('Optimizing suggestions', {
      userId,
      firmId,
      suggestionCount: suggestions.length,
    });

    // Get user learning metrics
    const learningMetrics = await suggestionLearningService.getAcceptanceStats(userId, firmId);

    // Get timing optimization
    const timingOpt = await this.getTimingOptimization(userId, firmId);

    // Rank each suggestion
    const rankedSuggestions: OptimizedSuggestion[] = [];

    for (const suggestion of suggestions) {
      const ranking = await this.calculateRanking(suggestion, learningMetrics, timingOpt, context);

      // Apply A/B test variant if applicable
      const abVariant = await this.getABTestVariant(suggestion.type);
      if (abVariant) {
        suggestion.title = abVariant.title || suggestion.title;
        suggestion.description = abVariant.description || suggestion.description;
        ranking.abTestVariant = abVariant.id;
      }

      rankedSuggestions.push({
        ...suggestion,
        ranking,
      });
    }

    // Sort by final score (descending)
    rankedSuggestions.sort((a, b) => b.ranking.finalScore - a.ranking.finalScore);

    logger.info('Suggestions optimized', {
      userId,
      firmId,
      topScore: rankedSuggestions[0]?.ranking.finalScore,
      bottomScore: rankedSuggestions[rankedSuggestions.length - 1]?.ranking.finalScore,
    });

    return rankedSuggestions;
  }

  /**
   * Calculate ranking scores for a suggestion
   */
  private async calculateRanking(
    suggestion: {
      type: string;
      category: string;
      confidence: number;
      priority: string;
    },
    learningMetrics: {
      byType: Record<string, { acceptanceRate: number; totalCount: number }>;
      byCategory: Record<string, { acceptanceRate: number }>;
      confidenceAdjustments: Record<string, number>;
    },
    timingOpt: TimingOptimization | null,
    context: {
      currentScreen?: string;
      currentTime?: Date;
      recentActions?: string[];
    }
  ): Promise<SuggestionRanking> {
    // Base score from confidence and priority
    const priorityScores: Record<string, number> = {
      Urgent: 1.0,
      High: 0.8,
      Normal: 0.5,
      Low: 0.3,
    };
    const baseScore = (suggestion.confidence + (priorityScores[suggestion.priority] || 0.5)) / 2;

    // User preference modifier based on past acceptance of this type
    const typeStats = learningMetrics.byType[suggestion.type];
    const userPreferenceModifier = typeStats
      ? (typeStats.acceptanceRate - 0.5) * 0.5 // Scale -0.25 to +0.25
      : 0;

    // Type success rate from learning metrics
    const typeSuccessRate = typeStats?.acceptanceRate || 0.5;

    // Context relevance score
    const contextRelevance = this.calculateContextRelevance(suggestion, context);

    // Timing score
    const timingScore = this.calculateTimingScore(timingOpt, context.currentTime);

    // Calculate final weighted score
    const finalScore =
      baseScore * SCORING_WEIGHTS.baseScore +
      (0.5 + userPreferenceModifier) * SCORING_WEIGHTS.userPreference +
      typeSuccessRate * SCORING_WEIGHTS.typeSuccessRate +
      contextRelevance * SCORING_WEIGHTS.contextRelevance +
      timingScore * SCORING_WEIGHTS.timing;

    return {
      suggestionId: '',
      baseScore,
      userPreferenceModifier,
      typeSuccessRate,
      contextRelevance,
      timingScore,
      finalScore,
    };
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextRelevance(
    suggestion: { type: string; category: string },
    context: { currentScreen?: string; recentActions?: string[] }
  ): number {
    let relevance = 0.5; // Default neutral

    // Screen-based relevance
    const screenRelevance: Record<string, Record<string, number>> = {
      case_detail: {
        Task: 0.8,
        Document: 0.9,
        Communication: 0.7,
        Calendar: 0.6,
        Compliance: 0.7,
      },
      task_list: {
        Task: 1.0,
        Document: 0.5,
        Communication: 0.4,
        Calendar: 0.8,
        Compliance: 0.7,
      },
      email_view: {
        Task: 0.6,
        Document: 0.5,
        Communication: 1.0,
        Calendar: 0.7,
        Compliance: 0.5,
      },
      document_editor: {
        Task: 0.5,
        Document: 1.0,
        Communication: 0.4,
        Calendar: 0.3,
        Compliance: 0.8,
      },
      dashboard: {
        Task: 0.8,
        Document: 0.6,
        Communication: 0.7,
        Calendar: 0.7,
        Compliance: 0.6,
      },
    };

    if (context.currentScreen && screenRelevance[context.currentScreen]) {
      relevance = screenRelevance[context.currentScreen][suggestion.category] || 0.5;
    }

    // Adjust based on recent actions
    if (context.recentActions && context.recentActions.length > 0) {
      const actionTypeMap: Record<string, string[]> = {
        Task: ['create_task', 'complete_task', 'update_task'],
        Document: ['upload_document', 'edit_document', 'review_document'],
        Communication: ['send_email', 'read_email', 'reply_email'],
        Calendar: ['create_event', 'schedule_meeting'],
        Compliance: ['set_deadline', 'check_compliance'],
      };

      const relevantActions = actionTypeMap[suggestion.category] || [];
      const recentRelevantCount = context.recentActions.filter((a) =>
        relevantActions.some((ra) => a.includes(ra))
      ).length;

      if (recentRelevantCount > 0) {
        relevance = Math.min(1.0, relevance + 0.1 * recentRelevantCount);
      }
    }

    return relevance;
  }

  /**
   * Calculate timing score based on user's engagement patterns
   */
  private calculateTimingScore(timingOpt: TimingOptimization | null, currentTime?: Date): number {
    if (!timingOpt || !currentTime) {
      return 0.5; // Neutral if no timing data
    }

    const currentHour = currentTime.getHours();
    const currentDay = currentTime.getDay();

    let score = 0.5;

    // Check if current hour is in best hours
    if (timingOpt.bestHoursOfDay.includes(currentHour)) {
      score += 0.25;
    }

    // Check if current day is in best days
    if (timingOpt.bestDaysOfWeek.includes(currentDay)) {
      score += 0.15;
    }

    // Check peak engagement window
    if (
      currentHour >= timingOpt.peakEngagementWindow.start &&
      currentHour <= timingOpt.peakEngagementWindow.end
    ) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Get timing optimization for a user
   */
  async getTimingOptimization(userId: string, firmId: string): Promise<TimingOptimization | null> {
    const cacheKey = `timing_opt:${userId}`;

    try {
      // Try cache first
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as TimingOptimization;
      }
    } catch (error) {
      logger.warn('Cache read failed for timing optimization', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Calculate from feedback data
    const feedback = await prisma.suggestionFeedback.findMany({
      where: {
        userId,
        firmId,
        action: { in: ['accepted', 'modified'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    if (feedback.length < 10) {
      return null; // Not enough data
    }

    // Analyze engagement patterns
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const fb of feedback) {
      const hour = fb.createdAt.getHours();
      const day = fb.createdAt.getDay();

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;

      if (fb.responseTimeMs) {
        totalResponseTime += fb.responseTimeMs;
        responseCount++;
      }
    }

    // Find best hours (top 4)
    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([hour]) => parseInt(hour));

    // Find best days (top 3)
    const sortedDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    // Find peak engagement window (most active 3-hour window)
    let peakStart = 9;
    let peakCount = 0;

    for (let start = 0; start < 22; start++) {
      const windowCount =
        (hourCounts[start] || 0) + (hourCounts[start + 1] || 0) + (hourCounts[start + 2] || 0);

      if (windowCount > peakCount) {
        peakCount = windowCount;
        peakStart = start;
      }
    }

    const timingOpt: TimingOptimization = {
      userId,
      bestHoursOfDay: sortedHours,
      bestDaysOfWeek: sortedDays,
      averageResponseTimeMs: responseCount > 0 ? totalResponseTime / responseCount : 0,
      peakEngagementWindow: { start: peakStart, end: peakStart + 2 },
    };

    // Cache the result
    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, OPTIMIZATION_CACHE_TTL, JSON.stringify(timingOpt));
    } catch (error) {
      logger.warn('Cache write failed for timing optimization', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return timingOpt;
  }

  /**
   * Get A/B test variant for a suggestion type
   */
  async getABTestVariant(suggestionType: string): Promise<ABTestVariant | null> {
    // For now, return null - A/B testing configuration would come from database
    // This is a placeholder for future implementation
    const activeTests = await this.getActiveABTests(suggestionType);

    if (activeTests.length === 0) {
      return null;
    }

    const test = activeTests[0];

    // Randomly select variant based on weights
    const random = Math.random();
    let cumulative = 0;

    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant;
      }
    }

    return test.variants[0]; // Fallback to first variant
  }

  /**
   * Get active A/B tests for a suggestion type
   */
  private async getActiveABTests(_suggestionType: string): Promise<ABTest[]> {
    // Placeholder - would fetch from database in full implementation
    // For now, return empty array (no active tests)
    return [];
  }

  /**
   * Record A/B test outcome
   */
  async recordABTestOutcome(
    testId: string,
    variantId: string,
    outcome: 'accepted' | 'dismissed' | 'ignored'
  ): Promise<void> {
    logger.info('A/B test outcome recorded', {
      testId,
      variantId,
      outcome,
    });

    // In full implementation, store in database for analysis
  }

  /**
   * Get suggestion timing recommendations
   */
  async getSuggestionTimingRecommendations(
    userId: string,
    firmId: string
  ): Promise<{
    optimalTimes: string[];
    avoidTimes: string[];
    insights: string[];
  }> {
    const timingOpt = await this.getTimingOptimization(userId, firmId);

    if (!timingOpt) {
      return {
        optimalTimes: ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
        avoidTimes: ['12:00 PM - 1:00 PM', 'After 6:00 PM'],
        insights: ['Not enough data to personalize timing. Using default recommendations.'],
      };
    }

    const formatHour = (h: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:00 ${ampm}`;
    };

    const optimalTimes = timingOpt.bestHoursOfDay.slice(0, 3).map((h) => formatHour(h));

    const allHours = Array.from({ length: 24 }, (_, i) => i);
    const lowEngagementHours = allHours
      .filter((h) => !timingOpt.bestHoursOfDay.includes(h))
      .slice(0, 3);

    const avoidTimes = lowEngagementHours.map((h) => formatHour(h));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDayNames = timingOpt.bestDaysOfWeek.map((d) => dayNames[d]);

    return {
      optimalTimes,
      avoidTimes,
      insights: [
        `Your most engaged hours are around ${formatHour(timingOpt.peakEngagementWindow.start)}`,
        `Best days for suggestions: ${bestDayNames.join(', ')}`,
        `Average response time: ${Math.round(timingOpt.averageResponseTimeMs / 1000)} seconds`,
      ],
    };
  }

  /**
   * Invalidate optimization cache for a user
   */
  async invalidateCache(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`timing_opt:${userId}`);
      logger.debug('Optimization cache invalidated', { userId });
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Singleton instance
export const suggestionOptimizationService = new SuggestionOptimizationService();
