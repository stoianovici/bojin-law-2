/**
 * AI Utilization Analytics Service
 * Story 5.7: Platform Intelligence Dashboard - Task 3
 *
 * Tracks AI utilization by user and feature (AC: 5)
 *
 * Business Logic:
 * - Aggregates AI usage metrics grouped by userId
 * - Tracks which features each user is using
 * - Calculates adoption scores (0-100)
 * - Identifies underutilized users for targeted training
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import Redis from 'ioredis';
import type {
  AIUtilizationByUser,
  AIUtilizationSummary,
  FeatureUsage,
  FirmAITotal,
  AIFeatureType,
  PlatformDateRange,
  AI_FEATURE_MAP,
} from '@legal-platform/types';

// Cache TTL in seconds (30 minutes for AI utilization data)
const CACHE_TTL = 1800;

// Feature map for operation type to user-friendly names
const FEATURE_MAP: Record<string, AIFeatureType> = {
  email_draft_generate: 'email_drafting',
  email_draft_refine: 'email_drafting',
  document_generate: 'document_generation',
  document_clause_suggest: 'clause_suggestions',
  task_parse_nlp: 'task_parsing',
  suggestion_morning_brief: 'morning_briefing',
  suggestion_proactive: 'proactive_suggestions',
  semantic_search: 'semantic_search',
  semantic_diff: 'version_comparison',
  style_analysis: 'style_analysis',
};

// All features for adoption score calculation
const ALL_FEATURES: AIFeatureType[] = [
  'email_drafting',
  'document_generation',
  'clause_suggestions',
  'task_parsing',
  'morning_briefing',
  'proactive_suggestions',
  'semantic_search',
  'version_comparison',
  'style_analysis',
];

// Adoption score thresholds
const ADOPTION_SCORE_THRESHOLD = 50; // Below this = underutilized
const USAGE_SCORE_MAX = 100; // Usage count for max points

interface UserUsageData {
  userId: string;
  totalTokens: number;
  totalCostCents: number;
  requestCount: number;
  byOperation: Map<string, { tokens: number; costCents: number; requests: number; latencyMs: number[] }>;
}

/**
 * AI Utilization Analytics Service
 * Analyzes AI usage patterns by user and feature
 */
export class AIUtilizationAnalyticsService {
  private prisma: PrismaClientType;
  private redis: Redis | null = null;

