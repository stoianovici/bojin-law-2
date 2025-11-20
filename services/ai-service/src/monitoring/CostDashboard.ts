/**
 * CostDashboard
 *
 * Extends CostTracker with production cost validation and monitoring (AC#5)
 * Validates cost savings targets and provides real-time cost tracking:
 * - Validates >35% cost savings requirement (AC#5)
 * - Projects future costs based on usage patterns
 * - Monitors cost trends and alerts on anomalies
 * - Generates detailed cost breakdown reports
 * - Tracks cost savings by model and skill
 *
 * Implements Story 2.14 Task#7: Build Monitoring Dashboards
 */

import { CostTracker, CostMetrics, CostProjection } from './CostTracker';

export interface CostValidationResult {
  achieved: boolean;
  actualSavings: number; // Percentage
  targetSavings: number; // Percentage (35%)
  totalCostWithSkills: number; // USD
  totalCostWithoutSkills: number; // USD
  tokensSaved: number;
  breakdown: {
    haiku: { cost: number; savings: number };
    sonnet: { cost: number; savings: number };
    opus: { cost: number; savings: number };
  };
  periodStart: Date;
  periodEnd: Date;
}

export interface CostTrend {
  timestamp: Date;
  hourlyRate: number; // USD per hour
  dailyProjection: number; // USD per day
  weeklyProjection: number; // USD per week
  monthlyProjection: number; // USD per month
  savingsPercentage: number;
  anomaly: boolean; // True if cost deviates significantly from baseline
}

export interface CostBreakdown {
  byModel: {
    model: string;
    totalCost: number;
    percentage: number;
    requestCount: number;
    averageCostPerRequest: number;
  }[];
  bySkill: {
    skillId: string;
    totalCost: number;
    tokensSaved: number;
    costSaved: number;
    usageCount: number;
  }[];
  byTimeOfDay: {
    hour: number; // 0-23
    totalCost: number;
    requestCount: number;
  }[];
}

export interface CostAlert {
  type: 'spike' | 'target_miss' | 'trend_change';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
}

/**
 * CostDashboard - Production cost monitoring and validation
 */
export class CostDashboard extends CostTracker {
  private costTrends: CostTrend[] = [];
  private readonly trendHistoryLimit = 1440; // 24 hours at 1min intervals
  private baselineCostPerHour: number = 0;
  private costAlerts: CostAlert[] = [];

  constructor(dbConnection?: any) {
    super(dbConnection);
  }

  // ============================================================================
  // Public Methods - Cost Validation (AC#5)
  // ============================================================================

  /**
   * Validate cost savings target (AC#5: >35% savings required)
   */
  async validateCostSavings(
    targetSavingsPercent: number = 35,
    periodDays: number = 7
  ): Promise<CostValidationResult> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const report = await this.generateReport(startDate, endDate);

    // Calculate actual savings percentage
    const totalCostWithSkills = report.totalCost;
    const totalTokens = report.totalTokens + report.totalTokensSaved;
    const avgCostPerToken = totalCostWithSkills / report.totalTokens;
    const totalCostWithoutSkills = totalTokens * avgCostPerToken;
    const actualSavings = ((totalCostWithoutSkills - totalCostWithSkills) / totalCostWithoutSkills) * 100;

    // Model breakdown
    const modelBreakdown = await this.getModelCostBreakdown(startDate, endDate);

    const result: CostValidationResult = {
      achieved: actualSavings >= targetSavingsPercent,
      actualSavings,
      targetSavings: targetSavingsPercent,
      totalCostWithSkills,
      totalCostWithoutSkills,
      tokensSaved: report.totalTokensSaved,
      breakdown: {
        haiku: modelBreakdown.haiku || { cost: 0, savings: 0 },
        sonnet: modelBreakdown.sonnet || { cost: 0, savings: 0 },
        opus: modelBreakdown.opus || { cost: 0, savings: 0 },
      },
      periodStart: startDate,
      periodEnd: endDate,
    };

