import { gql } from '@apollo/client';

// ============================================================================
// AI Usage Overview Queries
// ============================================================================

/**
 * Get AI usage overview stats for the dashboard
 * Returns aggregated metrics for cost, tokens, calls, and projections
 */
export const AI_USAGE_OVERVIEW = gql`
  query AIUsageOverview($dateRange: AIDateRangeInput) {
    aiUsageOverview(dateRange: $dateRange) {
      totalCost
      totalTokens
      totalCalls
      successRate
      projectedMonthEnd
    }
  }
`;

/**
 * Get combined AI usage overview with Anthropic reconciliation
 * Compares local logs against Anthropic Admin API (source of truth)
 */
export const AI_COMBINED_OVERVIEW = gql`
  query AICombinedOverview($dateRange: AIDateRangeInput) {
    aiCombinedOverview(dateRange: $dateRange) {
      local {
        totalCost
        totalTokens
        totalCalls
        successRate
        projectedMonthEnd
        cacheHitRate
        totalCacheReadTokens
        totalCacheCreationTokens
        totalThinkingTokens
        averageLatencyMs
      }
      anthropic {
        isConfigured
        totalCostUsd
        totalCostEur
        totalInputTokens
        totalOutputTokens
        byModel {
          model
          inputTokens
          outputTokens
        }
      }
      reconciliation {
        anthropicCostEur
        loggedCostEur
        unloggedCostEur
        unloggedPercent
        status
        message
      }
    }
  }
`;

// ============================================================================
// AI Feature Configuration Queries
// ============================================================================

/**
 * Get all AI features with their configurations
 * Used to display feature list with enable/disable toggles
 */
export const AI_FEATURES = gql`
  query AIFeatures {
    aiFeatures {
      id
      feature
      featureName
      featureType
      category
      enabled
      model
      monthlyBudgetEur
      dailyLimitEur
      schedule
      dailyCostEstimate
      lastRunAt
      lastRunStatus
      defaultModel
      defaultModelName
    }
  }
`;

/**
 * Get model overrides for the current firm
 * Shows custom model selections that override defaults
 */
export const AI_MODEL_OVERRIDES = gql`
  query AIModelOverrides {
    aiModelOverrides {
      operationType
      model
      updatedAt
    }
  }
`;

/**
 * Get available models for dropdown selection
 * Returns all models that can be used for AI operations
 */
export const AI_AVAILABLE_MODELS = gql`
  query AIAvailableModels {
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

// ============================================================================
// AI Cost Analytics Queries
// ============================================================================

/**
 * Get cost breakdown by feature for charts
 * Used to render pie charts and feature cost comparison
 */
export const AI_COSTS_BY_FEATURE = gql`
  query AICostsByFeature($dateRange: AIDateRangeInput!) {
    aiCostsByFeature(dateRange: $dateRange) {
      feature
      featureName
      cost
      tokens
      calls
      percentOfTotal
    }
  }
`;

/**
 * Get cost breakdown by AI model
 * Shows distribution across Claude models (Haiku/Sonnet/Opus)
 */
export const AI_MODEL_DISTRIBUTION = gql`
  query AIModelDistribution($dateRange: AIDateRangeInput!) {
    aiModelDistribution(dateRange: $dateRange) {
      model
      modelName
      cost
      calls
      tokens
      percentOfCost
    }
  }
`;

/**
 * Get daily cost breakdown for charting
 * Used to render daily cost trend line chart
 */
export const AI_DAILY_COSTS = gql`
  query AIDailyCosts($dateRange: AIDateRangeInput!) {
    aiDailyCosts(dateRange: $dateRange) {
      date
      cost
      tokens
      calls
    }
  }
`;

// ============================================================================
// AI Model Configuration Mutations
// ============================================================================

/**
 * Update model override for an operation type
 * Allows admins to select different models for specific AI operations
 */
export const UPDATE_MODEL_OVERRIDE = gql`
  mutation UpdateModelOverride($operationType: String!, $model: String!) {
    updateModelOverride(operationType: $operationType, model: $model) {
      operationType
      model
      updatedAt
    }
  }
`;

/**
 * Delete model override to revert to default
 * Removes custom model selection for an operation type
 */
export const DELETE_MODEL_OVERRIDE = gql`
  mutation DeleteModelOverride($operationType: String!) {
    deleteModelOverride(operationType: $operationType)
  }
`;

/**
 * Update AI feature configuration
 * Used to enable/disable features, change model, set budgets and schedules
 */
export const UPDATE_AI_FEATURE_CONFIG = gql`
  mutation UpdateAIFeatureConfig($feature: String!, $input: AIFeatureConfigInput!) {
    updateAIFeatureConfig(feature: $feature, input: $input) {
      id
      feature
      featureName
      featureType
      category
      enabled
      model
      monthlyBudgetEur
      dailyLimitEur
      schedule
      dailyCostEstimate
    }
  }
`;
