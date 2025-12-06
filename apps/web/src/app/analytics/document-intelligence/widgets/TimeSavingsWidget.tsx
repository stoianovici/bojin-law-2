'use client';

/**
 * Time Savings Widget
 * Story 3.7: AI Document Intelligence Dashboard (AC: 4)
 *
 * Displays time savings calculations and methodology
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Clock, DollarSign, Info } from 'lucide-react';
import type { TimeSavingsStats } from '@legal-platform/types';

interface TimeSavingsWidgetProps {
  data: TimeSavingsStats;
}

export function TimeSavingsWidget({ data }: TimeSavingsWidgetProps) {
  // Prepare chart data
  const chartData = data.byDocumentType.map((t) => ({
    name: t.documentType,
    manual: t.averageManualTimeMinutes,
    ai: t.averageAIAssistedTimeMinutes,
    saved: t.averageManualTimeMinutes - t.averageAIAssistedTimeMinutes,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Economii de Timp</h3>
          <p className="text-sm text-gray-500">Timp economisit prin AI</p>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">Timp Economisit</span>
          </div>
          <p className="text-2xl font-bold text-green-700">
            {Math.round(data.totalMinutesSaved / 60)}h {data.totalMinutesSaved % 60}m
          </p>
          <p className="text-xs text-green-600">
            ~{data.averageMinutesSavedPerDocument.toFixed(0)} min/document
          </p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700">Economii Estimate</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">
            {data.estimatedCostSavings.toLocaleString('ro-RO')} RON
          </p>
          <p className="text-xs text-blue-600">bazat pe rata medie orara</p>
        </div>
      </div>

      {/* Time Comparison Chart */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Comparatie Timp per Tip</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={11} unit=" min" />
            <YAxis type="category" dataKey="name" fontSize={11} width={70} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} min`,
                name === 'manual' ? 'Manual' : name === 'ai' ? 'Cu AI' : 'Economisit',
              ]}
            />
            <Legend />
            <Bar dataKey="manual" fill="#E0E0E0" name="Manual" />
            <Bar dataKey="ai" fill="#0088FE" name="Cu AI" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* User Savings */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Per Utilizator</h4>
        <div className="space-y-2">
          {data.byUser.slice(0, 3).map((user) => (
            <div key={user.userId} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{user.userName}</span>
              <div className="flex items-center gap-4">
                <span className="text-gray-500">{user.documentsCreated} doc</span>
                <span className="font-medium text-green-600">
                  {Math.round(user.minutesSaved / 60)}h economisit
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-500">{data.methodology}</p>
        </div>
      </div>
    </div>
  );
}
