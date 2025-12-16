'use client';

/**
 * Error Detection Widget
 * Story 3.7: AI Document Intelligence Dashboard (AC: 3)
 *
 * Displays AI-detected concerns and resolution rates
 */

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import type { ErrorDetectionStats } from '@legal-platform/types';

const SEVERITY_COLORS: Record<string, string> = {
  ERROR: '#EF4444',
  WARNING: '#F97316',
  INFO: '#3B82F6',
};

interface ErrorDetectionWidgetProps {
  data: ErrorDetectionStats;
}

// Format concern type for display
function formatConcernType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function ErrorDetectionWidget({ data }: ErrorDetectionWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Detectie Erori</h3>
          <p className="text-sm text-gray-500">Probleme detectate de AI si rezolvate</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">{data.detectionRate.toFixed(0)}%</p>
          <p className="text-sm text-gray-500">rata rezolvare</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{data.totalConcernsDetected}</p>
          <p className="text-xs text-gray-500">detectate</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-green-600">
            {data.concernsResolvedBeforeFiling}
          </p>
          <p className="text-xs text-gray-500">rezolvate</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">
            {data.totalConcernsDetected - data.concernsResolvedBeforeFiling}
          </p>
          <p className="text-xs text-gray-500">in asteptare</p>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Per Severitate</h4>
        <div className="flex gap-2">
          {data.bySeverity.map((sev) => (
            <div
              key={sev.severity}
              className="flex-1 p-2 rounded-lg text-center"
              style={{ backgroundColor: `${SEVERITY_COLORS[sev.severity]}15` }}
            >
              <p className="text-lg font-semibold" style={{ color: SEVERITY_COLORS[sev.severity] }}>
                {sev.count}
              </p>
              <p className="text-xs text-gray-600">{sev.severity}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detection Trend Chart */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Tendinta Detectie</h4>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data.trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip labelFormatter={(label) => `Data: ${label}`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="detected"
              stroke="#EF4444"
              name="Detectate"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#10B981"
              name="Rezolvate"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* By Type */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Per Tip Problema</h4>
        <div className="space-y-2">
          {data.byType.slice(0, 5).map((type) => (
            <div key={type.concernType} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate max-w-[60%]">
                {formatConcernType(type.concernType)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{type.count}</span>
                <span className="text-gray-400">({type.percentage.toFixed(0)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
