/**
 * Platform Intelligence Service
 * Story 5.7: Platform Intelligence Dashboard - Task 4
 *
 * Aggregates data from all specialized analytics services (AC: 1-6)
 *
 * Business Logic:
 * - Combines communication, document, AI, task, and ROI metrics
 * - Calculates platform health score (weighted average)
 * - Generates actionable recommendations
 * - Caches full dashboard for 1 hour
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import Redis from 'ioredis';
import type {
  PlatformIntelligenceDashboard,
  PlatformDateRange,
  EfficiencyMetrics,
  CommunicationAnalytics,
  DocumentQualityAnalytics,
  TaskCompletionSummary,
  TaskCompletionTrend,
  AIUtilizationSummary,
  ROISummary,
  PlatformSavingsCategory,
  PlatformRecommendation,
  RecommendationCategory,
  RecommendationPriority,
  AnalyticsFilters,
} from '@legal-platform/types';
import {
  DEFAULT_HEALTH_SCORE_WEIGHTS,
  DEFAULT_HEALTH_SCORE_TARGETS,
} from '@legal-platform/types';

import {
  CommunicationResponseAnalyticsService,
  getCommunicationResponseAnalyticsService,
} from './communication-response-analytics.service';
import {
  DocumentQualityAnalyticsService,
  getDocumentQualityAnalyticsService,
} from './document-quality-analytics.service';
import {
  AIUtilizationAnalyticsService,
  getAIUtilizationAnalyticsService,
} from './ai-utilization-analytics.service';
import {
  TaskCompletionAnalyticsService,
  getTaskCompletionAnalyticsService,
} from './task-completion-analytics.service';
import { ROICalculatorService, getROICalculatorService } from './roi-calculator.service';
import { OverdueAnalysisService, getOverdueAnalysisService } from './overdue-analysis.service';

// Cache TTL in seconds (1 hour for full dashboard)
const CACHE_TTL = 3600;

// Recommendation thresholds
const THRESHOLDS = {
  responseTimeImprovement: 10, // Warn if less than 10% improvement
  firstTimeRightPercent: 70, // Warn if below 70%
  taskCompletionRate: 85, // Warn if below 85%
  aiAdoptionScore: 40, // Warn if avg adoption below 40
  overdueCount: 5, // Warn if more than 5 overdue tasks
};

/**
 * Platform Intelligence Service
 * Aggregates all analytics for the intelligence dashboard
 */
export class PlatformIntelligenceService {
  private prisma: PrismaClientType;
  private redis: Redis | null = null;
  private commService: CommunicationResponseAnalyticsService;
  private docService: DocumentQualityAnalyticsService;
  private aiService: AIUtilizationAnalyticsService;
  private taskService: TaskCompletionAnalyticsService;
  private roiService: ROICalculatorService;
  private overdueService: OverdueAnalysisService;

  constructor(
    prismaClient?: PrismaClientType,
    redisClient?: Redis,
    services?: {
      commService?: CommunicationResponseAnalyticsService;
      docService?: DocumentQualityAnalyticsService;
      aiService?: AIUtilizationAnalyticsService;
      taskService?: TaskCompletionAnalyticsService;
      roiService?: ROICalculatorService;
      overdueService?: OverdueAnalysisService;
    }
  ) {
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

    // Initialize services
    this.commService = services?.commService ?? getCommunicationResponseAnalyticsService();
    this.docService = services?.docService ?? getDocumentQualityAnalyticsService();
    this.aiService = services?.aiService ?? getAIUtilizationAnalyticsService();
    this.taskService = services?.taskService ?? getTaskCompletionAnalyticsService();
    this.roiService = services?.roiService ?? getROICalculatorService();
    this.overdueService = services?.overdueService ?? getOverdueAnalysisService();
  }

  /**
   * Get full platform intelligence dashboard
   * AC: 1-6 - All acceptance criteria
   */
  async getDashboard(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<PlatformIntelligenceDashboard> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, dateRange);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch all analytics in parallel
    const [
      communication,
      documentQuality,
      aiUtilization,
      taskAnalytics,
      roiData,
      overdueData,
    ] = await Promise.all([
      this.commService.calculateResponseTimes(firmId, dateRange),
      this.docService.getDocumentQualityAnalytics(firmId, dateRange),
      this.aiService.getAIUtilizationByUser(firmId, dateRange),
      this.getTaskCompletionSummary(firmId, dateRange),
      this.getROISummary(firmId, dateRange),
      this.overdueService.getOverdueAnalytics(firmId, this.toAnalyticsFilters(firmId, dateRange)),
    ]);

