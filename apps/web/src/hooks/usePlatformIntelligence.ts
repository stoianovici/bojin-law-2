/**
 * Platform Intelligence Hooks
 * Story 5.7: Platform Intelligence Dashboard - Task 8
 *
 * React Query / Apollo Client hooks for fetching platform intelligence data.
 * Provides hooks for dashboard, communication analytics, document quality,
 * AI utilization, export, and refresh functionality.
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import type {
  PlatformIntelligenceDashboard,
  CommunicationAnalytics,
  DocumentQualityAnalytics,
  AIUtilizationSummary,
  AIUtilizationByUser,
  ExportResult,
  ExportFormat,
  ExportSection,
} from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface DateRangeInput {
  start: Date;
  end: Date;
}

export interface ExportSectionsInput {
  efficiency?: boolean;
  communication?: boolean;
  quality?: boolean;
  tasks?: boolean;
  ai?: boolean;
  roi?: boolean;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const PLATFORM_INTELLIGENCE_DASHBOARD_QUERY = gql`
  query PlatformIntelligenceDashboard($dateRange: DateRangeInput!) {
    platformIntelligenceDashboard(dateRange: $dateRange) {
      dateRange {
        startDate
        endDate
      }
      firmId
      generatedAt
      efficiency {
        totalTimeSavedHours
        aiAssistedActions
        automationTriggers
        manualVsAutomatedRatio
      }
      communication {
        currentResponseTime {
          avgResponseTimeHours
          medianResponseTimeHours
          p90ResponseTimeHours
          totalEmailsAnalyzed
          withinSLAPercent
        }
        baselineComparison {
          currentPeriod {
            avgResponseTimeHours
            medianResponseTimeHours
            p90ResponseTimeHours
            totalEmailsAnalyzed
            withinSLAPercent
          }
          baselinePeriod {
            avgResponseTimeHours
            medianResponseTimeHours
            p90ResponseTimeHours
            totalEmailsAnalyzed
            withinSLAPercent
          }
          improvementPercent
        }
        byRecipientType {
          emailType
          metrics {
            avgResponseTimeHours
            medianResponseTimeHours
            p90ResponseTimeHours
            totalEmailsAnalyzed
            withinSLAPercent
          }
          volumeCount
        }
        trend {
          date
          avgResponseTimeHours
          volumeCount
        }
      }
      documentQuality {
        revisionMetrics {
          totalDocumentsCreated
          avgRevisionsPerDocument
          documentsWithZeroRevisions
          documentsWithMultipleRevisions
          firstTimeRightPercent
        }
        errorMetrics {
          totalReviewsCompleted
          reviewsWithIssues
          issuesByCategory
          avgIssuesPerReview
          issueResolutionTimeHours
        }
        qualityTrend {
          date
          firstTimeRightPercent
          avgRevisions
          issueCount
        }
      }
      taskCompletion {
        completionRate
        deadlineAdherence
        avgCompletionTimeHours
        overdueCount
        trend {
          date
          completionRate
          deadlineAdherence
          tasksCompleted
        }
      }
      aiUtilization {
        firmTotal {
          totalRequests
          totalTokens
          totalCostCents
          avgRequestsPerUser
        }
        byUser {
          userId
          userName
          totalRequests
          totalTokens
          totalCostCents
          byFeature {
            feature
            requestCount
            tokenCount
            avgLatencyMs
            acceptanceRate
          }
          adoptionScore
        }
        byFeature {
          feature
          requestCount
          tokenCount
          avgLatencyMs
          acceptanceRate
        }
        topUsers {
          userId
          userName
          totalRequests
          adoptionScore
        }
        underutilizedUsers {
          userId
          userName
          totalRequests
          adoptionScore
        }
      }
      roi {
        totalValueSaved
        billableHoursRecovered
        projectedAnnualSavings
        savingsByCategory {
          category
          hoursSaved
          valueInCurrency
          percentOfTotal
        }
      }
      platformHealthScore
      recommendations {
        category
        priority
        message
        actionableSteps
      }
    }
  }
`;

const COMMUNICATION_ANALYTICS_QUERY = gql`
  query CommunicationAnalytics($dateRange: DateRangeInput!) {
    communicationAnalytics(dateRange: $dateRange) {
      currentResponseTime {
        avgResponseTimeHours
        medianResponseTimeHours
        p90ResponseTimeHours
        totalEmailsAnalyzed
        withinSLAPercent
      }
      baselineComparison {
        currentPeriod {
          avgResponseTimeHours
          medianResponseTimeHours
          p90ResponseTimeHours
          totalEmailsAnalyzed
          withinSLAPercent
        }
        baselinePeriod {
          avgResponseTimeHours
          medianResponseTimeHours
          p90ResponseTimeHours
          totalEmailsAnalyzed
          withinSLAPercent
        }
        improvementPercent
      }
      byRecipientType {
        emailType
        metrics {
          avgResponseTimeHours
          medianResponseTimeHours
          p90ResponseTimeHours
          totalEmailsAnalyzed
          withinSLAPercent
        }
        volumeCount
      }
      trend {
        date
        avgResponseTimeHours
        volumeCount
      }
    }
  }
`;

const DOCUMENT_QUALITY_ANALYTICS_QUERY = gql`
  query DocumentQualityAnalytics($dateRange: DateRangeInput!) {
    documentQualityAnalytics(dateRange: $dateRange) {
      revisionMetrics {
        totalDocumentsCreated
        avgRevisionsPerDocument
        documentsWithZeroRevisions
        documentsWithMultipleRevisions
        firstTimeRightPercent
      }
      errorMetrics {
        totalReviewsCompleted
        reviewsWithIssues
        issuesByCategory
        avgIssuesPerReview
        issueResolutionTimeHours
      }
      qualityTrend {
        date
        firstTimeRightPercent
        avgRevisions
        issueCount
      }
    }
  }
`;

const AI_UTILIZATION_ANALYTICS_QUERY = gql`
  query AIUtilizationAnalytics($dateRange: DateRangeInput!) {
    aiUtilizationAnalytics(dateRange: $dateRange) {
      firmTotal {
        totalRequests
        totalTokens
        totalCostCents
        avgRequestsPerUser
      }
      byUser {
        userId
        userName
        totalRequests
        totalTokens
        totalCostCents
        byFeature {
          feature
          requestCount
          tokenCount
          avgLatencyMs
          acceptanceRate
        }
        adoptionScore
      }
      byFeature {
        feature
        requestCount
        tokenCount
        avgLatencyMs
        acceptanceRate
      }
      topUsers {
        userId
        userName
        totalRequests
        adoptionScore
      }
      underutilizedUsers {
        userId
        userName
        totalRequests
        adoptionScore
      }
    }
  }
`;

const USER_AI_UTILIZATION_QUERY = gql`
  query UserAIUtilization($userId: ID!, $dateRange: DateRangeInput!) {
    userAIUtilization(userId: $userId, dateRange: $dateRange) {
      userId
      userName
      totalRequests
      totalTokens
      totalCostCents
      byFeature {
        feature
        requestCount
        tokenCount
        avgLatencyMs
        acceptanceRate
      }
      adoptionScore
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const EXPORT_PLATFORM_INTELLIGENCE_MUTATION = gql`
  mutation ExportPlatformIntelligence(
    $dateRange: DateRangeInput!
    $format: ExportFormat!
    $sections: ExportSectionsInput
  ) {
    exportPlatformIntelligence(dateRange: $dateRange, format: $format, sections: $sections) {
      url
      expiresAt
      format
    }
  }
`;

const REFRESH_PLATFORM_INTELLIGENCE_MUTATION = gql`
  mutation RefreshPlatformIntelligence {
    refreshPlatformIntelligence
  }
`;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for full platform intelligence dashboard
 * AC: 1-6 - All acceptance criteria
 */
