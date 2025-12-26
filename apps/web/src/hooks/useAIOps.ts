/**
 * useAIOps Hook
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Provides GraphQL queries for AI operations dashboard data.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';

// ============================================================================
// GraphQL Queries
// ============================================================================

const AI_USAGE_OVERVIEW_QUERY = gql`
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

const AI_DAILY_COSTS_QUERY = gql`
  query GetAIDailyCosts($dateRange: AIDateRangeInput!) {
    aiDailyCosts(dateRange: $dateRange) {
      date
      cost
      tokens
      calls
    }
  }
`;

const AI_FEATURES_QUERY = gql`
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
      lastRunAt
      lastRunStatus
      dailyCostEstimate
    }
  }
`;

const AI_COSTS_BY_FEATURE_QUERY = gql`
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

const AI_BATCH_JOBS_QUERY = gql`
  query GetAIBatchJobs($feature: String, $status: AIBatchJobStatus, $limit: Int, $offset: Int) {
    aiBatchJobs(feature: $feature, status: $status, limit: $limit, offset: $offset) {
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
// Types
// ============================================================================

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

export interface AIFeatureConfig {
  id: string;
  feature: string;
  featureName: string;
  featureType: 'request' | 'batch';
  enabled: boolean;
  monthlyBudgetEur: number | null;
  dailyLimitEur: number | null;
  schedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  dailyCostEstimate: number;
}

export interface AIFeatureCost {
  feature: string;
  featureName: string;
  cost: number;
  tokens: number;
  calls: number;
  percentOfTotal: number;
}

export interface AIBatchJobRun {
  id: string;
  feature: string;
  featureName: string;
  status: 'running' | 'completed' | 'partial' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  totalTokens: number;
  totalCostEur: number;
  errorMessage: string | null;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get date range for the current month
 */
export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get date range for last N days
 */
export function getLastNDaysRange(days: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/**
 * Format date range for GraphQL input
 */
function formatDateRange(range: DateRange | undefined) {
  if (!range) return undefined;
  return {
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch AI usage overview statistics
 */
export function useAIUsageOverview(dateRange?: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiUsageOverview: AIUsageOverview;
  }>(AI_USAGE_OVERVIEW_QUERY, {
    variables: {
      dateRange: formatDateRange(dateRange),
    },
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
 * Hook to fetch daily cost breakdown for charting
 */
export function useAIDailyCosts(dateRange: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiDailyCosts: AIDailyCost[];
  }>(AI_DAILY_COSTS_QUERY, {
    variables: {
      dateRange: formatDateRange(dateRange),
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
 * Hook to fetch AI feature configurations
 */
export function useAIFeatures() {
  const { data, loading, error, refetch } = useQuery<{
    aiFeatures: AIFeatureConfig[];
  }>(AI_FEATURES_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  // Separate request and batch features
  const features = useMemo(() => {
    const all = data?.aiFeatures ?? [];
    return {
      all,
      request: all.filter((f: AIFeatureConfig) => f.featureType === 'request'),
      batch: all.filter((f: AIFeatureConfig) => f.featureType === 'batch'),
    };
  }, [data]);

  return {
    features,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch cost breakdown by feature
 */
export function useAICostsByFeature(dateRange: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiCostsByFeature: AIFeatureCost[];
  }>(AI_COSTS_BY_FEATURE_QUERY, {
    variables: {
      dateRange: formatDateRange(dateRange),
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    costsByFeature: data?.aiCostsByFeature ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch batch job history
 */
export function useAIBatchJobs(options?: {
  feature?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { data, loading, error, refetch } = useQuery<{
    aiBatchJobs: AIBatchJobRun[];
  }>(AI_BATCH_JOBS_QUERY, {
    variables: {
      feature: options?.feature,
      status: options?.status,
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0,
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    jobs: data?.aiBatchJobs ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Combined hook for the overview dashboard
 * Fetches all data needed for the main AI Ops overview page
 */
export function useAIOpsOverview() {
  const currentMonth = useMemo(() => getCurrentMonthRange(), []);
  const last30Days = useMemo(() => getLastNDaysRange(30), []);

  const { overview, loading: overviewLoading, error: overviewError } = useAIUsageOverview();
  const { dailyCosts, loading: costsLoading, error: costsError } = useAIDailyCosts(last30Days);
  const { features, loading: featuresLoading, error: featuresError } = useAIFeatures();
  const { jobs, loading: jobsLoading, error: jobsError } = useAIBatchJobs({ limit: 5 });

  const loading = overviewLoading || costsLoading || featuresLoading || jobsLoading;
  const error = overviewError || costsError || featuresError || jobsError;

  return {
    overview,
    dailyCosts,
    features,
    recentJobs: jobs,
    loading,
    error,
    currentMonth,
  };
}
