/**
 * Skill Selector Service
 *
 * Intelligent skill selection for routing optimization including:
 * - Pattern matching for task→skill mapping
 * - Confidence scoring and thresholds
 * - Skill combination logic
 * - Context analysis for improved selection
 * - Integration with SkillsRegistry
 */

import { SkillsRegistry } from '../skills/SkillsRegistry';
import type { SkillMetadata } from '../types/skills';
import { PerformanceOptimizer } from './PerformanceOptimizer';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AIRequest {
  task: string;
  context?: {
    previousSkills?: string[];
    userPreferences?: string[];
    documentType?: string;
    complexity?: 'low' | 'medium' | 'high';
  };
  constraints?: {
    maxSkills?: number;
    minConfidence?: number;
    requiresDeterministic?: boolean;
  };
}

export interface SkillSelection {
  skills: SkillMetadata[];
  confidence: number;
  strategy: 'single' | 'combined' | 'fallback' | 'none';
  reasoning: string;
  alternatives?: SkillMetadata[];
}

interface TaskClassification {
  category: string;
  complexity: 'low' | 'medium' | 'high';
  keywords: string[];
  requiresMultipleSkills: boolean;
}

// ============================================================================
// SkillSelector Class
// ============================================================================

export class SkillSelector {
  private readonly skillsRegistry: SkillsRegistry;
  private readonly taskPatterns: Map<RegExp, string[]>;
  private readonly performanceOptimizer: PerformanceOptimizer;

  // Configuration
  private readonly config = {
    minConfidenceThreshold: 0.5,
    highConfidenceThreshold: 0.8,
    maxSkillsPerRequest: 3,
    combinationBonus: 0.15,
  };

