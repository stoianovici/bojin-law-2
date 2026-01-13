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
import type {
  AIUtilizationByUser,
  AIUtilizationSummary,
  FeatureUsage,
  FirmAITotal,
  PlatformDateRange,
} from '@legal-platform/types';

/**
 * AI Utilization Analytics Service
 * Analyzes AI usage patterns by user and feature
 *
 * NOTE: AITokenUsage model was removed from the schema.
 * All methods currently return empty results.
 * TODO: Re-implement when AI usage tracking is re-added.
 */
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
   * NOTE: AITokenUsage model was removed from the schema.
   * This method now returns empty results.
   * TODO: Re-implement when AI usage tracking is re-added.
   */
  async getAIUtilizationByUser(
    _firmId: string,
    _dateRange: PlatformDateRange
  ): Promise<AIUtilizationSummary> {
    // AITokenUsage model was removed - return empty results
    const firmTotal: FirmAITotal = {
      totalRequests: 0,
      totalTokens: 0,
      totalCostCents: 0,
      avgRequestsPerUser: 0,
    };

    return {
      firmTotal,
      byUser: [],
      byFeature: [],
      topUsers: [],
      underutilizedUsers: [],
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
   *
   * NOTE: AITokenUsage model was removed from the schema.
   * This method now returns empty results.
   * TODO: Re-implement when AI usage tracking is re-added.
   */
  async getUserAIUtilization(
    userId: string,
    _dateRange: PlatformDateRange
  ): Promise<AIUtilizationByUser | null> {
    // Get user's firm
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, firmId: true },
    });

    if (!user || !user.firmId) {
      return null;
    }

    // AITokenUsage model was removed - return empty results
    return {
      userId,
      userName: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
      totalRequests: 0,
      totalTokens: 0,
      totalCostCents: 0,
      byFeature: [],
      adoptionScore: 0,
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
