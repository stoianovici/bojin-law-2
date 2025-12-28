/**
 * Velocity Trends Chart Component
 * Story 4.7: Task Analytics and Optimization - Task 22
 *
 * Visualizes task velocity trends over time with firm and user breakdowns.
 * AC: 3 - Velocity trends track productivity
 */

'use client';

import React from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { VelocityTrendsResponse, VelocityInterval } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DateRangeInput {
  start: string | Date;
  end: string | Date;
}

interface VelocityTrendsChartProps {
  data?: VelocityTrendsResponse | undefined;
  loading?: boolean;
  interval?: VelocityInterval;
  onIntervalChange?: (interval: VelocityInterval) => void;
  /** Optional date range for self-fetching mode (Platform Intelligence) */
  dateRange?: DateRangeInput;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
];

const TREND_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  // TrendDirection values
  improving: { color: 'text-linear-success', icon: '↑', bg: 'bg-linear-success/10' },
  declining: { color: 'text-linear-error', icon: '↓', bg: 'bg-linear-error/10' },
  stable: { color: 'text-linear-text-secondary', icon: '→', bg: 'bg-linear-bg-tertiary' },
  // TrendDirectionSimple values
  up: { color: 'text-linear-success', icon: '↑', bg: 'bg-linear-success/10' },
  down: { color: 'text-linear-error', icon: '↓', bg: 'bg-linear-error/10' },
};

// ============================================================================
// Component
// ============================================================================

export function VelocityTrendsChart({
  data,
  loading = false,
  interval = 'weekly',
  onIntervalChange,
  dateRange: _dateRange,
}: VelocityTrendsChartProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-linear-bg-tertiary animate-pulse rounded-lg" />
        <div className="h-72 bg-linear-bg-tertiary animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8 text-linear-text-tertiary">Nu există date despre viteză</div>;
  }

  const trendConfig = TREND_CONFIG[data.firmVelocity.trend] || TREND_CONFIG.stable;

  const timeSeriesData = data.timeSeries.map((point) => ({
    date: new Date(point.date).toLocaleDateString('ro-RO', {
      month: 'short',
      day: 'numeric',
    }),
    created: point.tasksCreated,
    completed: point.tasksCompleted,
    velocity: point.velocityScore,
  }));

  return (
    <div className="space-y-6">
      {/* Interval Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tendințe viteză</h3>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as VelocityInterval[]).map((int) => (
            <button
              key={int}
              onClick={() => onIntervalChange?.(int)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                interval === int
                  ? 'bg-linear-accent text-white'
                  : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
              }`}
            >
              {int === 'daily' ? 'Zilnic' : int === 'weekly' ? 'Săptămânal' : 'Lunar'}
            </button>
          ))}
        </div>
      </div>

      {/* Firm Velocity Summary */}
      <div className={`rounded-lg border border-linear-border-subtle p-6 ${trendConfig.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-linear-text-tertiary mb-1">Scor viteză firmă</div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">{data.firmVelocity.current.toFixed(1)}</span>
              <span className={`flex items-center gap-1 ${trendConfig.color}`}>
                <span className="text-xl">{trendConfig.icon}</span>
                <span className="text-lg font-semibold">
                  {Math.abs(data.firmVelocity.percentageChange).toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="text-sm text-linear-text-tertiary mt-1">
              Anterior: {data.firmVelocity.previous.toFixed(1)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-linear-text-tertiary">Tendință</div>
            <div className={`text-lg font-medium capitalize ${trendConfig.color}`}>
              {data.firmVelocity.trend === 'improving'
                ? 'În creștere'
                : data.firmVelocity.trend === 'declining'
                  ? 'În scădere'
                  : 'Stabil'}
            </div>
          </div>
        </div>
      </div>

      {/* Time Series Chart */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h4 className="text-md font-semibold mb-4">Sarcini create vs finalizate</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="created"
                name="Sarcini create"
                fill="#93C5FD"
                stroke="#3B82F6"
                fillOpacity={0.3}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="completed"
                name="Sarcini finalizate"
                fill="#6EE7B7"
                stroke="#10B981"
                fillOpacity={0.3}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="velocity"
                name="Scor viteză"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User Velocity Breakdown */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h4 className="text-md font-semibold mb-4">Viteză echipă</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.byUser.map((user, index) => {
            const userTrend = TREND_CONFIG[user.trendDirection] || TREND_CONFIG.stable;
            return (
              <div key={user.userId} className="bg-linear-bg-tertiary rounded-lg p-4 border border-linear-border-subtle">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  >
                    {user.userName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{user.userName}</div>
                    <div className="text-sm text-linear-text-tertiary">
                      Curent: {user.currentVelocity.toFixed(1)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-linear-text-tertiary">
                    Anterior: {user.previousVelocity.toFixed(1)}
                  </div>
                  <div className={`flex items-center gap-1 ${userTrend.color}`}>
                    <span>{userTrend.icon}</span>
                    <span className="font-semibold">
                      {Math.abs(user.percentageChange).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="mt-3 h-2 bg-linear-bg-hover rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (user.currentVelocity / data.firmVelocity.current) * 100)}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {data.byUser.length === 0 && (
          <div className="text-center py-4 text-linear-text-tertiary">
            Nu există date despre viteza utilizatorilor
          </div>
        )}
      </div>
    </div>
  );
}

export default VelocityTrendsChart;
