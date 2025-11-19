/**
 * CostTracker
 *
 * Skills-aware cost tracking and optimization monitoring system:
 * - Track tokens with/without skills
 * - Calculate savings percentage and cost impact
 * - Log skill effectiveness metrics
 * - Generate cost comparison reports
 * - Real-time cost monitoring and projections
 * - Database persistence for historical analysis
 */

import { MessageResponse } from '../clients/AnthropicEnhancedClient';
import { SkillMetadata } from '../types/skills';

// Anthropic Claude pricing (as of 2025)
export const CLAUDE_PRICING = {
  'claude-3-opus-20240229': {
    input: 0.000015, // $15 per 1M tokens
    output: 0.000075, // $75 per 1M tokens
  },
  'claude-3-sonnet-20240229': {
    input: 0.000003, // $3 per 1M tokens
    output: 0.000015, // $15 per 1M tokens
  },
  'claude-3-5-sonnet-20241022': {
    input: 0.000003, // $3 per 1M tokens
    output: 0.000015, // $15 per 1M tokens
  },
  'claude-3-haiku-20240307': {
    input: 0.00000025, // $0.25 per 1M tokens
    output: 0.00000125, // $1.25 per 1M tokens
  },
} as const;

export interface CostMetrics {
  requestId: string;
  timestamp: Date;
  model: string;

  // Token usage
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  // Skills usage
  skillsUsed?: string[];
  usedSkills: boolean;

  // Cost calculations
  inputCost: number;
  outputCost: number;
  totalCost: number;

  // Savings (if skills were used)
  estimatedTokensWithoutSkills?: number;
  estimatedCostWithoutSkills?: number;
  tokenSavings?: number;
  costSavings?: number;
  savingsPercentage?: number;

  // Metadata
  taskType?: string;
  userId?: string;
}

export interface SkillEffectivenessMetrics {
  skillId: string;
  displayName: string;
  totalUsages: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  averageTokenSavingsPerUse: number;
  averageCostSavingsPerUse: number;
  averageSavingsPercentage: number;
  successRate: number;
}

export interface CostProjection {
  period: 'daily' | 'weekly' | 'monthly';
  currentCost: number;
  projectedCostWithoutSkills: number;
  projectedCostWithSkills: number;
  estimatedSavings: number;
  savingsPercentage: number;
  confidence: number; // 0-1 confidence score based on data availability
}

export interface CostComparisonReport {
  startDate: Date;
  endDate: Date;
  totalRequests: number;
  requestsWithSkills: number;
  requestsWithoutSkills: number;

  // Aggregate metrics
  totalTokens: number;
  totalCost: number;
  totalTokensSaved: number;
  totalCostSaved: number;

  // Averages
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  averageSavingsPercentage: number;

  // Skills breakdown
  skillsEffectiveness: SkillEffectivenessMetrics[];

  // Top performers
  topSkillsBySavings: SkillEffectivenessMetrics[];
  topSkillsByUsage: SkillEffectivenessMetrics[];
}

/**
 * Skills-aware cost tracking system
 */
export class CostTracker {
  private metricsCache: CostMetrics[] = [];
  private cacheLimit: number = 10000; // Keep last 10k requests in memory
  private skillsMetricsCache: Map<string, SkillEffectivenessMetrics> = new Map();

  constructor(private dbConnection?: any) {
    // Optional database connection for persistence
  }

  /**
   * Track cost for a request with skills
   */
  async trackRequest(
    response: MessageResponse,
    options: {
      model: string;
      skillsUsed?: string[];
      estimatedTokensWithoutSkills?: number;
      taskType?: string;
      userId?: string;
    }
  ): Promise<CostMetrics> {
    const metrics = this.calculateMetrics(response, options);

    // Cache in memory
    this.addToCache(metrics);

    // Persist to database if available
    if (this.dbConnection) {
      await this.persistMetrics(metrics);
    }

    // Update skills effectiveness metrics
    if (metrics.skillsUsed && metrics.skillsUsed.length > 0) {
      await this.updateSkillsEffectiveness(metrics);
    }

    return metrics;
  }

