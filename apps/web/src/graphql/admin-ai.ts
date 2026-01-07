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
      enabled
      model
      dailyCostEstimate
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