    // Calculate efficiency metrics (AC: 1)
    const efficiency = this.calculateEfficiencyMetrics(aiUtilization, roiData);

    // Build task completion summary (AC: 4)
    const taskCompletion: TaskCompletionSummary = {
      ...taskAnalytics,
      overdueCount: overdueData.totalOverdue,
    };

    // Calculate platform health score
    const platformHealthScore = this.calculatePlatformHealthScore(
      communication,
      documentQuality,
      taskCompletion,
      aiUtilization,
      roiData
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      communication,
      documentQuality,
      taskCompletion,
      aiUtilization,
      overdueData.totalOverdue
    );

    const dashboard: PlatformIntelligenceDashboard = {
      dateRange,
      firmId,
      generatedAt: new Date(),
      efficiency,
      communication,
      documentQuality,
      taskCompletion,
      aiUtilization,
      roi: roiData,
      platformHealthScore,
      recommendations,
    };

    // Cache result
    await this.setCache(cacheKey, dashboard);

    return dashboard;
  }

  /**
   * Calculate efficiency metrics (AC: 1)
   */
  private calculateEfficiencyMetrics(
    aiUtilization: AIUtilizationSummary,
    roiData: ROISummary
  ): EfficiencyMetrics {
    const aiAssistedActions = aiUtilization.firmTotal.totalRequests;
    const automationTriggers = Math.round(roiData.billableHoursRecovered * 6); // Estimate: 10 min per trigger

    // Manual vs automated ratio (lower is better - more automated)
    // Estimate based on AI adoption across users
    const avgAdoption =
      aiUtilization.byUser.length > 0
        ? aiUtilization.byUser.reduce(
            (sum: number, u: { adoptionScore: number }) => sum + u.adoptionScore,
            0
          ) / aiUtilization.byUser.length
        : 0;
    const manualVsAutomatedRatio = avgAdoption > 0 ? (100 - avgAdoption) / avgAdoption : 10;

    return {
      totalTimeSavedHours: roiData.billableHoursRecovered,
      aiAssistedActions,
      automationTriggers,
      manualVsAutomatedRatio: Math.round(manualVsAutomatedRatio * 100) / 100,
    };
  }

  /**
   * Get task completion summary with trend
   */
  private async getTaskCompletionSummary(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<Omit<TaskCompletionSummary, 'overdueCount'>> {
    const filters = this.toAnalyticsFilters(firmId, dateRange);
    const taskAnalytics = await this.taskService.getCompletionTimeAnalytics(firmId, filters);

    // Calculate completion rate from task counts
    const completedTasks = await this.prisma.task.count({
      where: {
        firmId,
        completedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    });

    const totalTasks = await this.prisma.task.count({
      where: {
        firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    });

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate deadline adherence (completed before due date)
    const completedOnTime = await this.prisma.task.count({
      where: {
        firmId,
        completedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        // Tasks with no due date count as on-time, or completed before/on due date
        // Using NOT filter with gte to find tasks completed late (then exclude them)
        NOT: {
          AND: [
            { dueDate: { not: undefined } },
            { completedAt: { gt: this.prisma.task.fields.dueDate } },
          ],
        },
      },
    });

    // Simplified: assume 80% on-time if we can't calculate exactly
    const deadlineAdherence = completedTasks > 0 ? (completedOnTime / completedTasks) * 100 : 80;

    // Get weekly trend
    const trend = await this.getTaskCompletionTrend(firmId, dateRange);

    return {
      completionRate: Math.round(completionRate * 100) / 100,
      deadlineAdherence: Math.round(deadlineAdherence * 100) / 100,
      avgCompletionTimeHours: taskAnalytics.firmMetrics.avgCompletionTimeHours,
      trend,
    };
  }

  /**
   * Get task completion trend over time
   */
  private async getTaskCompletionTrend(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<TaskCompletionTrend[]> {
    const trend: TaskCompletionTrend[] = [];
    let currentDate = new Date(dateRange.startDate);

    while (currentDate <= dateRange.endDate) {
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const periodEnd = weekEnd > dateRange.endDate ? dateRange.endDate : weekEnd;

      const [completed, total, onTime] = await Promise.all([
        this.prisma.task.count({
          where: {
            firmId,
            completedAt: {
              gte: currentDate,
              lte: periodEnd,
            },
          },
        }),
        this.prisma.task.count({
          where: {
            firmId,
            createdAt: {
              gte: currentDate,
              lte: periodEnd,
            },
          },
        }),
        this.prisma.task.count({
          where: {
            firmId,
            completedAt: {
              gte: currentDate,
              lte: periodEnd,
            },
            dueDate: { not: undefined },
          },
        }),
      ]);

      if (total > 0) {
        trend.push({
          date: new Date(currentDate),
          completionRate: Math.round((completed / total) * 10000) / 100,
          deadlineAdherence: completed > 0 ? Math.round((onTime / completed) * 10000) / 100 : 100,
          tasksCompleted: completed,
        });
      }

      currentDate.setDate(currentDate.getDate() + 7);
    }

    return trend;
  }

  /**
   * Get ROI summary (AC: 6)
   */
  private async getROISummary(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<ROISummary> {
    const filters = this.toAnalyticsFilters(firmId, dateRange);
    const roiData = await this.roiService.calculateROI(firmId, filters);

    // Map existing savings categories to platform format
    const savingsByCategory: PlatformSavingsCategory[] = roiData.topSavingsCategories.map((cat) => ({
      category: cat.category.toLowerCase().replace(/ /g, '_'),
      hoursSaved: cat.hoursSaved,
      valueInCurrency: cat.valueSaved,
      percentOfTotal: cat.percentageOfTotal,
    }));

    return {
      totalValueSaved: roiData.currentPeriod.totalValueSaved,
      billableHoursRecovered: roiData.currentPeriod.totalTimeSavedHours,
      projectedAnnualSavings: roiData.projectedAnnualSavings,
      savingsByCategory,
    };
  }

  /**
   * Calculate platform health score (0-100)
   * Weighted average of all metrics
   */
  calculatePlatformHealthScore(
    communication: CommunicationAnalytics,
    documentQuality: DocumentQualityAnalytics,
    taskCompletion: TaskCompletionSummary,
    aiUtilization: AIUtilizationSummary,
    roiData: ROISummary
  ): number {
    const weights = DEFAULT_HEALTH_SCORE_WEIGHTS;
    const targets = DEFAULT_HEALTH_SCORE_TARGETS;

    // Communication improvement score
    const commImprovement = communication.baselineComparison?.improvementPercent ?? 0;
    const commScore = this.normalizeScore(
      commImprovement,
      0,
      targets.communicationImprovementPercent
    );

    // Document quality score
    const docScore = this.normalizeScore(
      documentQuality.revisionMetrics.firstTimeRightPercent,
      0,
      targets.documentFirstTimeRightPercent
    );

    // Task completion score
    const taskScore = this.normalizeScore(
      taskCompletion.completionRate,
      0,
      targets.taskCompletionRatePercent
    );

    // AI adoption score
    const avgAdoption =
      aiUtilization.byUser.length > 0
        ? aiUtilization.byUser.reduce(
            (sum: number, u: { adoptionScore: number }) => sum + u.adoptionScore,
            0
          ) / aiUtilization.byUser.length
        : 0;
    const aiScore = this.normalizeScore(avgAdoption, 0, targets.aiAdoptionScorePercent);

    // ROI growth score (compare to previous period if available)
    const roiScore = roiData.billableHoursRecovered > 0 ? 80 : 0; // Simplified: any savings = 80%

    // Weighted average
    const totalScore =
      commScore * weights.communicationImprovement +
      docScore * weights.documentQuality +
      taskScore * weights.taskCompletion +
      aiScore * weights.aiAdoption +
      roiScore * weights.roiGrowth;

    return Math.round(totalScore);
  }

  /**
   * Normalize a value to 0-100 scale
   */
  private normalizeScore(value: number, min: number, max: number): number {
    if (max <= min) return 0;
    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(
    communication: CommunicationAnalytics,
    documentQuality: DocumentQualityAnalytics,
    taskCompletion: TaskCompletionSummary,
    aiUtilization: AIUtilizationSummary,
    overdueCount: number
  ): PlatformRecommendation[] {
    const recommendations: PlatformRecommendation[] = [];

    // Communication recommendations
    const commImprovement = communication.baselineComparison?.improvementPercent ?? 0;
    if (commImprovement < THRESHOLDS.responseTimeImprovement) {
      recommendations.push({
        category: 'communication',
        priority: 'medium',
        message: 'Email response times have not improved significantly since platform adoption',
        actionableSteps: [
          'Enable AI email drafting for all users',
          'Set up email templates for common responses',
          'Configure priority notifications for client emails',
        ],
      });
    }

    // Document quality recommendations
    if (documentQuality.revisionMetrics.firstTimeRightPercent < THRESHOLDS.firstTimeRightPercent) {
      recommendations.push({
        category: 'quality',
        priority: 'high',
        message: `Only ${documentQuality.revisionMetrics.firstTimeRightPercent.toFixed(1)}% of documents are approved on first submission`,
        actionableSteps: [
          'Enable AI document review suggestions',
          'Use clause suggestion feature during drafting',
          'Implement document templates for common document types',
        ],
      });
    }

    // Task completion recommendations
    if (taskCompletion.completionRate < THRESHOLDS.taskCompletionRate) {
      recommendations.push({
        category: 'efficiency',
        priority: 'high',
        message: `Task completion rate is ${taskCompletion.completionRate.toFixed(1)}%, below target of ${THRESHOLDS.taskCompletionRate}%`,
        actionableSteps: [
          'Review and redistribute workload across team members',
          'Enable automatic task reminders',
          'Identify and address blocking dependencies',
        ],
      });
    }

    if (overdueCount > THRESHOLDS.overdueCount) {
      recommendations.push({
        category: 'efficiency',
        priority: 'high',
        message: `${overdueCount} tasks are currently overdue`,
        actionableSteps: [
          'Triage overdue tasks by priority',
          'Consider reassigning tasks from overloaded team members',
          'Review and adjust unrealistic deadlines',
        ],
      });
    }

    // AI adoption recommendations
    const avgAdoption =
      aiUtilization.byUser.length > 0
        ? aiUtilization.byUser.reduce(
            (sum: number, u: { adoptionScore: number }) => sum + u.adoptionScore,
            0
          ) / aiUtilization.byUser.length
        : 0;

    if (avgAdoption < THRESHOLDS.aiAdoptionScore) {
      recommendations.push({
        category: 'adoption',
        priority: 'medium',
        message: `Average AI adoption score is ${avgAdoption.toFixed(0)}, indicating underutilization of AI features`,
        actionableSteps: [
          'Schedule training sessions on AI features',
          'Highlight time savings in team meetings',
          'Start with email drafting and task parsing as entry points',
        ],
      });
    }

    // Identify specific underutilized users
    if (aiUtilization.underutilizedUsers.length > 0) {
      const userNames = aiUtilization.underutilizedUsers
        .slice(0, 3)
        .map((u: { userName: string }) => u.userName);
      recommendations.push({
        category: 'adoption',
        priority: 'low',
        message: `${aiUtilization.underutilizedUsers.length} team members have low AI adoption scores`,
        actionableSteps: [
          `Provide targeted training for: ${userNames.join(', ')}`,
          'Pair low adopters with high adopters for mentoring',
          'Share success stories and time savings examples',
        ],
      });
    }

    // Sort by priority
    const priorityOrder: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Convert PlatformDateRange to AnalyticsFilters
   */
  private toAnalyticsFilters(firmId: string, dateRange: PlatformDateRange): AnalyticsFilters {
    return {
      firmId,
      dateRange: {
        start: dateRange.startDate,
        end: dateRange.endDate,
      },
    };
  }

  /**
   * Refresh dashboard cache
   */
  async refreshDashboard(firmId: string): Promise<boolean> {
    await this.invalidateCache(firmId);
    return true;
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
    return `analytics:platform-intelligence:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<PlatformIntelligenceDashboard | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects
        parsed.dateRange.startDate = new Date(parsed.dateRange.startDate);
        parsed.dateRange.endDate = new Date(parsed.dateRange.endDate);
        parsed.generatedAt = new Date(parsed.generatedAt);
        if (parsed.communication?.trend) {
          parsed.communication.trend = parsed.communication.trend.map((t: any) => ({
            ...t,
            date: new Date(t.date),
          }));
        }
        if (parsed.documentQuality?.qualityTrend) {
          parsed.documentQuality.qualityTrend = parsed.documentQuality.qualityTrend.map((t: any) => ({
            ...t,
            date: new Date(t.date),
          }));
        }
        if (parsed.taskCompletion?.trend) {
          parsed.taskCompletion.trend = parsed.taskCompletion.trend.map((t: any) => ({
            ...t,
            date: new Date(t.date),
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
  private async setCache(key: string, data: PlatformIntelligenceDashboard): Promise<void> {
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
      const pattern = `analytics:platform-intelligence:${firmId}:*`;
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
let serviceInstance: PlatformIntelligenceService | null = null;

export function getPlatformIntelligenceService(): PlatformIntelligenceService {
  if (!serviceInstance) {
    serviceInstance = new PlatformIntelligenceService();
  }
  return serviceInstance;
}

export default PlatformIntelligenceService;
