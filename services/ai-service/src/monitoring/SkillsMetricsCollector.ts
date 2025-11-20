/**
 * SkillsMetricsCollector
 *
 * New Relic integration for Skills monitoring (AC#2, AC#5)
 * Collects and reports custom metrics including:
 * - Skill execution performance (execution time, token usage, cost)
 * - Token reduction effectiveness (savings percentage, tokens saved)
 * - Cost optimization metrics (cost per request, total savings)
 * - Model distribution and usage patterns
 * - Cache performance (hit rate, miss rate)
 *
 * Implements Story 2.14 Task#7: Build Monitoring Dashboards
 */

/**
 * Skill execution metrics for New Relic
 */
export interface SkillExecutionMetrics {
  skillId: string;
  model: string;
  executionTime: number; // milliseconds
  tokenSavings: number; // tokens saved vs non-skills
  tokensUsed: number; // total tokens used
  cost: number; // USD
  success: boolean;
  timestamp: Date;
}

/**
 * Aggregated cost metrics for reporting
 */
export interface CostMetrics {
  totalCost: number;
  costWithSkills: number;
  costWithoutSkills: number;
  savingsPercent: number;
  tokensSaved: number;
  tokensUsed: number;
}

/**
 * Model usage distribution metrics
 */
export interface ModelDistributionMetrics {
  model: string;
  requestCount: number;
  totalCost: number;
  percentage: number;
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  hitRate: number; // 0-1
  missRate: number; // 0-1
  totalRequests: number;
  hits: number;
  misses: number;
}

/**
 * New Relic API interface (simplified)
 */
interface NewRelicAPI {
  recordMetric(name: string, value: number): void;
  recordCustomEvent(eventType: string, attributes: Record<string, any>): void;
  incrementMetric(name: string, value?: number): void;
  setTransactionName(name: string): void;
  noticeError(error: Error, customAttributes?: Record<string, any>): void;
}

/**
 * Mock New Relic API for environments without New Relic installed
 */
class MockNewRelicAPI implements NewRelicAPI {
  private metrics: Map<string, number[]> = new Map();
  private events: Array<{ type: string; attributes: Record<string, any> }> = [];

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  recordCustomEvent(eventType: string, attributes: Record<string, any>): void {
    this.events.push({ type: eventType, attributes });
  }

  incrementMetric(name: string, value: number = 1): void {
    const current = this.metrics.get(name)?.[0] || 0;
    this.recordMetric(name, current + value);
  }

  setTransactionName(name: string): void {
    // No-op for mock
  }

  noticeError(error: Error, customAttributes?: Record<string, any>): void {
    console.error('[MockNewRelic] Error:', error, customAttributes);
  }

  // Mock-specific methods for testing
  getMetrics(): Map<string, number[]> {
    return this.metrics;
  }

  getEvents(): Array<{ type: string; attributes: Record<string, any> }> {
    return this.events;
  }

  clear(): void {
    this.metrics.clear();
    this.events.length = 0;
  }
}

/**
 * SkillsMetricsCollector - New Relic integration
 */
export class SkillsMetricsCollector {
  private newrelic: NewRelicAPI;
  private isProduction: boolean;
  private executionHistory: SkillExecutionMetrics[] = [];
  private readonly historyLimit = 10000;

  constructor(options?: { useRealNewRelic?: boolean }) {
    this.isProduction = process.env.NODE_ENV === 'production';

    // Use real New Relic in production if available
    if (options?.useRealNewRelic || (this.isProduction && this.isNewRelicAvailable())) {
      try {
        this.newrelic = require('newrelic');
        console.log('[SkillsMetricsCollector] Using New Relic APM');
      } catch (error) {
        console.warn('[SkillsMetricsCollector] New Relic not available, using mock');
        this.newrelic = new MockNewRelicAPI();
      }
    } else {
      this.newrelic = new MockNewRelicAPI();
    }
  }

  // ============================================================================
  // Public Methods - Skill Execution Metrics
  // ============================================================================

