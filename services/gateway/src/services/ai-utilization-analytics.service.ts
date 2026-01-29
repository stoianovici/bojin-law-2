/**
 * AI Utilization Analytics Service
 * Story 5.7: Platform Intelligence Dashboard - Task 3
 *
 * Tracks AI utilization by user and feature (AC: 5)
 *
 * Business Logic:
 * - Aggregates AI usage metrics grouped by userId from AIUsageLog
 * - Tracks which features each user is using
 * - Calculates adoption scores (0-100)
 * - Identifies underutilized users for targeted training
 *
 * Re-implemented to use AIUsageLog instead of removed AITokenUsage model.
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import type {
  AIUtilizationByUser,
  AIUtilizationSummary,
  FeatureUsage,
  FirmAITotal,
  PlatformDateRange,
} from '@legal-platform/types';

// ============================================================================
// Constants
// ============================================================================

// Adoption score thresholds
const HIGH_USAGE_THRESHOLD = 50; // Requests per month for "high" adoption
const LOW_USAGE_THRESHOLD = 10; // Below this is "underutilized"

// ============================================================================
// Service
// ============================================================================

export class AIUtilizationAnalyticsService {
  private prisma: PrismaClientType;

  constructor(prismaClient?: PrismaClientType) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Get AI utilization by user
   * AC: 5 - AI utilization by user and feature
   *
   * Queries AIUsageLog to aggregate usage by user.
   */
  async getAIUtilizationByUser(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<AIUtilizationSummary> {
    // Get all users in firm for name lookup
    const users = await this.prisma.user.findMany({
      where: { firmId },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Aggregate usage by user
    const usageByUser = await this.prisma.aIUsageLog.groupBy({
      by: ['userId'],
      where: {
        firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
    });

    // Aggregate usage by feature
    const usageByFeature = await this.prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: {
        firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
    });

    // Build user utilization data
    const byUser: AIUtilizationByUser[] = usageByUser.map((u) => {
      const user = u.userId ? userMap.get(u.userId) : null;
      const totalTokens = (u._sum.inputTokens || 0) + (u._sum.outputTokens || 0);
      const totalRequests = u._count;
      const costEur = u._sum.costEur?.toNumber() || 0;

      // Calculate adoption score (0-100)
      // Higher requests = higher adoption, capped at 100
      const adoptionScore = Math.min(100, Math.round((totalRequests / HIGH_USAGE_THRESHOLD) * 100));

      return {
        userId: u.userId || 'batch',
        userName: user
          ? `${user.firstName} ${user.lastName}`.trim()
          : u.userId
            ? 'Unknown User'
            : 'Procesare Batch',
        totalRequests,
        totalTokens,
        totalCostCents: Math.round(costEur * 100), // Convert EUR to cents
        byFeature: [], // Would need separate query per user
        adoptionScore,
      };
    });

    // Build feature utilization data
    const totalCost = usageByFeature.reduce((sum, f) => sum + (f._sum.costEur?.toNumber() || 0), 0);
    const byFeature: FeatureUsage[] = usageByFeature.map((f) => {
      return {
        feature: f.feature as FeatureUsage['feature'],
        requestCount: f._count,
        tokenCount: (f._sum.inputTokens || 0) + (f._sum.outputTokens || 0),
        avgLatencyMs: 0, // Would need to aggregate durationMs
      };
    });

    // Calculate firm totals
    const firmTotal: FirmAITotal = {
      totalRequests: byUser.reduce((sum, u) => sum + u.totalRequests, 0),
      totalTokens: byUser.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCostCents: byUser.reduce((sum, u) => sum + u.totalCostCents, 0),
      avgRequestsPerUser:
        byUser.length > 0 ? byUser.reduce((sum, u) => sum + u.totalRequests, 0) / byUser.length : 0,
    };

    // Sort users by requests descending
    const sortedByRequests = [...byUser].sort((a, b) => b.totalRequests - a.totalRequests);

    // Top 5 users
    const topUsers = sortedByRequests.slice(0, 5);

    // Underutilized users (low adoption score, excluding batch)
    const underutilizedUsers = byUser.filter(
      (u) =>
        u.adoptionScore < (LOW_USAGE_THRESHOLD / HIGH_USAGE_THRESHOLD) * 100 && u.userId !== 'batch'
    );

    return {
      firmTotal,
      byUser,
      byFeature,
      topUsers,
      underutilizedUsers,
    };
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

    // Aggregate usage for this user
    const usage = await this.prisma.aIUsageLog.aggregate({
      where: {
        userId,
        firmId: user.firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
    });

    // Get usage by feature for this user
    const usageByFeature = await this.prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: {
        userId,
        firmId: user.firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
    });

    const totalTokens = (usage._sum.inputTokens || 0) + (usage._sum.outputTokens || 0);
    const totalRequests = usage._count;
    const costEur = usage._sum.costEur?.toNumber() || 0;
    const adoptionScore = Math.min(100, Math.round((totalRequests / HIGH_USAGE_THRESHOLD) * 100));

    const byFeature: FeatureUsage[] = usageByFeature.map((f) => {
      return {
        feature: f.feature as FeatureUsage['feature'],
        requestCount: f._count,
        tokenCount: (f._sum.inputTokens || 0) + (f._sum.outputTokens || 0),
        avgLatencyMs: 0, // Would need to aggregate durationMs
      };
    });

    return {
      userId,
      userName: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
      totalRequests,
      totalTokens,
      totalCostCents: Math.round(costEur * 100),
      byFeature,
      adoptionScore,
    };
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
