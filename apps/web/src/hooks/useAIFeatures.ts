/**
 * AI Features Hook
 * OPS-243: Feature Toggles Page
 *
 * GraphQL hook for fetching and managing AI feature configurations.
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// ============================================================================
// Types
// ============================================================================

export type AIFeatureType = 'request' | 'batch';
export type AIBatchJobStatus = 'running' | 'completed' | 'partial' | 'failed' | 'skipped';

export interface AIFeatureConfig {
  id: string;
  feature: string;
  featureName: string;
  featureType: AIFeatureType;
  enabled: boolean;
  monthlyBudgetEur: number | null;
  dailyLimitEur: number | null;
  schedule: string | null;
  model: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  dailyCostEstimate: number | null;
}

export interface AIAvailableModel {
  id: string;
  name: string;
  category: 'haiku' | 'sonnet' | 'opus';
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  isDefault: boolean;
}

export interface AIBatchJobRun {
  id: string;
  feature: string;
  featureName: string;
  status: AIBatchJobStatus;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  totalTokens: number;
  totalCostEur: number;
  errorMessage: string | null;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_AI_FEATURES = gql`
  query GetAIFeatures {
    aiFeatures {
      id
      feature
      featureName
      featureType
      enabled
      monthlyBudgetEur
      dailyLimitEur
      schedule
      model
      lastRunAt
      lastRunStatus
      dailyCostEstimate
    }
  }
`;

const GET_AI_AVAILABLE_MODELS = gql`
  query GetAIAvailableModels {
    aiAvailableModels {
      id
      name
      category
      inputCostPerMillion
      outputCostPerMillion
      isDefault
    }
  }
`;

const UPDATE_AI_FEATURE_CONFIG = gql`
  mutation UpdateAIFeatureConfig($feature: String!, $input: AIFeatureConfigInput!) {
    updateAIFeatureConfig(feature: $feature, input: $input) {
      id
      feature
      featureName
      featureType
      enabled
      monthlyBudgetEur
      dailyLimitEur
      schedule
      model
      lastRunAt
      lastRunStatus
      dailyCostEstimate
    }
  }
`;

const TRIGGER_BATCH_JOB = gql`
  mutation TriggerBatchJob($feature: String!) {
    triggerBatchJob(feature: $feature) {
      id
      feature
      featureName
      status
      startedAt
      completedAt
      itemsProcessed
      itemsFailed
      totalTokens
      totalCostEur
      errorMessage
    }
  }
`;

// ============================================================================
// Hooks
// ============================================================================

interface UseAIFeaturesResult {
  features: AIFeatureConfig[];
  batchFeatures: AIFeatureConfig[];
  requestFeatures: AIFeatureConfig[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Hook to fetch all AI feature configurations
 */
export function useAIFeatures(): UseAIFeaturesResult {
  const { data, loading, error, refetch } = useQuery<{ aiFeatures: AIFeatureConfig[] }>(
    GET_AI_FEATURES,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  const features = data?.aiFeatures || [];

  return {
    features,
    batchFeatures: features.filter((f: AIFeatureConfig) => f.featureType === 'batch'),
    requestFeatures: features.filter((f: AIFeatureConfig) => f.featureType === 'request'),
    loading,
    error: error as Error | undefined,
    refetch,
  };
}

interface UseToggleFeatureResult {
  toggleFeature: (feature: string, enabled: boolean) => Promise<AIFeatureConfig>;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Hook to toggle AI feature enabled state
 */
export function useToggleFeature(): UseToggleFeatureResult {
  const [mutate, { loading, error }] = useMutation<
    { updateAIFeatureConfig: AIFeatureConfig },
    { feature: string; input: { enabled: boolean } }
  >(UPDATE_AI_FEATURE_CONFIG, {
    refetchQueries: [{ query: GET_AI_FEATURES }],
  });

  const toggleFeature = async (feature: string, enabled: boolean): Promise<AIFeatureConfig> => {
    const result = await mutate({
      variables: {
        feature,
        input: { enabled },
      },
    });

    if (!result.data) {
      throw new Error('No data returned from mutation');
    }

    return result.data.updateAIFeatureConfig;
  };

  return {
    toggleFeature,
    loading,
    error: error as Error | undefined,
  };
}

interface UseTriggerBatchJobResult {
  triggerJob: (feature: string) => Promise<AIBatchJobRun>;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Hook to manually trigger a batch job
 */
export function useTriggerBatchJob(): UseTriggerBatchJobResult {
  const [mutate, { loading, error }] = useMutation<
    { triggerBatchJob: AIBatchJobRun },
    { feature: string }
  >(TRIGGER_BATCH_JOB, {
    refetchQueries: [{ query: GET_AI_FEATURES }],
  });

  const triggerJob = async (feature: string): Promise<AIBatchJobRun> => {
    const result = await mutate({
      variables: { feature },
    });

    if (!result.data) {
      throw new Error('No data returned from mutation');
    }

    return result.data.triggerBatchJob;
  };

  return {
    triggerJob,
    loading,
    error: error as Error | undefined,
  };
}

interface UseAIAvailableModelsResult {
  models: AIAvailableModel[];
  loading: boolean;
  error: Error | undefined;
}

/**
 * Hook to fetch all available Claude models
 */
export function useAIAvailableModels(): UseAIAvailableModelsResult {
  const { data, loading, error } = useQuery<{ aiAvailableModels: AIAvailableModel[] }>(
    GET_AI_AVAILABLE_MODELS,
    {
      fetchPolicy: 'cache-first',
    }
  );

  return {
    models: data?.aiAvailableModels || [],
    loading,
    error: error as Error | undefined,
  };
}

interface UseUpdateFeatureModelResult {
  updateModel: (feature: string, model: string | null) => Promise<AIFeatureConfig>;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Hook to update the Claude model for a feature
 */
export function useUpdateFeatureModel(): UseUpdateFeatureModelResult {
  const [mutate, { loading, error }] = useMutation<
    { updateAIFeatureConfig: AIFeatureConfig },
    { feature: string; input: { model: string | null } }
  >(UPDATE_AI_FEATURE_CONFIG, {
    refetchQueries: [{ query: GET_AI_FEATURES }],
  });

  const updateModel = async (feature: string, model: string | null): Promise<AIFeatureConfig> => {
    const result = await mutate({
      variables: {
        feature,
        input: { model },
      },
    });

    if (!result.data) {
      throw new Error('No data returned from mutation');
    }

    return result.data.updateAIFeatureConfig;
  };

  return {
    updateModel,
    loading,
    error: error as Error | undefined,
  };
}
