/**
 * Task Analytics Hooks
 * Story 4.7: Task Analytics and Optimization - Task 29
 *
 * React Query / Apollo Client hooks for fetching task analytics data.
 * Provides hooks for completion time, overdue, velocity, patterns, delegation, and ROI.
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import type {
  CompletionTimeAnalyticsResponse,
  OverdueAnalyticsResponse,
  VelocityTrendsResponse,
  PatternDetectionResponse,
  TaskCoOccurrencePattern,
  DelegationAnalyticsResponse,
  DelegationPatternUser,
  ROIDashboardResponse,
  VelocityInterval,
} from '@legal-platform/types';

// ============================================================================
// Filter Types
// ============================================================================

export interface TaskAnalyticsFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  taskTypes?: string[];
  userIds?: string[];
  caseIds?: string[];
  limit?: number;
  offset?: number;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const TASK_COMPLETION_ANALYTICS_QUERY = gql`
  query TaskCompletionAnalytics($filters: AnalyticsFiltersInput!) {
    taskCompletionAnalytics(filters: $filters) {
      firmMetrics {
        avgCompletionTimeHours
        medianCompletionTimeHours
        minCompletionTimeHours
        maxCompletionTimeHours
        totalTasksAnalyzed
      }
      byType {
        taskType
        metrics {
          avgCompletionTimeHours
          medianCompletionTimeHours
          minCompletionTimeHours
          maxCompletionTimeHours
          totalTasksAnalyzed
        }
        comparedToPrevious
      }
      byUser {
        userId
        userName
        metrics {
          avgCompletionTimeHours
          medianCompletionTimeHours
          minCompletionTimeHours
          maxCompletionTimeHours
          totalTasksAnalyzed
        }
        taskCount
        comparedToTeamAvg
      }
      dateRange {
        start
        end
      }
    }
  }
`;

const OVERDUE_ANALYTICS_QUERY = gql`
  query OverdueAnalytics($filters: AnalyticsFiltersInput!) {
    overdueAnalytics(filters: $filters) {
      totalOverdue
      overdueByType {
        taskType
        count
        avgDaysOverdue
      }
      overdueByUser {
        userId
        userName
        count
      }
      bottleneckPatterns {
        patternType
        description
        affectedTasks
        suggestedAction
        relatedUsers
        relatedTaskTypes
      }
      criticalTasks {
        taskId
        taskTitle
        taskType
        assigneeId
        assigneeName
        caseId
        caseTitle
        dueDate
        daysOverdue
        blockedBy
        estimatedImpact
      }
    }
  }
`;

const VELOCITY_TRENDS_QUERY = gql`
  query VelocityTrends($filters: AnalyticsFiltersInput!, $interval: VelocityInterval!) {
    velocityTrends(filters: $filters, interval: $interval) {
      firmVelocity {
        current
        previous
        trend
        percentageChange
      }
      timeSeries {
        date
        tasksCreated
        tasksCompleted
        velocityScore
        trend
      }
      byUser {
        userId
        userName
        currentVelocity
        previousVelocity
        trendDirection
        percentageChange
      }
      interval
    }
  }
`;

const TASK_PATTERNS_QUERY = gql`
  query TaskPatterns {
    taskPatterns {
      patterns {
        id
        taskTypes
        caseTypes
        occurrenceCount
        confidence
        suggestedTemplateName
        avgSequenceGapDays
        commonAssignees {
          userId
          userName
          frequency
        }
        sampleCases {
          caseId
          caseTitle
        }
        isTemplateCreated
      }
      analysisDate
      totalPatternsFound
      highConfidenceCount
    }
  }
`;

const TASK_PATTERN_QUERY = gql`
  query TaskPattern($patternId: ID!) {
    taskPattern(patternId: $patternId) {
      id
      taskTypes
      caseTypes
      occurrenceCount
      confidence
      suggestedTemplateName
      avgSequenceGapDays
      commonAssignees {
        userId
        userName
        frequency
      }
      sampleCases {
        caseId
        caseTitle
      }
      isTemplateCreated
    }
  }
`;

const DELEGATION_ANALYTICS_QUERY = gql`
  query DelegationAnalytics($filters: AnalyticsFiltersInput!) {
    delegationAnalytics(filters: $filters) {
      byUser {
        userId
        userName
        role
        delegationsReceived
        delegationsGiven
        successRate
        avgCompletionDays
        strengthAreas
        struggleAreas
        suggestedTraining {
          skillArea
          reason
          priority
          suggestedAction
        }
      }
      topDelegationFlows {
        fromUserId
        fromUserName
        toUserId
        toUserName
        count
        avgSuccessRate
      }
      firmWideSuccessRate
      trainingOpportunities {
        userId
        userName
        suggestions {
          skillArea
          reason
          priority
          suggestedAction
        }
      }
    }
  }
`;

const USER_DELEGATION_PATTERN_QUERY = gql`
  query UserDelegationPattern($userId: ID!, $filters: AnalyticsFiltersInput!) {
    userDelegationPattern(userId: $userId, filters: $filters) {
      userId
      userName
      role
      delegationsReceived
      delegationsGiven
      successRate
      avgCompletionDays
      strengthAreas
      struggleAreas
      suggestedTraining {
        skillArea
        reason
        priority
        suggestedAction
      }
    }
  }
`;

const ROI_DASHBOARD_QUERY = gql`
  query ROIDashboard($filters: AnalyticsFiltersInput!) {
    roiDashboard(filters: $filters) {
      currentPeriod {
        templateTasksCreated
        manualTasksCreated
        templateAdoptionRate
        estimatedTemplateTimeSavedHours
        nlpTasksCreated
        estimatedNLPTimeSavedHours
        autoRemindersSet
        autoDependencyTriggers
        autoReassignments
        estimatedAutomationTimeSavedHours
        totalTimeSavedHours
        avgHourlyRate
        totalValueSaved
        comparisonPeriod {
          start
          end
        }
        previousPeriodSavings
        savingsGrowthPercent
      }
      timeSeries {
        date
        timeSavedHours
        valueSaved
      }
      projectedAnnualSavings
      topSavingsCategories {
        category
        hoursSaved
        valueSaved
        percentageOfTotal
      }
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CREATE_TEMPLATE_FROM_PATTERN_MUTATION = gql`
  mutation CreateTemplateFromPattern($input: CreateTemplateFromPatternInput!) {
    createTemplateFromPattern(input: $input) {
      id
      name
    }
  }
`;

const DISMISS_PATTERN_MUTATION = gql`
  mutation DismissPattern($patternId: ID!) {
    dismissPattern(patternId: $patternId)
  }
`;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for task completion time analytics
 * AC: 1 - Average task completion time by type and user
 */
