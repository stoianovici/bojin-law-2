'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  AI_USAGE_OVERVIEW,
  AI_COMBINED_OVERVIEW,
  AI_FEATURES,
  AI_MODEL_OVERRIDES,
  AI_COSTS_BY_FEATURE,
  AI_MODEL_DISTRIBUTION,
  AI_DAILY_COSTS,
  AI_AVAILABLE_MODELS,
  UPDATE_MODEL_OVERRIDE,
  DELETE_MODEL_OVERRIDE,
  UPDATE_AI_FEATURE_CONFIG,
  TRIGGER_BATCH_JOB,
} from '@/graphql/admin-ai';

// ============================================================================
// Type Definitions
// ============================================================================

interface AIUsageOverview {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  successRate: number;
  projectedMonthEnd: number;
  // Epic 6 metrics
  cacheHitRate: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalThinkingTokens: number;
  averageLatencyMs: number;
}

interface AIUsageOverviewData {
  aiUsageOverview: AIUsageOverview;
}

export interface AIModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIAnthropicOverview {
  isConfigured: boolean;
  totalCostUsd: number;
  totalCostEur: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: AIModelUsage[];
}

export interface AIReconciliation {
  anthropicCostEur: number;
  loggedCostEur: number;
  unloggedCostEur: number;
  unloggedPercent: number;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

export interface AICombinedOverview {
  local: AIUsageOverview;
  anthropic: AIAnthropicOverview;
  reconciliation: AIReconciliation;
}

interface AICombinedOverviewData {
  aiCombinedOverview: AICombinedOverview;
}

export interface AIFeature {
  id: string;
  feature: string;
  featureName: string;
  featureType: 'request' | 'batch';
  category: string;
  enabled: boolean;
  model: string | null;
  monthlyBudgetEur: number | null;
  dailyLimitEur: number | null;
  schedule: string | null;
  dailyCostEstimate: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  defaultModel: string;
  defaultModelName: string;
}

export interface AIFeatureConfigInput {
  enabled?: boolean;
  model?: string | null;
  monthlyBudgetEur?: number | null;
  dailyLimitEur?: number | null;
  schedule?: string | null;
}

interface AIFeaturesData {
  aiFeatures: AIFeature[];
}

interface ModelOverride {
  operationType: string;
  model: string;
  updatedAt: string;
}

interface AIModelOverridesData {
  aiModelOverrides: ModelOverride[];
}

interface AIFeatureCost {
  feature: string;
  featureName: string;
  cost: number;
  tokens: number;
  calls: number;
  percentOfTotal: number;
}

interface AICostsByFeatureData {
  aiCostsByFeature: AIFeatureCost[];
}

export interface AIModelDistributionItem {
  model: string;
  modelName: string;
  cost: number;
  calls: number;
  tokens: number;
  percentOfCost: number;
}

interface AIModelDistributionData {
  aiModelDistribution: AIModelDistributionItem[];
}

export interface AIDailyCostItem {
  date: string;
  cost: number;
  tokens: number;
  calls: number;
}

interface AIDailyCostsData {
  aiDailyCosts: AIDailyCostItem[];
}

interface UpdateModelOverrideData {
  updateModelOverride: ModelOverride;
}

export interface AIBatchJobRun {
  id: string;
  feature: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  totalTokens: number;
  totalCostEur: number;
  errorMessage: string | null;
}

interface TriggerBatchJobData {
  triggerBatchJob: AIBatchJobRun;
}

export interface AvailableModel {
  id: string;
  name: string;
  category: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  isDefault: boolean;
}

interface AIAvailableModelsData {
  aiAvailableModels: AvailableModel[];
}

// ============================================================================
// Period Options
// ============================================================================

// Period options for the selector
export type AIPeriod = 'today' | 'week' | 'month' | 'custom';

export interface AIPeriodOption {
  value: AIPeriod;
  label: string;
}

export const PERIOD_OPTIONS: AIPeriodOption[] = [
  { value: 'today', label: 'Astăzi' },
  { value: 'week', label: 'Săptămâna aceasta' },
  { value: 'month', label: 'Luna aceasta' },
];

/**
 * Calculate date range for a period
 * All periods end at "now" for consistency
 */
function getDateRange(period: AIPeriod, customRange?: { start: Date; end: Date }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return {
        start: today,
        end: now, // Use "now" instead of end of day for consistency
      };
    case 'week': {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
      return {
        start: startOfWeek,
        end: now,
      };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: startOfMonth,
        end: now,
      };
    }
    case 'custom':
      return customRange || { start: today, end: now };
    default:
      return { start: today, end: now };
  }
}

