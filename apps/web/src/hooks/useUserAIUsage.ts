/**
 * User AI Usage React Hooks
 * OPS-247: Per-User AI Usage Dashboard
 *
 * Hooks for fetching AI usage data for a specific user.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { AIFeatureCost, AIDailyCost, DateRange } from './useAICosts';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_AI_USER_USAGE = gql`
  query GetAIUserUsage($userId: ID!, $dateRange: AIDateRangeInput!) {
    aiUserUsage(userId: $userId, dateRange: $dateRange) {
      userId
      userName
      userEmail
      totalCost
      totalTokens
      totalCalls
      dailyCosts {
        date
        cost
        tokens
        calls
      }
      costsByFeature {
        feature
        featureName
        cost
        tokens
        calls
        percentOfTotal
      }
    }
  }
`;

const GET_AI_USER_ACTIVITY = gql`
  query GetAIUserActivity($userId: ID!, $limit: Int, $offset: Int) {
    aiUserActivity(userId: $userId, limit: $limit, offset: $offset) {
      id
      feature
      featureName
      inputTokens
      outputTokens
      costEur
      durationMs
      createdAt
      entityType
      entityId
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface AIUserUsage {
  userId: string;
  userName: string;
  userEmail: string | null;
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  dailyCosts: AIDailyCost[];
  costsByFeature: AIFeatureCost[];
}

export interface AIUsageLogEntry {
  id: string;
  feature: string;
  featureName: string;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  durationMs: number;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch detailed AI usage for a specific user
 */
export function useAIUserUsage(userId: string, dateRange: DateRange) {
  const { data, loading, error, refetch } = useQuery<{
    aiUserUsage: AIUserUsage | null;
  }>(GET_AI_USER_USAGE, {
    variables: {
      userId,
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
    skip: !userId,
  });

  return {
    userUsage: data?.aiUserUsage ?? null,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch activity log for a specific user
 */
export function useAIUserActivity(userId: string, limit: number = 50, offset: number = 0) {
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    aiUserActivity: AIUsageLogEntry[];
  }>(GET_AI_USER_ACTIVITY, {
    variables: {
      userId,
      limit,
      offset,
    },
    fetchPolicy: 'cache-and-network',
    skip: !userId,
  });

  const loadMore = () => {
    fetchMore({
      variables: {
        offset: data?.aiUserActivity?.length ?? 0,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          aiUserActivity: [...prev.aiUserActivity, ...fetchMoreResult.aiUserActivity],
        };
      },
    });
  };

  return {
    activity: data?.aiUserActivity ?? [],
    loading,
    error,
    refetch,
    loadMore,
    hasMore: (data?.aiUserActivity?.length ?? 0) >= limit,
  };
}

/**
 * Combined hook for user AI usage page
 */
export function useUserAIUsagePage(userId: string, dateRange: DateRange) {
  const { userUsage, loading: usageLoading, error: usageError } = useAIUserUsage(userId, dateRange);

  const {
    activity,
    loading: activityLoading,
    error: activityError,
    loadMore,
    hasMore,
  } = useAIUserActivity(userId);

  return {
    userUsage,
    activity,
    loading: usageLoading || activityLoading,
    error: usageError || activityError,
    loadMore,
    hasMore,
  };
}
