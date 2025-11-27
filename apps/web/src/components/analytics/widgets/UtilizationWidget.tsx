/**
 * Utilization Widget
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays circular gauge chart for overall utilization rate.
 * Color coding: Green (>80%), Yellow (60-80%), Red (<60%).
 * Includes breakdown by role with bar chart.
 */

'use client';

import React from 'react';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { BaseWidget } from './BaseWidget';
import { GaugeSkeleton } from './WidgetSkeleton';
import { DeltaBadge } from '../DeltaBadge';
import { formatPercent, formatHours } from '../utils/formatters';
import type { UtilizationByRole } from '../../../hooks/useFinancialKPIs';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

/**
 * Get color based on utilization rate
 */
function getUtilizationColor(rate: number): string {
  if (rate >= 80) return '#10B981'; // Green
  if (rate >= 60) return '#F59E0B'; // Yellow/Amber
  return '#EF4444'; // Red
}

/**
 * Role colors
 */
const ROLE_COLORS: Record<string, string> = {
  Partner: '#6366F1', // Indigo
  Associate: '#3B82F6', // Blue
  Paralegal: '#14B8A6', // Teal
};

export interface UtilizationWidgetProps {
  /**
   * Overall utilization rate (0-100)
   */
  utilizationRate: number;

  /**
   * Total billable hours
   */
  totalBillableHours: number;

  /**
   * Total non-billable hours
   */
  totalNonBillableHours: number;

  /**
   * Utilization breakdown by role
   */
  utilizationByRole: UtilizationByRole[];

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
 * Custom tooltip for bar chart
 */
function CustomBarTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-1">{data.role}</p>
      <p className="text-sm text-gray-600">
        Utilization: {formatPercent(data.utilizationRate)}
      </p>
      <p className="text-xs text-gray-500">
        {formatHours(data.billableHours)} / {formatHours(data.totalHours)}
      </p>
    </div>
  );
}

/**
 * UtilizationWidget - Gauge chart with role breakdown
 */
export function UtilizationWidget({
  utilizationRate,
  totalBillableHours,
  totalNonBillableHours,
  utilizationByRole,
  isLoading = false,
  error = null,
  onRetry,
  delta,
  className = '',
}: UtilizationWidgetProps) {
  const totalHours = totalBillableHours + totalNonBillableHours;
  const hasData = totalHours > 0;

  // Data for radial gauge
  const gaugeData = [
    {
      name: 'Utilization',
      value: utilizationRate,
      fill: getUtilizationColor(utilizationRate),
    },
  ];

  // Role breakdown data
  const roleData = utilizationByRole.map((item) => ({
    ...item,
    color: ROLE_COLORS[item.role] || '#6B7280',
  }));

  return (
    <BaseWidget
      title="Utilizare"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!hasData && !isLoading && !error}
      emptyMessage="Nu există date pentru această perioadă"
      skeleton={<GaugeSkeleton />}
      className={className}
    >
      <div className="space-y-4">
        {/* Gauge Chart */}
        <div className="relative h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              data={gaugeData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: '#E5E7EB' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
            <span
              className="text-3xl font-bold"
              style={{ color: getUtilizationColor(utilizationRate) }}
            >
              {formatPercent(utilizationRate)}
            </span>
            {delta && (
              <div className="mt-1">
                <DeltaBadge delta={delta} size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* Hours summary */}
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Facturabile</p>
            <p className="font-semibold text-gray-900">
              {formatHours(totalBillableHours)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Non-facturabile</p>
            <p className="font-semibold text-gray-900">
              {formatHours(totalNonBillableHours)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Total</p>
            <p className="font-semibold text-gray-900">
              {formatHours(totalHours)}
            </p>
          </div>
        </div>

        {/* Role breakdown */}
        {roleData.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">
              După rol
            </p>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={roleData}
                  layout="vertical"
                  margin={{ left: 10, right: 10 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="role"
                    tick={{ fontSize: 11, fill: '#374151' }}
                    width={70}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="utilizationRate" radius={[0, 4, 4, 0]}>
                    {roleData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getUtilizationColor(entry.utilizationRate)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}

export default UtilizationWidget;
