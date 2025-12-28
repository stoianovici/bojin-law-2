/**
 * Response Time Trend Chart Component
 * Story 5.7: Platform Intelligence Dashboard - Task 12
 *
 * Line chart showing email response time trends over time with SLA threshold.
 * AC: 2 - Communication response time analytics
 */

'use client';

import React, { useMemo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar,
} from 'recharts';
import type { ResponseTimeTrend, ResponseTimeByType } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface ResponseTimeTrendChartProps {
  /** Trend data over time */
  trend: ResponseTimeTrend[];
  /** Optional breakdown by recipient type for context */
  byRecipientType?: ResponseTimeByType[];
  /** Whether the component is loading */
  loading?: boolean;
  /** SLA threshold in hours (default: 24) */
  slaThresholdHours?: number;
  /** Chart height (default: 300) */
  height?: number;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  avgResponseTimeHours: number;
  volumeCount: number;
  isAboveSLA: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  slaThreshold: number;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  responseLine: '#3B82F6', // blue-500
  volumeBar: '#93C5FD', // blue-300
  slaLine: '#EF4444', // red-500
  aboveSLA: '#FEE2E2', // red-100
  belowSLA: '#DCFCE7', // green-100
};

const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  client: 'Clienți',
  opposing_counsel: 'Avocați adversi',
  court: 'Instanțe',
  internal: 'Intern',
  CLIENT: 'Clienți',
  OPPOSING_COUNSEL: 'Avocați adversi',
  COURT: 'Instanțe',
  INTERNAL: 'Intern',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatDate(dateStr: string | Date): { full: string; short: string } {
  const date = new Date(dateStr);
  return {
    full: date.toLocaleDateString('ro-RO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    short: date.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
    }),
  };
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

