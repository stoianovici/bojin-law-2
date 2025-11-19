/**
 * Skills Registry
 *
 * Service for skill discovery and recommendation including:
 * - Pattern-based skill discovery
 * - Relevance scoring algorithm
 * - Skill-to-task mapping
 * - Effectiveness metrics collection
 * - Recommendation engine
 * - Fallback logic for skill failures
 */

import { SkillsManager } from './SkillsManager';
import type { SkillMetadata, SkillType, SkillCategory, SkillFilters } from '../types/skills';

interface TaskPattern {
  keywords: string[];
  type: SkillType;
  category: SkillCategory;
  weight: number;
}

interface SkillRecommendation {
  skill: SkillMetadata;
  relevanceScore: number;
  reason: string;
}

interface SkillEffectivenessMetrics {
  skillId: string;
  totalExecutions: number;
  successfulExecutions: number;
  averageTokensSaved: number;
  averageExecutionTime: number;
  successRate: number;
}

export class SkillsRegistry {
  private readonly skillsManager: SkillsManager;
  private readonly taskPatterns: TaskPattern[];
  private readonly effectivenessMetrics: Map<string, SkillEffectivenessMetrics>;
  private allSkills: SkillMetadata[] = [];
  private lastRefresh: Date | null = null;
  private readonly refreshInterval: number; // in milliseconds

  constructor(
    skillsManager: SkillsManager,
    options?: {
      refreshInterval?: number; // in seconds
    }
  ) {
    this.skillsManager = skillsManager;
    this.taskPatterns = this.initializeTaskPatterns();
    this.effectivenessMetrics = new Map();
    this.refreshInterval = (options?.refreshInterval || 300) * 1000; // Default 5 minutes
  }

  // ============================================================================
  // Public Methods - Skill Discovery
  // ============================================================================

  /**
   * Discover skills relevant to a task description
   */
  async discoverSkills(taskDescription: string, limit = 5): Promise<SkillRecommendation[]> {
    // Refresh skills cache if needed
    await this.refreshSkillsCache();

    // Analyze task to determine patterns
    const detectedPatterns = this.detectTaskPatterns(taskDescription);

    // Score all skills based on relevance
    const scoredSkills = this.scoreSkills(taskDescription, detectedPatterns);

    // Sort by relevance score and return top N
    const recommendations = scoredSkills
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    console.log(`[SkillsRegistry] Discovered ${recommendations.length} skills for task`);

    return recommendations;
  }

  /**
   * Get best skill for a specific category and type
   */
  async getBestSkill(category: SkillCategory, type?: SkillType): Promise<SkillMetadata | null> {
    await this.refreshSkillsCache();

    const filters: SkillFilters = {
      category,
      type,
      min_effectiveness_score: 0.5, // Only consider moderately effective skills
    };

    const filtered = this.filterSkills(filters);

    if (filtered.length === 0) {
      return null;
    }

    // Sort by effectiveness score and usage count
    const best = filtered.sort((a, b) => {
      const scoreA = a.effectiveness_score * 0.7 + (a.usage_count / 1000) * 0.3;
      const scoreB = b.effectiveness_score * 0.7 + (b.usage_count / 1000) * 0.3;
      return scoreB - scoreA;
    })[0];

    return best;
  }

  /**
   * Recommend skills based on task context
   */
  async recommendSkills(
    taskContext: {
      description: string;
      category?: SkillCategory;
      type?: SkillType;
      previousSkills?: string[]; // Skills used in similar tasks
    },
    limit = 3
  ): Promise<SkillRecommendation[]> {
    const recommendations = await this.discoverSkills(taskContext.description, limit * 2);

    // Filter by category/type if specified
    let filtered = recommendations;
    if (taskContext.category) {
      filtered = filtered.filter((r) => r.skill.category === taskContext.category);
    }
    if (taskContext.type) {
      filtered = filtered.filter((r) => r.skill.type === taskContext.type);
    }

    // Boost skills that were previously successful
    if (taskContext.previousSkills && taskContext.previousSkills.length > 0) {
      filtered.forEach((rec) => {
        if (taskContext.previousSkills!.includes(rec.skill.skill_id)) {
          rec.relevanceScore *= 1.2; // 20% boost for previous success
          rec.reason += ' (Previously successful)';
        }
      });
    }

    // Re-sort and limit
    return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }

