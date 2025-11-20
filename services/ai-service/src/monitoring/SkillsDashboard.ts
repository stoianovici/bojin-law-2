/**
 * Skills Dashboard
 *
 * Real-time monitoring and analytics dashboard for skills system including:
 * - Active skills count
 * - Requests per minute
 * - Token savings percentage
 * - Cost per minute
 * - Model distribution
 * - Historical trending
 * - Skill leaderboard
 * - Cost projection tools
 */

import { SkillMetrics, SkillEffectivenessMetrics } from '../metrics/SkillMetrics';
import { RequestRouter, ModelId, RoutingDecision } from '../routing/RequestRouter';
import { PerformanceOptimizer } from '../routing/PerformanceOptimizer';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DashboardSummary {
  // Real-time metrics
  activeSkillsCount: number;
  requestsPerMinute: number;
  tokenSavingsPercentage: number;
  costPerMinute: number;

  // Model distribution
  modelDistribution: {
    model: ModelId;
    count: number;
    percentage: number;
    totalCost: number;
  }[];

  // Performance metrics
  averageRoutingTime: number;
  cacheHitRate: number;

  // Timestamp
  generatedAt: Date;
}

export interface HistoricalTrend {
  timestamp: Date;
  requestCount: number;
  tokenSavings: number;
  costSavings: number;
  averageEffectiveness: number;
  successRate: number;
}

export interface SkillLeaderboardEntry {
  skillId: string;
  skillName: string;
  rank: number;
  effectivenessScore: number;
  totalExecutions: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  successRate: number;
  averageExecutionTime: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface CostProjection {
  daily: {
    currentCost: number;
    projectedCost: number;
    savings: number;
    savingsPercentage: number;
  };
  weekly: {
    currentCost: number;
    projectedCost: number;
    savings: number;
    savingsPercentage: number;
  };
  monthly: {
    currentCost: number;
    projectedCost: number;
    savings: number;
    savingsPercentage: number;
  };
  annual: {
    currentCost: number;
    projectedCost: number;
    savings: number;
    savingsPercentage: number;
  };
}

interface RequestLog {
  timestamp: Date;
  model: ModelId;
  skillsUsed: string[];
  tokensUsed: number;
  tokensSaved: number;
  cost: number;
  effectiveness: number;
}

// ============================================================================
// SkillsDashboard Class
// ============================================================================

export class SkillsDashboard {
  private requestLogs: RequestLog[] = [];
  private readonly requestLogLimit = 10000; // Keep last 10k requests

  // Model pricing (same as RequestRouter)
  private readonly modelPricing = {
    'claude-3-5-haiku-20241022': {
      inputCostPer1M: 0.80,
      outputCostPer1M: 4.00,
    },
    'claude-3-5-sonnet-20241022': {
      inputCostPer1M: 3.00,
      outputCostPer1M: 15.00,
    },
    'claude-4-opus-20250514': {
      inputCostPer1M: 15.00,
      outputCostPer1M: 75.00,
    },
  };

  constructor(
    private readonly skillMetrics: SkillMetrics,
    private readonly requestRouter: RequestRouter,
    private readonly performanceOptimizer: PerformanceOptimizer
  ) {}

  // ============================================================================
  // Public Methods - Dashboard Data
  // ============================================================================

