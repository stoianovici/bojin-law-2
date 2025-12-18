'use client';

/**
 * Performance Dashboard Page
 * Story 3.8: Document System Testing and Performance - Task 18
 *
 * Displays system performance metrics:
 * - API response times
 * - AI operation latencies
 * - Database query times
 * - Cache hit/miss rates
 * - System health indicators
 * - Performance alerts
 */

import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

// Performance thresholds from story requirements
const THRESHOLDS = {
  api: {
    documentUpload: { p95: 3000, target: 2000 },
    documentDownload: { p95: 1000, target: 500 },
    search: { p95: 500, target: 300 },
    graphql: { p95: 200, target: 100 },
  },
  ai: {
    haiku: { ttft: 500, total: 2000 },
    sonnet: { ttft: 1000, total: 5000 },
    opus: { ttft: 2000, total: 15000 },
  },
  database: {
    query: { p95: 100, target: 50 },
  },
  cache: {
    minHitRate: 0.7,
  },
};

// Empty placeholder data - in production, fetch from GraphQL API
const emptyPerformanceSnapshot = {
  timestamp: new Date().toISOString(),
  api: {
    totalRequests: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    errorRate: 0,
    byEndpoint: [] as Array<{
      endpoint: string;
      method: string;
      requestCount: number;
      avgResponseTime: number;
      p95ResponseTime: number;
      errorCount: number;
      status: string;
    }>,
  },
  ai: {
    totalOperations: 0,
    avgLatency: 0,
    p95Latency: 0,
    byModel: [] as Array<{
      model: string;
      requestCount: number;
      avgTTFT: number;
      avgTotalLatency: number;
      errorCount: number;
      status: string;
    }>,
    byOperation: [] as Array<{
      operation: string;
      count: number;
      avgLatency: number;
      p95Latency: number;
      successRate: number;
    }>,
  },
  database: {
    queryCount: 0,
    avgQueryTime: 0,
    p95QueryTime: 0,
    connectionPoolUsage: 0,
    slowQueries: 0,
  },
  cache: {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    memoryUsage: 0,
  },
  system: {
    uptime: 0,
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 1,
      external: 0,
      rss: 0,
    },
    cpuUsage: 0,
    activeConnections: 0,
  },
};

// Empty historical data - should be fetched from API
const emptyHistoricalData: Array<{
  timestamp: string;
  apiResponseTime: number;
  aiLatency: number;
  dbQueryTime: number;
  cacheHitRate: number;
}> = [];

// Empty alerts - should be fetched from API
const emptyAlerts: Array<{
  id: string;
  type: string;
  severity: string;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}> = [];

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HEALTHY: 'bg-green-100 text-green-800',
    DEGRADED: 'bg-yellow-100 text-yellow-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status}
    </span>
  );
}