  /**
   * Record skill execution metrics (AC#2)
   */
  recordSkillExecution(metrics: SkillExecutionMetrics): void {
    // Store in history
    this.addToHistory(metrics);

    // New Relic custom metrics
    this.newrelic.recordMetric('Custom/Skills/ExecutionTime', metrics.executionTime);
    this.newrelic.recordMetric('Custom/Skills/TokenSavings', metrics.tokenSavings);
    this.newrelic.recordMetric('Custom/Skills/TokensUsed', metrics.tokensUsed);
    this.newrelic.recordMetric('Custom/Skills/Cost', metrics.cost);
    this.newrelic.recordMetric('Custom/Skills/SuccessRate', metrics.success ? 1 : 0);

    // Increment execution counter
    this.newrelic.incrementMetric('Custom/Skills/TotalExecutions');

    // New Relic custom event for detailed analysis
    this.newrelic.recordCustomEvent('SkillExecution', {
      skillId: metrics.skillId,
      model: metrics.model,
      executionTime: metrics.executionTime,
      tokenSavings: metrics.tokenSavings,
      tokensUsed: metrics.tokensUsed,
      cost: metrics.cost,
      success: metrics.success,
      timestamp: metrics.timestamp.toISOString(),
    });

    // Record model-specific metrics
    this.newrelic.recordMetric(
      `Custom/Skills/Model/${metrics.model}/ExecutionTime`,
      metrics.executionTime
    );
    this.newrelic.recordMetric(`Custom/Skills/Model/${metrics.model}/Cost`, metrics.cost);

    // Record skill-specific metrics
    this.newrelic.recordMetric(
      `Custom/Skills/Skill/${metrics.skillId}/ExecutionTime`,
      metrics.executionTime
    );
    this.newrelic.recordMetric(
      `Custom/Skills/Skill/${metrics.skillId}/TokenSavings`,
      metrics.tokenSavings
    );
  }

  /**
   * Record skill error (AC#6)
   */
  recordSkillError(
    error: Error,
    context: {
      skillId: string;
      model: string;
      executionTime?: number;
    }
  ): void {
    this.newrelic.noticeError(error, {
      skillId: context.skillId,
      model: context.model,
      executionTime: context.executionTime,
      errorType: 'SkillExecutionError',
    });

    this.newrelic.incrementMetric('Custom/Skills/ErrorCount');
    this.newrelic.incrementMetric(`Custom/Skills/Skill/${context.skillId}/ErrorCount`);
  }

