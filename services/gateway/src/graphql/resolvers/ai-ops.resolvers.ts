/**
 * AI Ops Resolvers
 * OPS-241: AI Ops GraphQL Schema & Resolvers
 *
 * Admin dashboard API for AI usage monitoring, feature toggles, and batch job management.
 * All operations require Partner role.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { aiUsageService, type DateRange } from '../../services/ai-usage.service';
import {
  aiFeatureConfigService,
  AI_FEATURES,
  type AIFeatureKey,
} from '../../services/ai-feature-config.service';
import { aiBudgetAlertsService } from '../../services/ai-budget-alerts.service';
import { batchRunner } from '../../batch/batch-runner.service';
import { getAvailableModels, DEFAULT_MODEL } from '../../services/ai-client.service';
import { queueContentExtractionJob } from '../../workers/content-extraction.worker';
import { caseContextFileService } from '../../services/case-context-file.service';
import { DocumentExtractionStatus } from '@legal-platform/database';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
  // Admin API key bypass for internal/automated operations
  isAdminBypass?: boolean;
}

interface AIDateRangeInput {
  start: Date;
  end: Date;
}

interface AIFeatureConfigInput {
  enabled?: boolean;
  monthlyBudgetEur?: number | null;
  dailyLimitEur?: number | null;
  schedule?: string | null;
  model?: string | null;
}

interface AIBudgetSettingsInput {
  monthlyBudget?: number | null;
  alertAt75?: boolean;
  alertAt90?: boolean;
  autoPauseAt100?: boolean;
  slackWebhookUrl?: string | null;
}

// ============================================================================
// Authorization Helper
// ============================================================================

/**
 * Require Partner or BusinessOwner role for AI Ops operations
 * Throws GraphQLError if not authorized
 */
