'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  AI_USAGE_OVERVIEW,
  AI_FEATURES,
  AI_MODEL_OVERRIDES,
  AI_COSTS_BY_FEATURE,
  UPDATE_MODEL_OVERRIDE,
  DELETE_MODEL_OVERRIDE,
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

interface AIFeature {
  id: string;
  feature: string;
  featureName: string;
  featureType: 'request' | 'batch';
  enabled: boolean;
  model: string | null;
  dailyCostEstimate: number;
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
 */
function getDateRange(period: AIPeriod, customRange?: { start: Date; end: Date }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
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

  // Actions
  const updateModelOverride = async (operationType: string, model: string) => {
    await updateOverrideMutation({ variables: { operationType, model } });
  };

  const deleteModelOverride = async (operationType: string) => {
    await deleteOverrideMutation({ variables: { operationType } });
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

    // Loading states
    loading: overviewLoading || featuresLoading || overridesLoading,
    updating: updating || deleting,

    // Errors
    error: overviewError || featuresError || overridesError,

    // Actions
    updateModelOverride,
    deleteModelOverride,
    refetchAll,
  };
}
