/**
 * AI Feature Config Service
 * OPS-234: Feature Configuration Data Model & Service
 *
 * Manages AI feature toggles, budget controls, and batch job schedules per firm.
 * Uses Redis caching for fast `isFeatureEnabled` checks.
 */

import { prisma, cacheManager } from '@legal-platform/database';
import type { AIFeatureConfig, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Constants
// ============================================================================

const CACHE_PREFIX = 'ai-feature-config';
const CACHE_TTL = 300; // 5 minutes

/**
 * AI Feature definitions with metadata
 * type: 'request' = triggered by user actions (logged but not scheduled)
 * type: 'batch' = scheduled nightly jobs
 */
export const AI_FEATURES = {
  // Request-time features (triggered by user actions)
  assistant_chat: {
    name: 'AI Assistant Chat',
    type: 'request' as const,
    description: 'Conversational AI assistant for case queries and drafting',
  },
  email_classification: {
    name: 'Email Classification',
    type: 'request' as const,
    description: 'Automatic email routing to cases based on content',
  },
  email_drafting: {
    name: 'Email Drafting',
    type: 'request' as const,
    description: 'AI-assisted email composition',
  },
  document_drafting: {
    name: 'Document Drafting',
    type: 'request' as const,
    description: 'AI-powered legal document generation',
  },
  document_extraction: {
    name: 'Document Extraction',
    type: 'request' as const,
    description: 'Extract key information from documents',
  },
  word_draft: {
    name: 'Word Draft',
    type: 'request' as const,
    description: 'AI-powered document drafting in Word add-in',
  },

  // Batch processors (scheduled nightly jobs)
  search_index: {
    name: 'Search Index Generator',
    type: 'batch' as const,
    description: 'Generate fuzzy search indexes for documents',
    defaultSchedule: '0 3 * * *', // 3 AM daily
  },
  morning_briefings: {
    name: 'Morning Briefings',
    type: 'batch' as const,
    description: 'Pre-compute daily briefings for all users',
    defaultSchedule: '0 5 * * *', // 5 AM daily
  },
  case_health: {
    name: 'Case Health Scoring',
    type: 'batch' as const,
    description: 'Calculate health scores for active cases',
    defaultSchedule: '0 3 * * *', // 3 AM daily
  },
  thread_summaries: {
    name: 'Thread Summaries',
    type: 'batch' as const,
    description: 'Generate email thread summaries',
    defaultSchedule: '0 4 * * *', // 4 AM daily
  },
  case_context: {
    name: 'Case Context Pre-compilation',
    type: 'batch' as const,
    description: 'Pre-compile comprehensive case context for AI assistant',
    defaultSchedule: '0 4 * * *', // 4 AM daily, before morning briefings
  },
} as const;

export type AIFeatureKey = keyof typeof AI_FEATURES;

// ============================================================================
// Types
// ============================================================================

export interface AIFeatureConfigResult {
  id: string;
  firmId: string;
  feature: AIFeatureKey;
  enabled: boolean;
  monthlyBudgetEur: number | null;
  dailyLimitEur: number | null;
  schedule: string | null;
  model: string | null;
  updatedAt: Date;
  updatedBy: string;
}

export interface AIFeatureBudgetStatus {
  feature: AIFeatureKey;
  enabled: boolean;
  monthlyBudgetEur: number | null;
  dailyLimitEur: number | null;
  spentThisMonthEur: number;
  spentTodayEur: number;
  remainingMonthlyEur: number | null;
  remainingDailyEur: number | null;
  isOverMonthlyBudget: boolean;
  isOverDailyLimit: boolean;
}

export interface AIFeatureUpdateInput {
  enabled?: boolean;
  monthlyBudgetEur?: number | null;
  dailyLimitEur?: number | null;
  schedule?: string | null;
  model?: string | null;
}

// ============================================================================
// Service
// ============================================================================

export class AIFeatureConfigService {
  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Check if a feature is enabled for a firm
   * Uses Redis cache for fast lookups
   */
  async isFeatureEnabled(firmId: string, feature: AIFeatureKey): Promise<boolean> {
    // Check cache first
    const cacheKey = `${CACHE_PREFIX}:${firmId}:${feature}:enabled`;
    const cached = await cacheManager.get<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Get from DB (will seed defaults if not exists)
    const config = await this.getFeatureConfig(firmId, feature);
    const enabled = config.enabled;

    // Cache the result
    await cacheManager.set(cacheKey, enabled, CACHE_TTL);

    return enabled;
  }

  /**
   * Get feature configuration for a specific feature
   * Seeds default config if not exists
   */
  async getFeatureConfig(firmId: string, feature: AIFeatureKey): Promise<AIFeatureConfigResult> {
    let config = await prisma.aIFeatureConfig.findUnique({
      where: {
        firmId_feature: {
          firmId,
          feature,
        },
      },
    });

    // Seed default if not exists
    if (!config) {
      config = await this.seedFeatureDefault(firmId, feature);
    }

    return this.mapToResult(config);
  }

  /**
   * Get all feature configurations for a firm
   * Seeds defaults for any missing features
   */
  async getAllFeatures(firmId: string): Promise<AIFeatureConfigResult[]> {
    // Ensure all defaults exist
    await this.ensureAllDefaults(firmId);

    const configs = await prisma.aIFeatureConfig.findMany({
      where: { firmId },
      orderBy: { feature: 'asc' },
    });

    return configs.map(this.mapToResult);
  }

  /**
   * Get budget status for a feature
   * Calculates spent amounts from AITokenUsage
   */
  async getFeatureBudgetStatus(
    firmId: string,
    feature: AIFeatureKey
  ): Promise<AIFeatureBudgetStatus> {
    const config = await this.getFeatureConfig(firmId, feature);

    // Get spending for this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Map feature to operation types (for AITokenUsage lookup)
    const operationTypes = this.getOperationTypesForFeature(feature);

    // Query spending
    const [monthlySpending, dailySpending] = await Promise.all([
      this.getSpending(firmId, operationTypes, startOfMonth, now),
      this.getSpending(firmId, operationTypes, startOfDay, now),
    ]);

    const monthlyBudgetEur = config.monthlyBudgetEur;
    const dailyLimitEur = config.dailyLimitEur;

    return {
      feature,
      enabled: config.enabled,
      monthlyBudgetEur,
      dailyLimitEur,
      spentThisMonthEur: monthlySpending,
      spentTodayEur: dailySpending,
      remainingMonthlyEur: monthlyBudgetEur !== null ? monthlyBudgetEur - monthlySpending : null,
      remainingDailyEur: dailyLimitEur !== null ? dailyLimitEur - dailySpending : null,
      isOverMonthlyBudget: monthlyBudgetEur !== null && monthlySpending >= monthlyBudgetEur,
      isOverDailyLimit: dailyLimitEur !== null && dailySpending >= dailyLimitEur,
    };
  }

  /**
   * Get batch features with their schedules
   */
  async getBatchFeatures(firmId: string): Promise<AIFeatureConfigResult[]> {
    const allFeatures = await this.getAllFeatures(firmId);
    return allFeatures.filter((f) => AI_FEATURES[f.feature].type === 'batch');
  }

  // ============================================================================
  // Write Operations
  // ============================================================================

  /**
   * Update feature configuration
   */
  async updateFeatureConfig(
    firmId: string,
    feature: AIFeatureKey,
    input: AIFeatureUpdateInput,
    updatedBy: string
  ): Promise<AIFeatureConfigResult> {
    // Validate feature exists in definition
    if (!AI_FEATURES[feature]) {
      throw new Error(`Invalid feature: ${feature}`);
    }

    // Build update data
    const updateData: Prisma.AIFeatureConfigUpdateInput = {
      updatedBy,
    };

    if (input.enabled !== undefined) {
      updateData.enabled = input.enabled;
    }
    if (input.monthlyBudgetEur !== undefined) {
      updateData.monthlyBudgetEur =
        input.monthlyBudgetEur !== null ? new Decimal(input.monthlyBudgetEur) : null;
    }
    if (input.dailyLimitEur !== undefined) {
      updateData.dailyLimitEur =
        input.dailyLimitEur !== null ? new Decimal(input.dailyLimitEur) : null;
    }
    if (input.schedule !== undefined) {
      updateData.schedule = input.schedule;
    }
    if (input.model !== undefined) {
      updateData.model = input.model;
    }

    const config = await prisma.aIFeatureConfig.upsert({
      where: {
        firmId_feature: {
          firmId,
          feature,
        },
      },
      update: updateData,
      create: {
        firmId,
        feature,
        enabled: input.enabled ?? true,
        monthlyBudgetEur:
          input.monthlyBudgetEur !== undefined && input.monthlyBudgetEur !== null
            ? new Decimal(input.monthlyBudgetEur)
            : null,
        dailyLimitEur:
          input.dailyLimitEur !== undefined && input.dailyLimitEur !== null
            ? new Decimal(input.dailyLimitEur)
            : null,
        schedule:
          (input.schedule ?? AI_FEATURES[feature].type === 'batch')
            ? ((AI_FEATURES[feature] as { defaultSchedule?: string }).defaultSchedule ?? null)
            : null,
        model: input.model ?? null,
        updatedBy,
      },
    });

    // Invalidate cache
    await this.invalidateCache(firmId, feature);

    return this.mapToResult(config);
  }

  /**
   * Toggle feature enabled/disabled
   */
  async toggleFeature(
    firmId: string,
    feature: AIFeatureKey,
    enabled: boolean,
    updatedBy: string
  ): Promise<AIFeatureConfigResult> {
    return this.updateFeatureConfig(firmId, feature, { enabled }, updatedBy);
  }

  // ============================================================================
  // Cache Operations
  // ============================================================================

  /**
   * Invalidate cache for a feature
   */
  async invalidateCache(firmId: string, feature?: AIFeatureKey): Promise<void> {
    if (feature) {
      await cacheManager.delete(`${CACHE_PREFIX}:${firmId}:${feature}:enabled`);
    } else {
      // Invalidate all features for firm
      await cacheManager.invalidate(`${CACHE_PREFIX}:${firmId}:*`);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Seed default configuration for a feature
   */
  private async seedFeatureDefault(
    firmId: string,
    feature: AIFeatureKey
  ): Promise<AIFeatureConfig> {
    const featureDefn = AI_FEATURES[feature];

    return prisma.aIFeatureConfig.create({
      data: {
        firmId,
        feature,
        enabled: true, // All features enabled by default
        monthlyBudgetEur: null, // No budget limit by default
        dailyLimitEur: null, // No daily limit by default
        schedule:
          featureDefn.type === 'batch'
            ? ((featureDefn as { defaultSchedule?: string }).defaultSchedule ?? null)
            : null,
        updatedBy: 'system', // Seeded by system
      },
    });
  }

  /**
   * Ensure all feature defaults exist for a firm
   */
  private async ensureAllDefaults(firmId: string): Promise<void> {
    const existingConfigs = await prisma.aIFeatureConfig.findMany({
      where: { firmId },
      select: { feature: true },
    });

    const existingFeatures = new Set(existingConfigs.map((c) => c.feature));
    const missingFeatures = Object.keys(AI_FEATURES).filter(
      (f) => !existingFeatures.has(f)
    ) as AIFeatureKey[];

    // Create missing configs in parallel
    await Promise.all(missingFeatures.map((f) => this.seedFeatureDefault(firmId, f)));
  }

  /**
   * Get spending for operation types in a date range
   * Returns EUR amount
   */
  private async getSpending(
    firmId: string,
    operationTypes: string[],
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    if (operationTypes.length === 0) {
      return 0;
    }

    const result = await prisma.aITokenUsage.aggregate({
      where: {
        firmId,
        operationType: { in: operationTypes },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        costCents: true,
      },
    });

    // Convert cents to EUR
    const costCents = result._sum.costCents ?? 0;
    return costCents / 100;
  }

  /**
   * Map feature key to AITokenUsage operation types
   */
  private getOperationTypesForFeature(feature: AIFeatureKey): string[] {
    // These should match the operationType values used in AITokenUsage
    const mapping: Record<AIFeatureKey, string[]> = {
      assistant_chat: ['assistant_chat', 'ASSISTANT_CHAT'],
      email_classification: ['email_classification', 'EMAIL_CLASSIFICATION'],
      email_drafting: ['email_drafting', 'EMAIL_DRAFTING'],
      document_drafting: ['document_drafting', 'DOCUMENT_DRAFTING'],
      document_extraction: ['document_extraction', 'DOCUMENT_EXTRACTION'],
      word_draft: ['word_draft', 'WORD_DRAFT'],
      search_index: ['search_index', 'SEARCH_INDEX'],
      morning_briefings: ['morning_briefings', 'MORNING_BRIEFINGS'],
      case_health: ['case_health', 'CASE_HEALTH'],
      thread_summaries: ['thread_summaries', 'THREAD_SUMMARIES'],
      case_context: ['case_context', 'CASE_CONTEXT'],
    };

    return mapping[feature] ?? [];
  }

  /**
   * Map DB model to result type
   */
  private mapToResult(config: AIFeatureConfig): AIFeatureConfigResult {
    return {
      id: config.id,
      firmId: config.firmId,
      feature: config.feature as AIFeatureKey,
      enabled: config.enabled,
      monthlyBudgetEur: config.monthlyBudgetEur ? Number(config.monthlyBudgetEur) : null,
      dailyLimitEur: config.dailyLimitEur ? Number(config.dailyLimitEur) : null,
      schedule: config.schedule,
      model: config.model,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const aiFeatureConfigService = new AIFeatureConfigService();
