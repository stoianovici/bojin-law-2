/**
 * Analytics Page - Financial Dashboard
 * Story 2.11.4: Financial Dashboard UI
 *
 * Comprehensive financial dashboard for Partners and Business Owners.
 * Displays revenue, utilization, profitability, and retainer metrics.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

// Components
import { FinancialData } from '../../components/auth/FinancialData';
import { DashboardHeader } from '../../components/analytics/DashboardHeader';
import { DateRangePicker } from '../../components/analytics/DateRangePicker';
import { PeriodComparisonToggle } from '../../components/analytics/PeriodComparisonToggle';
import {
  RevenueOverviewWidget,
  RevenueTrendWidget,
  UtilizationWidget,
  ProfitabilityWidget,
  RetainerStatusWidget,
} from '../../components/analytics/widgets';

// Hooks and store
import { useAnalyticsFiltersStore } from '../../stores/analyticsFiltersStore';
import { useFinancialKPIsComparison } from '../../hooks/useFinancialKPIsComparison';

/**
 * Access Denied component for unauthorized users
 */
function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Acces restricționat</h2>
      <p className="text-gray-500 max-w-sm mb-6">
        Analizele financiare sunt disponibile doar pentru Parteneri și Administratori.
      </p>
      <button
        onClick={() => router.push('/')}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Mergi la Panou
      </button>
    </div>
  );
}

/**
 * Dashboard content component
 */
function DashboardContent() {
  const { dateRange, comparisonEnabled, getPreviousPeriod } =
    useAnalyticsFiltersStore();

  // Get financial KPIs with comparison
  const { current, previous, deltas, isLoading, error, refetch } =
    useFinancialKPIsComparison({
      dateRange,
      previousDateRange: getPreviousPeriod(),
      comparisonEnabled,
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
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
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                />
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
          <div className="mt-8 text-center text-xs text-gray-400">
            <p>
              Date calculate la{' '}
              {new Date(current.calculatedAt).toLocaleString('ro-RO')} •{' '}
              {current.caseCount} dosare în analiză
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Analytics Page Component
 * Wrapped with FinancialData to enforce authorization
 */
export default function AnalyticsPage() {
  // useFinancialDataScope is available via FinancialData component

  // Set document title
  React.useEffect(() => {
    document.title = 'Analize Financiare';
  }, []);

  return (
    <FinancialData fallback={<AccessDenied />}>
      <DashboardContent />
    </FinancialData>
  );
}
