/**
 * Financial Analytics Tab Content
 * Extracted from /analytics page for use in tabbed analytics view
 */

'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

// Components
import { DashboardHeader } from './DashboardHeader';
import { DateRangePicker } from './DateRangePicker';
import { PeriodComparisonToggle } from './PeriodComparisonToggle';
import {
  RevenueOverviewWidget,
  RevenueTrendWidget,
  UtilizationWidget,
  ProfitabilityWidget,
  RetainerStatusWidget,
} from './widgets';

// Hooks and store
import { useAnalyticsFiltersStore } from '../../stores/analyticsFiltersStore';
import { useFinancialKPIsComparison } from '../../hooks/useFinancialKPIsComparison';

/**
 * Financial Analytics Tab Content
 */
export function FinancialAnalyticsTab() {
  const { dateRange, comparisonEnabled, getPreviousPeriod } = useAnalyticsFiltersStore();

  // Get financial KPIs with comparison
  const { current, previous, deltas, isLoading, error, refetch } = useFinancialKPIsComparison({
    dateRange,
    previousDateRange: getPreviousPeriod(),
    comparisonEnabled,
  });

  return (
    <div className="min-h-screen bg-linear-bg-primary">
      {/* Page Header */}
      <div className="bg-linear-bg-secondary border-b border-linear-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DashboardHeader />

            <div className="flex flex-wrap items-center gap-3">
              <DateRangePicker />
              <PeriodComparisonToggle />

              {/* Refresh button */}
              <button
                onClick={refetch}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-linear-text-secondary hover:text-linear-text-primary hover:bg-linear-bg-tertiary rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Revenue Overview - 1 column */}
          <RevenueOverviewWidget
            totalRevenue={current?.totalRevenue ?? 0}
            revenueByBillingType={
              current?.revenueByBillingType ?? {
                hourly: 0,
                fixed: 0,
                retainer: 0,
              }
            }
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            delta={deltas?.totalRevenue}
            className="lg:col-span-1"
          />

          {/* Revenue Trend - 2 columns */}
          <RevenueTrendWidget
            revenueTrend={current?.revenueTrend ?? []}
            previousTrend={previous?.revenueTrend}
            comparisonEnabled={comparisonEnabled}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            className="lg:col-span-2"
          />

          {/* Utilization - 1 column */}
          <UtilizationWidget
            utilizationRate={current?.utilizationRate ?? 0}
            totalBillableHours={current?.totalBillableHours ?? 0}
            totalNonBillableHours={current?.totalNonBillableHours ?? 0}
            utilizationByRole={current?.utilizationByRole ?? []}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            delta={deltas?.utilizationRate}
          />

          {/* Profitability - 2 columns */}
          <ProfitabilityWidget
            effectiveHourlyRate={current?.effectiveHourlyRate ?? 0}
            profitabilityByCase={current?.profitabilityByCase ?? []}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            delta={deltas?.effectiveHourlyRate}
            className="lg:col-span-2"
          />

          {/* Retainer Status - 1 column */}
          <RetainerStatusWidget
            retainerUtilizationAverage={current?.retainerUtilizationAverage ?? null}
            retainerCasesCount={current?.retainerCasesCount ?? 0}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            delta={deltas?.retainerUtilizationAverage}
          />
        </div>

        {/* Metadata footer */}
        {current && (
          <div className="mt-8 text-center text-xs text-linear-text-muted">
            <p>
              Date calculate la {new Date(current.calculatedAt).toLocaleString('ro-RO')} •{' '}
              {current.caseCount} dosare în analiză
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
