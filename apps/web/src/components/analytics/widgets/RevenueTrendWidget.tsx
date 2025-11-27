/**
 * Revenue Trend Widget
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays line chart showing revenue over time.
 * When comparison is enabled, shows two lines (current vs previous period).
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BaseWidget } from './BaseWidget';
import { ChartSkeleton } from './WidgetSkeleton';
import { formatCurrency, formatDate, formatCompact } from '../utils/formatters';
import type { RevenueTrendPoint } from '../../../hooks/useFinancialKPIs';

export interface RevenueTrendWidgetProps {
  /**
   * Revenue trend data points
   */
  revenueTrend: RevenueTrendPoint[];

  /**
   * Previous period trend data (for comparison)
   */
  previousTrend?: RevenueTrendPoint[] | null;

  /**
   * Whether comparison is enabled
   */
  comparisonEnabled?: boolean;

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Error state
   */
  error?: Error | null;

  /**
   * Retry callback
   */
  onRetry?: () => void;

  /**
   * Optional class name
   */
  className?: string;
}

/**
 * Custom tooltip for line chart
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * RevenueTrendWidget - Line chart showing revenue over time
 */
export function RevenueTrendWidget({
  revenueTrend,
  previousTrend,
  comparisonEnabled = false,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}: RevenueTrendWidgetProps) {
  // Transform data for chart
  const chartData = React.useMemo(() => {
    if (!revenueTrend || revenueTrend.length === 0) return [];

    return revenueTrend.map((point, index) => ({
      date: formatDate(point.date),
      current: point.revenue,
      caseCount: point.caseCount,
      previous:
        comparisonEnabled && previousTrend && previousTrend[index]
          ? previousTrend[index].revenue
          : undefined,
    }));
  }, [revenueTrend, previousTrend, comparisonEnabled]);

  const hasData = chartData.length > 0;

  return (
    <BaseWidget
      title="Evoluție Venituri"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!hasData && !isLoading && !error}
      emptyMessage="Nu există date pentru această perioadă"
      skeleton={<ChartSkeleton />}
      className={className}
    >
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              tickFormatter={(value) => formatCompact(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            {comparisonEnabled && previousTrend && (
              <Legend
                verticalAlign="top"
                height={36}
                iconType="line"
                iconSize={12}
              />
            )}
            <Line
              type="monotone"
              dataKey="current"
              name="Perioada curentă"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#3B82F6' }}
            />
            {comparisonEnabled && previousTrend && (
              <Line
                type="monotone"
                dataKey="previous"
                name="Perioada anterioară"
                stroke="#9CA3AF"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#9CA3AF', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#9CA3AF' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </BaseWidget>
  );
}

export default RevenueTrendWidget;