  /**
   * Record skill timeout (AC#6)
   */
  recordSkillTimeout(context: { skillId: string; model: string; timeoutDuration: number }): void {
    this.newrelic.incrementMetric('Custom/Skills/TimeoutCount');
    this.newrelic.recordMetric('Custom/Skills/TimeoutDuration', context.timeoutDuration);

    this.newrelic.recordCustomEvent('SkillTimeout', {
      skillId: context.skillId,
      model: context.model,
      timeoutDuration: context.timeoutDuration,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // Public Methods - Cost Metrics (AC#5)
  // ============================================================================

  /**
   * Record cost metrics for monitoring cost savings
   */
  recordCostMetrics(metrics: CostMetrics): void {
    this.newrelic.recordMetric('Custom/Cost/TotalCost', metrics.totalCost);
    this.newrelic.recordMetric('Custom/Cost/CostWithSkills', metrics.costWithSkills);
    this.newrelic.recordMetric('Custom/Cost/CostWithoutSkills', metrics.costWithoutSkills);
    this.newrelic.recordMetric('Custom/Cost/SavingsPercent', metrics.savingsPercent);
    this.newrelic.recordMetric('Custom/Cost/TokensSaved', metrics.tokensSaved);
    this.newrelic.recordMetric('Custom/Cost/TokensUsed', metrics.tokensUsed);

    this.newrelic.recordCustomEvent('CostMetrics', {
      totalCost: metrics.totalCost,
      costWithSkills: metrics.costWithSkills,
      costWithoutSkills: metrics.costWithoutSkills,
      savingsPercent: metrics.savingsPercent,
      tokensSaved: metrics.tokensSaved,
      tokensUsed: metrics.tokensUsed,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate and record cost savings for a period (AC#5)
   */
  async calculateCostSavings(
    timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Promise<CostMetrics> {
    const now = Date.now();
    const timeframeMs = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    }[timeframe];

    const startTime = now - timeframeMs;
    const periodExecutions = this.executionHistory.filter(
      (e) => e.timestamp.getTime() >= startTime
    );

    if (periodExecutions.length === 0) {
      return {
        totalCost: 0,
        costWithSkills: 0,
        costWithoutSkills: 0,
        savingsPercent: 0,
        tokensSaved: 0,
        tokensUsed: 0,
      };
    }

    const costWithSkills = periodExecutions.reduce((sum, e) => sum + e.cost, 0);
    const tokensSaved = periodExecutions.reduce((sum, e) => sum + e.tokenSavings, 0);
    const tokensUsed = periodExecutions.reduce((sum, e) => sum + e.tokensUsed, 0);

    // Estimate cost without skills (tokens used + tokens saved)
    const totalTokens = tokensUsed + tokensSaved;
    const avgCostPerToken = costWithSkills / tokensUsed;
    const costWithoutSkills = totalTokens * avgCostPerToken;

    const savingsPercent = ((costWithoutSkills - costWithSkills) / costWithoutSkills) * 100;

    const metrics: CostMetrics = {
      totalCost: costWithSkills,
      costWithSkills,
      costWithoutSkills,
      savingsPercent,
      tokensSaved,
      tokensUsed,
    };

    this.recordCostMetrics(metrics);

    return metrics;
  }

  // ============================================================================
  // Public Methods - Model Distribution
  // ============================================================================

  /**
   * Record model distribution metrics
   */
  recordModelDistribution(distributions: ModelDistributionMetrics[]): void {
    for (const dist of distributions) {
      this.newrelic.recordMetric(`Custom/Models/${dist.model}/RequestCount`, dist.requestCount);
      this.newrelic.recordMetric(`Custom/Models/${dist.model}/TotalCost`, dist.totalCost);
      this.newrelic.recordMetric(`Custom/Models/${dist.model}/Percentage`, dist.percentage);

      this.newrelic.recordCustomEvent('ModelDistribution', {
        model: dist.model,
        requestCount: dist.requestCount,
        totalCost: dist.totalCost,
        percentage: dist.percentage,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Calculate current model distribution from history
   */
  getModelDistribution(): ModelDistributionMetrics[] {
    const modelCounts = new Map<string, number>();
    const modelCosts = new Map<string, number>();

    for (const execution of this.executionHistory) {
      modelCounts.set(execution.model, (modelCounts.get(execution.model) || 0) + 1);
      modelCosts.set(execution.model, (modelCosts.get(execution.model) || 0) + execution.cost);
    }

    const totalRequests = this.executionHistory.length;

    const distributions: ModelDistributionMetrics[] = [];
    for (const [model, count] of modelCounts.entries()) {
      distributions.push({
        model,
        requestCount: count,
        totalCost: modelCosts.get(model) || 0,
        percentage: (count / totalRequests) * 100,
      });
    }

    return distributions.sort((a, b) => b.requestCount - a.requestCount);
  }

  // ============================================================================
  // Public Methods - Cache Performance
  // ============================================================================

  /**
   * Record cache performance metrics
   */
  recordCacheMetrics(metrics: CacheMetrics): void {
    this.newrelic.recordMetric('Custom/Cache/HitRate', metrics.hitRate);
    this.newrelic.recordMetric('Custom/Cache/MissRate', metrics.missRate);
    this.newrelic.recordMetric('Custom/Cache/TotalRequests', metrics.totalRequests);
    this.newrelic.recordMetric('Custom/Cache/Hits', metrics.hits);
    this.newrelic.recordMetric('Custom/Cache/Misses', metrics.misses);

    this.newrelic.recordCustomEvent('CacheMetrics', {
      hitRate: metrics.hitRate,
      missRate: metrics.missRate,
      totalRequests: metrics.totalRequests,
      hits: metrics.hits,
      misses: metrics.misses,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record cache hit
   */
  recordCacheHit(skillId: string): void {
    this.newrelic.incrementMetric('Custom/Cache/Hits');
    this.newrelic.incrementMetric(`Custom/Cache/Skill/${skillId}/Hits`);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(skillId: string): void {
    this.newrelic.incrementMetric('Custom/Cache/Misses');
    this.newrelic.incrementMetric(`Custom/Cache/Skill/${skillId}/Misses`);
  }

  // ============================================================================
  // Public Methods - Performance Tracking
  // ============================================================================

  /**
   * Record routing performance (AC#4)
   */
  recordRoutingPerformance(metrics: {
    routingTime: number; // milliseconds
    skillsSelected: number;
    cacheHit: boolean;
  }): void {
    this.newrelic.recordMetric('Custom/Routing/Time', metrics.routingTime);
    this.newrelic.recordMetric('Custom/Routing/SkillsSelected', metrics.skillsSelected);
    this.newrelic.recordMetric('Custom/Routing/CacheHit', metrics.cacheHit ? 1 : 0);

    this.newrelic.recordCustomEvent('RoutingPerformance', {
      routingTime: metrics.routingTime,
      skillsSelected: metrics.skillsSelected,
      cacheHit: metrics.cacheHit,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record request latency (AC#4)
   */
  recordRequestLatency(metrics: {
    totalLatency: number; // milliseconds
    skillExecutionTime: number;
    apiLatency: number;
    routingLatency: number;
  }): void {
    this.newrelic.recordMetric('Custom/Latency/Total', metrics.totalLatency);
    this.newrelic.recordMetric('Custom/Latency/SkillExecution', metrics.skillExecutionTime);
    this.newrelic.recordMetric('Custom/Latency/API', metrics.apiLatency);
    this.newrelic.recordMetric('Custom/Latency/Routing', metrics.routingLatency);
  }

  // ============================================================================
  // Public Methods - Analytics
  // ============================================================================

  /**
   * Get execution statistics for a timeframe
   */
  getExecutionStats(timeframeMs: number): {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    averageTokenSavings: number;
    totalCost: number;
  } {
    const now = Date.now();
    const startTime = now - timeframeMs;
    const periodExecutions = this.executionHistory.filter(
      (e) => e.timestamp.getTime() >= startTime
    );

    if (periodExecutions.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        averageTokenSavings: 0,
        totalCost: 0,
      };
    }

    const successCount = periodExecutions.filter((e) => e.success).length;
    const totalExecutionTime = periodExecutions.reduce((sum, e) => sum + e.executionTime, 0);
    const totalTokenSavings = periodExecutions.reduce((sum, e) => sum + e.tokenSavings, 0);
    const totalCost = periodExecutions.reduce((sum, e) => sum + e.cost, 0);

    return {
      totalExecutions: periodExecutions.length,
      successRate: successCount / periodExecutions.length,
      averageExecutionTime: totalExecutionTime / periodExecutions.length,
      averageTokenSavings: totalTokenSavings / periodExecutions.length,
      totalCost,
    };
  }

  /**
   * Get top performing skills by token savings
   */
  getTopSkillsBySavings(limit: number = 10): Array<{
    skillId: string;
    totalSavings: number;
    executionCount: number;
    averageSavings: number;
  }> {
    const skillStats = new Map<string, { totalSavings: number; count: number }>();

    for (const execution of this.executionHistory) {
      const existing = skillStats.get(execution.skillId) || { totalSavings: 0, count: 0 };
      existing.totalSavings += execution.tokenSavings;
      existing.count += 1;
      skillStats.set(execution.skillId, existing);
    }

    const results = Array.from(skillStats.entries())
      .map(([skillId, stats]) => ({
        skillId,
        totalSavings: stats.totalSavings,
        executionCount: stats.count,
        averageSavings: stats.totalSavings / stats.count,
      }))
      .sort((a, b) => b.totalSavings - a.totalSavings)
      .slice(0, limit);

    return results;
  }

  // ============================================================================
  // Public Methods - Utility
  // ============================================================================

  /**
   * Get New Relic instance (for custom usage)
   */
  getNewRelic(): NewRelicAPI {
    return this.newrelic;
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): SkillExecutionMetrics[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private isNewRelicAvailable(): boolean {
    try {
      require.resolve('newrelic');
      return true;
    } catch {
      return false;
    }
  }

  private addToHistory(metrics: SkillExecutionMetrics): void {
    this.executionHistory.push(metrics);

    if (this.executionHistory.length > this.historyLimit) {
      this.executionHistory = this.executionHistory.slice(-this.historyLimit);
    }
  }
}