    // Generate alert if target not met
    if (!result.achieved) {
      this.addCostAlert({
        type: 'target_miss',
        severity: 'warning',
        message: `Cost savings below target: ${actualSavings.toFixed(1)}% (target: ${targetSavingsPercent}%)`,
        currentValue: actualSavings,
        threshold: targetSavingsPercent,
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Get detailed cost breakdown by model, skill, and time
   */
  async getCostBreakdown(periodDays: number = 7): Promise<CostBreakdown> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const report = await this.generateReport(startDate, endDate);

    // Model breakdown
    const modelCounts = new Map<string, { cost: number; count: number }>();
    const realTimeMetrics = this.getRealTimeMetrics();

    for (const metric of realTimeMetrics.last24Hours) {
      const model = this.normalizeModelName(metric.model);
      const existing = modelCounts.get(model) || { cost: 0, count: 0 };
      existing.cost += metric.totalCost;
      existing.count += 1;
      modelCounts.set(model, existing);
    }

    const totalRequests = report.totalRequests;
    const byModel = Array.from(modelCounts.entries()).map(([model, data]) => ({
      model,
      totalCost: data.cost,
      percentage: (data.cost / report.totalCost) * 100,
      requestCount: data.count,
      averageCostPerRequest: data.cost / data.count,
    }));

    // Skill breakdown
    const bySkill = report.skillsEffectiveness.map((skill) => ({
      skillId: skill.skillId,
      totalCost: skill.averageCostSavingsPerUse * skill.totalUsages,
      tokensSaved: skill.totalTokensSaved,
      costSaved: skill.totalCostSaved,
      usageCount: skill.totalUsages,
    }));

    // Time of day breakdown
    const hourlyStats = new Map<number, { cost: number; count: number }>();
    for (const metric of realTimeMetrics.last24Hours) {
      const hour = metric.timestamp.getHours();
      const existing = hourlyStats.get(hour) || { cost: 0, count: 0 };
      existing.cost += metric.totalCost;
      existing.count += 1;
      hourlyStats.set(hour, existing);
    }

    const byTimeOfDay = Array.from({ length: 24 }, (_, hour) => {
      const stats = hourlyStats.get(hour) || { cost: 0, count: 0 };
      return {
        hour,
        totalCost: stats.cost,
        requestCount: stats.count,
      };
    });

    return {
      byModel,
      bySkill,
      byTimeOfDay,
    };
  }

  // ============================================================================
  // Public Methods - Cost Monitoring
  // ============================================================================

  /**
   * Track cost trend and detect anomalies
   */
  async trackCostTrend(): Promise<CostTrend> {
    const realTimeMetrics = this.getRealTimeMetrics();
    const last24Hours = realTimeMetrics.last24Hours;

    if (last24Hours.length === 0) {
      return this.getEmptyTrend();
    }

    // Calculate hourly rate
    const totalCost = realTimeMetrics.totalCost;
    const hoursOfData = (Date.now() - last24Hours[0].timestamp.getTime()) / (60 * 60 * 1000);
    const hourlyRate = totalCost / (hoursOfData || 1);

    // Calculate savings percentage
    const totalTokens = last24Hours.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalTokensSaved = last24Hours.reduce((sum, m) => sum + (m.tokenSavings || 0), 0);
    const savingsPercentage = ((totalTokensSaved / (totalTokens + totalTokensSaved)) * 100) || 0;

    // Detect anomaly (cost spike >50% above baseline)
    const anomaly = this.baselineCostPerHour > 0 && hourlyRate > this.baselineCostPerHour * 1.5;

    if (anomaly) {
      this.addCostAlert({
        type: 'spike',
        severity: 'warning',
        message: `Cost spike detected: $${hourlyRate.toFixed(2)}/hr (baseline: $${this.baselineCostPerHour.toFixed(2)}/hr)`,
        currentValue: hourlyRate,
        threshold: this.baselineCostPerHour * 1.5,
        timestamp: new Date(),
      });
    }

    // Update baseline if stable
    if (!anomaly && this.costTrends.length > 10) {
      const recentTrends = this.costTrends.slice(-10);
      this.baselineCostPerHour = recentTrends.reduce((sum, t) => sum + t.hourlyRate, 0) / 10;
    }

    const trend: CostTrend = {
      timestamp: new Date(),
      hourlyRate,
      dailyProjection: hourlyRate * 24,
      weeklyProjection: hourlyRate * 24 * 7,
      monthlyProjection: hourlyRate * 24 * 30,
      savingsPercentage,
      anomaly,
    };

    this.addToTrendHistory(trend);

    return trend;
  }

  /**
   * Get cost projection with confidence intervals
   */
  async getDetailedCostProjection(days: number = 30): Promise<{
    projection: CostProjection;
    confidence: number; // 0-1
    trend: 'increasing' | 'stable' | 'decreasing';
    recommendations: string[];
  }> {
    const projection = await this.projectCosts('monthly');

    // Calculate confidence based on data availability
    const realTimeMetrics = this.getRealTimeMetrics();
    const dataPoints = realTimeMetrics.last24Hours.length;
    const confidence = Math.min(dataPoints / 1000, 1.0);

    // Determine trend
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.costTrends.length >= 10) {
      const recentTrends = this.costTrends.slice(-10);
      const oldAvg = recentTrends.slice(0, 5).reduce((sum, t) => sum + t.hourlyRate, 0) / 5;
      const newAvg = recentTrends.slice(5, 10).reduce((sum, t) => sum + t.hourlyRate, 0) / 5;

      if (newAvg > oldAvg * 1.1) {
        trend = 'increasing';
      } else if (newAvg < oldAvg * 0.9) {
        trend = 'decreasing';
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (projection.savingsPercentage < 35) {
      recommendations.push('Consider increasing skills usage to meet 35% savings target');
    }
    if (trend === 'increasing') {
      recommendations.push('Cost trend is increasing - review recent changes');
      recommendations.push('Check for inefficient skill usage or model selection');
    }
    if (this.costAlerts.length > 0) {
      recommendations.push(`${this.costAlerts.length} cost alerts require attention`);
    }

    return {
      projection,
      confidence,
      trend,
      recommendations,
    };
  }

  /**
   * Get cost alerts
   */
  getCostAlerts(limit?: number): CostAlert[] {
    if (limit) {
      return this.costAlerts.slice(-limit);
    }
    return [...this.costAlerts];
  }

  /**
   * Get cost trends
   */
  getCostTrends(limit?: number): CostTrend[] {
    if (limit) {
      return this.costTrends.slice(-limit);
    }
    return [...this.costTrends];
  }

  // ============================================================================
  // Public Methods - Reporting
  // ============================================================================

  /**
   * Generate comprehensive cost report
   */
  async generateComprehensiveReport(): Promise<{
    validation: CostValidationResult;
    breakdown: CostBreakdown;
    currentTrend: CostTrend;
    alerts: CostAlert[];
    summary: string;
  }> {
    const validation = await this.validateCostSavings();
    const breakdown = await this.getCostBreakdown();
    const currentTrend = await this.trackCostTrend();
    const alerts = this.getCostAlerts(10);

    const summary = this.formatComprehensiveReport(validation, breakdown, currentTrend, alerts);

    return {
      validation,
      breakdown,
      currentTrend,
      alerts,
      summary,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getModelCostBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<{
    haiku?: { cost: number; savings: number };
    sonnet?: { cost: number; savings: number };
    opus?: { cost: number; savings: number };
  }> {
    const realTimeMetrics = this.getRealTimeMetrics();
    const periodMetrics = realTimeMetrics.last24Hours.filter(
      (m) => m.timestamp >= startDate && m.timestamp <= endDate
    );

    const breakdown: any = {};

    for (const metric of periodMetrics) {
      const model = this.normalizeModelName(metric.model);
      if (!breakdown[model]) {
        breakdown[model] = { cost: 0, savings: 0 };
      }
      breakdown[model].cost += metric.totalCost;
      breakdown[model].savings += metric.costSavings || 0;
    }

    return breakdown;
  }

  private normalizeModelName(model: string): string {
    const normalized = model.toLowerCase();
    if (normalized.includes('haiku')) return 'haiku';
    if (normalized.includes('sonnet')) return 'sonnet';
    if (normalized.includes('opus')) return 'opus';
    return model;
  }

  private addToTrendHistory(trend: CostTrend): void {
    this.costTrends.push(trend);

    if (this.costTrends.length > this.trendHistoryLimit) {
      this.costTrends = this.costTrends.slice(-this.trendHistoryLimit);
    }
  }

  private addCostAlert(alert: CostAlert): void {
    this.costAlerts.push(alert);

    // Keep last 100 alerts
    if (this.costAlerts.length > 100) {
      this.costAlerts = this.costAlerts.slice(-100);
    }
  }

  private getEmptyTrend(): CostTrend {
    return {
      timestamp: new Date(),
      hourlyRate: 0,
      dailyProjection: 0,
      weeklyProjection: 0,
      monthlyProjection: 0,
      savingsPercentage: 0,
      anomaly: false,
    };
  }

  private formatComprehensiveReport(
    validation: CostValidationResult,
    breakdown: CostBreakdown,
    trend: CostTrend,
    alerts: CostAlert[]
  ): string {
    const lines: string[] = [
      '='.repeat(80),
      'COST DASHBOARD - COMPREHENSIVE REPORT',
      '='.repeat(80),
      '',
      '💰 COST SAVINGS VALIDATION (AC#5)',
      '-'.repeat(80),
      `  Target Savings:       ${validation.targetSavings}%`,
      `  Actual Savings:       ${validation.actualSavings.toFixed(2)}%`,
      `  Status:               ${validation.achieved ? '✅ ACHIEVED' : '❌ BELOW TARGET'}`,
      `  Cost with Skills:     $${validation.totalCostWithSkills.toFixed(4)}`,
      `  Cost without Skills:  $${validation.totalCostWithoutSkills.toFixed(4)}`,
      `  Tokens Saved:         ${validation.tokensSaved.toLocaleString()}`,
      '',
      '📊 MODEL BREAKDOWN',
      '-'.repeat(80),
    ];

    breakdown.byModel.forEach((model) => {
      lines.push(
        `  ${model.model.padEnd(20)} $${model.totalCost.toFixed(4)} (${model.percentage.toFixed(1)}%) - ${model.requestCount} requests`
      );
    });

    lines.push('');
    lines.push('📈 CURRENT COST TREND');
    lines.push('-'.repeat(80));
    lines.push(`  Hourly Rate:          $${trend.hourlyRate.toFixed(4)}/hr`);
    lines.push(`  Daily Projection:     $${trend.dailyProjection.toFixed(2)}/day`);
    lines.push(`  Monthly Projection:   $${trend.monthlyProjection.toFixed(2)}/mo`);
    lines.push(`  Savings Percentage:   ${trend.savingsPercentage.toFixed(1)}%`);
    lines.push(`  Anomaly Detected:     ${trend.anomaly ? '⚠️  YES' : '✅ NO'}`);

    if (alerts.length > 0) {
      lines.push('');
      lines.push('🚨 RECENT COST ALERTS');
      lines.push('-'.repeat(80));
      alerts.forEach((alert) => {
        lines.push(`  [${alert.severity.toUpperCase()}] ${alert.message}`);
      });
    }

    lines.push('');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
