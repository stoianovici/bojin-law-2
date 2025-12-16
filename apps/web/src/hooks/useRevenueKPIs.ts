/**
 * Revenue KPIs Hook
 * Story 2.8.1: Billing & Rate Management - Phase 5
 *
 * Fetches firm-wide revenue KPIs with optional date range filtering
 */

import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/apollo-client';
import { useNotificationStore } from '@/stores/notificationStore';

// GraphQL queries
const FIRM_REVENUE_KPIS_QUERY = gql`
  query FirmRevenueKPIs($dateRange: DateRangeInput) {
    firmRevenueKPIs(dateRange: $dateRange) {
      totalCases
      hourlyCount
      fixedCount
      avgVariance
      avgVariancePercent
      topPerformingCases {
        caseId
        caseTitle
        billingType
        actualRevenue
        projectedRevenue
        variance
        variancePercent
        timeEntriesCount
        totalHours
      }
      underperformingCases {
        caseId
        caseTitle
        billingType
        actualRevenue
        projectedRevenue
        variance
        variancePercent
        timeEntriesCount
        totalHours
      }
    }
  }
`;

const CASE_REVENUE_KPI_QUERY = gql`
  query CaseRevenueKPI($caseId: UUID!) {
    caseRevenueKPI(caseId: $caseId) {
      caseId
      caseTitle
      billingType
      actualRevenue
      projectedRevenue
      variance
      variancePercent
      timeEntriesCount
      totalHours
    }
  }
`;

export interface RevenueComparison {
  caseId: string;
  caseTitle: string;
  billingType: 'Hourly' | 'Fixed';
  actualRevenue: number;
  projectedRevenue: number;
  variance: number;
  variancePercent: number;
  timeEntriesCount: number;
  totalHours: number;
}

export interface FirmRevenueKPIs {
  totalCases: number;
  hourlyCount: number;
  fixedCount: number;
  avgVariance: number;
  avgVariancePercent: number;
  topPerformingCases: RevenueComparison[];
  underperformingCases: RevenueComparison[];
}

export interface DateRange {
  startDate: string; // ISO 8601 format
  endDate: string;
}

/**
 * Fetch firm-wide revenue KPIs
 *
 * @param dateRange - Optional date range filter
 * @returns React Query result with KPI data
 */
export function useFirmRevenueKPIs(dateRange?: DateRange) {
  const addNotification = useNotificationStore(
    (state: { addNotification: any }) => state.addNotification
  );

  return useQuery<FirmRevenueKPIs>({
    queryKey: ['firmRevenueKPIs', dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      try {
        const result = await apolloClient.query<{ firmRevenueKPIs: FirmRevenueKPIs }>({
          query: FIRM_REVENUE_KPIS_QUERY,
          variables: { dateRange },
          fetchPolicy: 'network-only', // Always fetch fresh data
        });

        if (!result.data) {
          throw new Error('No data returned from query');
        }

        return result.data.firmRevenueKPIs;
      } catch (error) {
        const errorMessage =
          (error as { graphQLErrors?: Array<{ message: string }> })?.graphQLErrors?.[0]?.message ||
          'Failed to fetch revenue KPIs';

        addNotification({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        });

        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch revenue KPI for a specific case
 *
 * @param caseId - UUID of the case
 * @param enabled - Whether to enable the query
 * @returns React Query result with case KPI data
 */
export function useCaseRevenueKPI(caseId: string, enabled: boolean = true) {
  const addNotification = useNotificationStore(
    (state: { addNotification: any }) => state.addNotification
  );

  return useQuery<RevenueComparison | null>({
    queryKey: ['caseRevenueKPI', caseId],
    queryFn: async () => {
      try {
        const { data } = await apolloClient.query<{ caseRevenueKPI: RevenueComparison | null }>({
          query: CASE_REVENUE_KPI_QUERY,
          variables: { caseId },
          fetchPolicy: 'network-only',
        });

        if (!data) {
          throw new Error('No data returned from query');
        }

        return data.caseRevenueKPI;
      } catch (error) {
        const errorMessage =
          (error as { graphQLErrors?: Array<{ message: string }> })?.graphQLErrors?.[0]?.message ||
          'Failed to fetch case revenue KPI';

        addNotification({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        });

        throw error;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Format currency from cents to dollars with proper formatting (no currency symbol)
 *
 * @param cents - Amount in cents
 * @returns Formatted number string without currency symbol
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format percentage with sign
 *
 * @param percent - Percentage value
 * @returns Formatted percentage string
 */
export function formatPercentage(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}
