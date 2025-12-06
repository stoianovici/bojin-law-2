/**
 * Suggestion Learning Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Tracks user feedback on AI suggestions and adjusts confidence thresholds
 * based on acceptance patterns. Implements learning decay where recent
 * feedback is weighted more heavily.
 */

import { prisma } from '@legal-platform/database';
import logger from '../lib/logger';

// Types for suggestion learning
export interface FeedbackRecord {
  suggestionId: string;
  action: 'accepted' | 'dismissed' | 'modified' | 'ignored';
  modifiedAction?: Record<string, unknown>;
  feedbackReason?: string;
  responseTimeMs: number;
}

export interface AcceptanceStats {
  type: string;
  totalCount: number;
  acceptedCount: number;
  dismissedCount: number;
  modifiedCount: number;
  ignoredCount: number;
  acceptanceRate: number;
  averageResponseTimeMs: number;
}

export interface LearningMetrics {
  userId: string;
  firmId: string;
  overallAcceptanceRate: number;
  byType: Record<string, AcceptanceStats>;
  byCategory: Record<string, AcceptanceStats>;
  confidenceAdjustments: Record<string, number>;
  lastUpdated: Date;
}

// Learning decay configuration
const DECAY_FACTOR = 0.95; // Recent feedback weighted 5% more than older
const DECAY_WINDOW_DAYS = 30; // Days after which decay starts applying
const MIN_SAMPLES_FOR_ADJUSTMENT = 10; // Minimum feedback count before adjusting confidence

// Default confidence thresholds
const DEFAULT_CONFIDENCE_THRESHOLDS = {
  aggressive: 0.3,
  moderate: 0.5,
  minimal: 0.7,
};