export function useAdminAI() {
  const [period, setPeriod] = useState<AIPeriod>('month');
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>();

  // Calculate date range based on period
  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  // Queries
  const {
    data: combinedOverviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery<AICombinedOverviewData>(AI_COMBINED_OVERVIEW, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: featuresData,
    loading: featuresLoading,
    error: featuresError,
    refetch: refetchFeatures,
  } = useQuery<AIFeaturesData>(AI_FEATURES, {
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: overridesData,
    loading: overridesLoading,
    error: overridesError,
    refetch: refetchOverrides,
  } = useQuery<AIModelOverridesData>(AI_MODEL_OVERRIDES, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: costsByFeatureData } = useQuery<AICostsByFeatureData>(AI_COSTS_BY_FEATURE, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });

  const { data: modelDistributionData } = useQuery<AIModelDistributionData>(AI_MODEL_DISTRIBUTION, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });

  const { data: dailyCostsData } = useQuery<AIDailyCostsData>(AI_DAILY_COSTS, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });

  const { data: availableModelsData, loading: modelsLoading } = useQuery<AIAvailableModelsData>(
    AI_AVAILABLE_MODELS,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  // Mutations
  const [updateOverrideMutation, { loading: updating }] = useMutation<UpdateModelOverrideData>(
    UPDATE_MODEL_OVERRIDE,
    {
      refetchQueries: [{ query: AI_MODEL_OVERRIDES }],
      awaitRefetchQueries: true,
    }
  );

  const [deleteOverrideMutation, { loading: deleting }] = useMutation<{
    deleteModelOverride: boolean;
  }>(DELETE_MODEL_OVERRIDE, {
    refetchQueries: [{ query: AI_MODEL_OVERRIDES }],
    awaitRefetchQueries: true,
  });

  const [updateFeatureConfigMutation, { loading: updatingFeature }] = useMutation<{
    updateAIFeatureConfig: AIFeature;
  }>(UPDATE_AI_FEATURE_CONFIG, {
    refetchQueries: [{ query: AI_FEATURES }],
  });

  const [triggerBatchJobMutation, { loading: triggeringBatchJob }] =
    useMutation<TriggerBatchJobData>(TRIGGER_BATCH_JOB, {
      refetchQueries: [{ query: AI_FEATURES }],
    });

  // Actions
  const updateModelOverride = async (operationType: string, model: string) => {
    await updateOverrideMutation({ variables: { operationType, model } });
  };

  const deleteModelOverride = async (operationType: string) => {
    await deleteOverrideMutation({ variables: { operationType } });
  };

  const updateFeatureConfig = async (feature: string, input: AIFeatureConfigInput) => {
    await updateFeatureConfigMutation({ variables: { feature, input } });
  };

  const triggerBatchJob = async (feature: string): Promise<AIBatchJobRun> => {
    const result = await triggerBatchJobMutation({ variables: { feature } });
    return result.data!.triggerBatchJob;
  };

  const refetchAll = () => {
    refetchOverview();
    refetchFeatures();
    refetchOverrides();
  };

  // Extract combined overview data
  const combinedOverview = combinedOverviewData?.aiCombinedOverview;

  return {
    // Period management
    period,
    setPeriod,
    customRange,
    setCustomRange,
    dateRange,

    // Data
    overview: combinedOverview?.local,
    anthropic: combinedOverview?.anthropic,
    reconciliation: combinedOverview?.reconciliation,
    features: featuresData?.aiFeatures || [],
    overrides: overridesData?.aiModelOverrides || [],
    costsByFeature: costsByFeatureData?.aiCostsByFeature || [],
    modelDistribution: modelDistributionData?.aiModelDistribution || [],
    dailyCosts: dailyCostsData?.aiDailyCosts || [],
    availableModels: availableModelsData?.aiAvailableModels || [],

    // Loading states
    loading: overviewLoading || featuresLoading || overridesLoading || modelsLoading,
    updating: updating || deleting || updatingFeature,
    triggeringBatchJob,

    // Errors
    error: overviewError || featuresError || overridesError,

    // Actions
    updateModelOverride,
    deleteModelOverride,
    updateFeatureConfig,
    triggerBatchJob,
    refetchAll,
  };
}
