/**
 * Document Issues Breakdown Component
 * Story 5.7: Platform Intelligence Dashboard - Task 14
 *
 * Horizontal bar chart displaying document issues by category with severity
 * color coding and drill-down capability.
 * AC: 3 - Document error rates and revision statistics
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { IssueCategory } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DocumentIssuesBreakdownProps {
  /** Issues count by category */
  issuesByCategory: Record<IssueCategory, number>;
  /** Total reviews for percentage calculation */
  totalReviews?: number;
  /** Loading state */
  loading?: boolean;
  /** Callback when clicking on a category */
  onCategoryClick?: (category: IssueCategory) => void;
  /** Whether to show the data table (for accessibility or preference) */
  showTable?: boolean;
}

interface CategoryData {
  category: IssueCategory;
  label: string;
  count: number;
  color: string;
  severity: 'low' | 'medium' | 'high';
  percentage: number;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<
  IssueCategory,
  { label: string; color: string; description: string }
> = {
  spelling: {
    label: 'Ortografie/Gramatică',
    color: '#F59E0B', // amber-500
    description: 'Greșeli de scriere, gramatică și punctuație',
  },
  legal_reference: {
    label: 'Referințe legale',
    color: '#EF4444', // red-500
    description: 'Citări incorecte, articole sau referințe legale greșite',
  },
  formatting: {
    label: 'Formatare',
    color: '#3B82F6', // blue-500
    description: 'Probleme de layout, spațiere și stilizare',
  },
  content: {
    label: 'Conținut',
    color: '#8B5CF6', // violet-500
    description: 'Erori de substanță sau conținut legal incorect',
  },
};

// Severity thresholds (percentage of reviews with this issue type)
const SEVERITY_THRESHOLDS = {
  high: 15, // >= 15% = high severity
  medium: 5, // >= 5% = medium severity
  // < 5% = low severity
};

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverity(percentage: number): 'low' | 'medium' | 'high' {
  if (percentage >= SEVERITY_THRESHOLDS.high) return 'high';
  if (percentage >= SEVERITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function getSeverityBadge(severity: 'low' | 'medium' | 'high'): {
  label: string;
  bg: string;
  text: string;
} {
  switch (severity) {
    case 'high':
      return { label: 'Ridicat', bg: 'bg-linear-error/15', text: 'text-linear-error' };
    case 'medium':
      return { label: 'Mediu', bg: 'bg-linear-warning/15', text: 'text-linear-warning' };
    case 'low':
      return { label: 'Scăzut', bg: 'bg-linear-success/15', text: 'text-linear-success' };
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 animate-pulse">
      <div className="h-5 bg-linear-bg-hover rounded w-48 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-linear-bg-tertiary rounded" />
        ))}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: CategoryData;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const severityBadge = getSeverityBadge(data.severity);

  return (
    <div className="bg-linear-bg-secondary border border-linear-border-subtle rounded-lg shadow-lg p-4 min-w-[220px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: data.color }} />
        <span className="font-semibold text-linear-text-primary">{data.label}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-linear-text-tertiary">Total probleme:</span>
          <span className="font-medium">{data.count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-linear-text-tertiary">Procent:</span>
          <span className="font-medium">{data.percentage.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-linear-text-tertiary">Severitate:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadge.bg} ${severityBadge.text}`}
          >
            {severityBadge.label}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t text-xs text-linear-text-muted">
        {CATEGORY_CONFIG[data.category].description}
      </div>
    </div>
  );
}

interface DataTableProps {
  data: CategoryData[];
  onCategoryClick?: (category: IssueCategory) => void;
}

function DataTable({ data, onCategoryClick }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-linear-border-subtle">
        <thead className="bg-linear-bg-tertiary">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
            >
              Categorie
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
            >
              Probleme
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
            >
              Procent
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
            >
              Severitate
            </th>
            {onCategoryClick && (
              <th
                scope="col"
                className="px-4 py-3 text-center text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Acțiune
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
          {data.map((row) => {
            const severityBadge = getSeverityBadge(row.severity);
            return (
              <tr
                key={row.category}
                className={onCategoryClick ? 'hover:bg-linear-bg-hover cursor-pointer' : ''}
                onClick={() => onCategoryClick?.(row.category)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: row.color }} />
                    <span className="text-sm font-medium text-linear-text-primary">{row.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-linear-text-primary">
                  {row.count.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm text-linear-text-primary">
                  {row.percentage.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityBadge.bg} ${severityBadge.text}`}
                  >
                    {severityBadge.label}
                  </span>
                </td>
                {onCategoryClick && (
                  <td className="px-4 py-3 text-center">
                    <button
                      className="text-linear-accent hover:text-linear-accent-hover text-sm font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCategoryClick(row.category);
                      }}
                    >
                      Vezi documente
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-linear-bg-tertiary">
          <tr>
            <td className="px-4 py-3 text-sm font-semibold text-linear-text-primary">Total</td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-linear-text-primary">
              {data.reduce((sum, d) => sum + d.count, 0).toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-linear-text-primary">100%</td>
            <td colSpan={onCategoryClick ? 2 : 1}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentIssuesBreakdown({
  issuesByCategory,
  totalReviews = 0,
  loading = false,
  onCategoryClick,
  showTable = false,
}: DocumentIssuesBreakdownProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>(showTable ? 'table' : 'chart');

  // Transform data for chart/table
  const chartData = useMemo((): CategoryData[] => {
    const totalIssues = Object.values(issuesByCategory).reduce((sum, count) => sum + count, 0);

    const categories: IssueCategory[] = ['content', 'legal_reference', 'spelling', 'formatting'];

    return categories
      .map((cat) => {
        const count = issuesByCategory[cat] || 0;
        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
        return {
          category: cat,
          label: CATEGORY_CONFIG[cat].label,
          count,
          color: CATEGORY_CONFIG[cat].color,
          severity: getSeverity(percentage),
          percentage: totalIssues > 0 ? (count / totalIssues) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [issuesByCategory, totalReviews]);

  const totalIssues = chartData.reduce((sum, d) => sum + d.count, 0);

  if (loading) {
    return <LoadingSkeleton />;
  }

  const hasData = totalIssues > 0;

  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-linear-text-primary">Detaliere probleme documente</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-linear-text-tertiary">
            {totalIssues.toLocaleString()} probleme totale
          </span>
          {/* View Toggle */}
          <div className="flex bg-linear-bg-tertiary rounded-lg p-0.5 ml-4">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'chart'
                  ? 'bg-linear-bg-secondary shadow text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              }`}
              aria-pressed={viewMode === 'chart'}
            >
              Grafic
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-linear-bg-secondary shadow text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              }`}
              aria-pressed={viewMode === 'table'}
            >
              Tabel
            </button>
          </div>
        </div>
      </div>

      {/* Severity Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-linear-text-tertiary">Severitate:</span>
        {(['high', 'medium', 'low'] as const).map((sev) => {
          const badge = getSeverityBadge(sev);
          return (
            <div key={sev} className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${badge.bg.replace('bg-', 'bg-')}`}
                style={{
                  backgroundColor:
                    sev === 'high' ? '#FCA5A5' : sev === 'medium' ? '#FCD34D' : '#6EE7B7',
                }}
              />
              <span className="text-linear-text-secondary">{badge.label}</span>
            </div>
          );
        })}
      </div>

      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-linear-text-tertiary">
          Nu există probleme înregistrate
        </div>
      ) : viewMode === 'chart' ? (
        /* Chart View */
        <div className="h-64" role="img" aria-label="Grafic probleme documente pe categorie">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 120, right: 40, top: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12, fill: '#374151' }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                cursor={onCategoryClick ? 'pointer' : 'default'}
                onClick={(data) => onCategoryClick?.((data as unknown as CategoryData).category)}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={entry.color}
                    opacity={entry.severity === 'high' ? 1 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Table View */
        <DataTable data={chartData} onCategoryClick={onCategoryClick} />
      )}

      {/* Category Details */}
      {onCategoryClick && viewMode === 'chart' && (
        <div className="mt-4 pt-4 border-t border-linear-border-subtle">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {chartData.map((item) => {
              const severityBadge = getSeverityBadge(item.severity);
              return (
                <button
                  key={item.category}
                  onClick={() => onCategoryClick(item.category)}
                  className="flex flex-col items-start p-3 rounded-lg bg-linear-bg-tertiary hover:bg-linear-bg-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-linear-text-primary truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-linear-text-primary">{item.count}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${severityBadge.bg} ${severityBadge.text}`}
                    >
                      {severityBadge.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Accessibility: Screen Reader Summary */}
      <div className="sr-only">
        <h4>Rezumat probleme documente pe categorie</h4>
        <p>Total probleme: {totalIssues}</p>
        <ul>
          {chartData.map((item) => (
            <li key={item.category}>
              {item.label}: {item.count} probleme ({item.percentage.toFixed(1)}
              %), severitate {getSeverityBadge(item.severity).label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default DocumentIssuesBreakdown;
