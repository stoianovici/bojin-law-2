/**
 * useDocumentIntelligence Hooks
 * Story 3.7: AI Document Intelligence Dashboard - Task 12
 *
 * React Query hooks for fetching document intelligence analytics.
 * Uses Apollo Client for GraphQL queries with 5-minute stale time.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type {
  DocumentIntelligenceDashboard,
  DocumentVelocityStats,
  AIUtilizationStats,
  ErrorDetectionStats,
  TimeSavingsStats,
  TemplateUsageStats,
  DocumentQualityTrends,
} from '@legal-platform/types';

// ============================================================================
// Filter Types
// ============================================================================

export interface DocumentIntelligenceFiltersInput {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  userIds?: string[];
  documentTypes?: string[];
  compareWithPrevious?: boolean;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

export const DOCUMENT_INTELLIGENCE_DASHBOARD_QUERY = gql`
  query DocumentIntelligenceDashboard($filters: DocumentIntelligenceFilters!) {
    documentIntelligenceDashboard(filters: $filters) {
      dateRange {
        startDate
        endDate
      }
      velocity {
        byUser {
          userId
          userName
          userRole
          documentCount
          averagePerWeek
          trend
        }
        byType {
          documentType
          documentCount
          averageCreationTimeMinutes
          trend
        }
        totalDocuments
        averagePerDay
        trendPercentage
      }
      aiUtilization {
        overallUtilizationRate
        byUser {
          userId
          userName
          utilizationRate
          aiDocumentCount
          totalDocumentCount
          lastAIUsage
        }
        adoptionTrend {
          date
          utilizationRate
          documentCount
        }
        totalAIAssistedDocuments
        totalManualDocuments
      }
      errorDetection {
        totalConcernsDetected
        concernsResolvedBeforeFiling
        detectionRate
        bySeverity {
          severity
          count
          percentage
        }
        byType {
          concernType
          count
          percentage
        }
        trendData {
          date
          detected
          resolved
        }
      }
      timeSavings {
        totalMinutesSaved
        averageMinutesSavedPerDocument
        estimatedCostSavings
        byUser {
          userId
          userName
          minutesSaved
          documentsCreated
          averageSavedPerDocument
        }
        byDocumentType {
          documentType
          averageManualTimeMinutes
          averageAIAssistedTimeMinutes
          timeSavedPercentage
          sampleSize
        }
        methodology
      }
      templateUsage {
        topTemplates {
          templateId
          templateName
          category
          usageCount
          lastUsed
          averageQualityScore
        }
        topClauses {
          clauseId
          clauseText
          category
          frequency
          insertionRate
        }
        totalTemplateUsage
        templateAdoptionRate
      }
      qualityTrends {
        overallQualityScore
        averageRevisionCount
        qualityTrend {
          date
          averageEditPercentage
          documentCount
          qualityScore
        }
        byDocumentType {
          documentType
          averageEditPercentage
          averageRevisionCount
          documentCount
          qualityScore
        }
        qualityThreshold
      }
      lastUpdated
    }
  }
`;

export const DOCUMENT_VELOCITY_STATS_QUERY = gql`
  query DocumentVelocityStats($filters: DocumentIntelligenceFilters!) {
    documentVelocityStats(filters: $filters) {
      byUser {
        userId
        userName
        userRole
        documentCount
        averagePerWeek
        trend
      }
      byType {
        documentType
        documentCount
        averageCreationTimeMinutes
        trend
      }
      totalDocuments
      averagePerDay
      trendPercentage
    }
  }
`;

export const AI_UTILIZATION_STATS_QUERY = gql`
  query AIUtilizationStats($filters: DocumentIntelligenceFilters!) {
    aiUtilizationStats(filters: $filters) {
      overallUtilizationRate
      byUser {
        userId
        userName
        utilizationRate
        aiDocumentCount
        totalDocumentCount
        lastAIUsage
      }
      adoptionTrend {
        date
        utilizationRate
        documentCount
      }
      totalAIAssistedDocuments
      totalManualDocuments
    }
  }
`;

export const ERROR_DETECTION_STATS_QUERY = gql`
  query ErrorDetectionStats($filters: DocumentIntelligenceFilters!) {
    errorDetectionStats(filters: $filters) {
      totalConcernsDetected
      concernsResolvedBeforeFiling
      detectionRate
      bySeverity {
        severity
        count
        percentage
      }
      byType {
        concernType
        count
        percentage
      }
      trendData {
        date
        detected
        resolved
      }
    }
  }
`;

export const TIME_SAVINGS_STATS_QUERY = gql`
  query TimeSavingsStats($filters: DocumentIntelligenceFilters!) {
    timeSavingsStats(filters: $filters) {
      totalMinutesSaved
      averageMinutesSavedPerDocument
      estimatedCostSavings
      byUser {
        userId
        userName
        minutesSaved
        documentsCreated
        averageSavedPerDocument
      }
      byDocumentType {
        documentType
        averageManualTimeMinutes
        averageAIAssistedTimeMinutes
        timeSavedPercentage
        sampleSize
      }
      methodology
    }
  }
`;

export const TEMPLATE_USAGE_STATS_QUERY = gql`
  query TemplateUsageStats($filters: DocumentIntelligenceFilters!) {
    templateUsageStats(filters: $filters) {
      topTemplates {
        templateId
        templateName
        category
        usageCount
        lastUsed
        averageQualityScore
      }
      topClauses {
        clauseId
        clauseText
        category
        frequency
        insertionRate
      }
      totalTemplateUsage
      templateAdoptionRate
    }
  }
`;

export const DOCUMENT_QUALITY_TRENDS_QUERY = gql`
  query DocumentQualityTrends($filters: DocumentIntelligenceFilters!) {
    documentQualityTrends(filters: $filters) {
      overallQualityScore
      averageRevisionCount
      qualityTrend {
        date
        averageEditPercentage
        documentCount
        qualityScore
      }
      byDocumentType {
        documentType
        averageEditPercentage
        averageRevisionCount
        documentCount
        qualityScore
      }
      qualityThreshold
    }
  }
`;

// ============================================================================
// Hook Options
// ============================================================================

export interface UseDocumentIntelligenceOptions {
  filters: DocumentIntelligenceFiltersInput;
  skip?: boolean;
  pollInterval?: number;
}

// ============================================================================
// Helper to format filters for GraphQL
// ============================================================================

function formatFiltersForGraphQL(filters: DocumentIntelligenceFiltersInput) {
  return {
    dateRange: {
      startDate: filters.dateRange.startDate.toISOString(),
      endDate: filters.dateRange.endDate.toISOString(),
    },
    userIds: filters.userIds,
    documentTypes: filters.documentTypes,
    compareWithPrevious: filters.compareWithPrevious ?? true,
  };
}

// ============================================================================
// Main Dashboard Hook
// ============================================================================

/**
 * Hook to fetch complete document intelligence dashboard data
 *
 * Returns all metrics in a single call:
 * - Document velocity by user and type
 * - AI utilization rates and adoption trends
 * - Error detection statistics
 * - Time savings calculations
 * - Template and clause usage
 * - Document quality trends
 *
 * @param options - Hook options including filters
 * @returns Dashboard data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { data, isLoading, error, refetch } = useDocumentIntelligenceDashboard({
 *     filters: {
 *       dateRange: { startDate: new Date('2025-01-01'), endDate: new Date() },
 *     },
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error onRetry={refetch} />;
 *   return <DashboardWidgets data={data} />;
 * }
 * ```
 */