export function usePlatformIntelligenceDashboard(dateRange: DateRangeInput) {
  const { data, loading, error, refetch } = useQuery<{
    platformIntelligenceDashboard: PlatformIntelligenceDashboard;
  }>(PLATFORM_INTELLIGENCE_DASHBOARD_QUERY, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.platformIntelligenceDashboard,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for communication analytics section
 * AC: 2 - Communication response time analytics
 */
export function useCommunicationAnalytics(dateRange: DateRangeInput) {
  const { data, loading, error, refetch } = useQuery<{
    communicationAnalytics: CommunicationAnalytics;
  }>(COMMUNICATION_ANALYTICS_QUERY, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.communicationAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for document quality analytics section
 * AC: 3 - Document quality analytics
 */
export function useDocumentQualityAnalytics(dateRange: DateRangeInput) {
  const { data, loading, error, refetch } = useQuery<{
    documentQualityAnalytics: DocumentQualityAnalytics;
  }>(DOCUMENT_QUALITY_ANALYTICS_QUERY, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.documentQualityAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for AI utilization analytics section
 * AC: 5 - AI utilization by user and feature
 */
export function useAIUtilizationAnalytics(dateRange: DateRangeInput) {
  const { data, loading, error, refetch } = useQuery<{
    aiUtilizationAnalytics: AIUtilizationSummary;
  }>(AI_UTILIZATION_ANALYTICS_QUERY, {
    variables: {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.aiUtilizationAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for individual user AI utilization
 * AC: 5 - User-level AI utilization details
 */
export function useUserAIUtilization(userId: string, dateRange: DateRangeInput) {
  const { data, loading, error, refetch } = useQuery<{
    userAIUtilization: AIUtilizationByUser | null;
  }>(USER_AI_UTILIZATION_QUERY, {
    variables: {
      userId,
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
    },
    skip: !userId,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return {
    data: data?.userAIUtilization,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for exporting platform intelligence dashboard
 * Supports PDF, Excel, and CSV formats
 */
export function useExportDashboard() {
  const [exportMutation, { data, loading, error }] = useMutation<{
    exportPlatformIntelligence: ExportResult;
  }>(EXPORT_PLATFORM_INTELLIGENCE_MUTATION);

  const exportDashboard = async (
    dateRange: DateRangeInput,
    format: 'PDF' | 'EXCEL' | 'CSV',
    sections?: ExportSectionsInput
  ) => {
    const result = await exportMutation({
      variables: {
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        format,
        sections,
      },
    });
    return result.data?.exportPlatformIntelligence;
  };

  return {
    exportDashboard,
    data: data?.exportPlatformIntelligence,
    loading,
    error,
  };
}

/**
 * Hook for manually refreshing platform intelligence data
 * Clears cache and re-fetches all analytics
 */
export function useRefreshDashboard() {
  const [refreshMutation, { loading, error }] = useMutation<{
    refreshPlatformIntelligence: boolean;
  }>(REFRESH_PLATFORM_INTELLIGENCE_MUTATION, {
    refetchQueries: [
      'PlatformIntelligenceDashboard',
      'CommunicationAnalytics',
      'DocumentQualityAnalytics',
      'AIUtilizationAnalytics',
    ],
  });

  const refresh = async () => {
    const result = await refreshMutation();
    return result.data?.refreshPlatformIntelligence ?? false;
  };

  return {
    refresh,
    loading,
    error,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for getting default date range (last 30 days)
 */
export function useDefaultDateRange(): DateRangeInput {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  return { start, end };
}

/**
 * Hook for getting date range presets
 */
export function useDateRangePresets() {
  const now = new Date();

  return {
    last7Days: {
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: now,
    },
    last30Days: {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now,
    },
    last90Days: {
      start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      end: now,
    },
    thisMonth: {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
    },
    lastMonth: {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0),
    },
    thisQuarter: {
      start: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
      end: now,
    },
    thisYear: {
      start: new Date(now.getFullYear(), 0, 1),
      end: now,
    },
  };
}
