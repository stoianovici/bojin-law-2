'use client';

import { useMemo } from 'react';
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
import type { ChartDataPoint } from '@legal-platform/types';
import { getReportMetadata, getReportData } from '../../lib/mock-reports-data';
import { useReportsStore } from '../../stores/reports.store';

export function ReportViewer() {
  const { selectedReportId, selectedCategoryId, dateRange, openDrillDown } = useReportsStore();

  // Get report metadata
  const allReports = useMemo(() => getReportMetadata(), []);
  const reportMetadata = useMemo(
    () => allReports.find((r) => r.id === selectedReportId),
    [allReports, selectedReportId]
  );

  // Get report data
  const reportData = useMemo(() => {
    if (!selectedReportId || !selectedCategoryId) return null;
    return getReportData(selectedReportId, dateRange, selectedCategoryId);
  }, [selectedReportId, selectedCategoryId, dateRange]);

  // Handle chart element click for drill-down
  const handleChartClick = (dataPoint: ChartDataPoint) => {
    if (!selectedReportId) return;

    // Generate mock drill-down data
    const mockDetailRows = Array.from({ length: 25 }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Element ${i + 1} - ${dataPoint.label}`,
      value: Math.floor(Math.random() * 1000),
      date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      status: ['Activ', 'Închis', 'În așteptare'][Math.floor(Math.random() * 3)],
    }));

    openDrillDown({
      reportId: selectedReportId,
      dataPoint,
      detailRows: mockDetailRows,
      columns: [
        { key: 'name', label: 'Name', labelRo: 'Nume', type: 'text' },
        { key: 'value', label: 'Value', labelRo: 'Valoare', type: 'number' },
        { key: 'date', label: 'Date', labelRo: 'Dată', type: 'date' },
        { key: 'status', label: 'Status', labelRo: 'Status', type: 'text' },
      ],
    });
  };

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
    const chartData = reportData.data.map((point) => ({
      name: point.label,
      value: point.value,
      fill: point.color || '#3B82F6',
    }));

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
                    const dataPoint = reportData.data.find((d) => d.label === data.name);
                    if (dataPoint) handleChartClick(dataPoint);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
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
                    const dataPoint = reportData.data.find((d) => d.label === data.name);
                    if (dataPoint) handleChartClick(dataPoint);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
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
                if (data && data.activePayload && reportData) {
                  const payload = data.activePayload[0]?.payload;
                  if (payload) {
                    const dataPoint = reportData.data.find((d) => d.label === payload.name);
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
                if (data && data.activePayload && reportData) {
                  const payload = data.activePayload[0]?.payload;
                  if (payload) {
                    const dataPoint = reportData.data.find((d) => d.label === payload.name);
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
    <div className="h-full p-6">
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
          {reportData.summary.changeFromPrevious !== undefined && (
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
    </div>
  );
}
