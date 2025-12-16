'use client';

/**
 * Quality Trends Widget
 * Story 3.7: AI Document Intelligence Dashboard (AC: 6)
 *
 * Displays document quality trends and metrics
 */

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { CheckCircle, Edit3, AlertTriangle } from 'lucide-react';
import type { DocumentQualityTrends } from '@legal-platform/types';

interface QualityTrendsWidgetProps {
  data: DocumentQualityTrends;
}

// Get quality color based on score
function getQualityColor(score: number): string {
  if (score >= 80) return '#10B981'; // green
  if (score >= 60) return '#F59E0B'; // yellow
  if (score >= 40) return '#F97316'; // orange
  return '#EF4444'; // red
}

// Get quality label based on score
function getQualityLabel(score: number): string {
  if (score >= 80) return 'Excelent';
  if (score >= 60) return 'Bun';
  if (score >= 40) return 'Acceptabil';
  return 'Necesita Imbunatatiri';
}

export function QualityTrendsWidget({ data }: QualityTrendsWidgetProps) {
  const qualityColor = getQualityColor(data.overallQualityScore);
  const qualityLabel = getQualityLabel(data.overallQualityScore);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tendinte Calitate</h3>
          <p className="text-sm text-gray-500">Scor calitate bazat pe editari</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: qualityColor }}>
            {data.overallQualityScore.toFixed(0)}
          </p>
          <p className="text-sm text-gray-500">{qualityLabel}</p>
        </div>
      </div>

      {/* Quality Score Gauge */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Scor General Calitate</span>
          <span className="text-sm font-medium" style={{ color: qualityColor }}>
            {data.overallQualityScore.toFixed(0)}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-300"
            style={{
              width: `${data.overallQualityScore}%`,
              backgroundColor: qualityColor,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>0</span>
          <span>Prag: {data.qualityThreshold}% edit</span>
          <span>100</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <Edit3 className="w-4 h-4 mx-auto text-gray-500 mb-1" />
          <p className="text-lg font-semibold text-gray-900">
            {data.averageRevisionCount.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500">revizii medii</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <CheckCircle className="w-4 h-4 mx-auto text-green-500 mb-1" />
          <p className="text-lg font-semibold text-green-700">
            {data.byDocumentType.filter((t) => t.qualityScore >= 70).length}
          </p>
          <p className="text-xs text-green-600">tipuri bune</p>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg text-center">
          <AlertTriangle className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
          <p className="text-lg font-semibold text-yellow-700">
            {data.byDocumentType.filter((t) => t.qualityScore < 70).length}
          </p>
          <p className="text-xs text-yellow-600">de imbunatatit</p>
        </div>
      </div>

      {/* Quality Trend Chart */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Evolutie Calitate</h4>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={data.qualityTrend}>
            <defs>
              <linearGradient id="colorQuality" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} fontSize={11} />
            <YAxis fontSize={11} domain={[0, 100]} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'qualityScore' ? `${value.toFixed(0)}/100` : `${value.toFixed(1)}%`,
                name === 'qualityScore' ? 'Scor' : 'Edit %',
              ]}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="qualityScore"
              stroke="#10B981"
              fill="url(#colorQuality)"
              name="Scor Calitate"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* By Document Type */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Per Tip Document</h4>
        <div className="space-y-2">
          {data.byDocumentType.map((type) => (
            <div key={type.documentType} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{type.documentType}</span>
              <div className="flex items-center gap-3">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${type.qualityScore}%`,
                      backgroundColor: getQualityColor(type.qualityScore),
                    }}
                  />
                </div>
                <span
                  className="text-sm font-medium w-8 text-right"
                  style={{ color: getQualityColor(type.qualityScore) }}
                >
                  {type.qualityScore.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
