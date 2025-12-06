/**
 * AI Utilization Panel Component
 * Story 5.7: Platform Intelligence Dashboard - Task 15
 *
 * Displays AI usage metrics including total requests, tokens, costs,
 * feature breakdown, and adoption rates.
 * AC: 5 - AI utilization by user and feature
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
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type {
  AIUtilizationSummary,
  AIFeatureType,
} from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface AIUtilizationPanelProps {
  data?: AIUtilizationSummary;
  loading?: boolean;
  /** Callback when clicking on a user */
  onUserClick?: (userId: string) => void;
  /** Callback when clicking on a feature */
  onFeatureClick?: (feature: AIFeatureType) => void;
}

interface FeatureChartData {
  feature: AIFeatureType;
  label: string;
  requestCount: number;
  tokenCount: number;
  color: string;
  acceptanceRate?: number;
}

// ============================================================================
// Constants
// ============================================================================

const FEATURE_CONFIG: Record<
  AIFeatureType,
  { label: string; color: string; icon: string }
> = {
  email_drafting: {
    label: 'Redactare email',
    color: '#3B82F6',
    icon: '✉️',
  },
  document_generation: {
    label: 'Generare documente',
    color: '#10B981',
    icon: '📄',
  },
  clause_suggestions: {
    label: 'Sugestii clauze',
    color: '#8B5CF6',
    icon: '📝',
  },
  task_parsing: {
    label: 'Parsare sarcini',
    color: '#F59E0B',
    icon: '✅',
  },
  morning_briefing: {
    label: 'Briefing matinal',
    color: '#EC4899',
    icon: '☀️',
  },
  proactive_suggestions: {
    label: 'Sugestii proactive',
    color: '#06B6D4',
    icon: '💡',
  },
  semantic_search: {
    label: 'Căutare semantică',
    color: '#84CC16',
    icon: '🔍',
  },
  version_comparison: {
    label: 'Comparare versiuni',
    color: '#F97316',
    icon: '📊',
  },
  style_analysis: {
    label: 'Analiză stil',
    color: '#6366F1',
    icon: '🎨',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(dollars);
}

function getAdoptionColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function getAdoptionBg(score: number): string {
  if (score >= 70) return 'bg-emerald-50';
  if (score >= 40) return 'bg-amber-50';
  return 'bg-red-50';
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
      <div className="grid grid-cols-2 gap-6">
        <div className="h-64 bg-gray-100 rounded" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: string;
}

function MetricCard({ title, value, subtitle, trend, icon }: MetricCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs text-gray-500 mb-1">{title}</div>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
      {trend && (
        <div
          className={`text-xs font-medium mt-1 ${
            trend.isPositive ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

interface FeatureUsageChartProps {
  data: FeatureChartData[];
  onFeatureClick?: (feature: AIFeatureType) => void;
}

function FeatureUsageChart({ data, onFeatureClick }: FeatureUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Nu există date de utilizare AI
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 100, right: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11 }}
          width={95}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatNumber(value),
            name === 'requestCount' ? 'Cereri' : 'Tokeni',
          ]}
          labelFormatter={(label) => `Funcție: ${label}`}
        />
        <Legend
          formatter={(value) =>
            value === 'requestCount' ? 'Cereri' : 'Tokeni (K)'
          }
        />
        <Bar
          dataKey="requestCount"
          fill="#3B82F6"
          radius={[0, 4, 4, 0]}
          cursor={onFeatureClick ? 'pointer' : 'default'}
          onClick={(data) => onFeatureClick?.(data.feature)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface FeatureDistributionPieProps {
  data: FeatureChartData[];
}

function FeatureDistributionPie({ data }: FeatureDistributionPieProps) {
  const totalRequests = data.reduce((sum, d) => sum + d.requestCount, 0);

  if (data.length === 0 || totalRequests === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Nu există date disponibile
      </div>
    );
  }

  const pieData = data
    .filter((d) => d.requestCount > 0)
    .map((d) => ({
      ...d,
      percent: (d.requestCount / totalRequests) * 100,
    }));

  return (
    <div className="flex items-center">
      <ResponsiveContainer width="50%" height={250}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="requestCount"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={50}
            paddingAngle={2}
          >
            {pieData.map((entry) => (
              <Cell key={entry.feature} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatNumber(value), 'Cereri']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-1/2 space-y-2">
        {pieData.slice(0, 6).map((item) => (
          <div key={item.feature} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600 truncate flex-1">
              {item.label}
            </span>
            <span className="text-xs font-medium text-gray-900">
              {item.percent.toFixed(0)}%
            </span>
          </div>
        ))}
        {pieData.length > 6 && (
          <div className="text-xs text-gray-400">
            +{pieData.length - 6} altele
          </div>
        )}
      </div>
    </div>
  );
}

interface CostPerUserTableProps {
  users: AIUtilizationSummary['byUser'];
  onUserClick?: (userId: string) => void;
}

function CostPerUserTable({ users, onUserClick }: CostPerUserTableProps) {
  const sortedUsers = [...users].sort((a, b) => b.totalCostCents - a.totalCostCents);
  const topUsers = sortedUsers.slice(0, 5);

  if (topUsers.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        Nu există date de cost per utilizator
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topUsers.map((user, index) => (
        <button
          key={user.userId}
          onClick={() => onUserClick?.(user.userId)}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user.userName}
            </div>
            <div className="text-xs text-gray-500">
              {formatNumber(user.totalRequests)} cereri
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">
              {formatCurrency(user.totalCostCents)}
            </div>
            <div
              className={`text-xs ${getAdoptionColor(user.adoptionScore)}`}
            >
              Adopție: {user.adoptionScore}%
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AIUtilizationPanel({
  data,
  loading = false,
  onUserClick,
  onFeatureClick,
}: AIUtilizationPanelProps) {
  const [selectedFeature, setSelectedFeature] = useState<AIFeatureType | null>(
    null
  );

  // Transform feature data for charts
  const featureChartData = useMemo((): FeatureChartData[] => {
    if (!data?.byFeature) return [];

    return data.byFeature
      .map((f) => ({
        feature: f.feature,
        label: FEATURE_CONFIG[f.feature]?.label || f.feature,
        requestCount: f.requestCount,
        tokenCount: f.tokenCount,
        color: FEATURE_CONFIG[f.feature]?.color || '#6B7280',
        acceptanceRate: f.acceptanceRate,
      }))
      .sort((a, b) => b.requestCount - a.requestCount);
  }, [data]);

  // Calculate average adoption score
  const avgAdoptionScore = useMemo(() => {
    if (!data?.byUser || data.byUser.length === 0) return 0;
    const sum = data.byUser.reduce((acc, u) => acc + u.adoptionScore, 0);
    return Math.round(sum / data.byUser.length);
  }, [data]);

  // Filter data by selected feature
  const filteredFeatureData = useMemo(() => {
    if (!selectedFeature) return featureChartData;
    return featureChartData.filter((f) => f.feature === selectedFeature);
  }, [featureChartData, selectedFeature]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        Nu există date de utilizare AI disponibile
      </div>
    );
  }

  const { firmTotal, byUser, topUsers, underutilizedUsers } = data;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Utilizare AI
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getAdoptionBg(
              avgAdoptionScore
            )} ${getAdoptionColor(avgAdoptionScore)}`}
          >
            Adopție medie: {avgAdoptionScore}%
          </span>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total cereri"
          value={formatNumber(firmTotal.totalRequests)}
          subtitle={`${firmTotal.avgRequestsPerUser.toFixed(1)} medie/utilizator`}
          icon="🤖"
        />
        <MetricCard
          title="Total tokeni"
          value={formatNumber(firmTotal.totalTokens)}
          subtitle="consumați"
          icon="📊"
        />
        <MetricCard
          title="Cost total"
          value={formatCurrency(firmTotal.totalCostCents)}
          subtitle="perioada curentă"
          icon="💰"
        />
        <MetricCard
          title="Utilizatori activi"
          value={byUser.filter((u) => u.totalRequests > 0).length}
          subtitle={`din ${byUser.length} total`}
          icon="👥"
        />
      </div>

      {/* Feature Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedFeature(null)}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            selectedFeature === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Toate
        </button>
        {featureChartData.slice(0, 5).map((f) => (
          <button
            key={f.feature}
            onClick={() =>
              setSelectedFeature(
                selectedFeature === f.feature ? null : f.feature
              )
            }
            className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${
              selectedFeature === f.feature
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{FEATURE_CONFIG[f.feature]?.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Feature Usage Bar Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Utilizare pe funcționalitate
          </h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <FeatureUsageChart
              data={filteredFeatureData}
              onFeatureClick={onFeatureClick}
            />
          </div>
        </div>

        {/* Feature Distribution Pie */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Distribuție cereri
          </h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <FeatureDistributionPie data={featureChartData} />
          </div>
        </div>
      </div>

      {/* Bottom Grid - Users */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Users by Cost */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Top utilizatori (cost)
          </h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <CostPerUserTable users={byUser} onUserClick={onUserClick} />
          </div>
        </div>

        {/* Adoption Summary */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Sumar adopție
          </h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {/* Top Users */}
            <div>
              <div className="text-xs text-gray-500 mb-2">
                Top performeri ({topUsers?.length || 0})
              </div>
              <div className="flex flex-wrap gap-2">
                {topUsers?.slice(0, 4).map((user) => (
                  <button
                    key={user.userId}
                    onClick={() => onUserClick?.(user.userId)}
                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200 transition-colors"
                  >
                    {user.userName} ({user.adoptionScore}%)
                  </button>
                ))}
              </div>
            </div>

            {/* Underutilized Users */}
            {underutilizedUsers && underutilizedUsers.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2">
                  Necesită training ({underutilizedUsers.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {underutilizedUsers.slice(0, 4).map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => onUserClick?.(user.userId)}
                      className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200 transition-colors"
                    >
                      {user.userName} ({user.adoptionScore}%)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Funcții utilizate</div>
                <div className="text-lg font-bold text-gray-900">
                  {featureChartData.filter((f) => f.requestCount > 0).length}
                  <span className="text-sm text-gray-400 font-normal">
                    /{Object.keys(FEATURE_CONFIG).length}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Rată acceptare medie</div>
                <div className="text-lg font-bold text-gray-900">
                  {(() => {
                    const withAcceptance = featureChartData.filter(
                      (f) => f.acceptanceRate !== undefined
                    );
                    if (withAcceptance.length === 0) return 'N/A';
                    const avg =
                      withAcceptance.reduce(
                        (sum, f) => sum + (f.acceptanceRate || 0),
                        0
                      ) / withAcceptance.length;
                    return `${avg.toFixed(0)}%`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility: Data Summary */}
      <div className="sr-only">
        <h4>Rezumat utilizare AI</h4>
        <ul>
          <li>Total cereri: {firmTotal.totalRequests}</li>
          <li>Total tokeni: {firmTotal.totalTokens}</li>
          <li>Cost total: {formatCurrency(firmTotal.totalCostCents)}</li>
          <li>Scor adopție mediu: {avgAdoptionScore}%</li>
        </ul>
        <h4>Utilizare pe funcționalitate</h4>
        <ul>
          {featureChartData.map((f) => (
            <li key={f.feature}>
              {f.label}: {f.requestCount} cereri, {f.tokenCount} tokeni
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default AIUtilizationPanel;
