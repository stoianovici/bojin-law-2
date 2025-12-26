/**
 * AI Usage Aggregation Service
 * OPS-235: Aggregation methods for dashboard queries
 *
 * Provides methods to aggregate AI usage data for:
 * - Daily cost breakdowns
 * - Per-feature cost analysis
 * - Per-user attribution
 * - Month-end projections
 *
 * Uses Redis caching for frequently accessed aggregations (5 min TTL).
 */

import { prisma, redis } from '@legal-platform/database';
import { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DailyCost {
  date: string; // ISO date string (YYYY-MM-DD)
  cost: number;
  tokens: number;
  calls: number;
}

export interface FeatureCost {
  feature: string;
  featureName: string; // Human-readable name
  cost: number;
  tokens: number;
  calls: number;
  percentOfTotal: number;
}

export interface UserCost {
  userId: string;
  userName: string;
  cost: number;
  tokens: number;
  calls: number;
}

// OPS-247: User-specific usage types
export interface UserUsage {
  userId: string;
  userName: string;
  userEmail: string | null;
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  dailyCosts: DailyCost[];
  costsByFeature: FeatureCost[];
}

export interface UsageLogEntry {
  id: string;
  feature: string;
  featureName: string;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  durationMs: number;
  createdAt: Date;
  entityType: string | null;
  entityId: string | null;
}

export interface UsageOverview {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  successRate: number;
  averageDailyCost: number;
  projectedMonthEnd: number;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 5 * 60; // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'ai-usage:';

// Human-readable feature names
const FEATURE_NAMES: Record<string, string> = {
  assistant_chat: 'Asistent AI',
  search_index: 'Indexare Căutare',
  morning_briefing: 'Briefing Matinal',
  case_health: 'Sănătate Dosar',
  thread_summary: 'Sumar Conversație',
  email_classification: 'Clasificare Email',
  email_drafting: 'Redactare Email',
  document_drafting: 'Redactare Document',
  document_extraction: 'Extragere Document',
  report_insights: 'Insight Rapoarte',
};

// ============================================================================
// Service
// ============================================================================

export class AIUsageService {
  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Get overall usage statistics for a firm
   */
  async getUsageOverview(firmId: string, dateRange?: DateRange): Promise<UsageOverview> {
    const range = dateRange || this.getCurrentMonthRange();
    const cacheKey = this.buildCacheKey('overview', firmId, range);

    // Try cache first
    const cached = await this.getFromCache<UsageOverview>(cacheKey);
    if (cached) return cached;

    // Query aggregations
    const result = await prisma.aIUsageLog.aggregate({
      where: {
        firmId,
        createdAt: {
          gte: range.start,
          lte: range.end,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
    });

    const totalCost = result._sum.costEur?.toNumber() || 0;
    const totalTokens = (result._sum.inputTokens || 0) + (result._sum.outputTokens || 0);
    const totalCalls = result._count || 0;

    // Calculate days in range for average
    const daysInRange = this.getDaysInRange(range);
    const averageDailyCost = daysInRange > 0 ? totalCost / daysInRange : 0;

    // Project to month end
    const projectedMonthEnd = this.projectMonthEnd(totalCost, range, averageDailyCost);

    // Success rate (all logged calls are successful - failures aren't logged)
    const successRate = 100;

    const overview: UsageOverview = {
      totalCost,
      totalTokens,
      totalCalls,
      successRate,
      averageDailyCost,
      projectedMonthEnd,
    };

    // Cache result
    await this.setCache(cacheKey, overview);

    return overview;
  }

  /**
   * Get daily cost breakdown for a date range
   */
  async getDailyCosts(firmId: string, dateRange: DateRange): Promise<DailyCost[]> {
    const cacheKey = this.buildCacheKey('daily', firmId, dateRange);

    // Try cache first
    const cached = await this.getFromCache<DailyCost[]>(cacheKey);
    if (cached) return cached;

    // Use raw SQL for efficient date grouping
    const results = await prisma.$queryRaw<
      Array<{
        date: Date;
        cost: Prisma.Decimal;
        tokens: bigint;
        calls: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC('day', created_at) as date,
        SUM(cost_eur) as cost,
        SUM(input_tokens + output_tokens) as tokens,
        COUNT(*) as calls
      FROM ai_usage_logs
      WHERE firm_id = ${firmId}
        AND created_at >= ${dateRange.start}
        AND created_at <= ${dateRange.end}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date
    `;

    const dailyCosts: DailyCost[] = results.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      cost: Number(row.cost) || 0,
      tokens: Number(row.tokens) || 0,
      calls: Number(row.calls) || 0,
    }));

    // Cache result
    await this.setCache(cacheKey, dailyCosts);

    return dailyCosts;
  }

  /**
   * Get cost breakdown by feature
   */
  async getCostsByFeature(firmId: string, dateRange: DateRange): Promise<FeatureCost[]> {
    const cacheKey = this.buildCacheKey('feature', firmId, dateRange);

    // Try cache first
    const cached = await this.getFromCache<FeatureCost[]>(cacheKey);
    if (cached) return cached;

    // Query grouped by feature
    const results = await prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: {
        firmId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          costEur: 'desc',
        },
      },
    });

    // Calculate total cost for percentages
    const totalCost = results.reduce((sum, r) => sum + (r._sum.costEur?.toNumber() || 0), 0);

    const featureCosts: FeatureCost[] = results.map((row) => {
      const cost = row._sum.costEur?.toNumber() || 0;
      return {
        feature: row.feature,
        featureName: FEATURE_NAMES[row.feature] || row.feature,
        cost,
        tokens: (row._sum.inputTokens || 0) + (row._sum.outputTokens || 0),
        calls: row._count || 0,
        percentOfTotal: totalCost > 0 ? (cost / totalCost) * 100 : 0,
      };
    });

    // Cache result
    await this.setCache(cacheKey, featureCosts);

    return featureCosts;
  }

  /**
   * Get cost breakdown by user
   */
  async getCostsByUser(firmId: string, dateRange: DateRange): Promise<UserCost[]> {
    const cacheKey = this.buildCacheKey('user', firmId, dateRange);

    // Try cache first
    const cached = await this.getFromCache<UserCost[]>(cacheKey);
    if (cached) return cached;

    // Query grouped by user with join to get names
    const results = await prisma.$queryRaw<
      Array<{
        user_id: string | null;
        first_name: string | null;
        last_name: string | null;
        cost: Prisma.Decimal;
        tokens: bigint;
        calls: bigint;
      }>
    >`
      SELECT
        l.user_id,
        u.first_name,
        u.last_name,
        SUM(l.cost_eur) as cost,
        SUM(l.input_tokens + l.output_tokens) as tokens,
        COUNT(*) as calls
      FROM ai_usage_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.firm_id = ${firmId}
        AND l.created_at >= ${dateRange.start}
        AND l.created_at <= ${dateRange.end}
      GROUP BY l.user_id, u.first_name, u.last_name
      ORDER BY cost DESC
    `;

    const userCosts: UserCost[] = results.map((row) => ({
      userId: row.user_id || 'batch',
      userName:
        row.user_id && row.first_name && row.last_name
          ? `${row.first_name} ${row.last_name}`
          : 'Procesare Batch',
      cost: Number(row.cost) || 0,
      tokens: Number(row.tokens) || 0,
      calls: Number(row.calls) || 0,
    }));

    // Cache result
    await this.setCache(cacheKey, userCosts);

    return userCosts;
  }

  /**
   * Get current month's spend (quick lookup for alerts)
   */
  async getCurrentMonthSpend(firmId: string): Promise<number> {
    const range = this.getCurrentMonthRange();
    const overview = await this.getUsageOverview(firmId, range);
    return overview.totalCost;
  }

  /**
   * Get projected spend at month end
   */
  async getProjectedMonthEnd(firmId: string): Promise<number> {
    const range = this.getCurrentMonthRange();
    const overview = await this.getUsageOverview(firmId, range);
    return overview.projectedMonthEnd;
  }

  // ============================================================================
  // OPS-247: User-Specific Methods
  // ============================================================================

  /**
   * Get detailed usage data for a specific user
   */
  async getUserUsage(
    firmId: string,
    userId: string,
    dateRange: DateRange
  ): Promise<UserUsage | null> {
    // Get user info first
    const user = await prisma.user.findFirst({
      where: { id: userId, firmId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!user) return null;

    // Fetch totals, daily costs, and costs by feature in parallel
    const [totals, dailyCosts, costsByFeature] = await Promise.all([
      this.getUserTotals(firmId, userId, dateRange),
      this.getUserDailyCosts(firmId, userId, dateRange),
      this.getUserCostsByFeature(firmId, userId, dateRange),
    ]);

    return {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      totalCost: totals.cost,
      totalTokens: totals.tokens,
      totalCalls: totals.calls,
      dailyCosts,
      costsByFeature,
    };
  }

  /**
   * Get activity log entries for a specific user
   */
  async getUserActivity(
    firmId: string,
    userId: string,
    limit: number,
    offset: number
  ): Promise<UsageLogEntry[]> {
    const logs = await prisma.aIUsageLog.findMany({
      where: { firmId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return logs.map((log) => ({
      id: log.id,
      feature: log.feature,
      featureName: FEATURE_NAMES[log.feature] || log.feature,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      costEur: Number(log.costEur),
      durationMs: log.durationMs,
      createdAt: log.createdAt,
      entityType: log.entityType,
      entityId: log.entityId,
    }));
  }

  /**
   * Get aggregate totals for a user
   */
  private async getUserTotals(
    firmId: string,
    userId: string,
    dateRange: DateRange
  ): Promise<{ cost: number; tokens: number; calls: number }> {
    const result = await prisma.aIUsageLog.aggregate({
      where: {
        firmId,
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
    });

    return {
      cost: result._sum.costEur?.toNumber() || 0,
      tokens: (result._sum.inputTokens || 0) + (result._sum.outputTokens || 0),
      calls: result._count || 0,
    };
  }

  /**
   * Get daily costs for a specific user
   */
  private async getUserDailyCosts(
    firmId: string,
    userId: string,
    dateRange: DateRange
  ): Promise<DailyCost[]> {
    const results = await prisma.$queryRaw<
      Array<{
        date: Date;
        cost: Prisma.Decimal;
        tokens: bigint;
        calls: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC('day', created_at) as date,
        SUM(cost_eur) as cost,
        SUM(input_tokens + output_tokens) as tokens,
        COUNT(*) as calls
      FROM ai_usage_logs
      WHERE firm_id = ${firmId}
        AND user_id = ${userId}
        AND created_at >= ${dateRange.start}
        AND created_at <= ${dateRange.end}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date
    `;

    return results.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      cost: Number(row.cost) || 0,
      tokens: Number(row.tokens) || 0,
      calls: Number(row.calls) || 0,
    }));
  }

  /**
   * Get costs by feature for a specific user
   */
  private async getUserCostsByFeature(
    firmId: string,
    userId: string,
    dateRange: DateRange
  ): Promise<FeatureCost[]> {
    const results = await prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: {
        firmId,
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costEur: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          costEur: 'desc',
        },
      },
    });

    // Calculate total for percentages
    const totalCost = results.reduce((sum, r) => sum + (r._sum.costEur?.toNumber() || 0), 0);

    return results.map((row) => {
      const cost = row._sum.costEur?.toNumber() || 0;
      return {
        feature: row.feature,
        featureName: FEATURE_NAMES[row.feature] || row.feature,
        cost,
        tokens: (row._sum.inputTokens || 0) + (row._sum.outputTokens || 0),
        calls: row._count || 0,
        percentOfTotal: totalCost > 0 ? (cost / totalCost) * 100 : 0,
      };
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the current month's date range (1st to now)
   */
  private getCurrentMonthRange(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }

  /**
   * Get number of days in a date range
   */
  private getDaysInRange(range: DateRange): number {
    const diffTime = range.end.getTime() - range.start.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Project month-end spend based on current pace
   */
  private projectMonthEnd(currentSpend: number, range: DateRange, dailyAverage: number): number {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.max(
      0,
      Math.ceil((monthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    return currentSpend + dailyAverage * daysRemaining;
  }

  /**
   * Build cache key for aggregation queries
   */
  private buildCacheKey(type: string, firmId: string, range: DateRange): string {
    const startStr = range.start.toISOString().split('T')[0];
    const endStr = range.end.toISOString().split('T')[0];
    return `${CACHE_KEY_PREFIX}${type}:${firmId}:${startStr}:${endStr}`;
  }

  /**
   * Get value from Redis cache
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      console.error('[AIUsageService] Cache get error:', err);
    }
    return null;
  }

  /**
   * Set value in Redis cache
   */
  private async setCache<T>(key: string, value: T): Promise<void> {
    try {
      await redis.setex(key, CACHE_TTL, JSON.stringify(value));
    } catch (err) {
      console.error('[AIUsageService] Cache set error:', err);
    }
  }

  /**
   * Invalidate cache for a firm (call after new usage logs)
   */
  async invalidateCache(firmId: string): Promise<void> {
    try {
      // Find all keys for this firm
      const pattern = `${CACHE_KEY_PREFIX}*:${firmId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.error('[AIUsageService] Cache invalidation error:', err);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const aiUsageService = new AIUsageService();
