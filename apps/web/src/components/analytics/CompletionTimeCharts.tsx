/**
 * Completion Time Charts Component
 * Story 4.7: Task Analytics and Optimization - Task 20
 *
 * Visualizes task completion time metrics by type and user.
 * AC: 1 - Average task completion time by type and user
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CompletionTimeAnalyticsResponse } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DateRangeInput {
  start: string | Date;
  end: string | Date;
}

interface CompletionTimeChartsProps {
  data?: CompletionTimeAnalyticsResponse | undefined;
  loading?: boolean;
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
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
];

const TASK_TYPE_LABELS: Record<string, string> = {
  CourtAppearance: 'Ședință instanță',
  DocumentDrafting: 'Redactare document',
  ClientMeeting: 'Întâlnire client',
  Research: 'Cercetare',
  Filing: 'Depunere',
  Correspondence: 'Corespondență',
  InternalMeeting: 'Întâlnire internă',
  Deadline: 'Termen',
  Review: 'Revizie',
  Other: 'Altele',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function getComparisonColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'text-linear-text-tertiary';
  if (value < -5) return 'text-linear-success';
  if (value > 5) return 'text-linear-error';
  return 'text-linear-text-tertiary';
}

function getComparisonArrow(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value < -5) return '↓';
  if (value > 5) return '↑';
  return '→';
}

// ============================================================================
// Component
// ============================================================================

export function CompletionTimeCharts({
  data,
  loading = false,
  dateRange: _dateRange,
}: CompletionTimeChartsProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-linear-bg-tertiary animate-pulse rounded-lg" />
        <div className="h-64 bg-linear-bg-tertiary animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-linear-text-tertiary">
        Nu există date despre timpul de finalizare
      </div>
    );
  }

  const byTypeData = data.byType.map((item, index) => ({
    name: TASK_TYPE_LABELS[item.taskType] || item.taskType,
    avgHours: item.metrics.avgCompletionTimeHours,
    medianHours: item.metrics.medianCompletionTimeHours,
    count: item.metrics.totalTasksAnalyzed,
    comparison: item.comparedToPrevious,
    color: COLORS[index % COLORS.length],
  }));

  const byUserData = data.byUser.map((item, index) => ({
    name: item.userName,
    avgHours: item.metrics.avgCompletionTimeHours,
    taskCount: item.taskCount,
    vsTeam: item.comparedToTeamAvg,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-8">
      {/* Firm-wide Summary */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h3 className="text-lg font-semibold mb-4">Metrici la nivel de firmă</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-linear-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-linear-accent">
              {formatHours(data.firmMetrics.avgCompletionTimeHours)}
            </div>
            <div className="text-sm text-linear-text-tertiary">Timp mediu</div>
          </div>
          <div className="text-center p-4 bg-linear-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-linear-success">
              {formatHours(data.firmMetrics.medianCompletionTimeHours)}
            </div>
            <div className="text-sm text-linear-text-tertiary">Timp median</div>
          </div>
          <div className="text-center p-4 bg-linear-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-linear-warning">
              {formatHours(data.firmMetrics.minCompletionTimeHours)}
            </div>
            <div className="text-sm text-linear-text-tertiary">Cel mai rapid</div>
          </div>
          <div className="text-center p-4 bg-linear-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-linear-error">
              {formatHours(data.firmMetrics.maxCompletionTimeHours)}
            </div>
            <div className="text-sm text-linear-text-tertiary">Cel mai lent</div>
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-linear-text-tertiary">
          Bazat pe {data.firmMetrics.totalTasksAnalyzed} sarcini finalizate
        </div>
      </div>

      {/* By Task Type Chart */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h3 className="text-lg font-semibold mb-4">Timp finalizare pe tip de sarcină</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byTypeData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v) => formatHours(v)}
                label={{ value: 'Ore', position: 'bottom', offset: -5 }}
              />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatHours(value),
                  name === 'avgHours' ? 'Medie' : 'Median',
                ]}
                labelFormatter={(label) => `Tip sarcină: ${label}`}
              />
              <Legend />
              <Bar dataKey="avgHours" name="Medie" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                {byTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Comparison indicators */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {byTypeData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <span className="truncate">{item.name}:</span>
              <span className={getComparisonColor(item.comparison)}>
                {getComparisonArrow(item.comparison)}
                {item.comparison !== null && item.comparison !== undefined
                  ? `${Math.abs(item.comparison).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By User Chart */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h3 className="text-lg font-semibold mb-4">Timp finalizare pe utilizator</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byUserData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v) => formatHours(v)}
                label={{ value: 'Ore', position: 'bottom', offset: -5 }}
              />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [formatHours(value), 'Timp mediu']}
                labelFormatter={(label) => `Utilizator: ${label}`}
              />
              <Bar dataKey="avgHours" name="Timp mediu" fill="#10B981" radius={[0, 4, 4, 0]}>
                {byUserData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* vs Team Average */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-linear-text-secondary mb-2">vs. Media echipei</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {byUserData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <span className="truncate">{item.name}:</span>
                <span className={getComparisonColor(item.vsTeam)}>
                  {getComparisonArrow(item.vsTeam)}
                  {item.vsTeam !== null && item.vsTeam !== undefined
                    ? `${Math.abs(item.vsTeam).toFixed(1)}%`
                    : 'N/D'}
                </span>
                <span className="text-linear-text-muted">({item.taskCount} sarcini)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompletionTimeCharts;
