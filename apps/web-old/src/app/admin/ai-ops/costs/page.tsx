/**
 * AI Costs Breakdown Page
 * OPS-244: Cost Breakdown & Charts Page
 *
 * Detailed view of AI costs by feature and user with visualizations.
 */

'use client';

import { useState, useCallback } from 'react';
import { Download, RefreshCw, TrendingUp } from 'lucide-react';
import { DateRangeSelector, type DateRange } from '@/components/admin/DateRangeSelector';
import { FeatureBreakdownChart } from '@/components/admin/FeatureBreakdownChart';
import { UserUsageTable } from '@/components/admin/UserUsageTable';
import { useAICosts, type AIFeatureCost, type AIUserCost } from '@/hooks/useAICosts';

// ============================================================================
// CSV Export Utility
// ============================================================================

function exportToCSV(featureCosts: AIFeatureCost[], userCosts: AIUserCost[], dateRange: DateRange) {
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  // Feature costs section
  const featureRows = [
    ['=== COST PE FUNCȚIONALITATE ==='],
    ['Funcționalitate', 'Cost (EUR)', 'Tokeni', 'Apeluri', '% din Total'],
    ...featureCosts.map((d) => [
      d.featureName,
      d.cost.toFixed(2),
      d.tokens.toString(),
      d.calls.toString(),
      d.percentOfTotal.toFixed(1) + '%',
    ]),
    [],
  ];

  // User costs section
  const userRows = [
    ['=== COST PE UTILIZATOR ==='],
    ['Utilizator', 'Cost (EUR)', 'Tokeni', 'Apeluri'],
    ...userCosts.map((u) => [
      u.userName,
      u.cost.toFixed(2),
      u.tokens.toString(),
      u.calls.toString(),
    ]),
  ];

  const allRows = [...featureRows, ...userRows];
  const csv = allRows.map((r) => r.join(',')).join('\n');

  // Download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ai-costs-${formatDate(dateRange.start)}-${formatDate(dateRange.end)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// KPI Card Component
// ============================================================================

function KPICard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-red-600',
    down: 'text-green-600',
    neutral: 'text-gray-400',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <TrendingUp
            className={`h-4 w-4 ${trendColors[trend]} ${trend === 'down' ? 'rotate-180' : ''}`}
          />
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AICostsPage() {
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });

  const { featureCosts, userCosts, overview, loading, error } = useAICosts(dateRange);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  // Handle CSV export
  const handleExport = useCallback(() => {
    if (featureCosts.length > 0 || userCosts.length > 0) {
      exportToCSV(featureCosts, userCosts, dateRange);
    }
  }, [featureCosts, userCosts, dateRange]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    // Force re-fetch by slightly changing date range
    setDateRange((prev) => ({ ...prev }));
  }, []);

  // Format helpers
  const formatCost = (value: number) => `€${value.toFixed(2)}`;
  const formatNumber = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detalii Costuri</h1>
          <p className="text-gray-500 text-sm mt-1">
            Analiză detaliată a costurilor AI pe funcționalități și utilizatori
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />

          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Reîmprospătează"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            disabled={featureCosts.length === 0 && userCosts.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportă CSV
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Eroare la încărcarea datelor</p>
          <p className="text-red-600 text-sm mt-1">
            {error.message || 'A apărut o eroare neașteptată.'}
          </p>
        </div>
      )}

      {/* KPI Summary */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            title="Cost Total"
            value={formatCost(overview.totalCost)}
            subtitle="în perioada selectată"
          />
          <KPICard
            title="Tokeni Utilizați"
            value={formatNumber(overview.totalTokens)}
            subtitle="input + output"
          />
          <KPICard
            title="Apeluri AI"
            value={formatNumber(overview.totalCalls)}
            subtitle="cereri procesate"
          />
          <KPICard
            title="Rată Succes"
            value={`${overview.successRate.toFixed(1)}%`}
            subtitle="apeluri reușite"
          />
        </div>
      )}

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Breakdown Chart */}
        <FeatureBreakdownChart data={featureCosts} loading={loading} />

        {/* User Usage Table */}
        <UserUsageTable data={userCosts} loading={loading} />
      </div>

      {/* Daily Cost Trend (could be expanded) */}
      {overview && overview.projectedMonthEnd > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Proiecție Lunară</h3>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-gray-500">Cost estimat luna aceasta</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCost(overview.projectedMonthEnd)}
              </p>
            </div>
            {overview.budgetLimit && (
              <>
                <div className="h-12 w-px bg-gray-200" />
                <div>
                  <p className="text-sm text-gray-500">Buget lunar</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCost(overview.budgetLimit)}
                  </p>
                </div>
                <div className="h-12 w-px bg-gray-200" />
                <div>
                  <p className="text-sm text-gray-500">Utilizat</p>
                  <p
                    className={`text-3xl font-bold ${
                      (overview.budgetUsedPercent || 0) > 90
                        ? 'text-red-600'
                        : (overview.budgetUsedPercent || 0) > 75
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    }`}
                  >
                    {(overview.budgetUsedPercent || 0).toFixed(1)}%
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
