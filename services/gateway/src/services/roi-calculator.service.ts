/**
 * ROI Calculator Service
 * Story 4.7: Task Analytics and Optimization - Task 12
 *
 * Calculates ROI showing time savings from automation (AC: 6)
 *
 * Business Logic:
 * - Template task creation: 5 minutes saved per task vs manual
 * - NLP parsing: 2 minutes saved per task vs form entry
 * - Auto-reminder: 1 minute saved per reminder
 * - Auto-reassignment: 10 minutes saved per reassignment
 * - Value calculated using firm's average hourly rate
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import Redis from 'ioredis';
import type {
  AnalyticsFilters,
  ROIDashboardResponse,
  ROIMetrics,
  ROITimeSeriesPoint,
  SavingsCategory,
} from '@legal-platform/types';

// Cache TTL in seconds (30 minutes for ROI data)
const CACHE_TTL = 1800;

// Time savings assumptions (minutes)
const SAVINGS_ASSUMPTIONS = {
  templateTaskMinutes: 5, // Minutes saved per template task
  nlpParseMinutes: 2, // Minutes saved per NLP-created task
  autoReminderMinutes: 1, // Minutes saved per auto-reminder
  autoReassignmentMinutes: 10, // Minutes saved per auto-reassignment
  autoDependencyMinutes: 2, // Minutes saved per auto-triggered dependency
};

// Default hourly rate if firm doesn't have one configured (RON)
const DEFAULT_HOURLY_RATE = 200;

interface MonthlyTaskData {
  month: Date;
  templateTasks: number;
  manualTasks: number;
  nlpTasks: number;
  reminders: number;
  reassignments: number;
  dependencyTriggers: number;
}

/**
 * ROI Calculator Service
 * Calculates and displays automation time savings
 */
