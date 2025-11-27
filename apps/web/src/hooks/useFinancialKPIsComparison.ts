/**
 * useFinancialKPIsComparison Hook
 * Story 2.11.4: Financial Dashboard UI
 *
 * Hook for fetching and comparing financial KPIs between two periods.
 * Calculates delta values for period-over-period comparison.
 */

import { useMemo } from 'react';
import {
  useFinancialKPIs,
  type FinancialKPIs,
  type UseFinancialKPIsOptions,
} from './useFinancialKPIs';
import type { DateRange } from '../stores/analyticsFiltersStore';

/**
 * Delta calculation result
 */
export interface KPIDelta {
  /**
   * Absolute change (current - previous)
   */
  absolute: number;

  /**
   * Percentage change ((current - previous) / previous * 100)
   */
  percentage: number;

  /**
   * Direction of change
   */
  direction: 'up' | 'down' | 'neutral';
}

/**
 * Comparison deltas for all KPIs
 */
export interface FinancialKPIsDeltas {
  totalRevenue: KPIDelta;
  totalBillableHours: KPIDelta;
  utilizationRate: KPIDelta;
  realizationRate: KPIDelta;
  effectiveHourlyRate: KPIDelta;
  caseCount: KPIDelta;
  retainerUtilizationAverage: KPIDelta | null;
}

/**
 * Hook return type
 */
export interface UseFinancialKPIsComparisonReturn {
  /**
   * Current period KPIs
   */
  current: FinancialKPIs | null;

  /**
   * Previous period KPIs (for comparison)
   */
  previous: FinancialKPIs | null;

  /**
   * Delta values between periods
   */
  deltas: FinancialKPIsDeltas | null;

  /**
   * Loading state for either query
   */
  isLoading: boolean;

  /**
   * Error from either query
   */
  error: Error | null;

  /**
   * Refetch both periods
   */
  refetch: () => void;
}

/**
 * Hook options
 */
export interface UseFinancialKPIsComparisonOptions {
  /**
   * Current period date range
   */
  dateRange: DateRange;

  /**
   * Previous period date range (for comparison)
   */
  previousDateRange: DateRange;

  /**
   * Whether comparison is enabled
   */
  comparisonEnabled?: boolean;

  /**
   * Skip the queries
   */
  skip?: boolean;
}

/**
 * Calculate delta between two values
 */
function calculateDelta(current: number, previous: number): KPIDelta {
  const absolute = current - previous;
  const percentage = previous !== 0 ? (absolute / previous) * 100 : 0;

  let direction: KPIDelta['direction'] = 'neutral';
  if (Math.abs(percentage) >= 0.1) {
    direction = absolute > 0 ? 'up' : 'down';
  }

  return {
    absolute: Math.round(absolute * 100) / 100,
    percentage: Math.round(percentage * 10) / 10,
    direction,
  };
}

/**
 * Calculate all deltas between current and previous KPIs
 */
function calculateDeltas(
  current: FinancialKPIs,
  previous: FinancialKPIs
): FinancialKPIsDeltas {
  return {
    totalRevenue: calculateDelta(current.totalRevenue, previous.totalRevenue),
    totalBillableHours: calculateDelta(
      current.totalBillableHours,
      previous.totalBillableHours
    ),
    utilizationRate: calculateDelta(
      current.utilizationRate,
      previous.utilizationRate
    ),
    realizationRate: calculateDelta(
      current.realizationRate,
      previous.realizationRate
    ),
    effectiveHourlyRate: calculateDelta(
      current.effectiveHourlyRate,
      previous.effectiveHourlyRate
    ),
    caseCount: calculateDelta(current.caseCount, previous.caseCount),
    retainerUtilizationAverage:
      current.retainerUtilizationAverage !== null &&
      previous.retainerUtilizationAverage !== null
        ? calculateDelta(
            current.retainerUtilizationAverage,
            previous.retainerUtilizationAverage
          )
        : null,
  };
}

/**
 * Hook to fetch and compare financial KPIs between two periods
 *
 * @param options - Hook options including date ranges and comparison flag
 * @returns Current/previous KPIs, deltas, loading state, error, and refetch
 *
 * @example
 * ```tsx
 * function ComparisonDashboard() {
 *   const { current, previous, deltas, isLoading } = useFinancialKPIsComparison({
 *     dateRange: { start: thisMonthStart, end: today },
 *     previousDateRange: { start: lastMonthStart, end: lastMonthEnd },
 *     comparisonEnabled: true,
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Revenue: {current?.totalRevenue}</h2>
 *       {deltas && <DeltaBadge delta={deltas.totalRevenue} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFinancialKPIsComparison(
  options: UseFinancialKPIsComparisonOptions
): UseFinancialKPIsComparisonReturn {
  const {
    dateRange,
    previousDateRange,
    comparisonEnabled = true,
    skip = false,
  } = options;

  // Fetch current period KPIs
  const currentOptions: UseFinancialKPIsOptions = {
    dateRange,
    skip,
  };

  const {
    data: currentData,
    isLoading: currentLoading,
    error: currentError,
    refetch: refetchCurrent,
  } = useFinancialKPIs(currentOptions);

  // Fetch previous period KPIs (only if comparison is enabled)
  const previousOptions: UseFinancialKPIsOptions = {
    dateRange: previousDateRange,
    skip: skip || !comparisonEnabled,
  };

  const {
    data: previousData,
    isLoading: previousLoading,
    error: previousError,
    refetch: refetchPrevious,
  } = useFinancialKPIs(previousOptions);

  // Calculate deltas
  const deltas = useMemo(() => {
    if (!comparisonEnabled || !currentData || !previousData) {
      return null;
    }
    return calculateDeltas(currentData, previousData);
  }, [comparisonEnabled, currentData, previousData]);

  // Combined refetch
  const refetch = () => {
    refetchCurrent();
    if (comparisonEnabled) {
      refetchPrevious();
    }
  };

  return {
    current: currentData,
    previous: comparisonEnabled ? previousData : null,
    deltas,
    isLoading: currentLoading || (comparisonEnabled && previousLoading),
    error: currentError || previousError,
    refetch,
  };
}

export default useFinancialKPIsComparison;
