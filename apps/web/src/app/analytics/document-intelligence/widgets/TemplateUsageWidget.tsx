'use client';

/**
 * Template Usage Widget
 * Story 3.7: AI Document Intelligence Dashboard (AC: 5)
 *
 * Displays template and clause usage statistics
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { FileText, Quote } from 'lucide-react';
import type { TemplateUsageStats } from '@legal-platform/types';

interface TemplateUsageWidgetProps {
  data: TemplateUsageStats;
}

export function TemplateUsageWidget({ data }: TemplateUsageWidgetProps) {
  // Prepare chart data for templates
  const templateChartData = data.topTemplates.map((t) => ({
    name: t.templateName.length > 20 ? t.templateName.substring(0, 20) + '...' : t.templateName,
    usage: t.usageCount,
    quality: t.averageQualityScore,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Utilizare Template-uri</h3>
          <p className="text-sm text-gray-500">Template-uri si clauze populare</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{data.templateAdoptionRate.toFixed(0)}%</p>
          <p className="text-sm text-gray-500">rata adoptie</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-lg font-semibold text-gray-900">{data.topTemplates.length}</p>
            <p className="text-xs text-gray-500">template-uri active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Quote className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-lg font-semibold text-gray-900">{data.totalTemplateUsage}</p>
            <p className="text-xs text-gray-500">utilizari totale</p>
          </div>
        </div>
      </div>

      {/* Template Usage Chart */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Top Template-uri</h4>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={templateChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={11} />
            <YAxis type="category" dataKey="name" fontSize={10} width={120} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value,
                name === 'usage' ? 'Utilizari' : 'Scor Calitate',
              ]}
            />
            <Bar dataKey="usage" fill="#0088FE" name="Utilizari" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Clauses */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Clauze Populare</h4>
        <div className="space-y-3">
          {data.topClauses.slice(0, 3).map((clause) => (
            <div key={clause.clauseId} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">{clause.category}</span>
                <span className="text-xs text-gray-400">
                  {clause.frequency}x | {clause.insertionRate.toFixed(0)}% acceptate
                </span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2">{clause.clauseText}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
