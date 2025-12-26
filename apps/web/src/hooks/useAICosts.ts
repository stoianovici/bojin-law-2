/**
 * AI Costs React Hooks
 * OPS-244: Cost Breakdown & Charts Page
 *
 * Hooks for fetching AI usage costs by feature and by user.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_AI_COSTS_BY_FEATURE = gql`
  query GetAICostsByFeature($dateRange: AIDateRangeInput!) {
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

const GET_AI_COSTS_BY_USER = gql`
  query GetAICostsByUser($dateRange: AIDateRangeInput!) {
    aiCostsByUser(dateRange: $dateRange) {
      userId
      userName
      cost
      tokens
      calls
    }
  }
`;

const GET_AI_USAGE_OVERVIEW = gql`
  query GetAIUsageOverview($dateRange: AIDateRangeInput) {
    aiUsageOverview(dateRange: $dateRange) {
      totalCost
      totalTokens
      totalCalls
      successRate
      projectedMonthEnd
      budgetLimit
      budgetUsedPercent
    }
  }
`;

const GET_AI_DAILY_COSTS = gql`
  query GetAIDailyCosts($dateRange: AIDateRangeInput!) {
    aiDailyCosts(dateRange: $dateRange) {
      date
      cost
      tokens
      calls
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface AIFeatureCost {
  feature: string;
  featureName: string;
  cost: number;
  tokens: number;
  calls: number;
  percentOfTotal: number;
}

export interface AIUserCost {
  userId: string;
  userName: string;
  cost: number;
  tokens: number;
  calls: number;
}

export interface AIUsageOverview {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  successRate: number;
  projectedMonthEnd: number;
  budgetLimit: number | null;
  budgetUsedPercent: number | null;
}

export interface AIDailyCost {
  date: string;
  cost: number;
  tokens: number;
  calls: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch AI costs broken down by feature
 */
export function useAICostsByFeature(dateRange: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiCostsByFeature: AIFeatureCost[];
  }>(GET_AI_COSTS_BY_FEATURE, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    featureCosts: data?.aiCostsByFeature ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch AI costs broken down by user
 */
export function useAICostsByUser(dateRange: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiCostsByUser: AIUserCost[];
  }>(GET_AI_COSTS_BY_USER, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    userCosts: data?.aiCostsByUser ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch AI usage overview (totals, projections, budget)
 */
export function useAIUsageOverview(dateRange?: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiUsageOverview: AIUsageOverview;
  }>(GET_AI_USAGE_OVERVIEW, {
    variables: dateRange
      ? {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
          },
        }
      : {},
    fetchPolicy: 'cache-and-network',
  });

  return {
    overview: data?.aiUsageOverview ?? null,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch daily cost breakdown for charts
 */
export function useAIDailyCosts(dateRange: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiDailyCosts: AIDailyCost[];
  }>(GET_AI_DAILY_COSTS, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    dailyCosts: data?.aiDailyCosts ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Combined hook for the complete AI costs page
 */
export function useAICosts(dateRange: DateRange) {
  const {
    featureCosts,
    loading: featureLoading,
    error: featureError,
  } = useAICostsByFeature(dateRange);

  const { userCosts, loading: userLoading, error: userError } = useAICostsByUser(dateRange);

  const {
    overview,
    loading: overviewLoading,
    error: overviewError,
  } = useAIUsageOverview(dateRange);

  const { dailyCosts, loading: dailyLoading, error: dailyError } = useAIDailyCosts(dateRange);

  return {
    featureCosts,
    userCosts,
    overview,
    dailyCosts,
    loading: featureLoading || userLoading || overviewLoading || dailyLoading,
    error: featureError || userError || overviewError || dailyError,
  };
}
