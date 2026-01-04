'use client';

/**
 * AI Usage Dashboard Page
 * Story 3.1: AI Service Infrastructure
 *
 * Displays AI token usage, costs, and provider health status
 */

import { useState, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

// GraphQL Queries
const AI_USAGE_STATS_QUERY = gql`
  query GetAIUsageStats($dateRange: DateRangeInput!, $firmId: ID!) {
    aiUsageStats(dateRange: $dateRange, firmId: $firmId) {
      totalTokens
      totalCostCents
      requestCount
      avgLatencyMs
      cacheHitRate
      byModel {
        model
        tokens
        costCents
        requestCount
      }
      byOperation {
        operation
        tokens
        costCents
        requestCount
      }
    }
  }
`;

const AI_DAILY_USAGE_QUERY = gql`
  query GetAIDailyUsage($dateRange: DateRangeInput!, $firmId: ID!) {
    aiDailyUsageTrend(dateRange: $dateRange, firmId: $firmId) {
      date
      tokens
      costCents
      requests
    }
  }
`;

const AI_PROVIDER_HEALTH_QUERY = gql`
  query GetAIProviderHealth {
    aiProviderHealth {
      provider
      status
      latencyMs
      lastChecked
      consecutiveFailures
    }
  }
`;

// Types
interface AIUsageStats {
  totalTokens: number;
  totalCostCents: number;
  requestCount: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  byModel: { model: string; tokens: number; costCents: number; requestCount: number }[];
  byOperation: { operation: string; tokens: number; costCents: number; requestCount: number }[];
}

interface DailyUsage {
  date: string;
  tokens: number;
  costCents: number;
  requests: number;
}

interface ProviderHealth {
  provider: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  latencyMs: number;
  lastChecked: string;
  consecutiveFailures?: number;
}

// Empty state fallbacks
const emptyUsageStats: AIUsageStats = {
  totalTokens: 0,
  totalCostCents: 0,
  requestCount: 0,
  avgLatencyMs: 0,
  cacheHitRate: 0,
  byModel: [],
  byOperation: [],
};

const emptyDailyTrend: DailyUsage[] = [];

const emptyProviderHealth: ProviderHealth[] = [];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

// Format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HEALTHY: 'bg-green-100 text-green-800',
    DEGRADED: 'bg-yellow-100 text-yellow-800',
    UNAVAILABLE: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status}
    </span>
  );
}

// Calculate date range from selection
function getDateRange(range: '7d' | '30d' | '90d'): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default function AIUsagePage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Calculate date range
  const dateRangeInput = useMemo(() => getDateRange(dateRange), [dateRange]);

  // Get firm ID from user
  const firmId = user?.firmId || '';

  // Fetch AI usage stats
  const { data: statsData, loading: statsLoading } = useQuery<{
    aiUsageStats: AIUsageStats;
  }>(AI_USAGE_STATS_QUERY, {
    variables: {
      dateRange: dateRangeInput,
      firmId,
    },
    skip: !firmId,
  });

  // Fetch daily usage trend
  const { data: trendData, loading: trendLoading } = useQuery<{
    aiDailyUsageTrend: DailyUsage[];
  }>(AI_DAILY_USAGE_QUERY, {
    variables: {
      dateRange: dateRangeInput,
      firmId,
    },
    skip: !firmId,
  });

  // Fetch provider health
  const { data: healthData, loading: healthLoading } = useQuery<{
    aiProviderHealth: ProviderHealth[];
  }>(AI_PROVIDER_HEALTH_QUERY);

  // Use data or fallback to empty
  const usageStats = statsData?.aiUsageStats ?? emptyUsageStats;
  const dailyTrend = trendData?.aiDailyUsageTrend ?? emptyDailyTrend;
  const providerHealth = healthData?.aiProviderHealth ?? emptyProviderHealth;

  const isLoading = statsLoading || trendLoading || healthLoading;

  // Calculate model breakdown for pie chart
  const modelPieData = useMemo(() => {
    return usageStats.byModel.map((m: { model: string; costCents: number }) => ({
      name: m.model.split('-').slice(1, 3).join(' '),
      value: m.costCents,
    }));
  }, [usageStats]);

  // Check authorization
  if (!user || !['Partner', 'BusinessOwner'].includes(user.role)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Access Denied</h2>
          <p className="text-red-600 text-sm">
            This page is only accessible to Partners and Business Owners.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tablou Utilizare AI</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitorizați utilizarea token-urilor AI, costuri și starea providerilor
            {isLoading && <span className="ml-2 text-blue-500">(Se încarcă...)</span>}
          </p>
        </div>

        {/* Date range filter */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {range === '7d' ? '7 Zile' : range === '30d' ? '30 Zile' : '90 Zile'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Tokeni</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(usageStats.totalTokens)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Cost Total</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(usageStats.totalCostCents)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Requests</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatNumber(usageStats.requestCount)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Avg Latency</p>
          <p className="text-2xl font-bold text-gray-900">{usageStats.avgLatencyMs.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Cache Hit Rate</p>
          <p className="text-2xl font-bold text-gray-900">
            {(usageStats.cacheHitRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Over Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Token Usage Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} fontSize={12} />
              <YAxis tickFormatter={(value) => formatNumber(value)} fontSize={12} />
              <Tooltip
                formatter={(value: number) => formatNumber(value)}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="tokens"
                stroke="#0088FE"
                name="Tokens"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Model */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by Model</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={modelPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {modelPieData.map((_: { name: string; value: number }, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Operation Types Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage by Operation Type</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={usageStats.byOperation}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="operation"
              tickFormatter={(value) =>
                value.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
              }
              fontSize={12}
            />
            <YAxis tickFormatter={(value) => formatNumber(value)} fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'tokens' ? formatNumber(value) : formatCurrency(value),
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
            />
            <Legend />
            <Bar dataKey="tokens" fill="#0088FE" name="Tokens" />
            <Bar dataKey="costCents" fill="#00C49F" name="Cost (cents)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Provider Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Provider Health Status</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Checked
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {providerHealth.map((provider: ProviderHealth) => (
                <tr key={provider.provider}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {provider.provider}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <StatusBadge status={provider.status} />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {provider.latencyMs}ms
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(provider.lastChecked).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            // Export functionality would be implemented here
            alert('Export functionality coming soon');
          }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Export Data
        </button>
      </div>
    </div>
  );
}
