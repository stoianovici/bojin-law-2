/**
 * Token Usage Monitoring Service
 * Story 3.8: Document System Testing and Performance - Task 14
 *
 * Features:
 * - Real-time token usage tracking per user/firm
 * - Daily/weekly/monthly aggregation
 * - Budget threshold checking
 * - Anomaly detection (sudden spikes)
 * - Redis for real-time access
 * - PostgreSQL for historical analysis
 */

import { PrismaClient } from '@prisma/client';

// Types for token usage monitoring
export interface TokenUsageRecord {
  userId: string | null;
  firmId: string;
  caseId: string | null;
  operationType: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  latencyMs: number;
  cached: boolean;
  timestamp: Date;
}

export interface UsageSummary {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostCents: number;
  operationCount: number;
  averageLatencyMs: number;
  cacheHitRate: number;
}

export interface FirmBudget {
  firmId: string;
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  currentDailyUsageCents: number;
  currentMonthlyUsageCents: number;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  reason: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue: number;
  threshold: number;
  recommendation: string;
}

export interface UsageByModel {
  model: string;
  tokens: number;
  costCents: number;
  operationCount: number;
}

export interface UsageByOperation {
  operationType: string;
  tokens: number;
  costCents: number;
  operationCount: number;
}

// Redis client interface (to be injected)
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  incrBy(key: string, value: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

export class TokenUsageMonitor {
  private prisma: PrismaClient;
  private redis: RedisClient;

  // Anomaly detection thresholds
  private readonly ANOMALY_THRESHOLDS = {
    hourlySpike: 2.0, // 200% of average
    dailySpike: 1.5,  // 150% of average
    singleRequest: {
      tokensWarning: 10000,    // Single request warning
      tokensCritical: 50000,   // Single request critical
    },
  };

  // Cache TTLs
  private readonly CACHE_TTL = {
    realTimeUsage: 60,        // 1 minute
    dailyAggregate: 300,      // 5 minutes
    weeklyAggregate: 900,     // 15 minutes
    monthlyAggregate: 3600,   // 1 hour
  };

  constructor(prisma: PrismaClient, redis: RedisClient) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Record token usage for an AI operation
   */
  async recordUsage(usage: TokenUsageRecord): Promise<void> {
    // Store in PostgreSQL for historical analysis
    await this.prisma.aITokenUsage.create({
      data: {
        userId: usage.userId,
        firmId: usage.firmId,
        caseId: usage.caseId,
        operationType: usage.operationType,
        modelUsed: usage.modelUsed,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        costCents: usage.costCents,
        latencyMs: usage.latencyMs,
        cached: usage.cached,
        createdAt: usage.timestamp,
      },
    });

    // Update real-time counters in Redis
    await this.updateRedisCounters(usage);

    // Check for anomalies
    await this.checkForAnomalies(usage);
  }

  /**
   * Update Redis counters for real-time tracking
   */
  private async updateRedisCounters(usage: TokenUsageRecord): Promise<void> {
    const now = new Date();
    const hourKey = this.getHourKey(usage.firmId, now);
    const dayKey = this.getDayKey(usage.firmId, now);
    const monthKey = this.getMonthKey(usage.firmId, now);

    // Increment hourly, daily, monthly counters
    await Promise.all([
      // Tokens
      this.redis.incrBy(`${hourKey}:tokens`, usage.totalTokens),
      this.redis.incrBy(`${dayKey}:tokens`, usage.totalTokens),
      this.redis.incrBy(`${monthKey}:tokens`, usage.totalTokens),

      // Cost
      this.redis.incrBy(`${hourKey}:cost`, usage.costCents),
      this.redis.incrBy(`${dayKey}:cost`, usage.costCents),
      this.redis.incrBy(`${monthKey}:cost`, usage.costCents),

      // Operation count
      this.redis.incr(`${hourKey}:ops`),
      this.redis.incr(`${dayKey}:ops`),
      this.redis.incr(`${monthKey}:ops`),
    ]);

    // Set expiration for hourly keys (24 hours)
    await this.redis.expire(`${hourKey}:tokens`, 86400);
    await this.redis.expire(`${hourKey}:cost`, 86400);
    await this.redis.expire(`${hourKey}:ops`, 86400);

    // User-specific counters
    if (usage.userId) {
      const userHourKey = `usage:user:${usage.userId}:${this.getHourString(now)}`;
      await this.redis.incrBy(`${userHourKey}:tokens`, usage.totalTokens);
      await this.redis.expire(`${userHourKey}:tokens`, 3600);
    }
  }

  /**
   * Get real-time usage for a firm
   */
  async getRealTimeUsage(firmId: string): Promise<{
    hourly: UsageSummary;
    daily: UsageSummary;
    monthly: UsageSummary;
  }> {
    const now = new Date();

    const [hourlyTokens, hourlyOps, hourlyCost] = await Promise.all([
      this.redis.get(`${this.getHourKey(firmId, now)}:tokens`),
      this.redis.get(`${this.getHourKey(firmId, now)}:ops`),
      this.redis.get(`${this.getHourKey(firmId, now)}:cost`),
    ]);

    const [dailyTokens, dailyOps, dailyCost] = await Promise.all([
      this.redis.get(`${this.getDayKey(firmId, now)}:tokens`),
      this.redis.get(`${this.getDayKey(firmId, now)}:ops`),
      this.redis.get(`${this.getDayKey(firmId, now)}:cost`),
    ]);

    const [monthlyTokens, monthlyOps, monthlyCost] = await Promise.all([
      this.redis.get(`${this.getMonthKey(firmId, now)}:tokens`),
      this.redis.get(`${this.getMonthKey(firmId, now)}:ops`),
      this.redis.get(`${this.getMonthKey(firmId, now)}:cost`),
    ]);

    return {
      hourly: {
        totalTokens: parseInt(hourlyTokens || '0'),
        inputTokens: 0, // Would need separate tracking
        outputTokens: 0,
        totalCostCents: parseInt(hourlyCost || '0'),
        operationCount: parseInt(hourlyOps || '0'),
        averageLatencyMs: 0,
        cacheHitRate: 0,
      },
      daily: {
        totalTokens: parseInt(dailyTokens || '0'),
        inputTokens: 0,
        outputTokens: 0,
        totalCostCents: parseInt(dailyCost || '0'),
        operationCount: parseInt(dailyOps || '0'),
        averageLatencyMs: 0,
        cacheHitRate: 0,
      },
      monthly: {
        totalTokens: parseInt(monthlyTokens || '0'),
        inputTokens: 0,
        outputTokens: 0,
        totalCostCents: parseInt(monthlyCost || '0'),
        operationCount: parseInt(monthlyOps || '0'),
        averageLatencyMs: 0,
        cacheHitRate: 0,
      },
    };
  }

  /**
   * Get aggregated usage from database
   */
  async getAggregatedUsage(
    firmId: string,
    period: 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageSummary> {
    const end = endDate || new Date();
    let start: Date;

    switch (period) {
      case 'daily':
        start = startDate || new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const result = await this.prisma.aITokenUsage.aggregate({
      where: {
        firmId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        costCents: true,
        latencyMs: true,
      },
      _count: true,
      _avg: {
        latencyMs: true,
      },
    });

    const cachedCount = await this.prisma.aITokenUsage.count({
      where: {
        firmId,
        createdAt: { gte: start, lte: end },
        cached: true,
      },
    });

    return {
      totalTokens: result._sum.totalTokens || 0,
      inputTokens: result._sum.inputTokens || 0,
      outputTokens: result._sum.outputTokens || 0,
      totalCostCents: result._sum.costCents || 0,
      operationCount: result._count,
      averageLatencyMs: result._avg.latencyMs || 0,
      cacheHitRate: result._count > 0 ? cachedCount / result._count : 0,
    };
  }

  /**
   * Get usage breakdown by model
   */
  async getUsageByModel(
    firmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageByModel[]> {
    const results = await this.prisma.aITokenUsage.groupBy({
      by: ['modelUsed'],
      where: {
        firmId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    return results.map((r) => ({
      model: r.modelUsed,
      tokens: r._sum.totalTokens || 0,
      costCents: r._sum.costCents || 0,
      operationCount: r._count,
    }));
  }

  /**
   * Get usage breakdown by operation type
   */
  async getUsageByOperation(
    firmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageByOperation[]> {
    const results = await this.prisma.aITokenUsage.groupBy({
      by: ['operationType'],
      where: {
        firmId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    return results.map((r) => ({
      operationType: r.operationType,
      tokens: r._sum.totalTokens || 0,
      costCents: r._sum.costCents || 0,
      operationCount: r._count,
    }));
  }

  /**
   * Check budget threshold
   */
  async checkBudget(firmId: string): Promise<{
    dailyUsage: number;
    dailyBudget: number;
    dailyPercentage: number;
    monthlyUsage: number;
    monthlyBudget: number;
    monthlyPercentage: number;
    alerts: string[];
  }> {
    const now = new Date();
    const dayKey = this.getDayKey(firmId, now);
    const monthKey = this.getMonthKey(firmId, now);

    // Get current usage from Redis
    const [dailyUsage, monthlyUsage] = await Promise.all([
      this.redis.get(`${dayKey}:cost`),
      this.redis.get(`${monthKey}:cost`),
    ]);

    // Get firm budget (would come from firm settings)
    const budget = await this.getFirmBudget(firmId);

    const dailyUsageCents = parseInt(dailyUsage || '0');
    const monthlyUsageCents = parseInt(monthlyUsage || '0');
    const dailyPercentage = (dailyUsageCents / budget.dailyBudgetCents) * 100;
    const monthlyPercentage = (monthlyUsageCents / budget.monthlyBudgetCents) * 100;

    const alerts: string[] = [];

    if (dailyPercentage >= 100) {
      alerts.push('Daily budget exceeded');
    } else if (dailyPercentage >= 90) {
      alerts.push('Daily budget at 90%');
    } else if (dailyPercentage >= 75) {
      alerts.push('Daily budget at 75%');
    }

    if (monthlyPercentage >= 100) {
      alerts.push('Monthly budget exceeded');
    } else if (monthlyPercentage >= 90) {
      alerts.push('Monthly budget at 90%');
    }

    return {
      dailyUsage: dailyUsageCents,
      dailyBudget: budget.dailyBudgetCents,
      dailyPercentage,
      monthlyUsage: monthlyUsageCents,
      monthlyBudget: budget.monthlyBudgetCents,
      monthlyPercentage,
      alerts,
    };
  }

  /**
   * Check for usage anomalies
   */
  private async checkForAnomalies(usage: TokenUsageRecord): Promise<AnomalyDetectionResult> {
    // Check for single request anomaly
    if (usage.totalTokens > this.ANOMALY_THRESHOLDS.singleRequest.tokensCritical) {
      return {
        isAnomaly: true,
        reason: 'Single request token count extremely high',
        severity: 'critical',
        currentValue: usage.totalTokens,
        threshold: this.ANOMALY_THRESHOLDS.singleRequest.tokensCritical,
        recommendation: 'Review the request and implement token limits',
      };
    }

    if (usage.totalTokens > this.ANOMALY_THRESHOLDS.singleRequest.tokensWarning) {
      return {
        isAnomaly: true,
        reason: 'Single request token count above warning threshold',
        severity: 'medium',
        currentValue: usage.totalTokens,
        threshold: this.ANOMALY_THRESHOLDS.singleRequest.tokensWarning,
        recommendation: 'Consider optimizing request context',
      };
    }

    // Check for hourly spike
    const hourlyAverage = await this.getHourlyAverageForFirm(usage.firmId);
    if (hourlyAverage > 0) {
      const now = new Date();
      const currentHourKey = this.getHourKey(usage.firmId, now);
      const currentHourUsage = parseInt(await this.redis.get(`${currentHourKey}:tokens`) || '0');

      if (currentHourUsage > hourlyAverage * this.ANOMALY_THRESHOLDS.hourlySpike) {
        return {
          isAnomaly: true,
          reason: 'Hourly usage spike detected',
          severity: 'high',
          currentValue: currentHourUsage,
          threshold: hourlyAverage * this.ANOMALY_THRESHOLDS.hourlySpike,
          recommendation: 'Investigate unusual activity or automated processes',
        };
      }
    }

    return {
      isAnomaly: false,
      reason: null,
      severity: 'low',
      currentValue: usage.totalTokens,
      threshold: 0,
      recommendation: '',
    };
  }

  /**
   * Get historical hourly average for anomaly detection
   */
  private async getHourlyAverageForFirm(firmId: string): Promise<number> {
    // Get average from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.aITokenUsage.aggregate({
      where: {
        firmId,
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { totalTokens: true },
      _count: true,
    });

    // Calculate hourly average
    const totalHours = 7 * 24;
    return result._sum.totalTokens ? result._sum.totalTokens / totalHours : 0;
  }

  /**
   * Get firm budget settings
   */
  private async getFirmBudget(firmId: string): Promise<FirmBudget> {
    // In production, this would fetch from firm settings
    // Default budgets as fallback
    return {
      firmId,
      dailyBudgetCents: 10000,   // $100/day
      monthlyBudgetCents: 200000, // $2000/month
      currentDailyUsageCents: 0,
      currentMonthlyUsageCents: 0,
    };
  }

  /**
   * Get user-specific usage for the current hour
   */
  async getUserHourlyUsage(userId: string): Promise<number> {
    const now = new Date();
    const userHourKey = `usage:user:${userId}:${this.getHourString(now)}`;
    const tokens = await this.redis.get(`${userHourKey}:tokens`);
    return parseInt(tokens || '0');
  }

  // Key generation helpers
  private getHourKey(firmId: string, date: Date): string {
    return `usage:firm:${firmId}:hour:${this.getHourString(date)}`;
  }

  private getDayKey(firmId: string, date: Date): string {
    return `usage:firm:${firmId}:day:${this.getDayString(date)}`;
  }

  private getMonthKey(firmId: string, date: Date): string {
    return `usage:firm:${firmId}:month:${this.getMonthString(date)}`;
  }

  private getHourString(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}`;
  }

  private getDayString(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  private getMonthString(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