  /**
   * Calculate cost metrics for a request
   */
  private calculateMetrics(
    response: MessageResponse,
    options: {
      model: string;
      skillsUsed?: string[];
      estimatedTokensWithoutSkills?: number;
      taskType?: string;
      userId?: string;
    }
  ): CostMetrics {
    const { model, skillsUsed, estimatedTokensWithoutSkills, taskType, userId } = options;

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    const pricing = this.getPricing(model);
    const inputCost = inputTokens * pricing.input;
    const outputCost = outputTokens * pricing.output;
    const totalCost = inputCost + outputCost;

    const usedSkills = Boolean(skillsUsed && skillsUsed.length > 0);

    // Calculate savings if skills were used and we have baseline estimate
    let tokenSavings: number | undefined;
    let costSavings: number | undefined;
    let savingsPercentage: number | undefined;
    let estimatedCostWithoutSkills: number | undefined;

    if (usedSkills && estimatedTokensWithoutSkills) {
      tokenSavings = estimatedTokensWithoutSkills - totalTokens;

      // Estimate cost without skills (assuming same input/output ratio)
      const tokensRatio = outputTokens / totalTokens;
      const estimatedInputTokens = estimatedTokensWithoutSkills * (1 - tokensRatio);
      const estimatedOutputTokens = estimatedTokensWithoutSkills * tokensRatio;

      estimatedCostWithoutSkills =
        estimatedInputTokens * pricing.input + estimatedOutputTokens * pricing.output;

      costSavings = estimatedCostWithoutSkills - totalCost;
      savingsPercentage = (tokenSavings / estimatedTokensWithoutSkills) * 100;
    }

    return {
      requestId: response.id,
      timestamp: new Date(),
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      skillsUsed,
      usedSkills,
      inputCost,
      outputCost,
      totalCost,
      estimatedTokensWithoutSkills,
      estimatedCostWithoutSkills,
      tokenSavings,
      costSavings,
      savingsPercentage,
      taskType,
      userId,
    };
  }

  /**
   * Get pricing for a model
   */
  private getPricing(model: string): { input: number; output: number } {
    // Normalize model name
    const normalizedModel = model.toLowerCase();

    if (normalizedModel.includes('opus')) {
      return CLAUDE_PRICING['claude-3-opus-20240229'];
    } else if (normalizedModel.includes('sonnet')) {
      return CLAUDE_PRICING['claude-3-5-sonnet-20241022'];
    } else if (normalizedModel.includes('haiku')) {
      return CLAUDE_PRICING['claude-3-haiku-20240307'];
    }

    // Default to Sonnet pricing
    return CLAUDE_PRICING['claude-3-5-sonnet-20241022'];
  }

  /**
   * Add metrics to in-memory cache
   */
  private addToCache(metrics: CostMetrics): void {
    this.metricsCache.push(metrics);

    // Trim cache if exceeds limit
    if (this.metricsCache.length > this.cacheLimit) {
      this.metricsCache = this.metricsCache.slice(-this.cacheLimit);
    }
  }