export class SuggestionLearningService {
  /**
   * Record feedback for a suggestion
   */
  async recordSuggestionFeedback(
    suggestionId: string,
    userId: string,
    firmId: string,
    feedback: FeedbackRecord
  ): Promise<void> {
    logger.info('Recording suggestion feedback', {
      suggestionId,
      userId,
      firmId,
      action: feedback.action,
    });

    try {
      // Store feedback in database
      await prisma.suggestionFeedback.create({
        data: {
          suggestionId: feedback.suggestionId,
          userId,
          firmId,
          action: feedback.action,
          modifiedAction: feedback.modifiedAction ? JSON.parse(JSON.stringify(feedback.modifiedAction)) : undefined,
          feedbackReason: feedback.feedbackReason,
          responseTimeMs: feedback.responseTimeMs,
        },
      });

      // Update the suggestion status based on feedback
      await this.updateSuggestionStatus(suggestionId, feedback.action);

      // Trigger async learning update
      this.updateLearningMetrics(userId, firmId).catch(error => {
        logger.error('Failed to update learning metrics', {
          userId,
          firmId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      logger.info('Feedback recorded successfully', {
        suggestionId,
        action: feedback.action,
      });
    } catch (error) {
      logger.error('Failed to record suggestion feedback', {
        suggestionId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update suggestion status based on feedback
   */
  private async updateSuggestionStatus(
    suggestionId: string,
    action: string
  ): Promise<void> {
    const statusMap: Record<string, string> = {
      accepted: 'Accepted',
      dismissed: 'Dismissed',
      modified: 'Accepted', // Modified is still considered accepted
      ignored: 'Expired', // Ignored suggestions are marked expired
    };

    const status = statusMap[action] || 'Pending';

    await prisma.aISuggestion.update({
      where: { id: suggestionId },
      data: {
        status: status as 'Accepted' | 'Dismissed' | 'Pending' | 'Expired' | 'AutoApplied',
        ...(action === 'accepted' || action === 'modified' ? { acceptedAt: new Date() } : {}),
        ...(action === 'dismissed' ? { dismissedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Get acceptance statistics for a user
   */
  async getAcceptanceStats(
    userId: string,
    firmId: string,
    daysBack: number = 30
  ): Promise<LearningMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch all feedback with decay weighting
    const feedback = await prisma.suggestionFeedback.findMany({
      where: {
        userId,
        firmId,
        createdAt: { gte: startDate },
      },
      include: {
        suggestion: {
          select: {
            type: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics with decay
    const byType: Record<string, AcceptanceStats> = {};
    const byCategory: Record<string, AcceptanceStats> = {};
    let totalWeightedAccepted = 0;
    let totalWeight = 0;

    for (let i = 0; i < feedback.length; i++) {
      const fb = feedback[i];
      const weight = this.calculateDecayWeight(fb.createdAt, i);

      // Update type stats
      if (fb.suggestion) {
        const type = fb.suggestion.type;
        if (!byType[type]) {
          byType[type] = this.createEmptyStats(type);
        }
        this.updateStats(byType[type], fb.action, fb.responseTimeMs || 0, weight);

        const category = fb.suggestion.category;
        if (!byCategory[category]) {
          byCategory[category] = this.createEmptyStats(category);
        }
        this.updateStats(byCategory[category], fb.action, fb.responseTimeMs || 0, weight);
      }

      // Overall stats
      totalWeight += weight;
      if (fb.action === 'accepted' || fb.action === 'modified') {
        totalWeightedAccepted += weight;
      }
    }

    // Calculate acceptance rates
    for (const type in byType) {
      byType[type].acceptanceRate = this.calculateAcceptanceRate(byType[type]);
    }

    for (const category in byCategory) {
      byCategory[category].acceptanceRate = this.calculateAcceptanceRate(byCategory[category]);
    }

    // Calculate confidence adjustments
    const confidenceAdjustments = this.calculateConfidenceAdjustments(byType);

    return {
      userId,
      firmId,
      overallAcceptanceRate: totalWeight > 0 ? totalWeightedAccepted / totalWeight : 0.5,
      byType,
      byCategory,
      confidenceAdjustments,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get adjusted confidence threshold for a user
   */
  async getAdjustedConfidenceThreshold(
    userId: string,
    firmId: string,
    suggestionType: string,
    basePreference: 'aggressive' | 'moderate' | 'minimal'
  ): Promise<number> {
    const baseThreshold = DEFAULT_CONFIDENCE_THRESHOLDS[basePreference];

    try {
      const metrics = await this.getAcceptanceStats(userId, firmId);

      // Check if we have enough samples for this type
      const typeStats = metrics.byType[suggestionType];
      if (!typeStats || typeStats.totalCount < MIN_SAMPLES_FOR_ADJUSTMENT) {
        return baseThreshold;
      }

      // Adjust threshold based on acceptance rate
      const adjustment = metrics.confidenceAdjustments[suggestionType] || 0;
      const adjustedThreshold = Math.max(0.1, Math.min(0.9, baseThreshold + adjustment));

      logger.debug('Adjusted confidence threshold', {
        userId,
        suggestionType,
        baseThreshold,
        adjustment,
        adjustedThreshold,
      });

      return adjustedThreshold;
    } catch (error) {
      logger.warn('Failed to get adjusted threshold, using base', {
        userId,
        suggestionType,
        error: error instanceof Error ? error.message : String(error),
      });
      return baseThreshold;
    }
  }

  /**
   * Update learning metrics for a user (async background task)
   */
  private async updateLearningMetrics(userId: string, firmId: string): Promise<void> {
    const metrics = await this.getAcceptanceStats(userId, firmId);

    logger.info('Learning metrics updated', {
      userId,
      firmId,
      overallAcceptanceRate: metrics.overallAcceptanceRate,
      typesTracked: Object.keys(metrics.byType).length,
    });

    // Could store metrics in cache or database for faster retrieval
    // For now, they're calculated on-demand
  }

  /**
   * Calculate decay weight based on age
   */
  private calculateDecayWeight(createdAt: Date, index: number): number {
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays <= DECAY_WINDOW_DAYS) {
      return 1.0;
    }

    // Apply exponential decay after window
    const decayPeriods = Math.floor((ageInDays - DECAY_WINDOW_DAYS) / 7);
    return Math.pow(DECAY_FACTOR, decayPeriods);
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(type: string): AcceptanceStats {
    return {
      type,
      totalCount: 0,
      acceptedCount: 0,
      dismissedCount: 0,
      modifiedCount: 0,
      ignoredCount: 0,
      acceptanceRate: 0,
      averageResponseTimeMs: 0,
    };
  }

  /**
   * Update stats with feedback
   */
  private updateStats(
    stats: AcceptanceStats,
    action: string,
    responseTimeMs: number,
    weight: number
  ): void {
    stats.totalCount += weight;

    switch (action) {
      case 'accepted':
        stats.acceptedCount += weight;
        break;
      case 'dismissed':
        stats.dismissedCount += weight;
        break;
      case 'modified':
        stats.modifiedCount += weight;
        break;
      case 'ignored':
        stats.ignoredCount += weight;
        break;
    }

    // Running average for response time (simplified)
    const currentTotal = stats.averageResponseTimeMs * (stats.totalCount - weight);
    stats.averageResponseTimeMs = (currentTotal + responseTimeMs * weight) / stats.totalCount;
  }

  /**
   * Calculate acceptance rate from stats
   */
  private calculateAcceptanceRate(stats: AcceptanceStats): number {
    if (stats.totalCount === 0) return 0.5;
    return (stats.acceptedCount + stats.modifiedCount) / stats.totalCount;
  }

  /**
   * Calculate confidence adjustments based on type acceptance rates
   */
  private calculateConfidenceAdjustments(
    byType: Record<string, AcceptanceStats>
  ): Record<string, number> {
    const adjustments: Record<string, number> = {};

    for (const type in byType) {
      const stats = byType[type];

      // Only adjust if we have enough samples
      if (stats.totalCount < MIN_SAMPLES_FOR_ADJUSTMENT) {
        adjustments[type] = 0;
        continue;
      }

      const acceptanceRate = stats.acceptanceRate;

      // Adjust confidence threshold based on acceptance rate
      // High acceptance (>70%) -> lower threshold (show more suggestions)
      // Low acceptance (<30%) -> higher threshold (show fewer suggestions)
      if (acceptanceRate > 0.7) {
        adjustments[type] = -0.1 * (acceptanceRate - 0.5); // Lower threshold
      } else if (acceptanceRate < 0.3) {
        adjustments[type] = 0.1 * (0.5 - acceptanceRate); // Raise threshold
      } else {
        adjustments[type] = 0; // Keep neutral
      }
    }

    return adjustments;
  }

  /**
   * Get suggestion feedback history for analytics
   */
  async getFeedbackHistory(
    userId: string,
    firmId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<{
    id: string;
    suggestionId: string;
    action: string;
    feedbackReason: string | null;
    responseTimeMs: number | null;
    createdAt: Date;
    suggestionType: string | null;
    suggestionCategory: string | null;
  }>> {
    const feedback = await prisma.suggestionFeedback.findMany({
      where: { userId, firmId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        suggestion: {
          select: {
            type: true,
            category: true,
          },
        },
      },
    });

    return feedback.map(fb => ({
      id: fb.id,
      suggestionId: fb.suggestionId,
      action: fb.action,
      feedbackReason: fb.feedbackReason,
      responseTimeMs: fb.responseTimeMs,
      createdAt: fb.createdAt,
      suggestionType: fb.suggestion?.type || null,
      suggestionCategory: fb.suggestion?.category || null,
    }));
  }

  /**
   * Get aggregate feedback metrics for a firm
   */
  async getFirmFeedbackMetrics(
    firmId: string,
    daysBack: number = 30
  ): Promise<{
    totalSuggestions: number;
    totalFeedback: number;
    overallAcceptanceRate: number;
    byType: Record<string, { count: number; acceptanceRate: number }>;
    averageResponseTimeMs: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [suggestions, feedback] = await Promise.all([
      prisma.aISuggestion.count({
        where: {
          firmId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.suggestionFeedback.findMany({
        where: {
          firmId,
          createdAt: { gte: startDate },
        },
        include: {
          suggestion: {
            select: { type: true },
          },
        },
      }),
    ]);

    const byType: Record<string, { total: number; accepted: number }> = {};
    let totalAccepted = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const fb of feedback) {
      const type = fb.suggestion?.type || 'Unknown';

      if (!byType[type]) {
        byType[type] = { total: 0, accepted: 0 };
      }
      byType[type].total++;

      if (fb.action === 'accepted' || fb.action === 'modified') {
        byType[type].accepted++;
        totalAccepted++;
      }

      if (fb.responseTimeMs) {
        totalResponseTime += fb.responseTimeMs;
        responseTimeCount++;
      }
    }

    const byTypeFormatted: Record<string, { count: number; acceptanceRate: number }> = {};
    for (const type in byType) {
      byTypeFormatted[type] = {
        count: byType[type].total,
        acceptanceRate: byType[type].total > 0 ? byType[type].accepted / byType[type].total : 0,
      };
    }

    return {
      totalSuggestions: suggestions,
      totalFeedback: feedback.length,
      overallAcceptanceRate: feedback.length > 0 ? totalAccepted / feedback.length : 0,
      byType: byTypeFormatted,
      averageResponseTimeMs: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
    };
  }

  /**
   * Reset learning data for a user (for testing or user request)
   */
  async resetUserLearningData(userId: string, firmId: string): Promise<void> {
    await prisma.suggestionFeedback.deleteMany({
      where: { userId, firmId },
    });

    logger.info('User learning data reset', { userId, firmId });
  }
}

// Singleton instance
export const suggestionLearningService = new SuggestionLearningService();
