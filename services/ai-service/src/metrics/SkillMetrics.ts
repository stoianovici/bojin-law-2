/**
 * Skill Metrics Service
 *
 * Comprehensive skill effectiveness tracking including:
 * - Success rate monitoring
 * - Token savings analysis
 * - Execution time tracking
 * - Error rate calculation
 * - User satisfaction scores
 * - Rolling averages for trend detection
 * - Effectiveness scoring algorithm
 * - Anomaly detection
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SkillExecutionRecord {
  skillId: string;
  timestamp: Date;
  success: boolean;
  executionTimeMs: number;
  tokensUsed: number;
  tokensSaved: number;
  errorMessage?: string;
  userSatisfaction?: number; // 1-5 scale
}

export interface SkillEffectivenessMetrics {
  skillId: string;

  // Aggregated counts
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;

  // Success rate
  successRate: number; // 0-1

  // Token metrics
  averageTokensSaved: number;
  totalTokensSaved: number;
  tokenSavingsStdDev: number;

  // Execution time metrics
  averageExecutionTimeMs: number;
  executionTimeStdDev: number;
  p95ExecutionTimeMs: number;

  // Error rate
  errorRate: number; // 0-1
  commonErrors: Map<string, number>;

  // User satisfaction
  averageUserSatisfaction?: number; // 1-5 scale
  userSatisfactionCount: number;

  // Overall effectiveness score
  effectivenessScore: number; // 0-1

  // Trend data (rolling averages)
  last24Hours: {
    executions: number;
    successRate: number;
    avgTokensSaved: number;
    avgExecutionTime: number;
  };

  last7Days: {
    executions: number;
    successRate: number;
    avgTokensSaved: number;
    avgExecutionTime: number;
  };

  // Timestamps
  firstExecution: Date;
  lastExecution: Date;
  lastUpdated: Date;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyType?: 'success_rate_drop' | 'execution_time_spike' | 'token_savings_drop' | 'error_rate_spike';
  severity: 'low' | 'medium' | 'high';
  message: string;
  detectedAt: Date;
  metrics: {
    current: number;
    baseline: number;
    deviation: number;
  };
}

// ============================================================================
// SkillMetrics Class
// ============================================================================

export class SkillMetrics {
  // In-memory storage for execution records
  private executionHistory: Map<string, SkillExecutionRecord[]> = new Map();

  // Cached metrics
  private metricsCache: Map<string, SkillEffectivenessMetrics> = new Map();

  // Configuration
  private readonly config = {
    historyLimit: 1000, // Max records per skill
    rollingWindow24h: 24 * 60 * 60 * 1000,
    rollingWindow7d: 7 * 24 * 60 * 60 * 1000,
    anomalyThresholds: {
      successRateDrop: 0.2, // 20% drop triggers anomaly
      executionTimeSpike: 2.0, // 2x increase triggers anomaly
      tokenSavingsDrop: 0.3, // 30% drop triggers anomaly
      errorRateSpike: 0.1, // 10% increase triggers anomaly
    },
    effectivenessWeights: {
      successRate: 0.4,
      tokenSavings: 0.3,
      speed: 0.2,
      errorRate: 0.1,
    },
  };

  constructor(
    private dbConnection?: any,
    config?: Partial<typeof SkillMetrics.prototype.config>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // ============================================================================
  // Public Methods - Recording
  // ============================================================================

  /**
   * Record a skill execution
   */
  async recordExecution(record: SkillExecutionRecord): Promise<void> {
    // Add to history
    const history = this.executionHistory.get(record.skillId) || [];
    history.push(record);

    // Trim history if exceeds limit
    if (history.length > this.config.historyLimit) {
      history.shift();
    }

    this.executionHistory.set(record.skillId, history);

    // Update cached metrics
    await this.updateMetrics(record.skillId);

    // Check for anomalies
    const anomalies = await this.detectAnomalies(record.skillId);
    if (anomalies.length > 0) {
      await this.handleAnomalies(record.skillId, anomalies);
    }

    // Persist to database if available
    if (this.dbConnection) {
      await this.persistExecution(record);
    }

    console.log(`[SkillMetrics] Recorded execution for ${record.skillId}: success=${record.success}, time=${record.executionTimeMs}ms`);
  }

  /**
   * Batch record multiple executions
   */
  async recordBatch(records: SkillExecutionRecord[]): Promise<void> {
    for (const record of records) {
      await this.recordExecution(record);
    }
  }

  // ============================================================================
  // Public Methods - Retrieval
  // ============================================================================

  /**
   * Get effectiveness metrics for a skill
   */
  async getEffectiveness(skillId: string): Promise<SkillEffectivenessMetrics | null> {
    // Return cached metrics if available
    if (this.metricsCache.has(skillId)) {
      return this.metricsCache.get(skillId)!;
    }

    // Calculate metrics if we have history
    const history = this.executionHistory.get(skillId);
    if (!history || history.length === 0) {
      return null;
    }

    await this.updateMetrics(skillId);
    return this.metricsCache.get(skillId) || null;
  }

  /**
   * Get effectiveness for multiple skills (parallel execution)
   */
  async getEffectivenessForSkills(skillIds: string[]): Promise<Map<string, SkillEffectivenessMetrics>> {
    const results = new Map<string, SkillEffectivenessMetrics>();

    // Execute effectiveness queries in parallel for better performance
    const metricsPromises = skillIds.map(async (skillId) => ({
      skillId,
      metrics: await this.getEffectiveness(skillId),
    }));

    const metricsResults = await Promise.all(metricsPromises);

    // Populate results map
    for (const { skillId, metrics } of metricsResults) {
      if (metrics) {
        results.set(skillId, metrics);
      }
    }

    return results;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): SkillEffectivenessMetrics[] {
    return Array.from(this.metricsCache.values());
  }

  /**
   * Get top performing skills
   */
  getTopSkills(limit = 10, sortBy: 'effectiveness' | 'usage' | 'savings' = 'effectiveness'): SkillEffectivenessMetrics[] {
    const allMetrics = this.getAllMetrics();

    const sortFn = {
      effectiveness: (a: SkillEffectivenessMetrics, b: SkillEffectivenessMetrics) =>
        b.effectivenessScore - a.effectivenessScore,
      usage: (a: SkillEffectivenessMetrics, b: SkillEffectivenessMetrics) =>
        b.totalExecutions - a.totalExecutions,
      savings: (a: SkillEffectivenessMetrics, b: SkillEffectivenessMetrics) =>
        b.totalTokensSaved - a.totalTokensSaved,
    }[sortBy];

    return allMetrics.sort(sortFn).slice(0, limit);
  }

  // ============================================================================
  // Private Methods - Metrics Calculation
  // ============================================================================

  /**
   * Update cached metrics for a skill
   */
  private async updateMetrics(skillId: string): Promise<void> {
    const history = this.executionHistory.get(skillId);
    if (!history || history.length === 0) {
      return;
    }

    const now = Date.now();

    // Filter records for rolling windows
    const last24h = history.filter(
      (r) => now - r.timestamp.getTime() < this.config.rollingWindow24h
    );
    const last7d = history.filter(
      (r) => now - r.timestamp.getTime() < this.config.rollingWindow7d
    );

    // Calculate basic metrics
    const totalExecutions = history.length;
    const successfulExecutions = history.filter((r) => r.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = successfulExecutions / totalExecutions;
    const errorRate = failedExecutions / totalExecutions;

    // Token savings metrics
    const tokensSaved = history.map((r) => r.tokensSaved);
    const averageTokensSaved = this.calculateMean(tokensSaved);
    const totalTokensSaved = tokensSaved.reduce((sum, val) => sum + val, 0);
    const tokenSavingsStdDev = this.calculateStdDev(tokensSaved);

    // Execution time metrics
    const executionTimes = history.map((r) => r.executionTimeMs);
    const averageExecutionTimeMs = this.calculateMean(executionTimes);
    const executionTimeStdDev = this.calculateStdDev(executionTimes);
    const p95ExecutionTimeMs = this.calculatePercentile(executionTimes, 0.95);

    // Error tracking
    const commonErrors = new Map<string, number>();
    history
      .filter((r) => !r.success && r.errorMessage)
      .forEach((r) => {
        const count = commonErrors.get(r.errorMessage!) || 0;
        commonErrors.set(r.errorMessage!, count + 1);
      });

    // User satisfaction
    const satisfactionRecords = history.filter((r) => r.userSatisfaction !== undefined);
    const averageUserSatisfaction = satisfactionRecords.length > 0
      ? this.calculateMean(satisfactionRecords.map((r) => r.userSatisfaction!))
      : undefined;
    const userSatisfactionCount = satisfactionRecords.length;

    // Calculate effectiveness score
    const effectivenessScore = this.calculateEffectivenessScore({
      successRate,
      tokenSavingsAvg: averageTokensSaved,
      executionTimeMs: averageExecutionTimeMs,
      errorRate,
      userSatisfaction: averageUserSatisfaction,
    });

    // Rolling window metrics
    const last24Hours = {
      executions: last24h.length,
      successRate: last24h.length > 0
        ? last24h.filter((r) => r.success).length / last24h.length
        : 0,
      avgTokensSaved: last24h.length > 0
        ? this.calculateMean(last24h.map((r) => r.tokensSaved))
        : 0,
      avgExecutionTime: last24h.length > 0
        ? this.calculateMean(last24h.map((r) => r.executionTimeMs))
        : 0,
    };

    const last7Days = {
      executions: last7d.length,
      successRate: last7d.length > 0
        ? last7d.filter((r) => r.success).length / last7d.length
        : 0,
      avgTokensSaved: last7d.length > 0
        ? this.calculateMean(last7d.map((r) => r.tokensSaved))
        : 0,
      avgExecutionTime: last7d.length > 0
        ? this.calculateMean(last7d.map((r) => r.executionTimeMs))
        : 0,
    };

    const metrics: SkillEffectivenessMetrics = {
      skillId,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      averageTokensSaved,
      totalTokensSaved,
      tokenSavingsStdDev,
      averageExecutionTimeMs,
      executionTimeStdDev,
      p95ExecutionTimeMs,
      errorRate,
      commonErrors,
      averageUserSatisfaction,
      userSatisfactionCount,
      effectivenessScore,
      last24Hours,
      last7Days,
      firstExecution: history[0].timestamp,
      lastExecution: history[history.length - 1].timestamp,
      lastUpdated: new Date(),
    };

    this.metricsCache.set(skillId, metrics);
  }

  /**
   * Calculate effectiveness score using weighted algorithm
   */
  private calculateEffectivenessScore(params: {
    successRate: number;
    tokenSavingsAvg: number;
    executionTimeMs: number;
    errorRate: number;
    userSatisfaction?: number;
  }): number {
    const weights = this.config.effectivenessWeights;

    // Normalize token savings (target: 70% = 1.0)
    const tokenSavingsScore = Math.min(params.tokenSavingsAvg / 0.7, 1.0);

    // Normalize execution time (target: 5000ms = 1.0, lower is better)
    const speedScore = Math.max(0, 1 - params.executionTimeMs / 5000);

    // Error penalty
    const errorPenalty = params.errorRate * weights.errorRate;

    // Base score
    let score =
      params.successRate * weights.successRate +
      tokenSavingsScore * weights.tokenSavings +
      speedScore * weights.speed -
      errorPenalty;

    // Boost from user satisfaction (if available)
    if (params.userSatisfaction !== undefined) {
      const satisfactionBoost = (params.userSatisfaction / 5) * 0.1; // Max 10% boost
      score += satisfactionBoost;
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  // ============================================================================
  // Private Methods - Anomaly Detection
  // ============================================================================

  /**
   * Detect anomalies in skill performance
   */
  private async detectAnomalies(skillId: string): Promise<AnomalyDetectionResult[]> {
    const metrics = this.metricsCache.get(skillId);
    if (!metrics) {
      return [];
    }

    const anomalies: AnomalyDetectionResult[] = [];

    // Need sufficient data for anomaly detection
    if (metrics.totalExecutions < 20) {
      return anomalies;
    }

    // Check success rate drop
    if (metrics.last24Hours.executions >= 10) {
      const deviation = metrics.successRate - metrics.last24Hours.successRate;
      if (deviation > this.config.anomalyThresholds.successRateDrop) {
        anomalies.push({
          isAnomaly: true,
          anomalyType: 'success_rate_drop',
          severity: deviation > 0.4 ? 'high' : deviation > 0.25 ? 'medium' : 'low',
          message: `Success rate dropped from ${(metrics.successRate * 100).toFixed(1)}% to ${(metrics.last24Hours.successRate * 100).toFixed(1)}% in last 24h`,
          detectedAt: new Date(),
          metrics: {
            current: metrics.last24Hours.successRate,
            baseline: metrics.successRate,
            deviation,
          },
        });
      }
    }

    // Check execution time spike
    if (metrics.last24Hours.executions >= 10) {
      const ratio = metrics.last24Hours.avgExecutionTime / metrics.averageExecutionTimeMs;
      if (ratio > this.config.anomalyThresholds.executionTimeSpike) {
        anomalies.push({
          isAnomaly: true,
          anomalyType: 'execution_time_spike',
          severity: ratio > 3 ? 'high' : ratio > 2.5 ? 'medium' : 'low',
          message: `Execution time spiked from ${metrics.averageExecutionTimeMs.toFixed(0)}ms to ${metrics.last24Hours.avgExecutionTime.toFixed(0)}ms`,
          detectedAt: new Date(),
          metrics: {
            current: metrics.last24Hours.avgExecutionTime,
            baseline: metrics.averageExecutionTimeMs,
            deviation: ratio - 1,
          },
        });
      }
    }

    // Check token savings drop
    if (metrics.last24Hours.executions >= 10 && metrics.averageTokensSaved > 0) {
      const deviation =
        (metrics.averageTokensSaved - metrics.last24Hours.avgTokensSaved) /
        metrics.averageTokensSaved;

      if (deviation > this.config.anomalyThresholds.tokenSavingsDrop) {
        anomalies.push({
          isAnomaly: true,
          anomalyType: 'token_savings_drop',
          severity: deviation > 0.5 ? 'high' : deviation > 0.4 ? 'medium' : 'low',
          message: `Token savings dropped from ${(metrics.averageTokensSaved * 100).toFixed(1)}% to ${(metrics.last24Hours.avgTokensSaved * 100).toFixed(1)}%`,
          detectedAt: new Date(),
          metrics: {
            current: metrics.last24Hours.avgTokensSaved,
            baseline: metrics.averageTokensSaved,
            deviation,
          },
        });
      }
    }

    // Check error rate spike
    if (metrics.last24Hours.executions >= 10) {
      const history = this.executionHistory.get(skillId);
      if (history) {
        const now = Date.now();
        const last24h = history.filter(
          (r) => now - r.timestamp.getTime() < this.config.rollingWindow24h
        );
        const recent24hErrorRate =
          last24h.filter((r) => !r.success).length / last24h.length;
        const deviation = recent24hErrorRate - metrics.errorRate;

        if (deviation > this.config.anomalyThresholds.errorRateSpike) {
          anomalies.push({
            isAnomaly: true,
            anomalyType: 'error_rate_spike',
            severity: deviation > 0.2 ? 'high' : deviation > 0.15 ? 'medium' : 'low',
            message: `Error rate increased from ${(metrics.errorRate * 100).toFixed(1)}% to ${(recent24hErrorRate * 100).toFixed(1)}%`,
            detectedAt: new Date(),
            metrics: {
              current: recent24hErrorRate,
              baseline: metrics.errorRate,
              deviation,
            },
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Handle detected anomalies
   */
  private async handleAnomalies(
    skillId: string,
    anomalies: AnomalyDetectionResult[]
  ): Promise<void> {
    for (const anomaly of anomalies) {
      console.warn(`[SkillMetrics] ANOMALY DETECTED for ${skillId}:`, {
        type: anomaly.anomalyType,
        severity: anomaly.severity,
        message: anomaly.message,
      });

      // Persist to database for alerting
      if (this.dbConnection) {
        await this.persistAnomaly(skillId, anomaly);
      }
    }
  }

  // ============================================================================
  // Private Methods - Statistical Utilities
  // ============================================================================

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  // ============================================================================
  // Private Methods - Persistence
  // ============================================================================

  private async persistExecution(record: SkillExecutionRecord): Promise<void> {
    if (!this.dbConnection) return;

    try {
      await this.dbConnection.query(
        `
        INSERT INTO skill_usage_logs (
          skill_id,
          execution_time_ms,
          tokens_used,
          tokens_saved_estimate,
          success,
          error_message,
          user_satisfaction,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          record.skillId,
          record.executionTimeMs,
          record.tokensUsed,
          record.tokensSaved,
          record.success,
          record.errorMessage || null,
          record.userSatisfaction || null,
          record.timestamp,
        ]
      );
    } catch (error) {
      console.error('[SkillMetrics] Failed to persist execution:', error);
    }
  }

  private async persistAnomaly(
    skillId: string,
    anomaly: AnomalyDetectionResult
  ): Promise<void> {
    if (!this.dbConnection) return;

    try {
      await this.dbConnection.query(
        `
        INSERT INTO skill_anomalies (
          skill_id,
          anomaly_type,
          severity,
          message,
          current_value,
          baseline_value,
          deviation,
          detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          skillId,
          anomaly.anomalyType,
          anomaly.severity,
          anomaly.message,
          anomaly.metrics.current,
          anomaly.metrics.baseline,
          anomaly.metrics.deviation,
          anomaly.detectedAt,
        ]
      );
    } catch (error) {
      console.error('[SkillMetrics] Failed to persist anomaly:', error);
    }
  }

  // ============================================================================
  // Public Methods - Utilities
  // ============================================================================

  /**
   * Clear cached metrics
   */
  clearCache(): void {
    this.metricsCache.clear();
    this.executionHistory.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    skillsTracked: number;
    totalExecutions: number;
    cacheSize: number;
  } {
    const totalExecutions = Array.from(this.executionHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    return {
      skillsTracked: this.executionHistory.size,
      totalExecutions,
      cacheSize: this.metricsCache.size,
    };
  }
}
