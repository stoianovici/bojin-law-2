/**
 * Request Router
 *
 * Intelligent request routing combining Skills with model selection:
 * - Hybrid routing strategy (skills + model optimization)
 * - Cost-benefit analysis
 * - Dynamic threshold adjustment
 * - Effectiveness-based routing decisions
 * - Integration with SkillSelector and SkillMetrics
 */

import { SkillSelector, AIRequest, SkillSelection } from './SkillSelector';
import { SkillMetrics } from '../metrics/SkillMetrics';
import type { SkillMetadata } from '../types/skills';
import { PerformanceOptimizer } from './PerformanceOptimizer';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ModelId =
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-4-opus-20250514';

export type RoutingStrategy =
  | 'skill-enhanced'  // High effectiveness: Haiku + skills
  | 'hybrid'          // Medium effectiveness: Sonnet + skills
  | 'fallback'        // Low effectiveness: Original routing without skills
  | 'premium';        // Complex/critical: Opus without skills

export interface RoutingDecision {
  model: ModelId;
  skills: SkillMetadata[];
  strategy: RoutingStrategy;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedTokens: number;
  alternatives?: RoutingDecision[];
}

export interface ModelPricing {
  inputCostPer1M: number;
  outputCostPer1M: number;
}

export interface CostBenefitAnalysis {
  withSkills: {
    model: ModelId;
    estimatedCost: number;
    estimatedTokens: number;
  };
  withoutSkills: {
    model: ModelId;
    estimatedCost: number;
    estimatedTokens: number;
  };
  savings: {
    tokens: number;
    cost: number;
    percentage: number;
  };
  recommendation: 'use_skills' | 'skip_skills';
  reasoning: string;
}

// ============================================================================
// RequestRouter Class
// ============================================================================

export class RequestRouter {
  private readonly skillSelector: SkillSelector;
  private readonly skillMetrics: SkillMetrics;
  private readonly performanceOptimizer: PerformanceOptimizer;

