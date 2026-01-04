/**
 * User AI Usage Detail Page
 * OPS-247: Per-User AI Usage Dashboard
 *
 * Detailed view of a specific user's AI usage including:
 * - Summary stats (cost, tokens, calls)
 * - Daily cost trend chart
 * - Feature usage breakdown
 * - Recent activity log
 */

'use client';

import { useState, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, DollarSign, Zap, Activity, Mail } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { DateRangeSelector, type DateRange } from '@/components/admin/DateRangeSelector';
import { StatCard } from '@/components/admin/StatCard';
import { UserActivityTable } from '@/components/admin/UserActivityTable';
import { useUserAIUsagePage } from '@/hooks/useUserAIUsage';

// ============================================================================
// Props
// ============================================================================

interface PageProps {
  params: Promise<{ userId: string }>;
}

// ============================================================================
// Chart Colors
// ============================================================================

const FEATURE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

// ============================================================================
// Custom Tooltip for Line Chart
// ============================================================================

function DailyTooltip({ active, payload, label }: any) {
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
// Custom Tooltip for Bar Chart
// ============================================================================

function FeatureTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-2">{data.featureName}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Cost:</span>
          <span className="font-medium text-blue-600">{formatCurrency(data.cost)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">% din total:</span>
          <span className="font-medium">{data.percentOfTotal.toFixed(1)}%</span>
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
// Main Page Component
// ============================================================================

export default function UserAIUsagePage({ params }: PageProps) {
  // Unwrap params promise (Next.js 15)
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;

  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });

  const { userUsage, activity, loading, error, loadMore, hasMore } = useUserAIUsagePage(
    userId,
    dateRange
  );

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setDateRange((prev) => ({ ...prev }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/ai-ops/costs"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div>
            {loading && !userUsage ? (
              <>
                <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mt-1" />
              </>
            ) : userUsage ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{userUsage.userName}</h1>
                {userUsage.userEmail && (
                  <p className="text-gray-500 text-sm flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {userUsage.userEmail}
                  </p>
                )}
              </>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">Utilizator negăsit</h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />

          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Reîmprospătează"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Eroare la încărcarea datelor</p>
          <p className="text-red-600 text-sm mt-1">
            {error.message || 'A apărut o eroare neașteptată.'}
          </p>
        </div>
      )}

      {/* User Not Found */}
      {!loading && !userUsage && !error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">Utilizatorul nu a fost găsit</p>
          <p className="text-yellow-600 text-sm mt-1">
            Verificați dacă ID-ul utilizatorului este corect.
          </p>
          <Link
            href="/admin/ai-ops/costs"
            className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Înapoi la costuri
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      {(loading || userUsage) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Cost Total"
            value={userUsage ? formatCurrency(userUsage.totalCost) : '—'}
            subtitle="în perioada selectată"
            icon={DollarSign}
            iconColor="green"
            loading={loading && !userUsage}
          />
          <StatCard
            title="Tokeni Utilizați"
            value={userUsage ? formatCompact(userUsage.totalTokens) : '—'}
            subtitle="input + output"
            icon={Zap}
            iconColor="yellow"
            loading={loading && !userUsage}
          />
          <StatCard
            title="Apeluri AI"
            value={userUsage ? formatCompact(userUsage.totalCalls) : '—'}
            subtitle="cereri procesate"
            icon={Activity}
            iconColor="blue"
            loading={loading && !userUsage}
          />
        </div>
      )}

      {/* Charts Grid */}
      {userUsage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Cost Trend */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Zilnic</h3>
            {userUsage.dailyCosts.length === 0 ? (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Nu există date pentru această perioadă</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={userUsage.dailyCosts}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    tickFormatter={(v) => `€${v.toFixed(2)}`}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    width={60}
                  />
                  <Tooltip content={<DailyTooltip />} />
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

          {/* Feature Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Utilizare pe Funcționalitate
            </h3>
            {userUsage.costsByFeature.length === 0 ? (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Nu există date pentru această perioadă</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={userUsage.costsByFeature}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `€${v.toFixed(2)}`}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="featureName"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    width={120}
                  />
                  <Tooltip content={<FeatureTooltip />} />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                    {userUsage.costsByFeature.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={FEATURE_COLORS[index % FEATURE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Activity Table */}
      <UserActivityTable
        data={activity}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