  constructor(
    skillsRegistry: SkillsRegistry,
    config?: Partial<typeof SkillSelector.prototype.config>,
    performanceOptimizer?: PerformanceOptimizer
  ) {
    this.skillsRegistry = skillsRegistry;
    this.taskPatterns = this.initializeTaskPatterns();
    this.performanceOptimizer = performanceOptimizer || new PerformanceOptimizer();

    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // ============================================================================
  // Public Methods - Skill Selection
  // ============================================================================

  /**
   * Select optimal skills for a given AI request
   */
  async select(request: AIRequest): Promise<SkillSelection> {
    console.log('[SkillSelector] Selecting skills for task:', request.task);

    // Step 1: Classify the task
    const classification = this.classifyTask(request.task);

    // Step 2: Get skill recommendations from registry
    const recommendations = await this.skillsRegistry.recommendSkills(
      {
        description: request.task,
        previousSkills: request.context?.previousSkills,
      },
      request.constraints?.maxSkills || this.config.maxSkillsPerRequest
    );

    if (recommendations.length === 0) {
      return {
        skills: [],
        confidence: 0,
        strategy: 'none',
        reasoning: 'No relevant skills found for this task',
      };
    }

    // Step 3: Apply pattern matching boost
    const enhancedRecommendations = this.applyPatternBoost(request.task, recommendations);

    // Step 4: Determine if skill combination is beneficial
    const shouldCombine = this.shouldCombineSkills(
      classification,
      enhancedRecommendations,
      request.context?.complexity || classification.complexity
    );

    // Step 5: Select skills based on strategy
    let selectedSkills: SkillMetadata[];
    let strategy: SkillSelection['strategy'];
    let confidence: number;

    if (shouldCombine && enhancedRecommendations.length > 1) {
      // Combined strategy
      selectedSkills = enhancedRecommendations
        .slice(0, Math.min(2, this.config.maxSkillsPerRequest))
        .map((r) => r.skill);
      confidence = this.calculateCombinedConfidence(enhancedRecommendations.slice(0, 2));
      strategy = 'combined';
    } else if (enhancedRecommendations[0].relevanceScore >= this.config.highConfidenceThreshold) {
      // Single high-confidence skill
      selectedSkills = [enhancedRecommendations[0].skill];
      confidence = enhancedRecommendations[0].relevanceScore;
      strategy = 'single';
    } else if (enhancedRecommendations[0].relevanceScore >= this.config.minConfidenceThreshold) {
      // Single medium-confidence skill (fallback)
      selectedSkills = [enhancedRecommendations[0].skill];
      confidence = enhancedRecommendations[0].relevanceScore;
      strategy = 'fallback';
    } else {
      // Below threshold - no skills
      return {
        skills: [],
        confidence: enhancedRecommendations[0].relevanceScore,
        strategy: 'none',
        reasoning: `Confidence too low: ${enhancedRecommendations[0].relevanceScore.toFixed(2)} < ${this.config.minConfidenceThreshold}`,
        alternatives: enhancedRecommendations.map((r) => r.skill),
      };
    }

    // Step 6: Apply context-based adjustments
    if (request.context) {
      confidence = this.applyContextAdjustments(confidence, request.context, selectedSkills);
    }

    // Step 7: Check constraint overrides
    const minConfidence = request.constraints?.minConfidence || this.config.minConfidenceThreshold;
    if (confidence < minConfidence) {
      return {
        skills: [],
        confidence,
        strategy: 'none',
        reasoning: `Confidence ${confidence.toFixed(2)} below required threshold ${minConfidence}`,
        alternatives: selectedSkills,
      };
    }

    const reasoning = this.generateReasoning(selectedSkills, strategy, classification, confidence);

    console.log(
      `[SkillSelector] Selected ${selectedSkills.length} skills with confidence ${confidence.toFixed(2)} (${strategy})`
    );

    return {
      skills: selectedSkills,
      confidence: Math.min(confidence, 1.0),
      strategy,
      reasoning,
      alternatives: enhancedRecommendations.slice(selectedSkills.length).map((r) => r.skill),
    };
  }

  /**
   * Get effectiveness score for a set of skills (with caching and parallel execution)
   */
  async getEffectiveness(skillIds: string[]): Promise<number> {
    if (skillIds.length === 0) {
      return 0;
    }

    // Check cache first
    const cached = this.performanceOptimizer.getEffectiveness(skillIds);
    if (cached !== null) {
      return cached;
    }

    // Execute metric lookups in parallel for better performance
    const metricsPromises = skillIds.map(async (skillId) => {
      const metrics = this.skillsRegistry.getSkillMetrics(skillId);
      if (metrics) {
        // Calculate effectiveness score based on metrics
        return (
          metrics.successRate * 0.5 +
          Math.min(metrics.averageTokensSaved / 0.7, 1.0) * 0.3 +
          Math.max(0, 1 - metrics.averageExecutionTime / 5000) * 0.2
        );
      } else {
        // No metrics yet - use default moderate score
        return 0.6;
      }
    });

    const scores = await Promise.all(metricsPromises);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Cache the result
    this.performanceOptimizer.setEffectiveness(skillIds, averageScore);

    return averageScore;
  }

  // ============================================================================
  // Private Methods - Pattern Matching
  // ============================================================================

  /**
   * Initialize regex patterns for skill matching
   */
  private initializeTaskPatterns(): Map<RegExp, string[]> {
    return new Map<RegExp, string[]>([
      [/contract.*review|analyze.*agreement/i, ['contract-analysis']],
      [/draft.*document|create.*agreement/i, ['document-drafting']],
      [/legal.*research|find.*precedent/i, ['legal-research']],
      [/compliance.*check|regulatory.*review/i, ['compliance-check']],
      [/extract.*clauses|identify.*risks/i, ['contract-analysis']],
      [/generate.*nda|create.*contract/i, ['document-drafting']],
      [/search.*case.*law|analyze.*precedent/i, ['legal-research']],
      [/gdpr|ccpa|hipaa.*compliance/i, ['compliance-check']],
    ]);
  }

  /**
   * Apply pattern matching boost to recommendations
   */
  private applyPatternBoost(
    task: string,
    recommendations: Array<{ skill: SkillMetadata; relevanceScore: number; reason: string }>
  ): Array<{ skill: SkillMetadata; relevanceScore: number; reason: string }> {
    const boosted = recommendations.map((rec) => ({ ...rec }));

    for (const [pattern, skillNames] of this.taskPatterns.entries()) {
      if (pattern.test(task)) {
        boosted.forEach((rec) => {
          if (skillNames.some((name) => rec.skill.skill_id.includes(name))) {
            rec.relevanceScore *= 1.2; // 20% boost for pattern match
            rec.reason += ' [Pattern matched]';
          }
        });
      }
    }

    return boosted.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // ============================================================================
  // Private Methods - Task Analysis
  // ============================================================================

  /**
   * Classify task complexity and type
   */
  private classifyTask(task: string): TaskClassification {
    const lowerTask = task.toLowerCase();
    const keywords = task
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Detect complexity
    let complexity: 'low' | 'medium' | 'high' = 'medium';

    if (
      lowerTask.includes('simple') ||
      lowerTask.includes('basic') ||
      lowerTask.includes('quick')
    ) {
      complexity = 'low';
    } else if (
      lowerTask.includes('complex') ||
      lowerTask.includes('detailed') ||
      lowerTask.includes('comprehensive') ||
      lowerTask.includes('thorough')
    ) {
      complexity = 'high';
    }

    // Detect if multiple skills might be needed
    const requiresMultipleSkills =
      lowerTask.includes(' and ') ||
      lowerTask.includes('then') ||
      lowerTask.includes('after') ||
      keywords.length > 10;

    // Determine category
    let category = 'general';
    if (lowerTask.match(/contract|agreement|clause/)) {
      category = 'legal-analysis';
    } else if (lowerTask.match(/draft|create|generate/)) {
      category = 'drafting';
    } else if (lowerTask.match(/research|find|search/)) {
      category = 'research';
    } else if (lowerTask.match(/compliance|regulatory|gdpr/)) {
      category = 'compliance';
    }

    return {
      category,
      complexity,
      keywords,
      requiresMultipleSkills,
    };
  }

  /**
   * Determine if combining skills would be beneficial
   */
  private shouldCombineSkills(
    classification: TaskClassification,
    recommendations: Array<{ skill: SkillMetadata; relevanceScore: number }>,
    complexity: 'low' | 'medium' | 'high'
  ): boolean {
    // Don't combine for low complexity tasks
    if (complexity === 'low') {
      return false;
    }

    // Don't combine if we don't have at least 2 good skills
    if (recommendations.length < 2 || recommendations[1].relevanceScore < 0.6) {
      return false;
    }

    // Combine if task explicitly requires multiple skills
    if (classification.requiresMultipleSkills) {
      return true;
    }

    // Combine if top 2 skills are complementary (different types)
    if (recommendations[0].skill.type !== recommendations[1].skill.type) {
      return true;
    }

    return false;
  }

  /**
   * Calculate confidence for combined skills
   */
  private calculateCombinedConfidence(
    recommendations: Array<{ skill: SkillMetadata; relevanceScore: number }>
  ): number {
    // Weighted average with combination bonus
    const weights = [0.6, 0.4];
    let score = 0;

    recommendations.forEach((rec, idx) => {
      score += rec.relevanceScore * weights[idx];
    });

    // Add bonus for successful combination
    score += this.config.combinationBonus;

    return Math.min(score, 1.0);
  }

  // ============================================================================
  // Private Methods - Context Analysis
  // ============================================================================

  /**
   * Apply context-based confidence adjustments
   */
  private applyContextAdjustments(
    baseConfidence: number,
    context: NonNullable<AIRequest['context']>,
    selectedSkills: SkillMetadata[]
  ): number {
    let adjusted = baseConfidence;

    // Boost if previously successful skills
    if (context.previousSkills && context.previousSkills.length > 0) {
      const hasPreviousSuccess = selectedSkills.some((skill) =>
        context.previousSkills!.includes(skill.skill_id)
      );
      if (hasPreviousSuccess) {
        adjusted *= 1.1; // 10% boost
      }
    }

    // Adjust based on complexity
    if (context.complexity === 'high' && selectedSkills.length === 1) {
      adjusted *= 0.9; // Slight penalty for single skill on complex task
    }

    // Boost if user has preferences
    if (context.userPreferences && context.userPreferences.length > 0) {
      const matchesPreference = selectedSkills.some((skill) =>
        context.userPreferences!.includes(skill.category)
      );
      if (matchesPreference) {
        adjusted *= 1.05; // 5% boost
      }
    }

    return Math.min(adjusted, 1.0);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    skills: SkillMetadata[],
    strategy: SkillSelection['strategy'],
    classification: TaskClassification,
    confidence: number
  ): string {
    const skillNames = skills.map((s) => s.display_name).join(' + ');

    const strategyText = {
      single: 'High confidence single skill',
      combined: 'Complementary skills combination',
      fallback: 'Moderate confidence single skill',
      none: 'No suitable skills',
    }[strategy];

    return `${strategyText}: ${skillNames} (${(confidence * 100).toFixed(0)}% confidence, ${classification.complexity} complexity)`;
  }

  // ============================================================================
  // Public Methods - Configuration
  // ============================================================================

  /**
   * Update confidence thresholds
   */
  updateThresholds(thresholds: { minConfidence?: number; highConfidence?: number }): void {
    if (thresholds.minConfidence !== undefined) {
      this.config.minConfidenceThreshold = thresholds.minConfidence;
    }
    if (thresholds.highConfidence !== undefined) {
      this.config.highConfidenceThreshold = thresholds.highConfidence;
    }
    console.log('[SkillSelector] Updated thresholds:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof SkillSelector.prototype.config {
    return { ...this.config };
  }
}