export function useDocumentIntelligenceDashboard(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    documentIntelligenceDashboard: DocumentIntelligenceDashboard;
  }>(DOCUMENT_INTELLIGENCE_DASHBOARD_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
    // 5 minutes stale time
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.documentIntelligenceDashboard ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

// ============================================================================
// Individual Metric Hooks
// ============================================================================

/**
 * Hook to fetch document velocity statistics
 */
export function useDocumentVelocity(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    documentVelocityStats: DocumentVelocityStats;
  }>(DOCUMENT_VELOCITY_STATS_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.documentVelocityStats ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Hook to fetch AI utilization statistics
 */
export function useAIUtilization(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    aiUtilizationStats: AIUtilizationStats;
  }>(AI_UTILIZATION_STATS_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.aiUtilizationStats ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Hook to fetch error detection statistics
 */
export function useErrorDetection(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    errorDetectionStats: ErrorDetectionStats;
  }>(ERROR_DETECTION_STATS_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.errorDetectionStats ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Hook to fetch time savings statistics
 */
export function useTimeSavings(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    timeSavingsStats: TimeSavingsStats;
  }>(TIME_SAVINGS_STATS_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.timeSavingsStats ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Hook to fetch template usage statistics
 */
export function useTemplateUsage(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    templateUsageStats: TemplateUsageStats;
  }>(TEMPLATE_USAGE_STATS_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.templateUsageStats ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

/**
 * Hook to fetch document quality trends
 */
export function useQualityTrends(options: UseDocumentIntelligenceOptions) {
  const { filters, skip = false, pollInterval } = options;

  const { data, loading, error, refetch } = useQuery<{
    documentQualityTrends: DocumentQualityTrends;
  }>(DOCUMENT_QUALITY_TRENDS_QUERY, {
    variables: { filters: formatFiltersForGraphQL(filters) },
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  return {
    data: data?.documentQualityTrends ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

export default useDocumentIntelligenceDashboard;
