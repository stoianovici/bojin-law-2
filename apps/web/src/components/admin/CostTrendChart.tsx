/**
 * CostTrendChart Component
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Line chart showing daily AI costs over time with optional budget line.
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
  ReferenceLine,
} from 'recharts';
import clsx from 'clsx';
import type { AIDailyCost } from '@/hooks/useAIOps';

// ============================================================================
// Types
// ============================================================================

export interface CostTrendChartProps {
  /** Daily cost data */
  data: AIDailyCost[];
  /** Optional daily budget limit line */
  dailyBudget?: number | null;
  /** Loading state */
  loading?: boolean;
  /** Chart height */
  height?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date for display on X axis
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

/**
 * Format EUR currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format compact number
 */
function formatCompact(value: number): string {
  if (value >= 1000000) {
    return `€${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `€${(value / 1000).toFixed(1)}K`;
  }
  return `€${value.toFixed(0)}`;
}

// ============================================================================
// Custom Tooltip
// ============================================================================

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-2">{formatDate(label)}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Cost:</span>
          <span className="font-medium text-blue-600">{formatCurrency(data.cost)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Tokeni:</span>
          <span className="font-medium">{data.tokens.toLocaleString('ro-RO')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Apeluri:</span>
          <span className="font-medium">{data.calls.toLocaleString('ro-RO')}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

// Pre-computed heights for skeleton bars to avoid Math.random() during render
const SKELETON_HEIGHTS = [45, 72, 38, 65, 55, 80, 42, 68, 50, 75];

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-full bg-gray-100 rounded-lg flex items-end justify-evenly px-4 pb-4">
        {SKELETON_HEIGHTS.map((h, i) => (
          <div key={i} className="w-4 bg-gray-200 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CostTrendChart({
  data,
  dailyBudget,
  loading = false,
  height = 300,
  className,
}: CostTrendChartProps) {
  if (loading) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
        <ChartSkeleton height={height} />
      </div>
    );
  }

  const hasData = data.length > 0;

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Tendință Costuri</h3>
        {dailyBudget && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-3 h-0.5 bg-red-400" />
            <span>Limită zilnică: {formatCurrency(dailyBudget)}</span>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height }}>
          <p className="text-gray-500">Nu există date pentru această perioadă</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            {dailyBudget && (
              <ReferenceLine
                y={dailyBudget}
                stroke="#EF4444"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
            )}
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: '#3B82F6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default CostTrendChart;