// Severity badge component
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colors[severity] || 'bg-gray-100 text-gray-800'}`}
    >
      {severity}
    </span>
  );
}

// KPI Card component
function KPICard({
  title,
  value,
  subtitle,
  status,
}: {
  title: string;
  value: string;
  subtitle?: string;
  status?: 'good' | 'warning' | 'critical';
}) {
  const borderColors = {
    good: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    critical: 'border-l-red-500',
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 border-l-4 ${status ? borderColors[status] : 'border-l-gray-200'}`}
    >
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function PerformanceDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'ai' | 'database' | 'alerts'>(
    'overview'
  );
  const [refreshInterval, setRefreshInterval] = useState<number>(30);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // TODO: Fetch from GraphQL API when performance metrics service is ready
  const snapshot = emptyPerformanceSnapshot;
  const historicalData = emptyHistoricalData;
  const alerts = emptyAlerts;

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
      // In production: refetch GraphQL queries
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Get overall system status
  const systemStatus = useMemo(() => {
    const issues = [];
    if (snapshot.api.errorRate > 0.05) issues.push('High API error rate');
    if (snapshot.cache.hitRate < THRESHOLDS.cache.minHitRate) issues.push('Low cache hit rate');
    if (snapshot.database.slowQueries > 20) issues.push('Many slow queries');

    if (issues.length === 0) return 'HEALTHY';
    if (issues.length <= 2) return 'DEGRADED';
    return 'CRITICAL';
  }, [snapshot]);

  // Check authorization
  if (!user || !['Partner', 'BusinessOwner', 'Admin'].includes(user.role)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Acces Interzis</h2>
          <p className="text-red-600 text-sm">
            Această pagină este accesibilă doar Partenerilor, Proprietarilor de Afaceri și
            Administratorilor.
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
          <h1 className="text-2xl font-bold text-gray-900">Tablou Performanță</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitorizarea performanței sistemului și alerte
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* System Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Stare Sistem:</span>
            <StatusBadge status={systemStatus} />
          </div>

          {/* Refresh Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Reîmprospătare:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
          </div>

          <span className="text-xs text-gray-400">Ultima: {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {(['overview', 'api', 'ai', 'database', 'alerts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'alerts' && alerts.filter((a) => !a.acknowledged).length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {alerts.filter((a) => !a.acknowledged).length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <KPICard
              title="API Requests"
              value={formatNumber(snapshot.api.totalRequests)}
              subtitle={`${formatPercent(snapshot.api.errorRate)} errors`}
              status={
                snapshot.api.errorRate < 0.01
                  ? 'good'
                  : snapshot.api.errorRate < 0.05
                    ? 'warning'
                    : 'critical'
              }
            />
            <KPICard
              title="API p95"
              value={`${snapshot.api.p95ResponseTime}ms`}
              subtitle="Response time"
              status={
                snapshot.api.p95ResponseTime < 200
                  ? 'good'
                  : snapshot.api.p95ResponseTime < 500
                    ? 'warning'
                    : 'critical'
              }
            />
            <KPICard
              title="AI Operations"
              value={formatNumber(snapshot.ai.totalOperations)}
              subtitle={`${snapshot.ai.avgLatency.toFixed(0)}ms avg`}
            />
            <KPICard
              title="Cache Hit Rate"
              value={formatPercent(snapshot.cache.hitRate)}
              status={
                snapshot.cache.hitRate >= 0.7
                  ? 'good'
                  : snapshot.cache.hitRate >= 0.5
                    ? 'warning'
                    : 'critical'
              }
            />
            <KPICard
              title="DB Queries"
              value={formatNumber(snapshot.database.queryCount)}
              subtitle={`${snapshot.database.slowQueries} slow`}
              status={
                snapshot.database.slowQueries < 10
                  ? 'good'
                  : snapshot.database.slowQueries < 50
                    ? 'warning'
                    : 'critical'
              }
            />
            <KPICard
              title="Uptime"
              value={formatDuration(snapshot.system.uptime)}
              subtitle={`${snapshot.system.activeConnections} connections`}
            />
          </div>

          {/* Historical Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response Time Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tendință Timp Răspuns (24h)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).getHours() + ':00'}
                    fontSize={12}
                  />
                  <YAxis tickFormatter={(value) => `${value}ms`} fontSize={12} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Response Time']}
                  />
                  <ReferenceLine y={200} stroke="#ff7300" strokeDasharray="3 3" label="Target" />
                  <Area
                    type="monotone"
                    dataKey="apiResponseTime"
                    stroke="#0088FE"
                    fill="#0088FE"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Cache Hit Rate Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Rată Utilizare Cache (24h)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).getHours() + ':00'}
                    fontSize={12}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    fontSize={12}
                  />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Hit Rate']}
                  />
                  <ReferenceLine y={0.7} stroke="#00C49F" strokeDasharray="3 3" label="Target" />
                  <Line
                    type="monotone"
                    dataKey="cacheHitRate"
                    stroke="#00C49F"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* System Resources */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resurse Sistem</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Utilizare CPU</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${snapshot.system.cpuUsage < 0.7 ? 'bg-green-500' : snapshot.system.cpuUsage < 0.9 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${snapshot.system.cpuUsage * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-sm font-medium">
                  {formatPercent(snapshot.system.cpuUsage)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Memorie Heap</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${(snapshot.system.memoryUsage.heapUsed / snapshot.system.memoryUsage.heapTotal) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-sm font-medium">
                  {formatBytes(snapshot.system.memoryUsage.heapUsed)} /{' '}
                  {formatBytes(snapshot.system.memoryUsage.heapTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Memorie Cache</p>
                <p className="mt-2 text-xl font-medium">
                  {formatBytes(snapshot.cache.memoryUsage)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Utilizare Pool BD</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${snapshot.database.connectionPoolUsage < 0.7 ? 'bg-green-500' : snapshot.database.connectionPoolUsage < 0.9 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${snapshot.database.connectionPoolUsage * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-sm font-medium">
                  {formatPercent(snapshot.database.connectionPoolUsage)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          {/* Endpoint Performance Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Performanță Endpoint-uri</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Metodă
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cereri
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medie (ms)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      p95 (ms)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Erori
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stare
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {snapshot.api.byEndpoint.map((endpoint, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {endpoint.endpoint}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 py-1 text-xs rounded ${endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' : endpoint.method === 'POST' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {endpoint.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(endpoint.requestCount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {endpoint.avgResponseTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {endpoint.p95ResponseTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        {endpoint.errorCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <StatusBadge status={endpoint.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Response Time Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Timp Răspuns per Endpoint</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={snapshot.api.byEndpoint} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${value}ms`} />
                <YAxis
                  type="category"
                  dataKey="endpoint"
                  width={200}
                  fontSize={12}
                  tickFormatter={(value) => value.replace('/api/', '')}
                />
                <Tooltip formatter={(value: number) => [`${value}ms`]} />
                <Legend />
                <Bar dataKey="avgResponseTime" fill="#0088FE" name="Average" />
                <Bar dataKey="p95ResponseTime" fill="#FF8042" name="p95" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Model Performance */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Performanță Modele AI</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cereri
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TTFT Medie (ms)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Latență Medie (ms)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Erori
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stare
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {snapshot.ai.byModel.map((model, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {model.model}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(model.requestCount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {model.avgTTFT.toFixed(0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {model.avgTotalLatency.toFixed(0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        {model.errorCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <StatusBadge status={model.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operation Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Operațiuni AI</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={snapshot.ai.byOperation}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="operation"
                  tickFormatter={(value) => value.replace(/_/g, ' ')}
                  fontSize={12}
                />
                <YAxis tickFormatter={(value) => `${value}ms`} fontSize={12} />
                <Tooltip
                  labelFormatter={(value) => value.toString().replace(/_/g, ' ')}
                  formatter={(value: number, name: string) => [
                    `${value}ms`,
                    name === 'avgLatency' ? 'Average' : 'p95',
                  ]}
                />
                <Legend />
                <Bar dataKey="avgLatency" fill="#0088FE" name="Average" />
                <Bar dataKey="p95Latency" fill="#FF8042" name="p95" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Thresholds Reference */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Praguri de Performanță</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(THRESHOLDS.ai).map(([model, values]) => (
                <div key={model} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    {model.charAt(0).toUpperCase() + model.slice(1)}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-500">
                      TTFT Target: <span className="text-gray-900">{values.ttft}ms</span>
                    </p>
                    <p className="text-gray-500">
                      Total Latency: <span className="text-gray-900">{values.total}ms</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Database Tab */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Database KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Total Queries" value={formatNumber(snapshot.database.queryCount)} />
            <KPICard
              title="Average Query Time"
              value={`${snapshot.database.avgQueryTime}ms`}
              status={
                snapshot.database.avgQueryTime < 50
                  ? 'good'
                  : snapshot.database.avgQueryTime < 100
                    ? 'warning'
                    : 'critical'
              }
            />
            <KPICard
              title="p95 Query Time"
              value={`${snapshot.database.p95QueryTime}ms`}
              status={
                snapshot.database.p95QueryTime < 100
                  ? 'good'
                  : snapshot.database.p95QueryTime < 200
                    ? 'warning'
                    : 'critical'
              }
            />
            <KPICard
              title="Slow Queries"
              value={snapshot.database.slowQueries.toString()}
              subtitle="> 100ms"
              status={
                snapshot.database.slowQueries < 10
                  ? 'good'
                  : snapshot.database.slowQueries < 50
                    ? 'warning'
                    : 'critical'
              }
            />
          </div>

          {/* Query Time Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tendință Timp Interogare (24h)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).getHours() + ':00'}
                  fontSize={12}
                />
                <YAxis tickFormatter={(value) => `${value}ms`} fontSize={12} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                  formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Query Time']}
                />
                <ReferenceLine
                  y={100}
                  stroke="#ff7300"
                  strokeDasharray="3 3"
                  label="p95 Threshold"
                />
                <ReferenceLine y={50} stroke="#00C49F" strokeDasharray="3 3" label="Target" />
                <Area
                  type="monotone"
                  dataKey="dbQueryTime"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Connection Pool */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pool de Conexiuni</h3>
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-2">Utilizare Pool</p>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${snapshot.database.connectionPoolUsage < 0.7 ? 'bg-green-500' : snapshot.database.connectionPoolUsage < 0.9 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${snapshot.database.connectionPoolUsage * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {formatPercent(snapshot.database.connectionPoolUsage)} din capacitatea pool-ului
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {snapshot.system.activeConnections}
                </p>
                <p className="text-sm text-gray-500">Conexiuni Active</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Active Alerts */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Alerte Active ({alerts.filter((a) => !a.acknowledged).length})
              </h3>
              <button
                onClick={() => {
                  // In production: call mutation to acknowledge all
                  alert('Acknowledge all alerts');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Confirmă Toate
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {alerts.filter((a) => !a.acknowledged).length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">Nu există alerte active</div>
              ) : (
                alerts
                  .filter((a) => !a.acknowledged)
                  .map((alert) => (
                    <div key={alert.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <SeverityBadge severity={alert.severity} />
                            <span className="text-sm font-medium text-gray-900">
                              {alert.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {alert.metric}: {alert.currentValue.toFixed(2)} (threshold:{' '}
                            {alert.threshold})
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // In production: call mutation to acknowledge
                            window.alert(`Acknowledge alert ${alert.id}`);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Confirmă
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Alert History */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Istoric Alerte</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {alerts
                .filter((a) => a.acknowledged)
                .map((alert) => (
                  <div key={alert.id} className="px-6 py-4 opacity-60">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={alert.severity} />
                          <span className="text-sm font-medium text-gray-900">
                            {alert.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-green-600">Confirmat</span>
                        </div>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