export class ROICalculatorService {
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
   * Calculate ROI dashboard data
   * AC: 6 - ROI calculator shows time savings from automation
   */
  async calculateROI(firmId: string, filters: AnalyticsFilters): Promise<ROIDashboardResponse> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, filters);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get firm's hourly rate
    const avgHourlyRate = await this.getFirmHourlyRate(firmId);

    // Get current period metrics
    const currentPeriod = await this.calculatePeriodMetrics(firmId, filters, avgHourlyRate);

    // Get time series data (monthly breakdown)
    const timeSeries = await this.getTimeSeries(firmId, filters, avgHourlyRate);

    // Calculate projected annual savings
    const projectedAnnualSavings = this.projectAnnualSavings(currentPeriod, filters);

    // Get top savings categories
    const topSavingsCategories = this.calculateSavingsCategories(currentPeriod);

    const result: ROIDashboardResponse = {
      currentPeriod,
      timeSeries,
      projectedAnnualSavings,
      topSavingsCategories,
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get firm's average hourly rate
   */
  private async getFirmHourlyRate(firmId: string): Promise<number> {
    const firm = await this.prisma.firm.findUnique({
      where: { id: firmId },
      select: { defaultRates: true },
    });

    if (firm?.defaultRates && typeof firm.defaultRates === 'object') {
      const rates = firm.defaultRates as Record<string, number>;
      // Average of all rates
      const rateValues = Object.values(rates).filter((r) => typeof r === 'number' && r > 0);
      if (rateValues.length > 0) {
        return rateValues.reduce((a, b) => a + b, 0) / rateValues.length;
      }
    }

    return DEFAULT_HOURLY_RATE;
  }

  /**
   * Calculate metrics for a period
   */
  private async calculatePeriodMetrics(
    firmId: string,
    filters: AnalyticsFilters,
    avgHourlyRate: number
  ): Promise<ROIMetrics> {
    // Count template tasks (tasks with templateStepId)
    const templateTasksCreated = await this.prisma.task.count({
      where: {
        firmId,
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        templateStepId: { not: null },
      },
    });

    // Count manual tasks (tasks without templateStepId)
    const manualTasksCreated = await this.prisma.task.count({
      where: {
        firmId,
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        templateStepId: null,
      },
    });

    // NLP task parsing feature has been removed (TaskParseHistory model deleted)
    const nlpTasksCreated = 0;

    // Count auto-reminders (from task reminders table if exists, otherwise estimate)
    const autoRemindersSet = await this.countAutoReminders(firmId, filters);

    // Count auto-dependency triggers
    const autoDependencyTriggers = await this.countAutoDependencyTriggers(firmId, filters);

    // Count auto-reassignments (OOO reassignments)
    const autoReassignments = await this.countAutoReassignments(firmId, filters);

    // Calculate time savings
    const templateTimeSavedMin = templateTasksCreated * SAVINGS_ASSUMPTIONS.templateTaskMinutes;
    const nlpTimeSavedMin = nlpTasksCreated * SAVINGS_ASSUMPTIONS.nlpParseMinutes;
    const reminderTimeSavedMin = autoRemindersSet * SAVINGS_ASSUMPTIONS.autoReminderMinutes;
    const reassignmentTimeSavedMin =
      autoReassignments * SAVINGS_ASSUMPTIONS.autoReassignmentMinutes;
    const dependencyTimeSavedMin =
      autoDependencyTriggers * SAVINGS_ASSUMPTIONS.autoDependencyMinutes;

    const totalTimeSavedMin =
      templateTimeSavedMin +
      nlpTimeSavedMin +
      reminderTimeSavedMin +
      reassignmentTimeSavedMin +
      dependencyTimeSavedMin;

    const totalTimeSavedHours = totalTimeSavedMin / 60;
    const totalValueSaved = totalTimeSavedHours * avgHourlyRate;

    // Calculate adoption rate
    const totalTasks = templateTasksCreated + manualTasksCreated + nlpTasksCreated;
    const templateAdoptionRate = totalTasks > 0 ? (templateTasksCreated / totalTasks) * 100 : 0;

    // Get previous period for comparison
    const periodLength = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    const previousFilters: AnalyticsFilters = {
      ...filters,
      dateRange: {
        start: new Date(filters.dateRange.start.getTime() - periodLength),
        end: new Date(filters.dateRange.start.getTime() - 1),
      },
    };
    const previousMetrics = await this.calculateBasicMetrics(
      firmId,
      previousFilters,
      avgHourlyRate
    );

    let savingsGrowthPercent: number | undefined;
    if (previousMetrics.totalValueSaved > 0) {
      savingsGrowthPercent =
        ((totalValueSaved - previousMetrics.totalValueSaved) / previousMetrics.totalValueSaved) *
        100;
    }

    return {
      templateTasksCreated,
      manualTasksCreated,
      templateAdoptionRate: Math.round(templateAdoptionRate * 100) / 100,
      estimatedTemplateTimeSavedHours: Math.round((templateTimeSavedMin / 60) * 100) / 100,
      nlpTasksCreated,
      estimatedNLPTimeSavedHours: Math.round((nlpTimeSavedMin / 60) * 100) / 100,
      autoRemindersSet,
      autoDependencyTriggers,
      autoReassignments,
      estimatedAutomationTimeSavedHours:
        Math.round(
          ((reminderTimeSavedMin + reassignmentTimeSavedMin + dependencyTimeSavedMin) / 60) * 100
        ) / 100,
      totalTimeSavedHours: Math.round(totalTimeSavedHours * 100) / 100,
      avgHourlyRate,
      totalValueSaved: Math.round(totalValueSaved * 100) / 100,
      comparisonPeriod: {
        start: filters.dateRange.start,
        end: filters.dateRange.end,
      },
      previousPeriodSavings: previousMetrics.totalValueSaved,
      savingsGrowthPercent: savingsGrowthPercent
        ? Math.round(savingsGrowthPercent * 100) / 100
        : undefined,
    };
  }

  /**
   * Calculate basic metrics for comparison
   */
  private async calculateBasicMetrics(
    firmId: string,
    filters: AnalyticsFilters,
    avgHourlyRate: number
  ): Promise<{ totalValueSaved: number }> {
    const templateTasks = await this.prisma.task.count({
      where: {
        firmId,
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        templateStepId: { not: null },
      },
    });

    // NLP task parsing feature has been removed (TaskParseHistory model deleted)
    const nlpTasks = 0;

    const timeSavedMin =
      templateTasks * SAVINGS_ASSUMPTIONS.templateTaskMinutes +
      nlpTasks * SAVINGS_ASSUMPTIONS.nlpParseMinutes;

    return {
      totalValueSaved: (timeSavedMin / 60) * avgHourlyRate,
    };
  }

  /**
   * Count auto-reminders set in period
   */
  private async countAutoReminders(firmId: string, filters: AnalyticsFilters): Promise<number> {
    // Count tasks with reminders set
    const tasksWithReminders = await this.prisma.task.count({
      where: {
        firmId,
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        // Assume tasks with due dates have auto-reminders
        dueDate: { not: undefined },
      },
    });

    return tasksWithReminders;
  }

  /**
   * Count auto-triggered dependency completions
   */
  private async countAutoDependencyTriggers(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<number> {
    // Count tasks that were unblocked due to predecessor completion
    // This is an estimate based on task dependencies
    const dependencyCount = await this.prisma.taskDependency.count({
      where: {
        predecessor: {
          firmId,
          completedAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
        },
      },
    });

    return dependencyCount;
  }

  /**
   * Count auto-reassignments (OOO)
   */
  private async countAutoReassignments(firmId: string, filters: AnalyticsFilters): Promise<number> {
    // Count task history entries for auto-reassignment
    // This would be recorded in TaskHistory with AssigneeChanged action
    const reassignments = await this.prisma.taskHistory.count({
      where: {
        task: { firmId },
        createdAt: {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end,
        },
        action: 'AssigneeChanged',
        // Only count automatic ones (would have specific indicator)
      },
    });

    return reassignments;
  }

  /**
   * Get time series data for ROI
   */
  private async getTimeSeries(
    firmId: string,
    filters: AnalyticsFilters,
    avgHourlyRate: number
  ): Promise<ROITimeSeriesPoint[]> {
    const points: ROITimeSeriesPoint[] = [];

    // Group by month
    const startMonth = new Date(filters.dateRange.start);
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);

    const endMonth = new Date(filters.dateRange.end);
    endMonth.setDate(1);

    const currentMonth = new Date(startMonth);

    while (currentMonth <= endMonth) {
      const monthEnd = new Date(currentMonth);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      const monthFilters: AnalyticsFilters = {
        ...filters,
        dateRange: {
          start: new Date(currentMonth),
          end: monthEnd,
        },
      };

      const monthMetrics = await this.calculateBasicMetrics(firmId, monthFilters, avgHourlyRate);

      points.push({
        date: new Date(currentMonth),
        timeSavedHours: Math.round((monthMetrics.totalValueSaved / avgHourlyRate) * 100) / 100,
        valueSaved: Math.round(monthMetrics.totalValueSaved * 100) / 100,
      });

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    return points;
  }

  /**
   * Project annual savings based on current data
   */
  projectAnnualSavings(currentPeriod: ROIMetrics, filters: AnalyticsFilters): number {
    const periodMs = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    const periodDays = periodMs / (1000 * 60 * 60 * 24);

    if (periodDays <= 0) return 0;

    // Extrapolate to 365 days
    const annualMultiplier = 365 / periodDays;
    return Math.round(currentPeriod.totalValueSaved * annualMultiplier * 100) / 100;
  }

  /**
   * Calculate savings by category
   */
  private calculateSavingsCategories(metrics: ROIMetrics): SavingsCategory[] {
    const categories: SavingsCategory[] = [
      {
        category: 'Template Tasks',
        hoursSaved: metrics.estimatedTemplateTimeSavedHours,
        valueSaved:
          Math.round(metrics.estimatedTemplateTimeSavedHours * metrics.avgHourlyRate * 100) / 100,
        percentageOfTotal: 0,
      },
      {
        category: 'NLP Task Creation',
        hoursSaved: metrics.estimatedNLPTimeSavedHours,
        valueSaved:
          Math.round(metrics.estimatedNLPTimeSavedHours * metrics.avgHourlyRate * 100) / 100,
        percentageOfTotal: 0,
      },
      {
        category: 'Automation Features',
        hoursSaved: metrics.estimatedAutomationTimeSavedHours,
        valueSaved:
          Math.round(metrics.estimatedAutomationTimeSavedHours * metrics.avgHourlyRate * 100) / 100,
        percentageOfTotal: 0,
      },
    ];

    // Calculate percentages
    const totalValue = categories.reduce((sum, c) => sum + c.valueSaved, 0);
    if (totalValue > 0) {
      for (const category of categories) {
        category.percentageOfTotal = Math.round((category.valueSaved / totalValue) * 10000) / 100;
      }
    }

    // Sort by value descending
    return categories.sort((a, b) => b.valueSaved - a.valueSaved);
  }

  /**
   * Get template time savings for a period
   */
  async getTemplateTimeSavings(
    firmId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    const templateTasks = await this.prisma.task.count({
      where: {
        firmId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        templateStepId: { not: null },
      },
    });
    return (templateTasks * SAVINGS_ASSUMPTIONS.templateTaskMinutes) / 60;
  }

  /**
   * Get NLP time savings for a period
   * NOTE: NLP task parsing feature has been removed (TaskParseHistory model deleted)
   */
  async getNLPTimeSavings(_firmId: string, _dateRange: { start: Date; end: Date }): Promise<number> {
    // NLP task parsing feature has been removed
    return 0;
  }

  /**
   * Get automation time savings for a period
   */
  async getAutomationTimeSavings(
    firmId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<number> {
    const filters: AnalyticsFilters = { firmId, dateRange };
    const reminders = await this.countAutoReminders(firmId, filters);
    const reassignments = await this.countAutoReassignments(firmId, filters);
    const dependencies = await this.countAutoDependencyTriggers(firmId, filters);

    const totalMinutes =
      reminders * SAVINGS_ASSUMPTIONS.autoReminderMinutes +
      reassignments * SAVINGS_ASSUMPTIONS.autoReassignmentMinutes +
      dependencies * SAVINGS_ASSUMPTIONS.autoDependencyMinutes;

    return totalMinutes / 60;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(firmId: string, filters: AnalyticsFilters): string {
    const params = [
      firmId,
      filters.dateRange.start.toISOString().split('T')[0],
      filters.dateRange.end.toISOString().split('T')[0],
    ];
    return `analytics:roi:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<ROIDashboardResponse | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects
        if (parsed.currentPeriod?.comparisonPeriod) {
          parsed.currentPeriod.comparisonPeriod.start = new Date(
            parsed.currentPeriod.comparisonPeriod.start
          );
          parsed.currentPeriod.comparisonPeriod.end = new Date(
            parsed.currentPeriod.comparisonPeriod.end
          );
        }
        if (parsed.timeSeries) {
          parsed.timeSeries = parsed.timeSeries.map((p: ROITimeSeriesPoint) => ({
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
  private async setCache(key: string, data: ROIDashboardResponse): Promise<void> {
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
      const pattern = `analytics:roi:${firmId}:*`;
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
let serviceInstance: ROICalculatorService | null = null;

export function getROICalculatorService(): ROICalculatorService {
  if (!serviceInstance) {
    serviceInstance = new ROICalculatorService();
  }
  return serviceInstance;
}

export default ROICalculatorService;