  /**
   * Get real-time dashboard summary
   */
  getDashboardSummary(): DashboardSummary {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Filter requests from last minute
    const recentRequests = this.requestLogs.filter(
      (log) => log.timestamp >= oneMinuteAgo
    );

    // Calculate active skills count (skills used in last hour)
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const recentSkills = new Set(
      this.requestLogs
        .filter((log) => log.timestamp >= oneHourAgo)
        .flatMap((log) => log.skillsUsed)
    );
    const activeSkillsCount = recentSkills.size;

    // Calculate requests per minute
    const requestsPerMinute = recentRequests.length;

    // Calculate average token savings
    const totalTokens = recentRequests.reduce((sum, log) => sum + log.tokensUsed, 0);
    const totalSaved = recentRequests.reduce((sum, log) => sum + log.tokensSaved, 0);
    const tokenSavingsPercentage = totalTokens > 0 ? totalSaved / (totalTokens + totalSaved) : 0;

    // Calculate cost per minute
    const costPerMinute = recentRequests.reduce((sum, log) => sum + log.cost, 0);

    // Calculate model distribution
    const modelCounts = new Map<ModelId, number>();
    const modelCosts = new Map<ModelId, number>();

    recentRequests.forEach((log) => {
      modelCounts.set(log.model, (modelCounts.get(log.model) || 0) + 1);
      modelCosts.set(log.model, (modelCosts.get(log.model) || 0) + log.cost);
    });

    const modelDistribution: DashboardSummary['modelDistribution'] = Array.from(modelCounts.entries()).map(
      ([model, count]) => ({
        model,
        count,
        percentage: recentRequests.length > 0 ? count / recentRequests.length : 0,
        totalCost: modelCosts.get(model) || 0,
      })
    );

    // Get performance metrics
    const perfStats = this.performanceOptimizer.getPerformanceStats();

    return {
      activeSkillsCount,
      requestsPerMinute,
      tokenSavingsPercentage,
      costPerMinute,
      modelDistribution,
      averageRoutingTime: perfStats.averageDuration,
      cacheHitRate: perfStats.cacheHitRate,
      generatedAt: now,
    };
  }

  /**
   * Get historical trends
   */
  getHistoricalTrends(intervalMinutes: number = 60, dataPoints: number = 24): HistoricalTrend[] {
    const trends: HistoricalTrend[] = [];
    const now = Date.now();
    const intervalMs = intervalMinutes * 60 * 1000;

    for (let i = dataPoints - 1; i >= 0; i--) {
      const endTime = now - i * intervalMs;
      const startTime = endTime - intervalMs;

      const periodRequests = this.requestLogs.filter(
        (log) => log.timestamp.getTime() >= startTime && log.timestamp.getTime() <= endTime
      );

      if (periodRequests.length === 0) {
        trends.push({
          timestamp: new Date(endTime),
          requestCount: 0,
          tokenSavings: 0,
          costSavings: 0,
          averageEffectiveness: 0,
          successRate: 0,
        });
        continue;
      }

      const totalTokensSaved = periodRequests.reduce((sum, log) => sum + log.tokensSaved, 0);
      const totalTokensUsed = periodRequests.reduce((sum, log) => sum + log.tokensUsed, 0);
      const tokenSavings = totalTokensUsed > 0 ? totalTokensSaved / (totalTokensUsed + totalTokensSaved) : 0;

      // Estimate cost savings (comparing with/without skills)
      const actualCost = periodRequests.reduce((sum, log) => sum + log.cost, 0);
      const estimatedCostWithoutSkills = actualCost / (1 - tokenSavings); // Rough estimate
      const costSavings = estimatedCostWithoutSkills - actualCost;

      const averageEffectiveness =
        periodRequests.reduce((sum, log) => sum + log.effectiveness, 0) / periodRequests.length;

      trends.push({
        timestamp: new Date(endTime),
        requestCount: periodRequests.length,
        tokenSavings,
        costSavings,
        averageEffectiveness,
        successRate: 1.0, // Would need success/failure tracking
      });
    }

    return trends;
  }

