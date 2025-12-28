/**
 * Revenue Overview Widget
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays total revenue with pie chart breakdown by billing type.
 * Shows delta badge when comparison is enabled.
 */

'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Banknote } from 'lucide-react';
import { BaseWidget } from './BaseWidget';
import { KPISkeleton } from './WidgetSkeleton';
import { DeltaBadge } from '../DeltaBadge';
import { formatCurrency } from '../utils/formatters';
import type { RevenueByBillingType } from '../../../hooks/useFinancialKPIs';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

/**
 * Chart colors for billing types
 */
const COLORS = {
  hourly: '#3B82F6', // Blue
  fixed: '#10B981', // Green
  retainer: '#F59E0B', // Amber
};

export interface RevenueOverviewWidgetProps {
  /**
   * Total revenue amount
   */
  totalRevenue: number;

  /**
   * Revenue breakdown by billing type
   */
  revenueByBillingType: RevenueByBillingType;

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
   * Delta for comparison (optional)
   */
  delta?: KPIDelta | null;

  /**
   * Optional class name
   */
  className?: string;
}

/**
 * Custom tooltip for pie chart
 */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload[0]) return null;

  return (
    <div className="bg-linear-bg-secondary px-3 py-2 shadow-lg rounded-lg border border-linear-border-subtle">
      <p className="text-sm font-medium text-linear-text-primary">{payload[0].name}</p>
      <p className="text-sm text-linear-text-secondary">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

/**
 * RevenueOverviewWidget - Total revenue with billing type breakdown
 */
export function RevenueOverviewWidget({
  totalRevenue,
  revenueByBillingType,
  isLoading = false,
  error = null,
  onRetry,
  delta,
  className = '',
}: RevenueOverviewWidgetProps) {
  // Prepare chart data
  const chartData = [
    { name: 'Orar', value: revenueByBillingType?.hourly || 0, color: COLORS.hourly },
    { name: 'Fix', value: revenueByBillingType?.fixed || 0, color: COLORS.fixed },
    { name: 'Abonament', value: revenueByBillingType?.retainer || 0, color: COLORS.retainer },
  ].filter((item) => item.value > 0);

  // Check if there's any data
  const hasData = chartData.length > 0 && totalRevenue > 0;

  return (
    <BaseWidget
      title="Sumar Venituri"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!hasData && !isLoading && !error}
      emptyMessage="Nu există date pentru această perioadă"
      skeleton={<KPISkeleton />}
      className={className}
    >
      <div className="space-y-4">
        {/* Total Revenue */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-linear-text-tertiary mb-1">Total Venituri</p>
            <div className="flex items-center gap-2">
              <Banknote className="w-6 h-6 text-linear-success" />
              <span className="text-3xl font-bold text-linear-text-primary">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
          </div>
          {delta && <DeltaBadge delta={delta} size="md" />}
        </div>

        {/* Pie Chart */}
        {hasData && (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        {hasData && (
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-linear-text-secondary">{item.name}</span>
                <span className="font-medium text-linear-text-primary">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}

export default RevenueOverviewWidget;