  /**
   * Persist metrics to database
   *
   * Input Sanitization Strategy:
   * - Uses parameterized queries ($1, $2, etc.) to prevent SQL injection
   * - requestId: Expected as alphanumeric UUID format from internal generator
   * - skillsUsed: Array type-checked at TypeScript level, defaults to empty array
   * - taskType: String enum validated upstream, defaults to 'unknown' for safety
   * - Numeric values (tokens, cost): TypeScript number type enforced, zero defaults prevent null issues
   * - timestamp: Date object from system clock, trusted source
   * - All values passed through PostgreSQL driver's type coercion and escaping
   *
   * Data Integrity:
   * - Database schema enforces NOT NULL constraints and type validation
   * - Numeric bounds validated by PostgreSQL NUMERIC type (prevents overflow)
   * - JSONB array type for skill_ids ensures valid JSON structure
   * - No user-controlled data directly concatenated into SQL strings
   */
  private async persistMetrics(metrics: CostMetrics): Promise<void> {
    if (!this.dbConnection) return;

    try {
      await this.dbConnection.query(
        `
        INSERT INTO skill_usage_logs (
          request_id,
          skill_ids,
          task_type,
          tokens_used,
          tokens_saved_estimate,
          cost_usd,
          cost_saved_usd,
          success,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          metrics.requestId,
          metrics.skillsUsed || [],
          metrics.taskType || 'unknown',
          metrics.totalTokens,
          metrics.tokenSavings || 0,
          metrics.totalCost,
          metrics.costSavings || 0,
          true,
          metrics.timestamp,
        ]
      );
    } catch (error) {
      console.error('[CostTracker] Failed to persist metrics:', error);
    }
  }

  /**
   * Update skills effectiveness metrics
   */
  private async updateSkillsEffectiveness(metrics: CostMetrics): Promise<void> {
    if (!metrics.skillsUsed || !metrics.tokenSavings) return;

    for (const skillId of metrics.skillsUsed) {
      const existing = this.skillsMetricsCache.get(skillId) || {
        skillId,
        displayName: skillId,
        totalUsages: 0,
        totalTokensSaved: 0,
        totalCostSaved: 0,
        averageTokenSavingsPerUse: 0,
        averageCostSavingsPerUse: 0,
        averageSavingsPercentage: 0,
        successRate: 1.0,
      };

      existing.totalUsages += 1;
      existing.totalTokensSaved += metrics.tokenSavings;
      existing.totalCostSaved += metrics.costSavings || 0;
      existing.averageTokenSavingsPerUse = existing.totalTokensSaved / existing.totalUsages;
      existing.averageCostSavingsPerUse = existing.totalCostSaved / existing.totalUsages;
      existing.averageSavingsPercentage = metrics.savingsPercentage || 0;

      this.skillsMetricsCache.set(skillId, existing);
    }
  }

  /**
   * Generate cost comparison report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<CostComparisonReport> {
    const metrics = this.metricsCache.filter(
      (m) => m.timestamp >= startDate && m.timestamp <= endDate
    );

    const totalRequests = metrics.length;
    const requestsWithSkills = metrics.filter((m) => m.usedSkills).length;
    const requestsWithoutSkills = totalRequests - requestsWithSkills;

    const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
    const totalTokensSaved = metrics.reduce((sum, m) => sum + (m.tokenSavings || 0), 0);
    const totalCostSaved = metrics.reduce((sum, m) => sum + (m.costSavings || 0), 0);

    const averageTokensPerRequest = totalTokens / totalRequests;
    const averageCostPerRequest = totalCost / totalRequests;
    const averageSavingsPercentage =
      metrics
        .filter((m) => m.savingsPercentage)
        .reduce((sum, m) => sum + (m.savingsPercentage || 0), 0) / requestsWithSkills || 0;

    const skillsEffectiveness = Array.from(this.skillsMetricsCache.values());
    const topSkillsBySavings = [...skillsEffectiveness]
      .sort((a, b) => b.totalCostSaved - a.totalCostSaved)
      .slice(0, 10);
    const topSkillsByUsage = [...skillsEffectiveness]
      .sort((a, b) => b.totalUsages - a.totalUsages)
      .slice(0, 10);

    return {
      startDate,
      endDate,
      totalRequests,
      requestsWithSkills,
      requestsWithoutSkills,
      totalTokens,
      totalCost,
      totalTokensSaved,
      totalCostSaved,
      averageTokensPerRequest,
      averageCostPerRequest,
      averageSavingsPercentage,
      skillsEffectiveness,
      topSkillsBySavings,
      topSkillsByUsage,
    };
  }

  /**
   * Project costs for a period
   */
  async projectCosts(period: 'daily' | 'weekly' | 'monthly'): Promise<CostProjection> {
    const now = new Date();
    const periodMs = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    }[period];

    const startDate = new Date(now.getTime() - periodMs);
    const metrics = this.metricsCache.filter((m) => m.timestamp >= startDate);

    if (metrics.length === 0) {
      return {
        period,
        currentCost: 0,
        projectedCostWithoutSkills: 0,
        projectedCostWithSkills: 0,
        estimatedSavings: 0,
        savingsPercentage: 0,
        confidence: 0,
      };
    }

    const currentCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
    const projectedCostWithSkills = currentCost; // Already using skills

    // Project cost without skills
    const averageSavingsPercentage =
      metrics
        .filter((m) => m.savingsPercentage)
        .reduce((sum, m) => sum + (m.savingsPercentage || 0), 0) /
        metrics.filter((m) => m.usedSkills).length || 0;

    const projectedCostWithoutSkills = currentCost / (1 - averageSavingsPercentage / 100);
    const estimatedSavings = projectedCostWithoutSkills - projectedCostWithSkills;

    const confidence = Math.min(metrics.length / 100, 1.0); // Higher confidence with more data

    return {
      period,
      currentCost,
      projectedCostWithoutSkills,
      projectedCostWithSkills,
      estimatedSavings,
      savingsPercentage: averageSavingsPercentage,
      confidence,
    };
  }

  /**
   * Get real-time cost metrics
   */
  getRealTimeMetrics(): {
    last24Hours: CostMetrics[];
    totalCost: number;
    totalSavings: number;
    activeSkills: number;
  } {
    const now = Date.now();
    const last24Hours = this.metricsCache.filter(
      (m) => now - m.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const totalCost = last24Hours.reduce((sum, m) => sum + m.totalCost, 0);
    const totalSavings = last24Hours.reduce((sum, m) => sum + (m.costSavings || 0), 0);
    const activeSkills = new Set(last24Hours.flatMap((m) => m.skillsUsed || [])).size;

    return {
      last24Hours,
      totalCost,
      totalSavings,
      activeSkills,
    };
  }

  /**
   * Clear in-memory cache
   */
  clearCache(): void {
    this.metricsCache = [];
    this.skillsMetricsCache.clear();
  }
}
