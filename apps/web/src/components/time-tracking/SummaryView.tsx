/**
 * SummaryView Component
 * Displays daily/weekly time tracking summary with billable breakdown
 * Fetches real data from GraphQL API
 */

'use client';

import React from 'react';
import { useWeeklySummary, getStartOfWeek } from '../../hooks/useTimeEntries';

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function SummaryView() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const weekStart = React.useMemo(() => getStartOfWeek(), []);

  const { data, loading, error } = useWeeklySummary(weekStart);
  const summary = data?.weeklySummary;

  const totalHours = summary?.totalHours ?? 0;
  const billableHours = summary?.billableHours ?? 0;
  const nonBillableHours = summary?.nonBillableHours ?? 0;
  const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  // Determine trend text
  const trendText =
    summary?.trend === 'UP'
      ? '+↑ vs săptămâna anterioară'
      : summary?.trend === 'DOWN'
        ? '↓ vs săptămâna anterioară'
        : '→ stabil';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Sumar Pontaj</h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {isCollapsed ? 'Arată' : 'Ascunde'}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-6">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Se încarcă...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg">
              Eroare la încărcarea datelor: {error.message}
            </div>
          )}

          {/* Data display */}
          {!loading && !error && (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Total Hours */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-700">Total Ore</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">
                    {formatHours(totalHours)}
                  </div>
                  <div className="text-xs text-blue-600 mt-2">{trendText}</div>
                </div>

                {/* Billable Hours */}
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-700">Ore Facturabile</div>
                  <div className="text-2xl font-bold text-green-900 mt-1">
                    {formatHours(billableHours)}
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    {billablePercentage.toFixed(1)}% din total
                  </div>
                </div>

                {/* Non-Billable Hours */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700">Ore Nefacturabile</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {formatHours(nonBillableHours)}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    {(100 - billablePercentage).toFixed(1)}% din total
                  </div>
                </div>

                {/* Billable Rate */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-purple-700">Rată Facturabilitate</div>
                  <div className="text-2xl font-bold text-purple-900 mt-1">
                    {billablePercentage.toFixed(0)}%
                  </div>
                  <div className="text-xs text-purple-600 mt-2">
                    {billablePercentage >= 70
                      ? 'Excelent'
                      : billablePercentage >= 50
                        ? 'Bun'
                        : 'Sub țintă'}
                  </div>
                </div>
              </div>

              {/* Visual Breakdown Bar */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Distribuție Ore</div>
                <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100">
                  <div
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
                    style={{ width: `${billablePercentage}%` }}
                  >
                    {billablePercentage > 15 && `${billablePercentage.toFixed(0)}%`}
                  </div>
                  <div
                    className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
                    style={{ width: `${100 - billablePercentage}%` }}
                  >
                    {100 - billablePercentage > 15 && `${(100 - billablePercentage).toFixed(0)}%`}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>● Facturabile</span>
                  <span>● Nefacturabile</span>
                </div>
              </div>

              {/* Entries count */}
              {summary && (
                <div className="mt-4 text-sm text-gray-500">
                  {summary.entriesCount} înregistrări săptămâna aceasta
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
