'use client';

/**
 * AI Utilization Widget
 * Story 3.7: AI Document Intelligence Dashboard (AC: 2)
 *
 * Displays AI adoption rates and trends
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { AIUtilizationStats } from '@legal-platform/types';

const COLORS = ['#0088FE', '#E0E0E0'];

interface AIUtilizationWidgetProps {
  data: AIUtilizationStats;
}

export function AIUtilizationWidget({ data }: AIUtilizationWidgetProps) {
  // Data for pie chart
  const pieData = [
    { name: 'AI-Asistat', value: data.totalAIAssistedDocuments },
    { name: 'Manual', value: data.totalManualDocuments },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Utilizare AI</h3>
          <p className="text-sm text-gray-500">Rata de adoptie si tendinte</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">
            {data.overallUtilizationRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500">rata utilizare</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adoption Trend Line Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Tendinta Adoptie</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.adoptionTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} fontSize={12} />
              <YAxis tickFormatter={(value) => `${value}%`} fontSize={12} domain={[0, 100]} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rata utilizare']}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="utilizationRate"
                stroke="#0088FE"
                strokeWidth={2}
                dot={{ fill: '#0088FE' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI vs Manual Pie Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">AI vs Manual</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Documente']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User Utilization Table */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Per Utilizator</h4>
        <div className="space-y-2">
          {data.byUser.slice(0, 5).map((user) => (
            <div key={user.userId} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{user.userName}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${user.utilizationRate}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 w-12 text-right">
                  {user.utilizationRate.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
