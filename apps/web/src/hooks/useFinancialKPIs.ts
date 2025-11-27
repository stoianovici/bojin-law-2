/**
 * useFinancialKPIs Hook
 * Story 2.11.4: Financial Dashboard UI
 *
 * Hook for fetching financial KPIs from GraphQL API.
 * Uses React Query for caching and automatic refetching.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { DateRange } from '../stores/analyticsFiltersStore';

/**
 * Revenue by billing type breakdown
 */
export interface RevenueByBillingType {
  hourly: number;
  fixed: number;
  retainer: number;
}

/**
 * Single revenue trend point
 */
export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  caseCount: number;
}

/**
 * Utilization by role
 */
export interface UtilizationByRole {
  role: string;
  billableHours: number;
  totalHours: number;
  utilizationRate: number;
}

/**
 * Case profitability data
 */
export interface CaseProfitability {
  caseId: string;
  caseName: string;
  billingType: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

/**
 * Financial KPIs data structure
 */
export interface FinancialKPIs {
  totalRevenue: number;
  revenueByBillingType: RevenueByBillingType;
  revenueTrend: RevenueTrendPoint[];
  totalBillableHours: number;
  totalNonBillableHours: number;
  utilizationRate: number;
  utilizationByRole: UtilizationByRole[];
  realizationRate: number;
  billedHours: number;
  workedHours: number;
  effectiveHourlyRate: number;
  profitabilityByCase: CaseProfitability[];
  retainerUtilizationAverage: number | null;
  retainerCasesCount: number;
  dataScope: 'OWN' | 'FIRM';
  calculatedAt: string;
  caseCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * GraphQL query for financial KPIs
 */
export const FINANCIAL_KPIS_QUERY = gql`
  query FinancialKPIs($dateRange: DateRangeInput) {
    financialKPIs(dateRange: $dateRange) {
      totalRevenue
      revenueByBillingType {
        hourly
        fixed
        retainer
      }
      revenueTrend {
        date
        revenue
        caseCount
      }
      totalBillableHours
      totalNonBillableHours
      utilizationRate
      utilizationByRole {
        role
        billableHours
        totalHours
        utilizationRate
      }
      realizationRate
      billedHours
      workedHours
      effectiveHourlyRate
      profitabilityByCase {
        caseId
        caseName
        billingType
        revenue
        cost
        margin
        marginPercent
      }
      retainerUtilizationAverage
      retainerCasesCount
      dataScope
      calculatedAt
      caseCount
      dateRange {
        start
        end
      }
    }
  }
`;

/**
 * Hook return type
 */
export interface UseFinancialKPIsReturn {
  data: FinancialKPIs | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook options
 */
export interface UseFinancialKPIsOptions {
  /**
   * Date range for filtering
   */
  dateRange?: DateRange;

  /**
   * Skip the query
   */
  skip?: boolean;

  /**
   * Poll interval in milliseconds
   */
  pollInterval?: number;
}

/**
 * Hook to fetch financial KPIs from GraphQL API
 *
 * @param options - Hook options including date range
 * @returns Financial KPIs data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { data, isLoading, error, refetch } = useFinancialKPIs({
 *     dateRange: { start: new Date('2025-01-01'), end: new Date() },
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error onRetry={refetch} />;
 *   return <Chart data={data} />;
 * }
 * ```
 */
export function useFinancialKPIs(
  options: UseFinancialKPIsOptions = {}
): UseFinancialKPIsReturn {
  const { dateRange, skip = false, pollInterval } = options;

  // Format dates for GraphQL
  const variables = dateRange
    ? {
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
      }
    : undefined;

  const { data, loading, error, refetch } = useQuery<{
    financialKPIs: FinancialKPIs;
  }>(FINANCIAL_KPIS_QUERY, {
    variables,
    skip,
    pollInterval,
    fetchPolicy: 'cache-and-network',
    // Notify on network status change for better loading handling
    notifyOnNetworkStatusChange: true,
  });

  return {
    data: data?.financialKPIs ?? null,
    isLoading: loading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

export default useFinancialKPIs;