  // Model pricing (Anthropic pricing as of 2025)
  private readonly modelPricing: Record<ModelId, ModelPricing> = {
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

  // Routing configuration
  private config = {
    // Effectiveness thresholds (from story requirements)
    highEffectivenessThreshold: 0.8,  // Route to Haiku + skills
    mediumEffectivenessThreshold: 0.5, // Route to Sonnet + skills

    // Cost optimization
    targetSavingsPercentage: 0.35, // 35% target savings (from AC#10)

    // Complexity detection
    complexityThresholds: {
      high: ['critical', 'complex', 'comprehensive', 'thorough', 'detailed'],
      medium: ['standard', 'normal', 'typical'],
      low: ['simple', 'basic', 'quick', 'straightforward'],
    },

    // Dynamic threshold adjustment
    adaptiveThresholds: true,
    thresholdAdjustmentRate: 0.05, // 5% adjustment per evaluation
  };

  constructor(
    skillSelector: SkillSelector,
    skillMetrics: SkillMetrics,
    config?: Partial<typeof RequestRouter.prototype.config>,
    performanceOptimizer?: PerformanceOptimizer
  ) {
    this.skillSelector = skillSelector;
    this.skillMetrics = skillMetrics;
    this.performanceOptimizer = performanceOptimizer || new PerformanceOptimizer();

    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // ============================================================================
  // Public Methods - Main Routing
  // ============================================================================

  /**
   * Route an AI request to the optimal model + skills combination
   * Performance Budget: <100ms total routing time (AC#8)
   */
  async route(request: AIRequest): Promise<RoutingDecision> {
    // Start performance measurement
    const routingStartTime = performance.now();

    console.log('[RequestRouter] Routing request:', request.task);

    // Step 1: Detect task complexity
    const complexity = this.detectComplexity(request.task);

    // Step 2: Check if task is critical (always use premium)
    if (this.isCritical(request)) {
      const decision = this.routeToPremium(request, 'Critical task requires highest quality model');
      this.logPerformance('route', routingStartTime);
      return decision;
    }

    // Step 3: Select applicable skills (with performance measurement)
    const skillSelection = await this.performanceOptimizer.measureAsync(
      'skill-selection',
      async () => await this.skillSelector.select(request)
    );

    // Step 4: Get effectiveness metrics for selected skills (with performance measurement)
    const effectiveness = await this.performanceOptimizer.measureAsync(
      'effectiveness-calculation',
      async () => await this.getSkillEffectiveness(
        skillSelection.skills.map(s => s.skill_id)
      )
    );

    console.log(`[RequestRouter] Skill effectiveness: ${effectiveness.toFixed(2)}, strategy: ${skillSelection.strategy}`);

    // Step 5: Make routing decision based on effectiveness
    let routingDecision: RoutingDecision;

    if (effectiveness >= this.config.highEffectivenessThreshold) {
      // High effectiveness: Use cheapest model (Haiku) with skills
      routingDecision = {
        model: 'claude-3-5-haiku-20241022',
        skills: skillSelection.skills,
        strategy: 'skill-enhanced',
        confidence: skillSelection.confidence,
        reasoning: `High skill effectiveness (${(effectiveness * 100).toFixed(0)}%) allows using Haiku with skills for optimal cost-performance`,
        estimatedCost: this.estimateCost('claude-3-5-haiku-20241022', request, true),
        estimatedTokens: this.estimateTokens(request, true),
      };
    } else if (effectiveness >= this.config.mediumEffectivenessThreshold) {
      // Medium effectiveness: Use Sonnet with skills
      routingDecision = {
        model: 'claude-3-5-sonnet-20241022',
        skills: skillSelection.skills,
        strategy: 'hybrid',
        confidence: skillSelection.confidence,
        reasoning: `Medium skill effectiveness (${(effectiveness * 100).toFixed(0)}%) requires Sonnet with skills for quality balance`,
        estimatedCost: this.estimateCost('claude-3-5-sonnet-20241022', request, true),
        estimatedTokens: this.estimateTokens(request, true),
      };
    } else {
      // Low effectiveness: Fallback to original routing without skills
      routingDecision = await this.originalRouting(request);
    }

    // Step 6: Perform cost-benefit analysis
    const costBenefit = await this.analyzeCostBenefit(request, routingDecision);

    // Step 7: Override decision if cost-benefit is unfavorable
    if (costBenefit.recommendation === 'skip_skills' && routingDecision.strategy !== 'fallback') {
      console.warn('[RequestRouter] Cost-benefit analysis recommends skipping skills');
      routingDecision = await this.originalRouting(request);
    }

    // Step 8: Adjust thresholds dynamically based on performance
    if (this.config.adaptiveThresholds) {
      await this.adjustThresholds(effectiveness, routingDecision);
    }

    // Step 9: Generate alternatives
    routingDecision.alternatives = await this.generateAlternatives(request, routingDecision);

    console.log(`[RequestRouter] Final decision: ${routingDecision.model} (${routingDecision.strategy}) with ${routingDecision.skills.length} skills`);

    // Log total routing performance and check budget (AC#8: <100ms)
    this.logPerformance('route', routingStartTime);

    return routingDecision;
  }

  /**
   * Original routing logic without skills (fallback)
   */
  private async originalRouting(request: AIRequest): Promise<RoutingDecision> {
    const complexity = this.detectComplexity(request.task);

    let model: ModelId;
    let reasoning: string;

    if (complexity === 'high') {
      model = 'claude-3-5-sonnet-20241022';
      reasoning = 'High complexity task requires Sonnet quality';
    } else if (complexity === 'medium') {
      model = 'claude-3-5-sonnet-20241022';
      reasoning = 'Standard task routed to Sonnet';
    } else {
      model = 'claude-3-5-haiku-20241022';
      reasoning = 'Low complexity task can use Haiku';
    }

    return {
      model,
      skills: [],
      strategy: 'fallback',
      confidence: 0.5,
      reasoning,
      estimatedCost: this.estimateCost(model, request, false),
      estimatedTokens: this.estimateTokens(request, false),
    };
  }

  // ============================================================================
  // Private Methods - Effectiveness Calculation
  // ============================================================================

  /**
   * Get effectiveness score for a set of skills
   */
  private async getSkillEffectiveness(skillIds: string[]): Promise<number> {
    if (skillIds.length === 0) {
      return 0;
    }

    // Use SkillSelector's effectiveness calculation
    return await this.skillSelector.getEffectiveness(skillIds);
  }

  // ============================================================================
  // Private Methods - Complexity Detection
  // ============================================================================

  /**
   * Detect task complexity from description
   */
  private detectComplexity(task: string): 'low' | 'medium' | 'high' {
    const lowerTask = task.toLowerCase();

    // Check for high complexity indicators
    for (const keyword of this.config.complexityThresholds.high) {
      if (lowerTask.includes(keyword)) {
        return 'high';
      }
    }

    // Check for low complexity indicators
    for (const keyword of this.config.complexityThresholds.low) {
      if (lowerTask.includes(keyword)) {
        return 'low';
      }
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Check if task is marked as critical
   */
  private isCritical(request: AIRequest): boolean {
    const lowerTask = request.task.toLowerCase();
    return lowerTask.includes('critical') || request.context?.complexity === 'high';
  }

  /**
   * Route to premium model (Opus)
   */
  private routeToPremium(request: AIRequest, reasoning: string): RoutingDecision {
    return {
      model: 'claude-4-opus-20250514',
      skills: [],
      strategy: 'premium',
      confidence: 1.0,
      reasoning,
      estimatedCost: this.estimateCost('claude-4-opus-20250514', request, false),
      estimatedTokens: this.estimateTokens(request, false),
    };
  }

  // ============================================================================
  // Private Methods - Cost Analysis
  // ============================================================================

  /**
   * Estimate cost for a request
   */
  private estimateCost(
    model: ModelId,
    request: AIRequest,
    withSkills: boolean
  ): number {
    const estimatedTokens = this.estimateTokens(request, withSkills);
    const pricing = this.modelPricing[model];

    // Assume 60/40 input/output split
    const inputTokens = estimatedTokens * 0.6;
    const outputTokens = estimatedTokens * 0.4;

    const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPer1M;

    return inputCost + outputCost;
  }

  /**
   * Estimate tokens for a request
   */
  private estimateTokens(request: AIRequest, withSkills: boolean): number {
    // Rough estimate: 4 chars per token
    const taskTokens = Math.ceil(request.task.length / 4);

    // Base estimate: task + context + response
    let estimatedTokens = taskTokens * 3; // Rough 3x multiplier

    // Apply skill reduction if using skills
    if (withSkills) {
      estimatedTokens = Math.floor(estimatedTokens * 0.3); // 70% reduction (from story AC#6)
    }

    return estimatedTokens;
  }

  /**
   * Perform cost-benefit analysis
   */
  private async analyzeCostBenefit(
    request: AIRequest,
    proposedDecision: RoutingDecision
  ): Promise<CostBenefitAnalysis> {
    // Calculate cost with skills (proposed decision)
    const withSkills = {
      model: proposedDecision.model,
      estimatedCost: proposedDecision.estimatedCost,
      estimatedTokens: proposedDecision.estimatedTokens,
    };

    // Calculate cost without skills (fallback)
    const fallback = await this.originalRouting(request);
    const withoutSkills = {
      model: fallback.model,
      estimatedCost: fallback.estimatedCost,
      estimatedTokens: fallback.estimatedTokens,
    };

    // Calculate savings
    const tokenSavings = withoutSkills.estimatedTokens - withSkills.estimatedTokens;
    const costSavings = withoutSkills.estimatedCost - withSkills.estimatedCost;
    const savingsPercentage = costSavings / withoutSkills.estimatedCost;

    // Determine recommendation
    const shouldUseSkills =
      savingsPercentage >= this.config.targetSavingsPercentage &&
      proposedDecision.confidence >= 0.5;

    return {
      withSkills,
      withoutSkills,
      savings: {
        tokens: tokenSavings,
        cost: costSavings,
        percentage: savingsPercentage,
      },
      recommendation: shouldUseSkills ? 'use_skills' : 'skip_skills',
      reasoning: shouldUseSkills
        ? `Skills provide ${(savingsPercentage * 100).toFixed(1)}% cost savings`
        : `Insufficient savings (${(savingsPercentage * 100).toFixed(1)}% < target ${this.config.targetSavingsPercentage * 100}%)`,
    };
  }

  // ============================================================================
  // Private Methods - Dynamic Threshold Adjustment
  // ============================================================================

  /**
   * Dynamically adjust thresholds based on performance
   */
  private async adjustThresholds(
    effectiveness: number,
    decision: RoutingDecision
  ): Promise<void> {
    // Get recent performance metrics
    const recentMetrics = this.skillMetrics.getAllMetrics();

    if (recentMetrics.length === 0) {
      return; // Not enough data
    }

    // Calculate average effectiveness across all skills
    const avgEffectiveness =
      recentMetrics.reduce((sum, m) => sum + m.effectivenessScore, 0) /
      recentMetrics.length;

    // Adjust high effectiveness threshold
    if (avgEffectiveness > this.config.highEffectivenessThreshold + 0.1) {
      // Performance is consistently high - slightly increase threshold
      this.config.highEffectivenessThreshold = Math.min(
        0.95,
        this.config.highEffectivenessThreshold + this.config.thresholdAdjustmentRate
      );
      console.log(`[RequestRouter] Increased high effectiveness threshold to ${this.config.highEffectivenessThreshold.toFixed(2)}`);
    } else if (avgEffectiveness < this.config.highEffectivenessThreshold - 0.1) {
      // Performance is low - slightly decrease threshold
      this.config.highEffectivenessThreshold = Math.max(
        0.7,
        this.config.highEffectivenessThreshold - this.config.thresholdAdjustmentRate
      );
      console.log(`[RequestRouter] Decreased high effectiveness threshold to ${this.config.highEffectivenessThreshold.toFixed(2)}`);
    }

    // Adjust medium effectiveness threshold similarly
    if (avgEffectiveness > this.config.mediumEffectivenessThreshold + 0.1) {
      this.config.mediumEffectivenessThreshold = Math.min(
        0.7,
        this.config.mediumEffectivenessThreshold + this.config.thresholdAdjustmentRate
      );
    } else if (avgEffectiveness < this.config.mediumEffectivenessThreshold - 0.1) {
      this.config.mediumEffectivenessThreshold = Math.max(
        0.4,
        this.config.mediumEffectivenessThreshold - this.config.thresholdAdjustmentRate
      );
    }
  }

  // ============================================================================
  // Private Methods - Alternatives Generation
  // ============================================================================

  /**
   * Generate alternative routing decisions (parallel execution)
   */
  private async generateAlternatives(
    request: AIRequest,
    primaryDecision: RoutingDecision
  ): Promise<RoutingDecision[]> {
    const alternativePromises: Promise<RoutingDecision | null>[] = [];

    // Alternative 1: Fallback (no skills)
    if (primaryDecision.strategy !== 'fallback') {
      alternativePromises.push(this.originalRouting(request));
    } else {
      alternativePromises.push(Promise.resolve(null));
    }

    // Alternative 2: Premium (Opus)
    if (primaryDecision.strategy !== 'premium') {
      alternativePromises.push(
        Promise.resolve(this.routeToPremium(request, 'Premium quality option'))
      );
    } else {
      alternativePromises.push(Promise.resolve(null));
    }

    // Alternative 3: Different skill combination if available
    if (primaryDecision.skills.length > 1) {
      const singleSkillDecision = {
        ...primaryDecision,
        skills: [primaryDecision.skills[0]],
        reasoning: 'Single skill alternative',
      };
      alternativePromises.push(Promise.resolve(singleSkillDecision));
    }

    // Execute all alternatives in parallel
    const results = await Promise.all(alternativePromises);

    // Filter out null results
    return results.filter((alt): alt is RoutingDecision => alt !== null);
  }

  // ============================================================================
  // Public Methods - Configuration
  // ============================================================================

  /**
   * Update routing configuration
   */
  updateConfig(config: Partial<typeof RequestRouter.prototype.config>): void {
    this.config = { ...this.config, ...config };
    console.log('[RequestRouter] Updated configuration:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof RequestRouter.prototype.config {
    return { ...this.config };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): {
    high: number;
    medium: number;
  } {
    return {
      high: this.config.highEffectivenessThreshold,
      medium: this.config.mediumEffectivenessThreshold,
    };
  }

  // ============================================================================
  // Performance Monitoring (AC#8: <100ms routing overhead)
  // ============================================================================

  /**
   * Log performance and check against budget
   */
  private logPerformance(operationName: string, startTime: number): void {
    const duration = performance.now() - startTime;
    const PERFORMANCE_BUDGET_MS = 100; // AC#8 requirement

    if (duration > PERFORMANCE_BUDGET_MS) {
      console.warn(
        `[RequestRouter] Performance budget exceeded for ${operationName}: ${duration.toFixed(2)}ms > ${PERFORMANCE_BUDGET_MS}ms`
      );
    } else {
      console.log(
        `[RequestRouter] ${operationName} completed in ${duration.toFixed(2)}ms (within ${PERFORMANCE_BUDGET_MS}ms budget)`
      );
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageDuration: number;
    p95Duration: number;
    cacheHitRate: number;
    slowestOperations: Array<{ operationName: string; duration: number }>;
  } {
    const stats = this.performanceOptimizer.getPerformanceStats();

    return {
      averageDuration: stats.averageDuration,
      p95Duration: stats.p95Duration,
      cacheHitRate: stats.cacheHitRate,
      slowestOperations: stats.slowestOperations.map(m => ({
        operationName: m.operationName,
        duration: m.duration,
      })),
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    metadata: any;
    patternMatch: any;
    effectiveness: any;
    request: any;
  } {
    return this.performanceOptimizer.getAllCacheStats();
  }
}