export function useTaskCompletionAnalytics(filters: TaskAnalyticsFilters) {
  const { data, loading, error, refetch } = useQuery<{
    taskCompletionAnalytics: CompletionTimeAnalyticsResponse;
  }>(TASK_COMPLETION_ANALYTICS_QUERY, {
    variables: {
      filters: {
        dateRange: {
          start: filters.dateRange.start.toISOString(),
          end: filters.dateRange.end.toISOString(),
        },
        taskTypes: filters.taskTypes,
        userIds: filters.userIds,
        caseIds: filters.caseIds,
        limit: filters.limit,
        offset: filters.offset,
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.taskCompletionAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for overdue task analytics
 * AC: 2 - Overdue analysis identifies bottleneck patterns
 */
export function useOverdueAnalytics(filters: TaskAnalyticsFilters) {
  const { data, loading, error, refetch } = useQuery<{
    overdueAnalytics: OverdueAnalyticsResponse;
  }>(OVERDUE_ANALYTICS_QUERY, {
    variables: {
      filters: {
        dateRange: {
          start: filters.dateRange.start.toISOString(),
          end: filters.dateRange.end.toISOString(),
        },
        taskTypes: filters.taskTypes,
        userIds: filters.userIds,
        caseIds: filters.caseIds,
        limit: filters.limit,
        offset: filters.offset,
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.overdueAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for velocity trends
 * AC: 3 - Velocity trends track productivity
 */
export function useVelocityTrends(
  filters: TaskAnalyticsFilters,
  interval: VelocityInterval = 'weekly'
) {
  const { data, loading, error, refetch } = useQuery<{
    velocityTrends: VelocityTrendsResponse;
  }>(VELOCITY_TRENDS_QUERY, {
    variables: {
      filters: {
        dateRange: {
          start: filters.dateRange.start.toISOString(),
          end: filters.dateRange.end.toISOString(),
        },
        taskTypes: filters.taskTypes,
        userIds: filters.userIds,
        caseIds: filters.caseIds,
        limit: filters.limit,
        offset: filters.offset,
      },
      interval: interval.toUpperCase(),
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.velocityTrends,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for task pattern detection
 * AC: 4 - AI identifies frequently co-occurring tasks
 */
export function useTaskPatterns() {
  const { data, loading, error, refetch } = useQuery<{
    taskPatterns: PatternDetectionResponse;
  }>(TASK_PATTERNS_QUERY, {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.taskPatterns,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for single task pattern
 */
export function useTaskPattern(patternId: string) {
  const { data, loading, error } = useQuery<{
    taskPattern: TaskCoOccurrencePattern | null;
  }>(TASK_PATTERN_QUERY, {
    variables: { patternId },
    skip: !patternId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.taskPattern,
    loading,
    error,
  };
}

/**
 * Hook for delegation analytics
 * AC: 5 - Delegation patterns reveal training opportunities
 */
export function useDelegationAnalytics(filters: TaskAnalyticsFilters) {
  const { data, loading, error, refetch } = useQuery<{
    delegationAnalytics: DelegationAnalyticsResponse;
  }>(DELEGATION_ANALYTICS_QUERY, {
    variables: {
      filters: {
        dateRange: {
          start: filters.dateRange.start.toISOString(),
          end: filters.dateRange.end.toISOString(),
        },
        taskTypes: filters.taskTypes,
        userIds: filters.userIds,
        caseIds: filters.caseIds,
        limit: filters.limit,
        offset: filters.offset,
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.delegationAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for user-specific delegation pattern
 */
export function useUserDelegationPattern(userId: string, filters: TaskAnalyticsFilters) {
  const { data, loading, error } = useQuery<{
    userDelegationPattern: DelegationPatternUser | null;
  }>(USER_DELEGATION_PATTERN_QUERY, {
    variables: {
      userId,
      filters: {
        dateRange: {
          start: filters.dateRange.start.toISOString(),
          end: filters.dateRange.end.toISOString(),
        },
        taskTypes: filters.taskTypes,
        userIds: filters.userIds,
        caseIds: filters.caseIds,
      },
    },
    skip: !userId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.userDelegationPattern,
    loading,
    error,
  };
}

/**
 * Hook for ROI dashboard
 * AC: 6 - ROI dashboard shows automation time savings
 */
export function useROIDashboard(filters: TaskAnalyticsFilters) {
  const { data, loading, error, refetch } = useQuery<{
    roiDashboard: ROIDashboardResponse;
  }>(ROI_DASHBOARD_QUERY, {
    variables: {
      filters: {
        dateRange: {
          start: filters.dateRange.start.toISOString(),
          end: filters.dateRange.end.toISOString(),
        },
        taskTypes: filters.taskTypes,
        userIds: filters.userIds,
        caseIds: filters.caseIds,
        limit: filters.limit,
        offset: filters.offset,
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.roiDashboard,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating template from detected pattern
 */
export function useCreateTemplateFromPattern() {
  const [createTemplate, { data, loading, error }] = useMutation(
    CREATE_TEMPLATE_FROM_PATTERN_MUTATION,
    {
      refetchQueries: ['TaskPatterns'],
    }
  );

  return {
    createTemplate: (input: { patternId: string; templateName: string; description?: string }) =>
      createTemplate({ variables: { input } }),
    data,
    loading,
    error,
  };
}

/**
 * Hook for dismissing a pattern
 */
export function useDismissPattern() {
  const [dismissPattern, { loading, error }] = useMutation(DISMISS_PATTERN_MUTATION, {
    refetchQueries: ['TaskPatterns'],
  });

  return {
    dismissPattern: (patternId: string) => dismissPattern({ variables: { patternId } }),
    loading,
    error,
  };
}
