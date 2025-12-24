'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChevronDown, ChevronUp, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import type { ChartDataPoint, DateRange } from '@legal-platform/types';
import {
  usePredefinedReports,
  useReportData,
  useReportAIInsight,
  type PredefinedReport,
} from '../../hooks/useReportData';
import { useReportsStore } from '../../stores/reports.store';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Skeleton } from '../ui/skeleton';

// ============================================================================
// AI Insights Section Component
// ============================================================================

interface AIInsightsSectionProps {
  reportId: string | null;
  dateRange?: DateRange;
}

function AIInsightsSection({ reportId, dateRange }: AIInsightsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { insight, loading, error, loadInsight, regenerate, called } = useReportAIInsight(
    reportId,
    dateRange
  );

  // Memoize load function to avoid infinite effect loops
  const handleLoadInsight = useCallback(() => {
    loadInsight();
  }, [loadInsight]);

  // Load insight when section is opened for the first time
  useEffect(() => {
    if (isOpen && !called && reportId) {
      handleLoadInsight();
    }
  }, [isOpen, called, reportId, handleLoadInsight]);

  if (!reportId) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mt-6 rounded-lg border border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">Analiză AI</span>
            {insight && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                {Math.round((insight.confidence ?? 0) * 100)}% încredere
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-gray-200 p-4">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>Nu s-a putut genera analiza. Încearcă din nou.</span>
              </div>
            )}

            {!loading && !error && insight && (
              <div className="space-y-4">
                {/* Summary */}
                <div>
                  <p className="text-gray-700 leading-relaxed">{insight.summary}</p>
                </div>

                {/* Key Findings */}
                {insight.keyFindings && insight.keyFindings.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-medium text-gray-900">Constatări Cheie</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {insight.keyFindings.map((finding: string, idx: number) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {insight.recommendations && insight.recommendations.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-medium text-gray-900">Recomandări</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {insight.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Regenerate Button */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    Generat:{' '}
                    {new Date(insight.generatedAt).toLocaleString('ro-RO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <button
                    onClick={regenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Regenerează
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && !insight && called && (
              <div className="text-center py-4 text-gray-500">
                Nu s-au putut obține informații AI pentru acest raport.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Main ReportViewer Component
// ============================================================================

export function ReportViewer() {
  const { selectedReportId, dateRange, openDrillDown } = useReportsStore();

  // Fetch predefined reports from API
  const { reports: allReports, loading: reportsLoading } = usePredefinedReports();

  // Get report metadata
  const reportMetadata = useMemo<PredefinedReport | undefined>(
    () => allReports.find((r: PredefinedReport) => r.id === selectedReportId),
    [allReports, selectedReportId]
  );

  // Fetch report data from API
  const {
    reportData,
    loading: dataLoading,
    error: dataError,
  } = useReportData(selectedReportId, dateRange);

  // Handle chart element click for drill-down
  const handleChartClick = (dataPoint: ChartDataPoint) => {
    if (!selectedReportId) return;

    // TODO: Replace with actual API call to fetch drill-down data
    // Detail rows should be fetched from API based on reportId and dataPoint
    openDrillDown({
      reportId: selectedReportId,
      dataPoint,
      detailRows: [], // Empty - should come from API
      columns: [
        { key: 'name', label: 'Name', labelRo: 'Nume', type: 'text' },
        { key: 'value', label: 'Value', labelRo: 'Valoare', type: 'number' },
        { key: 'date', label: 'Date', labelRo: 'Dată', type: 'date' },
        { key: 'status', label: 'Status', labelRo: 'Status', type: 'text' },
      ],
    });
  };

  // Loading state
  if (reportsLoading || dataLoading) {
    return (
      <div className="h-full p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (dataError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Eroare la încărcare</h3>
          <p className="mt-2 text-sm text-gray-500">
            Nu s-au putut încărca datele raportului. Încearcă din nou.
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!reportMetadata || !reportData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Niciun raport selectat</h3>
          <p className="mt-2 text-sm text-gray-500">
            Selectează un raport din meniul din stânga pentru a vizualiza datele
          </p>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    const chartData = reportData.data.map((point: ChartDataPoint) => ({
      name: point.label,
      value: point.value,
      fill: point.color || '#3B82F6',
    }));

    // No data state
    if (chartData.length === 0) {
      return (
        <div className="flex h-96 items-center justify-center text-gray-500">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="mt-2">Nu există date pentru perioada selectată</p>
          </div>
        </div>
      );
    }

    switch (reportMetadata.chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={120}
                dataKey="value"
                onClick={(data) => {
                  if (data && reportData) {
                    const dataPoint = reportData.data.find(
                      (d: ChartDataPoint) => d.label === data.name
                    );
                    if (dataPoint) handleChartClick(dataPoint);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map(
                  (entry: { name: string; value: number; fill: string }, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  )
                )}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="value"
                fill="#3B82F6"
                onClick={(data) => {
                  if (data && reportData) {
                    const dataPoint = reportData.data.find(
                      (d: ChartDataPoint) => d.label === data.name
                    );
                    if (dataPoint) handleChartClick(dataPoint);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map(
                  (entry: { name: string; value: number; fill: string }, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  )
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              onClick={(data) => {
                const clickData = data as { activePayload?: Array<{ payload?: { name: string } }> };
                if (clickData && clickData.activePayload && reportData) {
                  const payload = clickData.activePayload[0]?.payload;
                  if (payload) {
                    const dataPoint = reportData.data.find(
                      (d: ChartDataPoint) => d.label === payload.name
                    );
                    if (dataPoint) handleChartClick(dataPoint);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart
              data={chartData}
              onClick={(data) => {
                const clickData = data as { activePayload?: Array<{ payload?: { name: string } }> };
                if (clickData && clickData.activePayload && reportData) {
                  const payload = clickData.activePayload[0]?.payload;
                  if (payload) {
                    const dataPoint = reportData.data.find(
                      (d: ChartDataPoint) => d.label === payload.name
                    );
                    if (dataPoint) handleChartClick(dataPoint);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.6}
                style={{ cursor: 'pointer' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'gauge':
        // Simplified gauge using a pie chart
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Used', value: chartData[0]?.value || 0 },
                  { name: 'Remaining', value: 100 - (chartData[0]?.value || 0) },
                ]}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={80}
                outerRadius={120}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill="#10B981" />
                <Cell fill="#E5E7EB" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex h-96 items-center justify-center text-gray-500">
            Tip grafic nesuportat: {reportMetadata.chartType}
          </div>
        );
    }
  };

  return (
    <div className="h-full p-6 overflow-auto">
      {/* Report Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{reportMetadata.nameRo}</h1>
        <p className="mt-1 text-sm text-gray-600">{reportMetadata.description}</p>
      </div>

      {/* Summary Cards */}
      {reportData.summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-600">Total</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {reportData.summary.totalValue.toLocaleString('ro-RO')}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-600">Medie</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {reportData.summary.averageValue.toLocaleString('ro-RO', {
                maximumFractionDigits: 1,
              })}
            </div>
          </div>
          {reportData.summary.changeFromPrevious !== undefined &&
            reportData.summary.changeFromPrevious !== null && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm font-medium text-gray-600">Schimbare</div>
                <div
                  className={`mt-2 flex items-center gap-1 text-2xl font-bold ${
                    reportData.summary.changeFromPrevious > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {reportData.summary.changeFromPrevious > 0 ? '↑' : '↓'}
                  {Math.abs(reportData.summary.changeFromPrevious).toFixed(1)}%
                </div>
              </div>
            )}
        </div>
      )}

      {/* Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Vizualizare Date</h2>
        {renderChart()}
      </div>

      {/* AI Insights Section */}
      <AIInsightsSection reportId={selectedReportId} dateRange={dateRange} />
    </div>
  );
}