function CustomTooltip({ active, payload, label, slaThreshold }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const responseTime = payload.find((p) => p.dataKey === 'avgResponseTimeHours');
  const volume = payload.find((p) => p.dataKey === 'volumeCount');
  const isAboveSLA = responseTime && responseTime.value > slaThreshold;

  return (
    <div className="bg-linear-bg-secondary border border-linear-border-subtle rounded-lg shadow-lg p-4 min-w-[200px]">
      <div className="font-medium text-linear-text-primary mb-2 border-b pb-2">{label}</div>
      <div className="space-y-2">
        {/* Response Time */}
        {responseTime && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.responseLine }}
              />
              <span className="text-sm text-linear-text-secondary">Timp răspuns</span>
            </div>
            <span className={`font-semibold ${isAboveSLA ? 'text-linear-error' : 'text-linear-success'}`}>
              {formatHours(responseTime.value)}
            </span>
          </div>
        )}

        {/* Volume */}
        {volume && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.volumeBar }} />
              <span className="text-sm text-linear-text-secondary">Emailuri</span>
            </div>
            <span className="font-semibold text-linear-text-primary">{volume.value.toLocaleString()}</span>
          </div>
        )}

        {/* SLA Status */}
        <div className="pt-2 mt-2 border-t">
          <div
            className={`text-xs font-medium px-2 py-1 rounded text-center ${
              isAboveSLA ? 'bg-linear-error/15 text-linear-error' : 'bg-linear-success/15 text-linear-success'
            }`}
          >
            {isAboveSLA ? `Peste SLA (${slaThreshold}h)` : `În SLA (${slaThreshold}h)`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton({ height }: { height: number }) {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 animate-pulse">
      <div className="h-5 bg-linear-bg-hover rounded w-48 mb-4" />
      <div style={{ height }} className="bg-linear-bg-tertiary rounded" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResponseTimeTrendChart({
  trend,
  byRecipientType,
  loading = false,
  slaThresholdHours = 24,
  height = 300,
}: ResponseTimeTrendChartProps) {
  // Transform data for chart
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!trend || trend.length === 0) return [];

    return trend.map((point) => {
      const formatted = formatDate(point.date);
      return {
        date: formatted.full,
        dateLabel: formatted.short,
        avgResponseTimeHours: point.avgResponseTimeHours,
        volumeCount: point.volumeCount,
        isAboveSLA: point.avgResponseTimeHours > slaThresholdHours,
      };
    });
  }, [trend, slaThresholdHours]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { avg: 0, max: 0, min: 0, daysAboveSLA: 0, totalVolume: 0 };
    }

    const responseTimes = chartData.map((d) => d.avgResponseTimeHours);
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const max = Math.max(...responseTimes);
    const min = Math.min(...responseTimes);
    const daysAboveSLA = chartData.filter((d) => d.isAboveSLA).length;
    const totalVolume = chartData.reduce((sum, d) => sum + d.volumeCount, 0);

    return { avg, max, min, daysAboveSLA, totalVolume };
  }, [chartData]);

  // Max Y value for chart scaling
  const maxYValue = useMemo(() => {
    if (chartData.length === 0) return slaThresholdHours + 12;
    const maxResponse = Math.max(...chartData.map((d) => d.avgResponseTimeHours));
    return Math.max(maxResponse * 1.2, slaThresholdHours + 6);
  }, [chartData, slaThresholdHours]);

  if (loading) {
    return <LoadingSkeleton height={height} />;
  }

  if (!trend || trend.length === 0) {
    return (
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h3 className="text-lg font-semibold text-linear-text-primary mb-4">Tendință timp de răspuns</h3>
        <div className="flex items-center justify-center text-linear-text-tertiary" style={{ height }}>
          Nu există date de tendință disponibile
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-linear-text-primary">Tendință timp de răspuns</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5" style={{ backgroundColor: COLORS.slaLine }} />
            <span className="text-linear-text-tertiary">SLA ({slaThresholdHours}h)</span>
          </div>
          <div
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              stats.daysAboveSLA > 0 ? 'bg-linear-error/15 text-linear-error' : 'bg-linear-success/15 text-linear-success'
            }`}
          >
            {stats.daysAboveSLA === 0 ? 'Toate în SLA' : `${stats.daysAboveSLA} zile peste SLA`}
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-linear-bg-tertiary rounded-lg p-3 text-center">
          <div className="text-xs text-linear-text-tertiary">Medie perioadă</div>
          <div className="text-lg font-bold text-linear-text-primary">{formatHours(stats.avg)}</div>
        </div>
        <div className="bg-linear-bg-tertiary rounded-lg p-3 text-center">
          <div className="text-xs text-linear-text-tertiary">Minim</div>
          <div className="text-lg font-bold text-linear-success">{formatHours(stats.min)}</div>
        </div>
        <div className="bg-linear-bg-tertiary rounded-lg p-3 text-center">
          <div className="text-xs text-linear-text-tertiary">Maxim</div>
          <div
            className={`text-lg font-bold ${
              stats.max > slaThresholdHours ? 'text-linear-error' : 'text-linear-text-primary'
            }`}
          >
            {formatHours(stats.max)}
          </div>
        </div>
        <div className="bg-linear-bg-tertiary rounded-lg p-3 text-center">
          <div className="text-xs text-linear-text-tertiary">Total emailuri</div>
          <div className="text-lg font-bold text-linear-accent">
            {stats.totalVolume.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} role="img" aria-label="Grafic tendință timp de răspuns">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              yAxisId="response"
              domain={[0, maxYValue]}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              tickFormatter={(value) => formatHours(value)}
              label={{
                value: 'Timp răspuns',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#6B7280', fontSize: 12 },
              }}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              label={{
                value: 'Volum',
                angle: 90,
                position: 'insideRight',
                style: { textAnchor: 'middle', fill: '#6B7280', fontSize: 12 },
              }}
            />
            <Tooltip content={<CustomTooltip slaThreshold={slaThresholdHours} />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => {
                const labels: Record<string, string> = {
                  avgResponseTimeHours: 'Timp răspuns mediu',
                  volumeCount: 'Volum emailuri',
                };
                return <span className="text-sm">{labels[value] || value}</span>;
              }}
            />

            {/* SLA Threshold Reference Line */}
            <ReferenceLine
              yAxisId="response"
              y={slaThresholdHours}
              stroke={COLORS.slaLine}
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `SLA ${slaThresholdHours}h`,
                position: 'right',
                fill: COLORS.slaLine,
                fontSize: 11,
              }}
            />

            {/* Volume Bars */}
            <Bar
              yAxisId="volume"
              dataKey="volumeCount"
              fill={COLORS.volumeBar}
              opacity={0.5}
              radius={[4, 4, 0, 0]}
            />

            {/* Response Time Line */}
            <Line
              yAxisId="response"
              type="monotone"
              dataKey="avgResponseTimeHours"
              stroke={COLORS.responseLine}
              strokeWidth={2}
              dot={{
                fill: COLORS.responseLine,
                r: 4,
                strokeWidth: 2,
                stroke: '#fff',
              }}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: '#fff',
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Recipient Type Context (if provided) */}
      {byRecipientType && byRecipientType.length > 0 && (
        <div className="mt-6 pt-4 border-t border-linear-border-subtle">
          <h4 className="text-sm font-medium text-linear-text-secondary mb-3">Timp mediu per tip destinatar</h4>
          <div className="flex flex-wrap gap-3">
            {byRecipientType.map((item) => (
              <div
                key={item.emailType}
                className="flex items-center gap-2 px-3 py-2 bg-linear-bg-tertiary rounded-lg"
              >
                <span className="text-sm text-linear-text-secondary">
                  {RECIPIENT_TYPE_LABELS[item.emailType] || item.emailType}:
                </span>
                <span
                  className={`font-semibold ${
                    item.metrics.avgResponseTimeHours > slaThresholdHours
                      ? 'text-linear-error'
                      : 'text-linear-success'
                  }`}
                >
                  {formatHours(item.metrics.avgResponseTimeHours)}
                </span>
                <span className="text-xs text-linear-text-muted">({item.volumeCount} emailuri)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accessibility: Data Table for Screen Readers */}
      <div className="sr-only">
        <table>
          <caption>Tendință timp de răspuns email</caption>
          <thead>
            <tr>
              <th>Data</th>
              <th>Timp răspuns mediu (ore)</th>
              <th>Volum emailuri</th>
              <th>Status SLA</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.avgResponseTimeHours.toFixed(2)}</td>
                <td>{row.volumeCount}</td>
                <td>{row.isAboveSLA ? 'Peste SLA' : 'În SLA'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ResponseTimeTrendChart;