  // ============================================================================
  // Public Methods - Effectiveness Tracking
  // ============================================================================

  /**
   * Record skill execution metrics
   */
  recordSkillExecution(
    skillId: string,
    success: boolean,
    tokensSaved: number,
    executionTime: number
  ): void {
    let metrics = this.effectivenessMetrics.get(skillId);

    if (!metrics) {
      metrics = {
        skillId,
        totalExecutions: 0,
        successfulExecutions: 0,
        averageTokensSaved: 0,
        averageExecutionTime: 0,
        successRate: 0,
      };
      this.effectivenessMetrics.set(skillId, metrics);
    }

    // Update metrics
    metrics.totalExecutions++;
    if (success) {
      metrics.successfulExecutions++;
    }

    // Update running averages
    metrics.averageTokensSaved =
      (metrics.averageTokensSaved * (metrics.totalExecutions - 1) + tokensSaved) /
      metrics.totalExecutions;

    metrics.averageExecutionTime =
      (metrics.averageExecutionTime * (metrics.totalExecutions - 1) + executionTime) /
      metrics.totalExecutions;

    metrics.successRate = metrics.successfulExecutions / metrics.totalExecutions;

    console.log(`[SkillsRegistry] Recorded execution for ${skillId}:`, metrics);
  }

  /**
   * Get effectiveness metrics for a skill
   */
  getSkillMetrics(skillId: string): SkillEffectivenessMetrics | null {
    return this.effectivenessMetrics.get(skillId) || null;
  }

  /**
   * Get all effectiveness metrics
   */
  getAllMetrics(): SkillEffectivenessMetrics[] {
    return Array.from(this.effectivenessMetrics.values());
  }

  // ============================================================================
  // Public Methods - Fallback Logic
  // ============================================================================