  constructor(prismaClient?: PrismaClientType, redisClient?: Redis) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }

    if (redisClient) {
      this.redis = redisClient;
    } else {
      try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl);
        }
      } catch {
        // Redis not available
      }
    }
  }

  /**
   * Get AI utilization by user
   * AC: 5 - AI utilization by user and feature
   */
  async getAIUtilizationByUser(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<AIUtilizationSummary> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, dateRange);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get all AI usage records for the firm in the date range
    const usageRecords = await this.prisma.aITokenUsage.findMany({
      where: {
        firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        userId: true,
        operationType: true,
        totalTokens: true,
        costCents: true,
        latencyMs: true,
      },
    });

    // Group by user
    const userDataMap = new Map<string, UserUsageData>();
    const firmTotals = {
      totalTokens: 0,
      totalCostCents: 0,
      requestCount: 0,
    };

    for (const record of usageRecords) {
      // Add to firm totals
      firmTotals.totalTokens += record.totalTokens;
      firmTotals.totalCostCents += record.costCents;
      firmTotals.requestCount += 1;

      // Skip if no userId
      if (!record.userId) continue;

      // Get or create user data
      if (!userDataMap.has(record.userId)) {
        userDataMap.set(record.userId, {
          userId: record.userId,
          totalTokens: 0,
          totalCostCents: 0,
          requestCount: 0,
          byOperation: new Map(),
        });
      }

      const userData = userDataMap.get(record.userId)!;
      userData.totalTokens += record.totalTokens;
      userData.totalCostCents += record.costCents;
      userData.requestCount += 1;

      // Track by operation
      if (!userData.byOperation.has(record.operationType)) {
        userData.byOperation.set(record.operationType, {
          tokens: 0,
          costCents: 0,
          requests: 0,
          latencyMs: [],
        });
      }
      const opData = userData.byOperation.get(record.operationType)!;
      opData.tokens += record.totalTokens;
      opData.costCents += record.costCents;
      opData.requests += 1;
      opData.latencyMs.push(record.latencyMs);
    }

    // Get user names
    const userIds = Array.from(userDataMap.keys());
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userNameMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || 'Unknown']));

    // Build user utilization list
    const byUser: AIUtilizationByUser[] = [];
    for (const [userId, data] of userDataMap.entries()) {
      const byFeature = this.aggregateByFeature(data.byOperation);
      const adoptionScore = this.calculateAdoptionScore(byFeature, data.requestCount);

      byUser.push({
        userId,
        userName: userNameMap.get(userId) ?? 'Unknown',
        totalRequests: data.requestCount,
        totalTokens: data.totalTokens,
        totalCostCents: data.totalCostCents,
        byFeature,
        adoptionScore,
      });
    }

    // Sort by adoption score for top/bottom users
    const sortedByAdoption = [...byUser].sort((a, b) => b.adoptionScore - a.adoptionScore);

    // Get aggregate feature usage across firm
    const firmByFeature = this.getAggregateFeatureUsage(byUser);

    // Calculate firm total
    const totalUsers = byUser.length;
    const firmTotal: FirmAITotal = {
      totalRequests: firmTotals.requestCount,
      totalTokens: firmTotals.totalTokens,
      totalCostCents: firmTotals.totalCostCents,
      avgRequestsPerUser: totalUsers > 0 ? Math.round((firmTotals.requestCount / totalUsers) * 100) / 100 : 0,
    };

    const result: AIUtilizationSummary = {
      firmTotal,
      byUser: byUser.sort((a, b) => b.totalRequests - a.totalRequests),
      byFeature: firmByFeature,
      topUsers: sortedByAdoption.slice(0, 5),
      underutilizedUsers: sortedByAdoption.filter((u) => u.adoptionScore < ADOPTION_SCORE_THRESHOLD),
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get AI utilization grouped by feature
   */
  async getAIUtilizationByFeature(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<FeatureUsage[]> {
    const summary = await this.getAIUtilizationByUser(firmId, dateRange);
    return summary.byFeature;
  }

  /**
   * Identify underutilized users for training
   */
  async identifyUnderutilizedUsers(firmId: string): Promise<AIUtilizationByUser[]> {
    const dateRange: PlatformDateRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date(),
    };

    const summary = await this.getAIUtilizationByUser(firmId, dateRange);
    return summary.underutilizedUsers;
  }

  /**
   * Get utilization for a specific user
   */
  async getUserAIUtilization(
    userId: string,
    dateRange: PlatformDateRange
  ): Promise<AIUtilizationByUser | null> {
    // Get user's firm
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, firmId: true },
    });

    if (!user || !user.firmId) {
      return null;
    }

    // Get usage records for this user
    const usageRecords = await this.prisma.aITokenUsage.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        operationType: true,
        totalTokens: true,
        costCents: true,
        latencyMs: true,
      },
    });

    const byOperation = new Map<string, { tokens: number; costCents: number; requests: number; latencyMs: number[] }>();
    let totalTokens = 0;
    let totalCostCents = 0;

    for (const record of usageRecords) {
      totalTokens += record.totalTokens;
      totalCostCents += record.costCents;

      if (!byOperation.has(record.operationType)) {
        byOperation.set(record.operationType, {
          tokens: 0,
          costCents: 0,
          requests: 0,
          latencyMs: [],
        });
      }
      const opData = byOperation.get(record.operationType)!;
      opData.tokens += record.totalTokens;
      opData.costCents += record.costCents;
      opData.requests += 1;
      opData.latencyMs.push(record.latencyMs);
    }

    const byFeature = this.aggregateByFeature(byOperation);
    const adoptionScore = this.calculateAdoptionScore(byFeature, usageRecords.length);

    return {
      userId,
      userName: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
      totalRequests: usageRecords.length,
      totalTokens,
      totalCostCents,
      byFeature,
      adoptionScore,
    };
  }

  /**
   * Aggregate operation data into feature usage
   */
  private aggregateByFeature(
    byOperation: Map<string, { tokens: number; costCents: number; requests: number; latencyMs: number[] }>
  ): FeatureUsage[] {
    const featureMap = new Map<AIFeatureType, { tokens: number; requests: number; latencyMs: number[] }>();

    for (const [operation, data] of byOperation.entries()) {
      const feature = FEATURE_MAP[operation] ?? 'document_generation'; // Default feature

      if (!featureMap.has(feature)) {
        featureMap.set(feature, { tokens: 0, requests: 0, latencyMs: [] });
      }
      const featureData = featureMap.get(feature)!;
      featureData.tokens += data.tokens;
      featureData.requests += data.requests;
      featureData.latencyMs.push(...data.latencyMs);
    }

    const result: FeatureUsage[] = [];
    for (const [feature, data] of featureMap.entries()) {
      const avgLatencyMs =
        data.latencyMs.length > 0
          ? data.latencyMs.reduce((sum, l) => sum + l, 0) / data.latencyMs.length
          : 0;

      result.push({
        feature,
        requestCount: data.requests,
        tokenCount: data.tokens,
        avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
        acceptanceRate: undefined, // Would require additional tracking
      });
    }

    return result.sort((a, b) => b.requestCount - a.requestCount);
  }

  /**
   * Get aggregate feature usage across all users
   */
  private getAggregateFeatureUsage(byUser: AIUtilizationByUser[]): FeatureUsage[] {
    const featureMap = new Map<AIFeatureType, { tokens: number; requests: number; latencySum: number; latencyCount: number }>();

    for (const user of byUser) {
      for (const feature of user.byFeature) {
        if (!featureMap.has(feature.feature)) {
          featureMap.set(feature.feature, { tokens: 0, requests: 0, latencySum: 0, latencyCount: 0 });
        }
        const data = featureMap.get(feature.feature)!;
        data.tokens += feature.tokenCount;
        data.requests += feature.requestCount;
        data.latencySum += feature.avgLatencyMs * feature.requestCount;
        data.latencyCount += feature.requestCount;
      }
    }

    const result: FeatureUsage[] = [];
    for (const [feature, data] of featureMap.entries()) {
      result.push({
        feature,
        requestCount: data.requests,
        tokenCount: data.tokens,
        avgLatencyMs:
          data.latencyCount > 0 ? Math.round((data.latencySum / data.latencyCount) * 100) / 100 : 0,
        acceptanceRate: undefined,
      });
    }

    return result.sort((a, b) => b.requestCount - a.requestCount);
  }

  /**
   * Calculate adoption score (0-100)
   * Based on feature breadth and usage volume
   */
  private calculateAdoptionScore(byFeature: FeatureUsage[], totalRequests: number): number {
    // Feature breadth: percentage of all features used
    const featuresUsed = byFeature.filter((f) => f.requestCount > 0).length;
    const breadthScore = (featuresUsed / ALL_FEATURES.length) * 50; // Max 50 points

    // Usage volume: based on request count (capped at USAGE_SCORE_MAX for max points)
    const usageScore = Math.min(totalRequests / USAGE_SCORE_MAX, 1) * 50; // Max 50 points

    return Math.round(breadthScore + usageScore);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(firmId: string, dateRange: PlatformDateRange): string {
    const params = [
      firmId,
      dateRange.startDate.toISOString().split('T')[0],
      dateRange.endDate.toISOString().split('T')[0],
    ];
    return `analytics:ai-utilization:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<AIUtilizationSummary | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache error
    }
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: AIUtilizationSummary): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(data));
    } catch {
      // Cache error
    }
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(firmId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `analytics:ai-utilization:${firmId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Cache error
    }
  }
}

// Export singleton
let serviceInstance: AIUtilizationAnalyticsService | null = null;

export function getAIUtilizationAnalyticsService(): AIUtilizationAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new AIUtilizationAnalyticsService();
  }
  return serviceInstance;
}

export default AIUtilizationAnalyticsService;
