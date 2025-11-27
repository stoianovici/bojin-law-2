'use client';

/**
 * AI Usage Dashboard Page
 * Story 3.1: AI Service Infrastructure
 *
 * Displays AI token usage, costs, and provider health status
 */

import { useState, useMemo } from 'react';
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

// Mock data for development
const mockUsageStats = {
  totalTokens: 2500000,
  totalCostCents: 4250,
  requestCount: 1250,
  avgLatencyMs: 450,
  cacheHitRate: 0.32,
  byModel: [
    { model: 'claude-3-haiku-20240307', tokens: 500000, costCents: 125, requestCount: 500 },
    { model: 'claude-3-5-sonnet-20241022', tokens: 1500000, costCents: 3750, requestCount: 600 },
    { model: 'claude-3-opus-20240229', tokens: 500000, costCents: 375, requestCount: 150 },
  ],
  byOperation: [
    { operation: 'text_generation', tokens: 800000, costCents: 1500, requestCount: 400 },
    { operation: 'document_summary', tokens: 600000, costCents: 1200, requestCount: 300 },
    { operation: 'classification', tokens: 200000, costCents: 50, requestCount: 200 },
    { operation: 'extraction', tokens: 300000, costCents: 75, requestCount: 150 },
    { operation: 'legal_analysis', tokens: 600000, costCents: 1425, requestCount: 200 },
  ],
};

const mockDailyTrend = [
  { date: '2025-11-20', tokens: 350000, costCents: 600, requests: 175 },
  { date: '2025-11-21', tokens: 420000, costCents: 720, requests: 210 },
  { date: '2025-11-22', tokens: 380000, costCents: 650, requests: 190 },
  { date: '2025-11-23', tokens: 250000, costCents: 430, requests: 125 },
  { date: '2025-11-24', tokens: 280000, costCents: 480, requests: 140 },
  { date: '2025-11-25', tokens: 410000, costCents: 700, requests: 205 },
  { date: '2025-11-26', tokens: 410000, costCents: 670, requests: 205 },
];

const mockProviderHealth = [
  { provider: 'Claude', status: 'HEALTHY', latencyMs: 150, lastChecked: new Date() },
  { provider: 'Grok', status: 'HEALTHY', latencyMs: 200, lastChecked: new Date() },
];

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

export default function AIUsagePage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');

  // In production, fetch from GraphQL
  const usageStats = mockUsageStats;
  const dailyTrend = mockDailyTrend;
  const providerHealth = mockProviderHealth;

  // Calculate model breakdown for pie chart
  const modelPieData = useMemo(() => {
    return usageStats.byModel.map((m) => ({
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
          <h1 className="text-2xl font-bold text-gray-900">AI Usage Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitor AI token usage, costs, and provider health
          </p>
        </div>

        {/* Date range filter */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Tokens</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(usageStats.totalTokens)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Cost</p>
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
                {modelPieData.map((_, index) => (
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
              {providerHealth.map((provider) => (
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
                    {provider.lastChecked.toLocaleTimeString()}
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
