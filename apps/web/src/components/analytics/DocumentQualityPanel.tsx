/**
 * Document Quality Panel Component
 * Story 5.7: Platform Intelligence Dashboard - Task 13
 *
 * Displays document quality metrics including first-time-right percentage,
 * revision counts, issues by category, and quality trends.
 * AC: 3 - Document error rates and revision statistics
 */

'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DocumentQualityAnalytics, IssueCategory } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DocumentQualityPanelProps {
  data?: DocumentQualityAnalytics;
  loading?: boolean;
  /** Callback when clicking on quality trend - navigates to documents for that date */
  onDateClick?: (date: Date) => void;
  /** Callback when clicking on issue category - navigates to documents with that issue type */
  onCategoryClick?: (category: IssueCategory) => void;
}

interface CategoryChartData {
  category: IssueCategory;
  label: string;
  count: number;
  color: string;
}

interface TrendChartData {
  date: string;
  dateLabel: string;
  firstTimeRightPercent: number;
  avgRevisions: number;
  issueCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<IssueCategory, { label: string; color: string }> = {
  spelling: { label: 'Ortografie', color: '#F59E0B' }, // amber-500
  legal_reference: { label: 'Referințe legale', color: '#EF4444' }, // red-500
  formatting: { label: 'Formatare', color: '#3B82F6' }, // blue-500
  content: { label: 'Conținut', color: '#8B5CF6' }, // violet-500
};

const QUALITY_THRESHOLDS = {
  firstTimeRight: { good: 80, medium: 60 }, // >= 80% = good
  avgRevisions: { good: 1, medium: 2 }, // <= 1 = good
  resolutionTime: { good: 4, medium: 8 }, // <= 4h = good
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function getQualityColor(
  value: number,
  thresholds: { good: number; medium: number },
  higherIsBetter: boolean = true
): string {
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'text-emerald-600';
    if (value >= thresholds.medium) return 'text-amber-600';
    return 'text-red-600';
  } else {
    if (value <= thresholds.good) return 'text-emerald-600';
    if (value <= thresholds.medium) return 'text-amber-600';
    return 'text-red-600';
  }
}

function getQualityBg(
  value: number,
  thresholds: { good: number; medium: number },
  higherIsBetter: boolean = true
): string {
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'bg-emerald-50';
    if (value >= thresholds.medium) return 'bg-amber-50';
    return 'bg-red-50';
  } else {
    if (value <= thresholds.good) return 'bg-emerald-50';
    if (value <= thresholds.medium) return 'bg-amber-50';
    return 'bg-red-50';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded mb-4" />
      <div className="h-48 bg-gray-100 rounded" />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  colorClass?: string;
  bgClass?: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  colorClass = 'text-gray-900',
  bgClass = 'bg-gray-50',
}: MetricCardProps) {
  return (
    <div className={`rounded-lg p-4 ${bgClass}`}>
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}

interface FirstTimeRightGaugeProps {
  percent: number;
}

function FirstTimeRightGauge({ percent }: FirstTimeRightGaugeProps) {
  const colorClass = getQualityColor(percent, QUALITY_THRESHOLDS.firstTimeRight);
  const strokeColor =
    percent >= QUALITY_THRESHOLDS.firstTimeRight.good
      ? '#10B981'
      : percent >= QUALITY_THRESHOLDS.firstTimeRight.medium
        ? '#F59E0B'
        : '#EF4444';

  // SVG circle parameters
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${colorClass}`}>{percent.toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-600 text-center">Corect din prima</div>
    </div>
  );
}

interface IssuesByCategoryChartProps {
  data: CategoryChartData[];
  onCategoryClick?: (category: IssueCategory) => void;
}

function IssuesByCategoryChart({ data, onCategoryClick }: IssuesByCategoryChartProps) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500">
        Nu există probleme înregistrate
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={80} />
        <Tooltip
          formatter={(value: number) => [value, 'Probleme']}
          labelFormatter={(label) => `Categorie: ${label}`}
        />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          cursor={onCategoryClick ? 'pointer' : 'default'}
          onClick={(data) => onCategoryClick?.(data.category)}
        >
          {data.map((entry) => (
            <Cell key={entry.category} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface QualityTrendChartProps {
  data: TrendChartData[];
  onDateClick?: (date: Date) => void;
}

function QualityTrendChart({ data, onDateClick }: QualityTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Nu există date de tendință disponibile
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        onClick={(e) => {
          if (e?.activePayload?.[0]?.payload && onDateClick) {
            const dateStr = e.activePayload[0].payload.date;
            onDateClick(new Date(dateStr));
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            const labels: Record<string, string> = {
              firstTimeRightPercent: 'Corect din prima',
            };
            return [`${value.toFixed(1)}%`, labels[name] || name];
          }}
        />
        <Area
          type="monotone"
          dataKey="firstTimeRightPercent"
          stroke="#10B981"
          fill="#D1FAE5"
          strokeWidth={2}
          dot={{ fill: '#10B981', r: 3 }}
          activeDot={{ r: 5, cursor: onDateClick ? 'pointer' : 'default' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentQualityPanel({
  data,
  loading = false,
  onDateClick,
  onCategoryClick,
}: DocumentQualityPanelProps) {
  // Transform issues by category for chart
  const categoryChartData = useMemo((): CategoryChartData[] => {
    if (!data?.errorMetrics?.issuesByCategory) return [];

    const categories: IssueCategory[] = ['spelling', 'legal_reference', 'formatting', 'content'];
    return categories.map((cat) => ({
      category: cat,
      label: CATEGORY_CONFIG[cat].label,
      count: data.errorMetrics.issuesByCategory[cat] || 0,
      color: CATEGORY_CONFIG[cat].color,
    }));
  }, [data]);

  // Transform trend data for chart
  const trendChartData = useMemo((): TrendChartData[] => {
    if (!data?.qualityTrend) return [];

    return data.qualityTrend.map((point) => {
      const date = new Date(point.date);
      return {
        date: point.date.toString(),
        dateLabel: date.toLocaleDateString('ro-RO', {
          day: 'numeric',
          month: 'short',
        }),
        firstTimeRightPercent: point.firstTimeRightPercent,
        avgRevisions: point.avgRevisions,
        issueCount: point.issueCount,
      };
    });
  }, [data]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        Nu există date de calitate documente disponibile
      </div>
    );
  }

  const { revisionMetrics, errorMetrics } = data;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Calitate documente</h3>
        <div className="text-sm text-gray-500">
          {revisionMetrics.totalDocumentsCreated.toLocaleString()} documente analizate
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* First-time-right Gauge */}
        <div className="col-span-1 flex justify-center">
          <FirstTimeRightGauge percent={revisionMetrics.firstTimeRightPercent} />
        </div>

        {/* Revision Metrics */}
        <MetricCard
          title="Medie revizuiri"
          value={revisionMetrics.avgRevisionsPerDocument.toFixed(1)}
          subtitle="per document"
          colorClass={getQualityColor(
            revisionMetrics.avgRevisionsPerDocument,
            QUALITY_THRESHOLDS.avgRevisions,
            false
          )}
          bgClass={getQualityBg(
            revisionMetrics.avgRevisionsPerDocument,
            QUALITY_THRESHOLDS.avgRevisions,
            false
          )}
        />

        <MetricCard
          title="Fără revizuiri"
          value={revisionMetrics.documentsWithZeroRevisions.toLocaleString()}
          subtitle="documente corecte din prima"
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />

        <MetricCard
          title="Multiple revizuiri"
          value={revisionMetrics.documentsWithMultipleRevisions.toLocaleString()}
          subtitle="documente cu >1 revizuiri"
          colorClass={
            revisionMetrics.documentsWithMultipleRevisions >
            revisionMetrics.totalDocumentsCreated * 0.3
              ? 'text-amber-600'
              : 'text-gray-900'
          }
        />

        <MetricCard
          title="Timp rezolvare"
          value={formatHours(errorMetrics.issueResolutionTimeHours)}
          subtitle="medie rezolvare probleme"
          colorClass={getQualityColor(
            errorMetrics.issueResolutionTimeHours,
            QUALITY_THRESHOLDS.resolutionTime,
            false
          )}
          bgClass={getQualityBg(
            errorMetrics.issueResolutionTimeHours,
            QUALITY_THRESHOLDS.resolutionTime,
            false
          )}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Issues by Category */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Probleme pe categorie</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <IssuesByCategoryChart data={categoryChartData} onCategoryClick={onCategoryClick} />
          </div>
          {/* Category Legend */}
          <div className="mt-3 flex flex-wrap gap-2">
            {categoryChartData.map((item) => (
              <button
                key={item.category}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-gray-100 transition-colors"
                onClick={() => onCategoryClick?.(item.category)}
              >
                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} />
                <span className="text-gray-600">{item.label}</span>
                <span className="text-gray-400">({item.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Review Metrics Summary */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Statistici revizuiri</h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total revizuiri</span>
              <span className="font-semibold">
                {errorMetrics.totalReviewsCompleted.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Cu probleme</span>
              <span className="font-semibold text-amber-600">
                {errorMetrics.reviewsWithIssues.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Medie probleme/revizuire</span>
              <span className="font-semibold">{errorMetrics.avgIssuesPerReview.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rată succes</span>
                <span className="font-semibold text-emerald-600">
                  {(
                    ((errorMetrics.totalReviewsCompleted - errorMetrics.reviewsWithIssues) /
                      Math.max(errorMetrics.totalReviewsCompleted, 1)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Trend */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Tendință calitate în timp</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <QualityTrendChart data={trendChartData} onDateClick={onDateClick} />
        </div>
        {onDateClick && (
          <p className="text-xs text-gray-400 mt-2">
            Click pe un punct pentru a vedea documentele din acea zi
          </p>
        )}
      </div>

      {/* Accessibility: Data Summary for Screen Readers */}
      <div className="sr-only">
        <h4>Rezumat calitate documente</h4>
        <ul>
          <li>Corect din prima: {revisionMetrics.firstTimeRightPercent.toFixed(1)}%</li>
          <li>
            Medie revizuiri per document: {revisionMetrics.avgRevisionsPerDocument.toFixed(2)}
          </li>
          <li>Documente fără revizuiri: {revisionMetrics.documentsWithZeroRevisions}</li>
          <li>
            Timp mediu rezolvare probleme: {formatHours(errorMetrics.issueResolutionTimeHours)}
          </li>
        </ul>
        <h4>Probleme pe categorie</h4>
        <ul>
          {categoryChartData.map((item) => (
            <li key={item.category}>
              {item.label}: {item.count} probleme
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default DocumentQualityPanel;
