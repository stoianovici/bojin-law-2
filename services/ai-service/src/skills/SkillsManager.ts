/**
 * Skills Manager Service
 *
 * High-level service for managing Claude Skills including:
 * - Skill validation before upload
 * - Version management
 * - Caching layer for frequently used skills
 * - Skill packaging/zip functionality
 * - Template generation
 * - Effectiveness tracking
 */

import { SkillsAPIClient } from './SkillsAPIClient';
import type {
  Skill,
  SkillMetadata,
  UploadSkillPayload,
  SkillFilters,
  SkillUpdatePayload,
  SkillValidationError,
  SkillConfig,
  SkillType,
  SkillCategory,
} from '../types/skills';

interface SkillTemplate {
  name: string;
  type: SkillType;
  category: SkillCategory;
  contentTemplate: string;
  configDefaults: SkillConfig;
}

interface CachedSkill {
  skill: Skill;
  cachedAt: Date;
  accessCount: number;
}

export class SkillsManager {
  private readonly apiClient: SkillsAPIClient;
  private readonly skillCache: Map<string, CachedSkill>;
  private readonly cacheTTL: number;
  private readonly maxCacheSize: number;

  constructor(
    apiClient: SkillsAPIClient,
    options?: {
      cacheTTL?: number; // in seconds
      maxCacheSize?: number;
    }
  ) {
    this.apiClient = apiClient;
    this.skillCache = new Map();
    this.cacheTTL = (options?.cacheTTL || 3600) * 1000; // Convert to milliseconds
    this.maxCacheSize = options?.maxCacheSize || 100;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Upload a skill with validation
   */
  async uploadSkill(payload: UploadSkillPayload): Promise<SkillMetadata> {
    // Validate before upload
    this.validateSkill(payload);

    // Package if needed (currently just passes through, but could zip files)
    const packagedPayload = await this.packageSkill(payload);

    // Upload via API client
    const skillMetadata = await this.apiClient.uploadSkill(packagedPayload);

    // Track initial effectiveness score
    console.log(`[SkillsManager] Skill uploaded: ${skillMetadata.skill_id}`);

    return skillMetadata;
  }

  /**
   * Get skill with caching
   */
  async getSkill(skillId: string, useCache = true): Promise<Skill> {
    if (useCache) {
      const cached = this.getCachedSkill(skillId);
      if (cached) {
        console.log(`[SkillsManager] Cache hit for skill: ${skillId}`);
        return cached;
      }
    }

    const skill = await this.apiClient.getSkill(skillId);

    if (useCache) {
      this.cacheSkill(skillId, skill);
    }

    return skill;
  }

  /**
   * List skills with filters
   */
  async listSkills(filters?: SkillFilters) {
    return this.apiClient.listSkills(filters);
  }

  /**
   * Update skill and invalidate cache
   */
  async updateSkill(skillId: string, updates: SkillUpdatePayload): Promise<Skill> {
    // Validate updates if content is provided
    if (updates.content) {
      this.validateSkillContent(updates.content);
    }

    const updatedSkill = await this.apiClient.updateSkill(skillId, updates);

    // Invalidate cache
    this.invalidateCache(skillId);

    console.log(`[SkillsManager] Skill updated and cache invalidated: ${skillId}`);

    return updatedSkill;
  }

  /**
   * Delete skill and cleanup
   */
  async deleteSkill(skillId: string): Promise<void> {
    await this.apiClient.deleteSkill(skillId);

    // Remove from cache
    this.invalidateCache(skillId);

    console.log(`[SkillsManager] Skill deleted: ${skillId}`);
  }

  /**
   * Generate new skill from template
   */
  generateSkillFromTemplate(
    template: string,
    variables: Record<string, string>
  ): UploadSkillPayload {
    const templates = this.getSkillTemplates();
    const skillTemplate = templates.find((t) => t.name === template);

    if (!skillTemplate) {
      throw new Error(`Template not found: ${template}`);
    }

    // Replace variables in template
    let content = skillTemplate.contentTemplate;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return {
      display_name: variables.display_name || `${template} Skill`,
      description: variables.description || `Generated from ${template} template`,
      type: skillTemplate.type,
      category: skillTemplate.category,
      content,
      config: skillTemplate.configDefaults,
    };
  }

  /**
   * Track skill effectiveness after execution
   */
  async trackSkillEffectiveness(
    skillId: string,
    tokensSaved: number,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    console.log(`[SkillsManager] Tracking effectiveness for ${skillId}:`, {
      tokensSaved,
      executionTime,
      success,
    });

    // In a full implementation, this would update the database
    // For now, just log the metrics
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ skillId: string; accessCount: number }>;
  } {
    const entries = Array.from(this.skillCache.entries()).map(([skillId, cached]) => ({
      skillId,
      accessCount: cached.accessCount,
    }));

    return {
      size: this.skillCache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // Would calculate from hit/miss counters in full implementation
      entries,
    };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.skillCache.clear();
    console.log('[SkillsManager] Cache cleared');
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validate skill payload before upload
   */
  private validateSkill(payload: UploadSkillPayload): void {
    const errors: string[] = [];

    // Validate required fields
    if (!payload.display_name || payload.display_name.trim().length === 0) {
      errors.push('Display name is required');
    }

    if (!payload.description || payload.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!payload.content || payload.content.trim().length === 0) {
      errors.push('Content is required');
    }

    // Validate content length
    if (payload.content && payload.content.length > 1_000_000) {
      errors.push('Content exceeds maximum size of 1MB');
    }

    // Validate type and category
    if (!payload.type) {
      errors.push('Skill type is required');
    }

    if (!payload.category) {
      errors.push('Skill category is required');
    }

    // Validate version format if provided
    if (payload.version && !/^\d+\.\d+\.\d+$/.test(payload.version)) {
      errors.push('Version must follow semver format (e.g., 1.0.0)');
    }

    // Validate config if provided
    if (payload.config) {
      this.validateSkillConfig(payload.config, errors);
    }

    // Additional content validation
    this.validateSkillContent(payload.content, errors);

    if (errors.length > 0) {
      throw {
        name: 'SkillValidationError',
        message: 'Skill validation failed',
        validationErrors: errors,
      } as SkillValidationError;
    }
  }

  /**
   * Validate skill content
   */
  private validateSkillContent(content: string, errors: string[] = []): void {
    // Check for potentially harmful content
    const dangerousPatterns = [/eval\(/gi, /exec\(/gi, /system\(/gi, /rm\s+-rf/gi];

    dangerousPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        errors.push(`Content contains potentially dangerous pattern: ${pattern}`);
      }
    });

    if (errors.length > 0) {
      throw {
        name: 'SkillValidationError',
        message: 'Content validation failed',
        validationErrors: errors,
      } as SkillValidationError;
    }
  }

  /**
   * Validate skill configuration
   */
  private validateSkillConfig(config: SkillConfig, errors: string[]): void {
    if (config.max_tokens !== undefined) {
      if (config.max_tokens < 1 || config.max_tokens > 200000) {
        errors.push('max_tokens must be between 1 and 200000');
      }
    }

    if (config.temperature !== undefined) {
      if (config.temperature < 0 || config.temperature > 1) {
        errors.push('temperature must be between 0 and 1');
      }
    }
  }

  // ============================================================================
  // Packaging Methods
  // ============================================================================

  /**
   * Package skill for upload (currently a pass-through, but could zip files)
   */
  private async packageSkill(payload: UploadSkillPayload): Promise<UploadSkillPayload> {
    // In a full implementation, this might:
    // - Compress content
    // - Bundle multiple files
    // - Add metadata
    // For now, just return as-is
    return payload;
  }

  // ============================================================================
  // Caching Methods
  // ============================================================================

  /**
   * Get skill from cache if valid
   */
  private getCachedSkill(skillId: string): Skill | null {
    const cached = this.skillCache.get(skillId);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const age = Date.now() - cached.cachedAt.getTime();
    if (age > this.cacheTTL) {
      this.skillCache.delete(skillId);
      return null;
    }

    // Increment access count
    cached.accessCount++;

    return cached.skill;
  }

  /**
   * Cache a skill
   */
  private cacheSkill(skillId: string, skill: Skill): void {
    // Enforce max cache size using LRU strategy
    if (this.skillCache.size >= this.maxCacheSize) {
      const leastUsed = this.findLeastUsedCacheEntry();
      if (leastUsed) {
        this.skillCache.delete(leastUsed);
      }
    }

    this.skillCache.set(skillId, {
      skill,
      cachedAt: new Date(),
      accessCount: 1,
    });
  }

  /**
   * Find least recently used cache entry
   */
  private findLeastUsedCacheEntry(): string | null {
    let leastUsed: string | null = null;
    let minAccessCount = Infinity;

    this.skillCache.forEach((cached, skillId) => {
      if (cached.accessCount < minAccessCount) {
        minAccessCount = cached.accessCount;
        leastUsed = skillId;
      }
    });

    return leastUsed;
  }

  /**
   * Invalidate cache entry
   */
  private invalidateCache(skillId: string): void {
    this.skillCache.delete(skillId);
  }

  // ============================================================================
  // Template Methods
  // ============================================================================

  /**
   * Get available skill templates
   */
  private getSkillTemplates(): SkillTemplate[] {
    return [
      {
        name: 'legal-analysis',
        type: 'analysis',
        category: 'legal-analysis',
        contentTemplate: `# Legal Analysis Skill

Analyze {{document_type}} for:
- {{analysis_focus}}
- Key legal issues
- Risk factors
- Recommendations

Output format: {{output_format}}`,
        configDefaults: {
          max_tokens: 4096,
          temperature: 0.3,
          thinking_mode: 'enabled',
        },
      },
      {
        name: 'document-extraction',
        type: 'extraction',
        category: 'document-processing',
        contentTemplate: `# Document Extraction Skill

Extract {{data_type}} from {{document_type}}:
- {{field_1}}
- {{field_2}}
- {{field_3}}

Return as structured JSON.`,
        configDefaults: {
          max_tokens: 2048,
          temperature: 0.1,
          thinking_mode: 'disabled',
        },
      },
      {
        name: 'compliance-check',
        type: 'validation',
        category: 'compliance',
        contentTemplate: `# Compliance Check Skill

Verify compliance with:
- {{regulation_1}}
- {{regulation_2}}

Check for:
{{compliance_criteria}}`,
        configDefaults: {
          max_tokens: 3072,
          temperature: 0.2,
          thinking_mode: 'enabled',
        },
      },
    ];
  }
}