  /**
   * Get skill leaderboard
   */
  getSkillLeaderboard(limit: number = 10): SkillLeaderboardEntry[] {
    const allMetrics = this.skillMetrics.getAllMetrics();

    // Calculate rankings
    const entries: SkillLeaderboardEntry[] = allMetrics.map((metrics, index) => {
      // Calculate trend (comparing last 24h to last 7d)
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      const recentEffectiveness = metrics.last24Hours.successRate;
      const weeklyEffectiveness = metrics.last7Days.successRate;

      if (recentEffectiveness > weeklyEffectiveness * 1.1) {
        trend = 'improving';
      } else if (recentEffectiveness < weeklyEffectiveness * 0.9) {
        trend = 'declining';
      }

      // Calculate cost saved
      const tokenSavingsValue = metrics.totalTokensSaved;
      const avgCostPerToken = 0.000005; // Rough estimate
      const totalCostSaved = tokenSavingsValue * avgCostPerToken;

      return {
        skillId: metrics.skillId,
        skillName: metrics.skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        rank: index + 1,
        effectivenessScore: metrics.effectivenessScore,
        totalExecutions: metrics.totalExecutions,
        totalTokensSaved: metrics.totalTokensSaved,
        totalCostSaved,
        successRate: metrics.successRate,
        averageExecutionTime: metrics.averageExecutionTimeMs,
        trend,
      };
    });

    // Sort by effectiveness score
    entries.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

    // Update ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries.slice(0, limit);
  }

