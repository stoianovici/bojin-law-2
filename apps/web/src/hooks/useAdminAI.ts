'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  AI_USAGE_OVERVIEW,
  AI_FEATURES,
  AI_MODEL_OVERRIDES,
  AI_COSTS_BY_FEATURE,
  AI_AVAILABLE_MODELS,
  UPDATE_MODEL_OVERRIDE,
  DELETE_MODEL_OVERRIDE,
  UPDATE_AI_FEATURE_CONFIG,
} from '@/graphql/admin-ai';

// ============================================================================
// Type Definitions
// ============================================================================

interface AIUsageOverviewData {
  aiUsageOverview: {
    totalCost: number;
    totalTokens: number;
    totalCalls: number;
    successRate: number;
    projectedMonthEnd: number;
  };
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

interface UpdateModelOverrideData {
  updateModelOverride: ModelOverride;
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
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery<AIUsageOverviewData>(AI_USAGE_OVERVIEW, {
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
    }
  );

  const [deleteOverrideMutation, { loading: deleting }] = useMutation<{
    deleteModelOverride: boolean;
  }>(DELETE_MODEL_OVERRIDE, {
    refetchQueries: [{ query: AI_MODEL_OVERRIDES }],
  });

  const [updateFeatureConfigMutation, { loading: updatingFeature }] = useMutation<{
    updateAIFeatureConfig: AIFeature;
  }>(UPDATE_AI_FEATURE_CONFIG, {
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

  const refetchAll = () => {
    refetchOverview();
    refetchFeatures();
    refetchOverrides();
  };

  return {
    // Period management
    period,
    setPeriod,
    customRange,
    setCustomRange,
    dateRange,

    // Data
    overview: overviewData?.aiUsageOverview,
    features: featuresData?.aiFeatures || [],
    overrides: overridesData?.aiModelOverrides || [],
    costsByFeature: costsByFeatureData?.aiCostsByFeature || [],
    availableModels: availableModelsData?.aiAvailableModels || [],

    // Loading states
    loading: overviewLoading || featuresLoading || overridesLoading || modelsLoading,
    updating: updating || deleting || updatingFeature,

    // Errors
    error: overviewError || featuresError || overridesError,

    // Actions
    updateModelOverride,
    deleteModelOverride,
    updateFeatureConfig,
    refetchAll,
  };
}
