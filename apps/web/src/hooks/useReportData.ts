/**
 * Report Data React Hooks
 * OPS-155: useReportData Hook + ReportViewer Integration
 *
 * Provides hooks for fetching predefined reports, report data, and AI insights
 */

import { gql } from '@apollo/client';
import { useQuery, useLazyQuery } from '@apollo/client/react';
import type {
  ReportCategory,
  DateRange,
  ReportAIInsight,
  ChartDataPoint,
} from '@legal-platform/types';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_PREDEFINED_REPORTS = gql`
  query GetPredefinedReports($categoryId: ReportCategory) {
    predefinedReports(categoryId: $categoryId) {
      id
      categoryId
      name
      nameRo
      description
      chartType
      requiresDateRange
      allowedRoles
    }
  }
`;

const GET_REPORT_DATA = gql`
  query GetReportData($reportId: ID!, $dateRange: DateRangeInput) {
    reportData(reportId: $reportId, dateRange: $dateRange) {
      reportId
      data {
        label
        value
        color
        metadata
      }
      summary {
        totalValue
        averageValue
        changeFromPrevious
        trendDirection
      }
    }
  }
`;

const GET_REPORT_AI_INSIGHT = gql`
  query GetReportAIInsight($reportId: ID!, $dateRange: DateRangeInput) {
    reportAIInsight(reportId: $reportId, dateRange: $dateRange) {
      summary
      keyFindings
      recommendations
      generatedAt
      confidence
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface PredefinedReport {
  id: string;
  categoryId: ReportCategory;
  name: string;
  nameRo: string;
  description: string;
  chartType: 'bar' | 'pie' | 'line' | 'gauge' | 'area';
  requiresDateRange: boolean;
  allowedRoles: string[];
}

export interface ReportDataResult {
  reportId: string;
  data: ChartDataPoint[];
  summary: {
    totalValue: number;
    averageValue: number;
    changeFromPrevious?: number;
    trendDirection?: 'up' | 'down' | 'stable';
  } | null;
}

interface GetPredefinedReportsData {
  predefinedReports: PredefinedReport[];
}

interface GetReportDataData {
  reportData: ReportDataResult | null;
}

interface GetReportAIInsightData {
  reportAIInsight: ReportAIInsight | null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching predefined report templates
 * Optionally filter by category
 */
export function usePredefinedReports(categoryId?: ReportCategory) {
  const { data, loading, error, refetch } = useQuery<GetPredefinedReportsData>(
    GET_PREDEFINED_REPORTS,
    {
      variables: { categoryId: categoryId || null },
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    reports: data?.predefinedReports ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching report data (chart data + summary)
 * Returns null if no reportId is provided
 */
export function useReportData(reportId: string | null, dateRange?: DateRange) {
  const { data, loading, error, refetch } = useQuery<GetReportDataData>(GET_REPORT_DATA, {
    variables: {
      reportId,
      dateRange: dateRange
        ? {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            preset: dateRange.preset,
          }
        : null,
    },
    skip: !reportId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    reportData: data?.reportData ?? null,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching AI-generated insights for a report
 * Uses lazy query to allow on-demand generation
 */
export function useReportAIInsight(reportId: string | null, dateRange?: DateRange) {
  const [fetchInsight, { data, loading, error, called }] = useLazyQuery<GetReportAIInsightData>(
    GET_REPORT_AI_INSIGHT,
    {
      fetchPolicy: 'network-only', // Always fetch fresh for AI insights
    }
  );

  const loadInsight = () => {
    if (!reportId) return;

    fetchInsight({
      variables: {
        reportId,
        dateRange: dateRange
          ? {
              start: dateRange.start.toISOString(),
              end: dateRange.end.toISOString(),
              preset: dateRange.preset,
            }
          : null,
      },
    });
  };

  const regenerate = () => {
    loadInsight();
  };

  return {
    insight: data?.reportAIInsight ?? null,
    loading,
    error,
    called,
    loadInsight,
    regenerate,
  };
}

/**
 * Combined hook for report data and AI insights
 * Automatically loads AI insight when report data loads
 */
export function useReportWithInsight(reportId: string | null, dateRange?: DateRange) {
  const { reportData, loading: dataLoading, error: dataError } = useReportData(reportId, dateRange);
  const {
    insight,
    loading: insightLoading,
    error: insightError,
    loadInsight,
    regenerate,
    called,
  } = useReportAIInsight(reportId, dateRange);

  return {
    reportData,
    insight,
    dataLoading,
    insightLoading,
    dataError,
    insightError,
    loadInsight,
    regenerate,
    insightCalled: called,
  };
}