  /**
   * Get cost projections
   */
  getCostProjections(): CostProjection {
    const now = Date.now();

    // Get last 24 hours of data
    const last24h = this.requestLogs.filter(
      (log) => now - log.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    if (last24h.length === 0) {
      return this.getEmptyProjection();
    }

    // Calculate current daily rate
    const dailyRequests = last24h.length;
    const dailyCost = last24h.reduce((sum, log) => sum + log.cost, 0);
    const dailyTokensSaved = last24h.reduce((sum, log) => sum + log.tokensSaved, 0);
    const dailyTokensUsed = last24h.reduce((sum, log) => sum + log.tokensUsed, 0);
    const savingsRate = dailyTokensUsed > 0 ? dailyTokensSaved / (dailyTokensUsed + dailyTokensSaved) : 0;

    // Estimate cost without skills
    const currentDailyCostWithoutSkills = dailyCost / (1 - savingsRate);

    // Calculate projections
    return {
      daily: {
        currentCost: dailyCost,
        projectedCost: currentDailyCostWithoutSkills,
        savings: currentDailyCostWithoutSkills - dailyCost,
        savingsPercentage: savingsRate,
      },
      weekly: {
        currentCost: dailyCost * 7,
        projectedCost: currentDailyCostWithoutSkills * 7,
        savings: (currentDailyCostWithoutSkills - dailyCost) * 7,
        savingsPercentage: savingsRate,
      },
      monthly: {
        currentCost: dailyCost * 30,
        projectedCost: currentDailyCostWithoutSkills * 30,
        savings: (currentDailyCostWithoutSkills - dailyCost) * 30,
        savingsPercentage: savingsRate,
      },
      annual: {
        currentCost: dailyCost * 365,
        projectedCost: currentDailyCostWithoutSkills * 365,
        savings: (currentDailyCostWithoutSkills - dailyCost) * 365,
        savingsPercentage: savingsRate,
      },
    };
  }

  // ============================================================================
  // Public Methods - Data Recording
  // ============================================================================

  /**
   * Record a request for dashboard tracking
   */
  recordRequest(decision: RoutingDecision, actualMetrics: {
    tokensUsed: number;
    tokensSaved: number;
    effectiveness: number;
  }): void {
    const log: RequestLog = {
      timestamp: new Date(),
      model: decision.model,
      skillsUsed: decision.skills.map((s) => s.skill_id),
      tokensUsed: actualMetrics.tokensUsed,
      tokensSaved: actualMetrics.tokensSaved,
      cost: decision.estimatedCost,
      effectiveness: actualMetrics.effectiveness,
    };

    this.requestLogs.push(log);

    // Trim logs if exceeding limit
    if (this.requestLogs.length > this.requestLogLimit) {
      this.requestLogs.shift();
    }
  }

  /**
   * Get raw request logs (for export)
   */
  getRequestLogs(limit?: number): RequestLog[] {
    if (limit) {
      return this.requestLogs.slice(-limit);
    }
    return [...this.requestLogs];
  }

  /**
   * Clear request logs
   */
  clearLogs(): void {
    this.requestLogs = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getEmptyProjection(): CostProjection {
    return {
      daily: { currentCost: 0, projectedCost: 0, savings: 0, savingsPercentage: 0 },
      weekly: { currentCost: 0, projectedCost: 0, savings: 0, savingsPercentage: 0 },
      monthly: { currentCost: 0, projectedCost: 0, savings: 0, savingsPercentage: 0 },
      annual: { currentCost: 0, projectedCost: 0, savings: 0, savingsPercentage: 0 },
    };
  }

  // ============================================================================
  // Formatted Reports
  // ============================================================================

  /**
   * Generate formatted dashboard report
   */
  generateReport(): string {
    const summary = this.getDashboardSummary();
    const leaderboard = this.getSkillLeaderboard(5);
    const projections = this.getCostProjections();

    const lines: string[] = [
      '='.repeat(80),
      'SKILLS DASHBOARD - REAL-TIME MONITORING',
      '='.repeat(80),
      '',
      '📊 REAL-TIME METRICS',
      '-'.repeat(80),
      `  Active Skills:           ${summary.activeSkillsCount}`,
      `  Requests/Minute:         ${summary.requestsPerMinute}`,
      `  Token Savings:           ${(summary.tokenSavingsPercentage * 100).toFixed(1)}%`,
      `  Cost/Minute:             $${summary.costPerMinute.toFixed(4)}`,
      `  Avg Routing Time:        ${summary.averageRoutingTime.toFixed(2)}ms`,
      `  Cache Hit Rate:          ${(summary.cacheHitRate * 100).toFixed(1)}%`,
      '',
      '🤖 MODEL DISTRIBUTION',
      '-'.repeat(80),
    ];

    summary.modelDistribution.forEach((dist) => {
      const modelName = dist.model.split('-').slice(0, 3).join(' ').toUpperCase();
      lines.push(
        `  ${modelName.padEnd(20)} ${dist.count.toString().padStart(5)} requests (${(dist.percentage * 100).toFixed(1)}%) - $${dist.totalCost.toFixed(4)}`
      );
    });

    lines.push('');
    lines.push('🏆 TOP SKILLS');
    lines.push('-'.repeat(80));

    leaderboard.forEach((entry) => {
      const trend = { improving: '↗️', stable: '→', declining: '↘️' }[entry.trend];
      lines.push(
        `  ${entry.rank}. ${entry.skillName.padEnd(25)} Score: ${(entry.effectivenessScore * 100).toFixed(0)}% ${trend} (${entry.totalExecutions} uses, ${(entry.successRate * 100).toFixed(1)}% success)`
      );
    });

    lines.push('');
    lines.push('💰 COST PROJECTIONS');
    lines.push('-'.repeat(80));
    lines.push(
      `  Daily:    $${projections.daily.currentCost.toFixed(2)} → $${projections.daily.projectedCost.toFixed(2)} (Save $${projections.daily.savings.toFixed(2)} / ${(projections.daily.savingsPercentage * 100).toFixed(1)}%)`
    );
    lines.push(
      `  Monthly:  $${projections.monthly.currentCost.toFixed(2)} → $${projections.monthly.projectedCost.toFixed(2)} (Save $${projections.monthly.savings.toFixed(2)} / ${(projections.monthly.savingsPercentage * 100).toFixed(1)}%)`
    );
    lines.push(
      `  Annual:   $${projections.annual.currentCost.toFixed(2)} → $${projections.annual.projectedCost.toFixed(2)} (Save $${projections.annual.savings.toFixed(2)} / ${(projections.annual.savingsPercentage * 100).toFixed(1)}%)`
    );

    lines.push('');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${summary.generatedAt.toISOString()}`);
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
