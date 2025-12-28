/**
 * Case Revenue KPI Widget
 * Story 2.8.1: Billing & Rate Management - Phase 5
 *
 * Displays revenue comparison KPI for Fixed Fee cases
 * Shows variance between fixed amount and projected hourly revenue
 * Partners only
 */

'use client';

import { useState } from 'react';
import { FinancialData } from '@/components/auth/FinancialData';
import { useCaseRevenueKPI, formatCurrency, formatPercentage } from '@/hooks/useRevenueKPIs';

interface CaseRevenueKPIWidgetProps {
  caseId: string;
  billingType: 'Hourly' | 'Fixed' | 'Retainer';
}

export function CaseRevenueKPIWidget({ caseId, billingType }: CaseRevenueKPIWidgetProps) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Don't show widget for Hourly cases
  if (billingType !== 'Fixed') {
    return null;
  }

  return (
    <FinancialData>
      <CaseRevenueKPIWidgetContent
        caseId={caseId}
        lastUpdated={lastUpdated}
        onRefresh={() => setLastUpdated(new Date())}
      />
    </FinancialData>
  );
}

interface CaseRevenueKPIWidgetContentProps {
  caseId: string;
  lastUpdated: Date;
  onRefresh: () => void;
}

function CaseRevenueKPIWidgetContent({
  caseId,
  lastUpdated,
  onRefresh,
}: CaseRevenueKPIWidgetContentProps) {
  const { data: kpi, isLoading, error, refetch } = useCaseRevenueKPI(caseId);

  const handleRefresh = async () => {
    onRefresh();
    await refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-linear-bg-tertiary rounded w-1/3 animate-pulse" />
          <div className="h-8 w-8 bg-linear-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-linear-bg-tertiary rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-error/30 p-6">
        <div className="flex items-center gap-2 text-linear-error mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="font-semibold">Failed to load KPI data</h3>
        </div>
        <button
          onClick={handleRefresh}
          className="text-sm text-linear-accent hover:text-linear-accent-hover underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // No data available (null KPI - cannot calculate)
  if (!kpi) {
    return (
      <div className="bg-linear-bg-tertiary rounded-lg border border-linear-border-subtle p-6">
        <h3 className="font-semibold text-linear-text-secondary mb-2">Revenue KPI</h3>
        <p className="text-linear-text-tertiary text-sm">
          KPI cannot be calculated. Please ensure billing rates are set.
        </p>
      </div>
    );
  }

  // No time entries yet
  if (kpi.timeEntriesCount === 0) {
    return (
      <div className="bg-linear-accent/10 rounded-lg border border-linear-accent/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-linear-accent">Revenue KPI</h3>
          <button
            onClick={handleRefresh}
            className="text-linear-accent hover:text-linear-accent-hover p-1.5 rounded hover:bg-linear-accent/20 transition-colors"
            title="Refresh KPI"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
        <div className="text-center py-4">
          <p className="text-linear-text-secondary font-medium mb-1">No time tracked yet</p>
          <p className="text-linear-text-tertiary text-sm">
            KPI will be available once time entries are logged
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-linear-accent/30">
          <div className="flex justify-between items-center text-sm">
            <span className="text-linear-text-tertiary">Fixed Amount:</span>
            <span className="font-semibold text-linear-text-primary">{formatCurrency(kpi.actualRevenue)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Determine variance color
  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-linear-success bg-linear-success/15 border-linear-success/30';
    if (variance < 0) return 'text-linear-error bg-linear-error/15 border-linear-error/30';
    return 'text-linear-text-tertiary bg-linear-bg-tertiary border-linear-border-subtle';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    if (variance < 0) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return null;
  };

  const varianceColor = getVarianceColor(kpi.variance);

  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-linear-text-primary">Revenue KPI</h3>
        <button
          onClick={handleRefresh}
          className="text-linear-text-tertiary hover:text-linear-text-secondary p-1.5 rounded hover:bg-linear-bg-hover transition-colors"
          title="Refresh KPI"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="space-y-3">
        {/* Fixed Amount */}
        <div className="bg-linear-bg-tertiary rounded-lg p-4">
          <div className="text-sm text-linear-text-tertiary mb-1">Fixed Fee Amount</div>
          <div className="text-2xl font-bold text-linear-text-primary">
            {formatCurrency(kpi.actualRevenue)}
          </div>
        </div>

        {/* Projected Hourly Revenue */}
        <div className="bg-linear-bg-tertiary rounded-lg p-4">
          <div className="text-sm text-linear-text-tertiary mb-1">Projected Hourly Revenue</div>
          <div className="text-2xl font-bold text-linear-text-primary">
            {formatCurrency(kpi.projectedRevenue)}
          </div>
          <div className="text-xs text-linear-text-muted mt-1">
            Based on {kpi.totalHours.toFixed(1)} billable hours
          </div>
        </div>

        {/* Variance */}
        <div className={`rounded-lg p-4 border ${varianceColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">Variance</div>
              <div className="text-2xl font-bold">{formatCurrency(Math.abs(kpi.variance))}</div>
              <div className="text-sm mt-1">{formatPercentage(kpi.variancePercent)}</div>
            </div>
            <div className="ml-4">{getVarianceIcon(kpi.variance)}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-linear-border-subtle">
        <span className="text-xs text-linear-text-muted">Updated {formatTimestamp(lastUpdated)}</span>
      </div>
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return date.toLocaleString();
}