  /**
   * Get fallback skills when primary skill fails
   */
  async getFallbackSkills(
    failedSkillId: string,
    taskDescription: string
  ): Promise<SkillRecommendation[]> {
    // Get the failed skill to understand what we're looking for
    const failedSkill = this.allSkills.find((s) => s.skill_id === failedSkillId);

    if (!failedSkill) {
      return this.discoverSkills(taskDescription, 3);
    }

    // Find alternative skills in same category
    const alternatives = this.allSkills
      .filter(
        (s) =>
          s.skill_id !== failedSkillId &&
          s.category === failedSkill.category &&
          s.effectiveness_score >= 0.4 // Lower threshold for fallbacks
      )
      .map((skill) => ({
        skill,
        relevanceScore: skill.effectiveness_score,
        reason: `Fallback for ${failedSkill.display_name}`,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    console.log(`[SkillsRegistry] Found ${alternatives.length} fallback skills`);

    return alternatives;
  }

  /**
   * Determine if task should fallback to non-skills routing
   */
  shouldFallbackToNonSkills(skillId: string): boolean {
    const metrics = this.effectivenessMetrics.get(skillId);

    if (!metrics) {
      return false; // Not enough data
    }

    // Fallback if success rate is very low
    if (metrics.totalExecutions >= 10 && metrics.successRate < 0.3) {
      console.warn(
        `[SkillsRegistry] Skill ${skillId} has low success rate: ${metrics.successRate}`
      );
      return true;
    }

    return false;
  }

  // ============================================================================
  // Private Methods - Pattern Detection
  // ============================================================================

  /**
   * Initialize task patterns for skill matching
   */
  private initializeTaskPatterns(): TaskPattern[] {
    return [
      {
        keywords: ['analyze', 'review', 'assess', 'evaluate', 'examine'],
        type: 'analysis',
        category: 'legal-analysis',
        weight: 1.0,
      },
      {
        keywords: ['extract', 'parse', 'find', 'locate', 'identify'],
        type: 'extraction',
        category: 'document-processing',
        weight: 1.0,
      },
      {
        keywords: ['generate', 'create', 'draft', 'write', 'compose'],
        type: 'generation',
        category: 'drafting',
        weight: 1.0,
      },
      {
        keywords: ['transform', 'convert', 'reformat', 'restructure'],
        type: 'transformation',
        category: 'document-processing',
        weight: 0.9,
      },
      {
        keywords: ['verify', 'check', 'validate', 'confirm', 'ensure'],
        type: 'validation',
        category: 'compliance',
        weight: 0.9,
      },
      {
        keywords: ['compliance', 'regulation', 'standard', 'requirement'],
        type: 'validation',
        category: 'compliance',
        weight: 0.8,
      },
      {
        keywords: ['research', 'investigate', 'search', 'discover'],
        type: 'analysis',
        category: 'research',
        weight: 0.8,
      },
      {
        keywords: ['contract', 'agreement', 'terms', 'clause'],
        type: 'analysis',
        category: 'legal-analysis',
        weight: 0.7,
      },
    ];
  }

  /**
   * Detect task patterns from description
   */
  private detectTaskPatterns(taskDescription: string): TaskPattern[] {
    const lowerDescription = taskDescription.toLowerCase();
    const detected: TaskPattern[] = [];

    for (const pattern of this.taskPatterns) {
      for (const keyword of pattern.keywords) {
        if (lowerDescription.includes(keyword)) {
          detected.push(pattern);
          break; // Only add pattern once even if multiple keywords match
        }
      }
    }

    return detected;
  }

  /**
   * Score skills based on relevance to task
   */
  private scoreSkills(
    taskDescription: string,
    detectedPatterns: TaskPattern[]
  ): SkillRecommendation[] {
    return this.allSkills.map((skill) => {
      let score = 0;
      let reasons: string[] = [];

      // Base score from effectiveness
      score += skill.effectiveness_score * 0.4;

      // Score from pattern matching
      for (const pattern of detectedPatterns) {
        if (pattern.category === skill.category) {
          score += pattern.weight * 0.3;
          reasons.push(`Matches ${pattern.category} category`);
        }
        if (pattern.type === skill.type) {
          score += pattern.weight * 0.2;
          reasons.push(`Matches ${pattern.type} type`);
        }
      }

      // Boost popular skills slightly
      const usageBoost = Math.min(skill.usage_count / 1000, 0.1);
      score += usageBoost;

      // Check for keyword match in skill description
      const descriptionMatch = this.matchKeywords(taskDescription, skill.description);
      score += descriptionMatch * 0.1;
      if (descriptionMatch > 0) {
        reasons.push('Description keyword match');
      }

      return {
        skill,
        relevanceScore: Math.min(score, 1.0), // Cap at 1.0
        reason: reasons.join('; ') || 'General match',
      };
    });
  }

  /**
   * Match keywords between task and skill description
   */
  private matchKeywords(taskDescription: string, skillDescription: string): number {
    const taskWords = taskDescription.toLowerCase().split(/\s+/);
    const skillWords = new Set(skillDescription.toLowerCase().split(/\s+/));

    const matches = taskWords.filter((word) => word.length > 3 && skillWords.has(word));

    return Math.min(matches.length / 10, 1.0); // Normalize to 0-1
  }

  // ============================================================================
  // Private Methods - Cache Management
  // ============================================================================

  /**
   * Refresh skills cache if needed
   */
  private async refreshSkillsCache(): Promise<void> {
    const now = new Date();

    if (!this.lastRefresh || now.getTime() - this.lastRefresh.getTime() > this.refreshInterval) {
      console.log('[SkillsRegistry] Refreshing skills cache...');

      const response = await this.skillsManager.listSkills({
        limit: 1000, // Get all skills
      });

      this.allSkills = response.items;
      this.lastRefresh = now;

      console.log(`[SkillsRegistry] Loaded ${this.allSkills.length} skills`);
    }
  }

  /**
   * Filter skills based on criteria
   */
  private filterSkills(filters: SkillFilters): SkillMetadata[] {
    return this.allSkills.filter((skill) => {
      if (filters.type && skill.type !== filters.type) {
        return false;
      }
      if (filters.category && skill.category !== filters.category) {
        return false;
      }
      if (
        filters.min_effectiveness_score !== undefined &&
        skill.effectiveness_score < filters.min_effectiveness_score
      ) {
        return false;
      }
      if (filters.search_query) {
        const query = filters.search_query.toLowerCase();
        const matchesName = skill.display_name.toLowerCase().includes(query);
        const matchesDesc = skill.description.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Force refresh of skills cache
   */
  async forceRefresh(): Promise<void> {
    this.lastRefresh = null;
    await this.refreshSkillsCache();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    skillCount: number;
    lastRefresh: Date | null;
    metricsCount: number;
  } {
    return {
      skillCount: this.allSkills.length,
      lastRefresh: this.lastRefresh,
      metricsCount: this.effectivenessMetrics.size,
    };
  }
}
