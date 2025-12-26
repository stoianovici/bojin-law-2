/**
 * Feature Breakdown Chart
 * OPS-244: Cost Breakdown & Charts Page
 *
 * Horizontal bar chart showing AI cost breakdown by feature.
 */

'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AIFeatureCost } from '@/hooks/useAICosts';

// ============================================================================
// Types
// ============================================================================

interface FeatureBreakdownChartProps {
  data: AIFeatureCost[];
  loading?: boolean;
}

// ============================================================================
// Colors
// ============================================================================

const COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
];

// ============================================================================
// Helpers
// ============================================================================

function formatCost(cost: number): string {
  return `€${cost.toFixed(2)}`;
}

// ============================================================================
// Custom Tooltip (defined outside component to avoid recreation during render)
// ============================================================================

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AIFeatureCost }>;
}) {
  if (!active || !payload || !payload[0]) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900">{item.featureName}</p>
      <div className="mt-1 space-y-0.5 text-sm">
        <p className="text-gray-600">
          Cost: <span className="font-medium text-gray-900">€{item.cost.toFixed(2)}</span>
        </p>
        <p className="text-gray-600">
          Tokeni: <span className="font-medium text-gray-900">{item.tokens.toLocaleString()}</span>
        </p>
        <p className="text-gray-600">
          Apeluri: <span className="font-medium text-gray-900">{item.calls.toLocaleString()}</span>
        </p>
        <p className="text-gray-600">
          Procent:{' '}
          <span className="font-medium text-gray-900">{item.percentOfTotal.toFixed(1)}%</span>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function FeatureBreakdownChart({ data, loading }: FeatureBreakdownChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="flex-1 h-8 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost pe Funcționalitate</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          Nu există date pentru perioada selectată
        </div>
      </div>
    );
  }

  // Sort by cost descending
  const sortedData = [...data].sort((a, b) => b.cost - a.cost);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Cost pe Funcționalitate</h3>

      <ResponsiveContainer width="100%" height={Math.max(300, sortedData.length * 50)}>
        <BarChart data={sortedData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis
            type="number"
            tickFormatter={(value) => `€${value}`}
            fontSize={12}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="featureName"
            width={150}
            fontSize={12}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={30}>
            {sortedData.map((entry, index) => (
              <Cell key={entry.feature} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend with percentages */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sortedData.map((item, index) => (
          <div key={item.feature} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-sm text-gray-600 truncate">{item.featureName}</span>
            <span className="text-sm font-medium text-gray-900 ml-auto">
              {formatCost(item.cost)} ({item.percentOfTotal.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
