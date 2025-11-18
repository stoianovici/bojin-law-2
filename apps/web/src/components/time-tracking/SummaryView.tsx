/**
 * SummaryView Component
 * Displays daily/weekly time tracking summary with billable breakdown
 */

'use client';

import React from 'react';
import { useTimeTrackingStore, selectTimeSummary } from '../../stores/time-tracking.store';

function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

export function SummaryView() {
  const summary = useTimeTrackingStore(selectTimeSummary);

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);

  // Defer rendering dynamic values until client-side to prevent hydration mismatch
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const totalHours = formatMinutesToHours(summary.totalMinutes);
  const billableHours = formatMinutesToHours(summary.billableMinutes);
  const nonBillableHours = formatMinutesToHours(summary.nonBillableMinutes);

  const billablePercentage =
    summary.totalMinutes > 0 ? (summary.billableMinutes / summary.totalMinutes) * 100 : 0;

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
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Total Hours */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-700">Total Ore</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {isClient ? totalHours : '0:00'}
              </div>
              {isClient && summary.comparisonToPrevious && (
                <div
                  className={`text-xs mt-2 ${
                    summary.comparisonToPrevious.totalDiff >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {summary.comparisonToPrevious.totalDiff >= 0 ? '+' : ''}
                  {Math.round(summary.comparisonToPrevious.percentChange)}% vs perioada anterioară
                </div>
              )}
            </div>

            {/* Billable Hours */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm font-medium text-green-700">Ore Facturabile</div>
              <div className="text-2xl font-bold text-green-900 mt-1">
                {isClient ? billableHours : '0:00'}
              </div>
              {isClient && (
                <div className="text-xs text-green-600 mt-2">
                  {summary.billableRate.toFixed(1)}% din total
                </div>
              )}
            </div>

            {/* Non-Billable Hours */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700">Ore Nefacturabile</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {isClient ? nonBillableHours : '0:00'}
              </div>
              {isClient && (
                <div className="text-xs text-gray-600 mt-2">
                  {(100 - summary.billableRate).toFixed(1)}% din total
                </div>
              )}
            </div>

            {/* Billable Rate */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm font-medium text-purple-700">Rată Facturabilitate</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">
                {isClient ? `${summary.billableRate.toFixed(0)}%` : '0%'}
              </div>
              {isClient && (
                <div className="text-xs text-purple-600 mt-2">
                  {summary.billableRate >= 70
                    ? 'Excelent'
                    : summary.billableRate >= 50
                      ? 'Bun'
                      : 'Sub țintă'}
                </div>
              )}
            </div>
          </div>

          {/* Visual Breakdown Bar */}
          {isClient && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Distribuție Ore</div>
              <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100">
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${billablePercentage}%` }}
                >
                  {billablePercentage > 15 && `${billablePercentage.toFixed(0)}%`}
                </div>
                <div
                  className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
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
          )}
        </div>
      )}
    </div>
  );
}