function requirePartner(context: Context): { firmId: string; userId: string } {
  if (!context.user) {
    throw new GraphQLError('Autentificare necesară', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (context.user.role !== 'Partner' && context.user.role !== 'BusinessOwner') {
    throw new GraphQLError('Acces interzis. Rol de Partner sau BusinessOwner necesar.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return {
    firmId: context.user.firmId,
    userId: context.user.id,
  };
}

/**
 * Parse date range input to DateRange
 */
function parseDateRange(input?: AIDateRangeInput): DateRange | undefined {
  if (!input) return undefined;
  return {
    start: new Date(input.start),
    end: new Date(input.end),
  };
}

/**
 * Get feature name from AI_FEATURES constant
 */
function getFeatureName(feature: string): string {
  const featureConfig = AI_FEATURES[feature as AIFeatureKey];
  return featureConfig?.name || feature;
}

/**
 * Get feature type from AI_FEATURES constant
 */
function getFeatureType(feature: string): 'request' | 'batch' {
  const featureConfig = AI_FEATURES[feature as AIFeatureKey];
  return featureConfig?.type || 'request';
}

/**
 * Get feature category from AI_FEATURES constant
 */
function getFeatureCategory(feature: string): string {
  const featureConfig = AI_FEATURES[feature as AIFeatureKey] as { category?: string };
  return featureConfig?.category || 'Other';
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const aiOpsQueryResolvers = {
  /**
   * Get all available Claude models for feature configuration
   */
  aiAvailableModels: (_: unknown, __: unknown, context: Context) => {
    requirePartner(context);

    const models = getAvailableModels();
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      inputCostPerMillion: m.input,
      outputCostPerMillion: m.output,
      isDefault: m.id === DEFAULT_MODEL,
    }));
  },

  /**
   * Get budget settings for the current firm
   */
  aiBudgetSettings: async (_: unknown, __: unknown, context: Context) => {
    const { firmId } = requirePartner(context);
    const settings = await aiBudgetAlertsService.getBudgetSettings(firmId);
    return settings;
  },

  /**
   * Get overall AI usage statistics
   */
  aiUsageOverview: async (
    _: unknown,
    { dateRange }: { dateRange?: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange);

    const overview = await aiUsageService.getUsageOverview(firmId, range);

    // Get budget settings for this firm (if implemented)
    // For now, return null for budget fields
    return {
      totalCost: overview.totalCost,
      totalTokens: overview.totalTokens,
      totalCalls: overview.totalCalls,
      successRate: overview.successRate,
      projectedMonthEnd: overview.projectedMonthEnd,
      budgetLimit: null, // TODO: Implement firm-wide budget settings
      budgetUsedPercent: null,
      // Epic 6 metrics
      cacheHitRate: overview.cacheHitRate,
      totalCacheReadTokens: overview.totalCacheReadTokens,
      totalCacheCreationTokens: overview.totalCacheCreationTokens,
      totalThinkingTokens: overview.totalThinkingTokens,
      averageLatencyMs: overview.averageLatencyMs,
    };
  },

  /**
   * Get combined overview from local logs and Anthropic Admin API
   */
  aiCombinedOverview: async (
    _: unknown,
    { dateRange }: { dateRange?: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange);

    const combined = await aiUsageService.getCombinedOverview(firmId, range);

    // Transform byModel from Record to array for GraphQL
    const byModelArray = Object.entries(combined.anthropic.byModel).map(([model, data]) => ({
      model,
      ...data,
    }));

    return {
      local: {
        totalCost: combined.local.totalCost,
        totalTokens: combined.local.totalTokens,
        totalCalls: combined.local.totalCalls,
        successRate: combined.local.successRate,
        projectedMonthEnd: combined.local.projectedMonthEnd,
        budgetLimit: null,
        budgetUsedPercent: null,
        // Epic 6 metrics
        cacheHitRate: combined.local.cacheHitRate,
        totalCacheReadTokens: combined.local.totalCacheReadTokens,
        totalCacheCreationTokens: combined.local.totalCacheCreationTokens,
        totalThinkingTokens: combined.local.totalThinkingTokens,
        averageLatencyMs: combined.local.averageLatencyMs,
      },
      anthropic: {
        isConfigured: combined.anthropic.isConfigured,
        totalCostUsd: combined.anthropic.totalCostUsd,
        totalCostEur: combined.anthropic.totalCostEur,
        totalInputTokens: combined.anthropic.totalInputTokens,
        totalOutputTokens: combined.anthropic.totalOutputTokens,
        byModel: byModelArray,
        byDay: combined.anthropic.byDay,
      },
      reconciliation: combined.reconciliation,
    };
  },

  /**
   * Get daily cost breakdown
   */
  aiDailyCosts: async (
    _: unknown,
    { dateRange }: { dateRange: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange)!;

    return aiUsageService.getDailyCosts(firmId, range);
  },

  /**
   * Get cost breakdown by feature
   */
  aiCostsByFeature: async (
    _: unknown,
    { dateRange }: { dateRange: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange)!;

    return aiUsageService.getCostsByFeature(firmId, range);
  },

  /**
   * Get cost breakdown by user
   */
  aiCostsByUser: async (
    _: unknown,
    { dateRange }: { dateRange: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange)!;

    return aiUsageService.getCostsByUser(firmId, range);
  },

  /**
   * Get cost breakdown by AI model
   */
  aiModelDistribution: async (
    _: unknown,
    { dateRange }: { dateRange: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange)!;

    const modelCosts = await aiUsageService.getCostsByModel(firmId, range);
    const models = getAvailableModels();

    return modelCosts.map((m) => {
      const modelInfo = models.find((model) => model.id === m.model);
      return {
        model: m.model,
        modelName: modelInfo?.name || m.model,
        cost: m.cost,
        calls: m.calls,
        tokens: m.tokens,
        percentOfCost: m.percentOfCost,
      };
    });
  },

  /**
   * Get all AI feature configurations
   */
  aiFeatures: async (_: unknown, __: unknown, context: Context) => {
    const { firmId } = requirePartner(context);

    const features = await aiFeatureConfigService.getAllFeatures(firmId);

    // Get last run info for batch features
    const batchFeatures = features.filter((f) => AI_FEATURES[f.feature]?.type === 'batch');
    const lastRuns = await Promise.all(
      batchFeatures.map(async (f) => {
        const lastJob = await prisma.aIBatchJobRun.findFirst({
          where: { firmId, feature: f.feature },
          orderBy: { startedAt: 'desc' },
        });
        return { feature: f.feature, lastJob };
      })
    );
    const lastRunMap = new Map(lastRuns.map((r) => [r.feature, r.lastJob]));

    // Get daily cost estimates from last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const costsByFeature = await aiUsageService.getCostsByFeature(firmId, {
      start: weekAgo,
      end: new Date(),
    });
    const costMap = new Map(costsByFeature.map((c) => [c.feature, c.cost / 7]));

    // Get model info for looking up names
    const models = getAvailableModels();

    return features.map((f) => {
      const lastJob = lastRunMap.get(f.feature);
      const featureDefn = AI_FEATURES[f.feature as AIFeatureKey];
      const defaultModelId = featureDefn?.defaultModel || DEFAULT_MODEL;
      const defaultModelInfo = models.find((m) => m.id === defaultModelId);

      return {
        id: f.id,
        feature: f.feature,
        featureName: getFeatureName(f.feature),
        featureType: getFeatureType(f.feature),
        category: getFeatureCategory(f.feature),
        enabled: f.enabled,
        monthlyBudgetEur: f.monthlyBudgetEur,
        dailyLimitEur: f.dailyLimitEur,
        schedule: f.schedule,
        model: f.model,
        lastRunAt: lastJob?.completedAt || lastJob?.startedAt || null,
        lastRunStatus: lastJob?.status || null,
        dailyCostEstimate: costMap.get(f.feature) || 0,
        defaultModel: defaultModelId,
        defaultModelName: defaultModelInfo?.name || defaultModelId,
      };
    });
  },

  /**
   * Get configuration for a specific feature
   */
  aiFeature: async (_: unknown, { feature }: { feature: string }, context: Context) => {
    const { firmId } = requirePartner(context);

    // Validate feature key
    if (!AI_FEATURES[feature as AIFeatureKey]) {
      return null;
    }

    const config = await aiFeatureConfigService.getFeatureConfig(firmId, feature as AIFeatureKey);

    // Get last run for batch features
    let lastJob = null;
    if (AI_FEATURES[feature as AIFeatureKey]?.type === 'batch') {
      lastJob = await prisma.aIBatchJobRun.findFirst({
        where: { firmId, feature },
        orderBy: { startedAt: 'desc' },
      });
    }

    // Get daily cost estimate
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const costsByFeature = await aiUsageService.getCostsByFeature(firmId, {
      start: weekAgo,
      end: new Date(),
    });
    const featureCost = costsByFeature.find((c) => c.feature === feature);

    // Get default model info
    const featureDefn = AI_FEATURES[feature as AIFeatureKey];
    const defaultModelId = featureDefn?.defaultModel || DEFAULT_MODEL;
    const models = getAvailableModels();
    const defaultModelInfo = models.find((m) => m.id === defaultModelId);

    return {
      id: config.id,
      feature: config.feature,
      featureName: getFeatureName(config.feature),
      featureType: getFeatureType(config.feature),
      category: getFeatureCategory(config.feature),
      enabled: config.enabled,
      monthlyBudgetEur: config.monthlyBudgetEur,
      dailyLimitEur: config.dailyLimitEur,
      schedule: config.schedule,
      model: config.model,
      lastRunAt: lastJob?.completedAt || lastJob?.startedAt || null,
      lastRunStatus: lastJob?.status || null,
      dailyCostEstimate: featureCost ? featureCost.cost / 7 : 0,
      defaultModel: defaultModelId,
      defaultModelName: defaultModelInfo?.name || defaultModelId,
    };
  },

  /**
   * Get batch job execution history
   */
  aiBatchJobs: async (
    _: unknown,
    {
      feature,
      status,
      limit = 50,
      offset = 0,
    }: { feature?: string; status?: string; limit?: number; offset?: number },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);

    const where: {
      firmId: string;
      feature?: string;
      status?: string;
    } = { firmId };

    if (feature) {
      where.feature = feature;
    }
    if (status) {
      where.status = status;
    }

    const jobs = await prisma.aIBatchJobRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return jobs.map((job) => ({
      id: job.id,
      feature: job.feature,
      featureName: getFeatureName(job.feature),
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      itemsProcessed: job.itemsProcessed,
      itemsFailed: job.itemsFailed,
      totalTokens: job.totalTokens,
      totalCostEur: Number(job.totalCostEur),
      errorMessage: job.errorMessage,
    }));
  },

  /**
   * OPS-247: Get detailed AI usage for a specific user
   */
  aiUserUsage: async (
    _: unknown,
    { userId, dateRange }: { userId: string; dateRange: AIDateRangeInput },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);
    const range = parseDateRange(dateRange)!;

    const usage = await aiUsageService.getUserUsage(firmId, userId, range);

    if (!usage) {
      return null;
    }

    return {
      userId: usage.userId,
      userName: usage.userName,
      userEmail: usage.userEmail,
      totalCost: usage.totalCost,
      totalTokens: usage.totalTokens,
      totalCalls: usage.totalCalls,
      dailyCosts: usage.dailyCosts,
      costsByFeature: usage.costsByFeature,
    };
  },

  /**
   * OPS-247: Get activity log for a specific user
   */
  aiUserActivity: async (
    _: unknown,
    { userId, limit = 50, offset = 0 }: { userId: string; limit?: number; offset?: number },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);

    return aiUsageService.getUserActivity(firmId, userId, limit, offset);
  },

  /**
   * Get all model overrides for the current firm
   */
  aiModelOverrides: async (_: unknown, __: unknown, context: Context) => {
    const { firmId } = requirePartner(context);

    const overrides = await prisma.aIModelConfig.findMany({
      where: { firmId },
      orderBy: { operationType: 'asc' },
    });

    return overrides.map((o) => ({
      operationType: o.operationType,
      model: o.model,
      updatedAt: o.updatedAt,
    }));
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const aiOpsMutationResolvers = {
  /**
   * Update AI feature configuration
   */
  updateAIFeatureConfig: async (
    _: unknown,
    { feature, input }: { feature: string; input: AIFeatureConfigInput },
    context: Context
  ) => {
    const { firmId, userId } = requirePartner(context);

    // Validate feature key
    if (!AI_FEATURES[feature as AIFeatureKey]) {
      throw new GraphQLError(`Funcționalitate necunoscută: ${feature}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const config = await aiFeatureConfigService.updateFeatureConfig(
      firmId,
      feature as AIFeatureKey,
      {
        enabled: input.enabled,
        monthlyBudgetEur: input.monthlyBudgetEur,
        dailyLimitEur: input.dailyLimitEur,
        schedule: input.schedule,
        model: input.model,
      },
      userId
    );

    // Refresh scheduler if schedule changed
    if (input.schedule !== undefined) {
      await batchRunner.refreshScheduleForFirm(firmId);
    }

    return {
      id: config.id,
      feature: config.feature,
      featureName: getFeatureName(config.feature),
      featureType: getFeatureType(config.feature),
      category: getFeatureCategory(config.feature),
      enabled: config.enabled,
      monthlyBudgetEur: config.monthlyBudgetEur,
      dailyLimitEur: config.dailyLimitEur,
      schedule: config.schedule,
      model: config.model,
      lastRunAt: null,
      lastRunStatus: null,
      dailyCostEstimate: 0,
    };
  },

  /**
   * Manually trigger a batch job
   */
  triggerBatchJob: async (_: unknown, { feature }: { feature: string }, context: Context) => {
    const { firmId } = requirePartner(context);

    // Validate feature key
    if (!AI_FEATURES[feature as AIFeatureKey]) {
      throw new GraphQLError(`Funcționalitate necunoscută: ${feature}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Check if feature is a batch type
    if (AI_FEATURES[feature as AIFeatureKey]?.type !== 'batch') {
      throw new GraphQLError(`${feature} nu este o funcționalitate de tip batch`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    try {
      const result = await batchRunner.runProcessor(firmId, feature);

      return {
        id: result.job.id,
        feature: result.job.feature,
        featureName: getFeatureName(result.job.feature),
        status: result.job.status,
        startedAt: result.job.startedAt,
        completedAt: result.job.completedAt,
        itemsProcessed: result.job.itemsProcessed,
        itemsFailed: result.job.itemsFailed,
        totalTokens: result.job.totalTokens,
        totalCostEur: Number(result.job.totalCostEur),
        errorMessage: result.job.errorMessage,
      };
    } catch (error) {
      throw new GraphQLError(
        `Eroare la pornirea job-ului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`,
        {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        }
      );
    }
  },

  /**
   * Update global AI budget settings
   */
  updateAIBudgetSettings: async (
    _: unknown,
    { input }: { input: AIBudgetSettingsInput },
    context: Context
  ) => {
    const { firmId, userId } = requirePartner(context);

    await aiBudgetAlertsService.updateBudgetSettings(
      firmId,
      {
        monthlyBudgetEur: input.monthlyBudget ?? undefined,
        alertAt75Percent: input.alertAt75,
        alertAt90Percent: input.alertAt90,
        autoPauseAt100Percent: input.autoPauseAt100,
        slackWebhookUrl: input.slackWebhookUrl,
      },
      userId
    );

    return true;
  },

  /**
   * Update or create a model override for an AI operation type
   */
  updateModelOverride: async (
    _: unknown,
    { operationType, model }: { operationType: string; model: string },
    context: Context
  ) => {
    const { firmId, userId } = requirePartner(context);

    // Validate model value - accept full model IDs from AI_MODELS
    const availableModels = getAvailableModels();
    const validModelIds = availableModels.map((m) => m.id);
    if (!validModelIds.includes(model)) {
      throw new GraphQLError(
        `Model invalid: ${model}. Valori acceptate: ${validModelIds.join(', ')}`,
        {
          extensions: { code: 'BAD_USER_INPUT' },
        }
      );
    }

    const override = await prisma.aIModelConfig.upsert({
      where: {
        operationType_firmId: { operationType, firmId },
      },
      create: {
        firmId,
        operationType,
        model,
        updatedById: userId,
      },
      update: {
        model,
        updatedById: userId,
      },
    });

    return {
      operationType: override.operationType,
      model: override.model,
      updatedAt: override.updatedAt,
    };
  },

  /**
   * Delete a model override, returning to default routing
   */
  deleteModelOverride: async (
    _: unknown,
    { operationType }: { operationType: string },
    context: Context
  ) => {
    const { firmId } = requirePartner(context);

    try {
      await prisma.aIModelConfig.delete({
        where: {
          operationType_firmId: { operationType, firmId },
        },
      });
      return true;
    } catch (error) {
      // If not found, that's fine - it's already deleted
      return false;
    }
  },

  /**
   * Queue document extraction for all PENDING documents in a case
   * Supports admin API key bypass for automated operations
   */
  triggerCaseDocumentExtraction: async (
    _: unknown,
    { caseId }: { caseId: string },
    context: Context
  ) => {
    let firmId: string;

    if (context.isAdminBypass) {
      // Admin bypass - get firmId from the case itself
      const caseWithFirm = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });
      if (!caseWithFirm) {
        throw new GraphQLError('Dosarul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      firmId = caseWithFirm.firmId;
      console.log(`[AI Ops] Admin bypass used for extraction trigger, caseId: ${caseId}`);
    } else {
      // Normal auth flow
      const auth = requirePartner(context);
      firmId = auth.firmId;
    }

    // Verify case belongs to firm
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: { id: true },
    });

    if (!caseRecord) {
      throw new GraphQLError('Dosarul nu a fost găsit', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Find all documents with PENDING or NONE extraction status
    const pendingDocs = await prisma.document.findMany({
      where: {
        caseLinks: {
          some: { caseId },
        },
        extractionStatus: {
          in: [DocumentExtractionStatus.PENDING, DocumentExtractionStatus.NONE],
        },
      },
      select: { id: true, fileName: true },
    });

    console.log(
      `[AI Ops] Queuing extraction for ${pendingDocs.length} documents in case ${caseId}`
    );

    // Queue each document for extraction
    let queued = 0;
    for (const doc of pendingDocs) {
      try {
        await queueContentExtractionJob({
          documentId: doc.id,
          triggeredBy: 'manual',
        });
        queued++;
      } catch (err) {
        console.error(`[AI Ops] Failed to queue extraction for ${doc.id}:`, err);
      }
    }

    return queued;
  },

  /**
   * Regenerate case context (invalidate cache and rebuild)
   */
  regenerateCaseContext: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
    const { firmId } = requirePartner(context);

    // Verify case belongs to firm
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: { id: true },
    });

    if (!caseRecord) {
      throw new GraphQLError('Dosarul nu a fost găsit', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Invalidate cache and regenerate context
    await caseContextFileService.invalidateCache(caseId);

    // Force regenerate by fetching context
    const contextFile = await caseContextFileService.getContextFile(caseId, 'word_addin');

    console.log(`[AI Ops] Regenerated context for case ${caseId}`, {
      tokenCount: contextFile?.tokenCount,
      sections: contextFile?.sections?.length,
    });

    return true;
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const aiOpsResolvers = {
  Query: aiOpsQueryResolvers,
  Mutation: aiOpsMutationResolvers,
};
