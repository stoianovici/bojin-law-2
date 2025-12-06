/**
 * Velocity Trends Service
 * Story 4.7: Task Analytics and Optimization - Task 9
 *
 * Tracks task velocity trends showing productivity changes (AC: 3)
 *
 * Business Logic:
 * - Velocity = Tasks completed / Target (based on historical average)
 * - Trend = Comparison of current vs previous period
 * - Support daily, weekly, monthly intervals
 *
 * Performance Optimizations:
 * - Redis caching with 15-minute TTL
 * - Pre-aggregated snapshots for historical data
 */

import { PrismaClient as PrismaClientType, TaskStatus } from '@prisma/client';
import Redis from 'ioredis';
import type {
  AnalyticsFilters,
  VelocityTrendsResponse,
  VelocityDataPoint,
  VelocityByUser,
  FirmVelocity,
  TrendDirection,
  TrendDirectionSimple,
  VelocityInterval,
} from '@legal-platform/types';

// Cache TTL in seconds (15 minutes)
const CACHE_TTL = 900;

interface DailyTaskCounts {
  date: Date;
  created: number;
  completed: number;
}

/**
 * Velocity Trends Service
 * Tracks task productivity and velocity changes
 */
export class VelocityTrendsService {
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
   * Get velocity trends for a firm
   * AC: 3 - Task velocity trends show productivity changes
   */
  async getVelocityTrends(
    firmId: string,
    filters: AnalyticsFilters,
    interval: VelocityInterval
  ): Promise<VelocityTrendsResponse> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, filters, interval);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get time series data
    const timeSeries = await this.getTimeSeries(firmId, filters, interval);

    // Calculate firm velocity
    const firmVelocity = await this.calculateFirmVelocity(firmId, filters);

    // Calculate by user
    const byUser = await this.getUserVelocityComparison(firmId, filters);

    const result: VelocityTrendsResponse = {
      firmVelocity,
      timeSeries,
      byUser,
      interval,
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get time series data for velocity
   */
  private async getTimeSeries(
    firmId: string,
    filters: AnalyticsFilters,
    interval: VelocityInterval
  ): Promise<VelocityDataPoint[]> {
    // Get daily counts
    const dailyCounts = await this.getDailyTaskCounts(firmId, filters);

    // Aggregate by interval
    const aggregated = this.aggregateByInterval(dailyCounts, interval);

    // Calculate historical average for target (from last 90 days before period)
    const historicalTarget = await this.getHistoricalTarget(firmId, filters.dateRange.start, interval);

    // Build velocity data points
    const dataPoints: VelocityDataPoint[] = [];
    let previousVelocity = 0;

    for (const bucket of aggregated) {
      const velocityScore = historicalTarget > 0 ? bucket.completed / historicalTarget : 0;
      const trend = this.determineTrend(velocityScore, previousVelocity);

      dataPoints.push({
        date: bucket.date,
        tasksCreated: bucket.created,
        tasksCompleted: bucket.completed,
        velocityScore: Math.round(velocityScore * 100) / 100,
        trend,
      });

      previousVelocity = velocityScore;
    }

    return dataPoints;
  }

  /**
   * Get daily task counts (created and completed)
   */
  private async getDailyTaskCounts(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<DailyTaskCounts[]> {
    // Get tasks created in date range
    const createdTasks = await this.prisma.task.groupBy({
      by: ['createdAt'],
      where: {
        firmId,
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        ...(filters.userIds?.length && { assignedTo: { in: filters.userIds } }),
      },
      _count: { id: true },
    });

    // Get tasks completed in date range
    const completedTasks = await this.prisma.task.groupBy({
      by: ['completedAt'],
      where: {
        firmId,
        completedAt: {
          not: null,
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        status: TaskStatus.Completed,
        ...(filters.userIds?.length && { assignedTo: { in: filters.userIds } }),
      },
      _count: { id: true },
    });

    // Merge into daily counts
    const dailyMap = new Map<string, DailyTaskCounts>();

    // Initialize all dates in range
    const currentDate = new Date(filters.dateRange.start);
    while (currentDate <= filters.dateRange.end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyMap.set(dateKey, {
        date: new Date(dateKey),
        created: 0,
        completed: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add created counts
    for (const task of createdTasks) {
      const dateKey = new Date(task.createdAt).toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey);
      if (existing) {
        existing.created += task._count.id;
      }
    }

    // Add completed counts
    for (const task of completedTasks) {
      if (task.completedAt) {
        const dateKey = new Date(task.completedAt).toISOString().split('T')[0];
        const existing = dailyMap.get(dateKey);
        if (existing) {
          existing.completed += task._count.id;
        }
      }
    }

    return Array.from(dailyMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Aggregate daily counts by interval
   */
  private aggregateByInterval(
    dailyCounts: DailyTaskCounts[],
    interval: VelocityInterval
  ): DailyTaskCounts[] {
    if (interval === 'daily') {
      return dailyCounts;
    }

    const buckets = new Map<string, DailyTaskCounts>();

    for (const day of dailyCounts) {
      let bucketKey: string;
      let bucketDate: Date;

      if (interval === 'weekly') {
        // Get Monday of the week
        const dayOfWeek = day.date.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        bucketDate = new Date(day.date);
        bucketDate.setDate(bucketDate.getDate() + mondayOffset);
        bucketKey = bucketDate.toISOString().split('T')[0];
      } else {
        // Monthly - first of month
        bucketDate = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
        bucketKey = bucketDate.toISOString().split('T')[0];
      }

      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.created += day.created;
        existing.completed += day.completed;
      } else {
        buckets.set(bucketKey, {
          date: bucketDate,
          created: day.created,
          completed: day.completed,
        });
      }
    }

    return Array.from(buckets.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Get historical target (average completed per interval)
   */
  private async getHistoricalTarget(
    firmId: string,
    startDate: Date,
    interval: VelocityInterval
  ): Promise<number> {
    // Look back 90 days from start of period
    const lookbackEnd = new Date(startDate.getTime() - 24 * 60 * 60 * 1000); // Day before
    const lookbackStart = new Date(lookbackEnd.getTime() - 90 * 24 * 60 * 60 * 1000);

    const completedCount = await this.prisma.task.count({
      where: {
        firmId,
        completedAt: {
          gte: lookbackStart,
          lte: lookbackEnd,
        },
        status: TaskStatus.Completed,
      },
    });

    // Calculate intervals in the lookback period
    const daysDiff = 90;
    let intervalsCount: number;

    switch (interval) {
      case 'daily':
        intervalsCount = daysDiff;
        break;
      case 'weekly':
        intervalsCount = Math.ceil(daysDiff / 7);
        break;
      case 'monthly':
        intervalsCount = 3;
        break;
    }

    return intervalsCount > 0 ? completedCount / intervalsCount : 0;
  }

  /**
   * Calculate velocity score
   */
  calculateVelocityScore(created: number, completed: number, target: number): number {
    if (target === 0) return 0;
    return Math.round((completed / target) * 100) / 100;
  }

  /**
   * Determine trend direction based on velocity change
   */
  determineTrend(current: number, previous: number): TrendDirection {
    if (previous === 0) return 'stable';

    const changePercent = ((current - previous) / previous) * 100;

    if (changePercent > 5) return 'improving';
    if (changePercent < -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate firm-wide velocity metrics
   */
  async calculateFirmVelocity(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<FirmVelocity> {
    // Current period
    const currentCompleted = await this.prisma.task.count({
      where: {
        firmId,
        completedAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        status: TaskStatus.Completed,
      },
    });

    // Previous period (same length)
    const periodLength = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    const previousStart = new Date(filters.dateRange.start.getTime() - periodLength);
    const previousEnd = new Date(filters.dateRange.start.getTime() - 1);

    const previousCompleted = await this.prisma.task.count({
      where: {
        firmId,
        completedAt: {
          gte: previousStart,
          lte: previousEnd,
        },
        status: TaskStatus.Completed,
      },
    });

    // Calculate target from historical data
    const historicalTarget = await this.getHistoricalTarget(firmId, filters.dateRange.start, 'daily');
    const periodDays = Math.ceil(periodLength / (24 * 60 * 60 * 1000));
    const periodTarget = historicalTarget * periodDays;

    const currentVelocity = periodTarget > 0 ? currentCompleted / periodTarget : 0;
    const previousVelocity = periodTarget > 0 ? previousCompleted / periodTarget : 0;

    let percentageChange = 0;
    if (previousVelocity > 0) {
      percentageChange = ((currentVelocity - previousVelocity) / previousVelocity) * 100;
    }

    return {
      current: Math.round(currentVelocity * 100) / 100,
      previous: Math.round(previousVelocity * 100) / 100,
      trend: this.determineTrend(currentVelocity, previousVelocity),
      percentageChange: Math.round(percentageChange * 100) / 100,
    };
  }

  /**
   * Get velocity comparison by user
   * AC: 3 - User velocity trends
   */
  async getUserVelocityComparison(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<VelocityByUser[]> {
    // Get users with completed tasks in period
    const userStats = await this.prisma.task.groupBy({
      by: ['assignedTo'],
      where: {
        firmId,
        completedAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        status: TaskStatus.Completed,
      },
      _count: { id: true },
    });

    // Previous period
    const periodLength = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    const previousStart = new Date(filters.dateRange.start.getTime() - periodLength);
    const previousEnd = new Date(filters.dateRange.start.getTime() - 1);

    const previousUserStats = await this.prisma.task.groupBy({
      by: ['assignedTo'],
      where: {
        firmId,
        completedAt: {
          gte: previousStart,
          lte: previousEnd,
        },
        status: TaskStatus.Completed,
      },
      _count: { id: true },
    });

    const previousMap = new Map(previousUserStats.map((s) => [s.assignedTo, s._count.id]));

    // Get user names
    const userIds = userStats.map((s) => s.assignedTo);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userNameMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    // Calculate historical target per user
    const historicalTarget = await this.getHistoricalTarget(firmId, filters.dateRange.start, 'daily');
    const periodDays = Math.ceil(periodLength / (24 * 60 * 60 * 1000));
    const userTarget = historicalTarget > 0 ? (historicalTarget * periodDays) / userStats.length : 1;

    // Build result
    const result: VelocityByUser[] = userStats.map((stats) => {
      const currentCount = stats._count.id;
      const previousCount = previousMap.get(stats.assignedTo) || 0;

      const currentVelocity = userTarget > 0 ? currentCount / userTarget : 0;
      const previousVelocity = userTarget > 0 ? previousCount / userTarget : 0;

      let percentageChange = 0;
      if (previousVelocity > 0) {
        percentageChange = ((currentVelocity - previousVelocity) / previousVelocity) * 100;
      }

      let trendDirection: TrendDirectionSimple = 'stable';
      if (percentageChange > 5) trendDirection = 'up';
      else if (percentageChange < -5) trendDirection = 'down';

      return {
        userId: stats.assignedTo,
        userName: userNameMap.get(stats.assignedTo) || 'Unknown',
        currentVelocity: Math.round(currentVelocity * 100) / 100,
        previousVelocity: Math.round(previousVelocity * 100) / 100,
        trendDirection,
        percentageChange: Math.round(percentageChange * 100) / 100,
      };
    });

    // Sort by current velocity descending
    return result.sort((a, b) => b.currentVelocity - a.currentVelocity);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    firmId: string,
    filters: AnalyticsFilters,
    interval: VelocityInterval
  ): string {
    const params = [
      firmId,
      filters.dateRange.start.toISOString().split('T')[0],
      filters.dateRange.end.toISOString().split('T')[0],
      interval,
      filters.userIds?.sort().join(',') || '',
    ];
    return `analytics:velocity:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<VelocityTrendsResponse | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects
        if (parsed.timeSeries) {
          parsed.timeSeries = parsed.timeSeries.map((p: VelocityDataPoint) => ({
            ...p,
            date: new Date(p.date),
          }));
        }
        return parsed;
      }
    } catch {
      // Cache error
    }
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: VelocityTrendsResponse): Promise<void> {
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
      const pattern = `analytics:velocity:${firmId}:*`;
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
let serviceInstance: VelocityTrendsService | null = null;

export function getVelocityTrendsService(): VelocityTrendsService {
  if (!serviceInstance) {
    serviceInstance = new VelocityTrendsService();
  }
  return serviceInstance;
}

export default VelocityTrendsService;
