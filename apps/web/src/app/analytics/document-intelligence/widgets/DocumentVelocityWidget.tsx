'use client';

/**
 * Document Velocity Widget
 * Story 3.7: AI Document Intelligence Dashboard (AC: 1)
 *
 * Displays document creation patterns by user and type
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { DocumentVelocityStats } from '@legal-platform/types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface DocumentVelocityWidgetProps {
  data: DocumentVelocityStats;
}

export function DocumentVelocityWidget({ data }: DocumentVelocityWidgetProps) {
  // Prepare data for pie chart
  const typeData = data.byType.map((t) => ({
    name: t.documentType,
    value: t.documentCount,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Velocitate Documente</h3>
          <p className="text-sm text-gray-500">Rata de creare documente pe utilizator si tip</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{data.totalDocuments}</p>
          <p className="text-sm text-gray-500">total documente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By User Bar Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Per Utilizator</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byUser} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} />
              <YAxis
                type="category"
                dataKey="userName"
                fontSize={12}
                width={100}
                tickFormatter={(value) => value.split(' ')[0]}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Documente']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="documentCount" fill="#0088FE" name="Documente" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Type Pie Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Per Tip Document</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {typeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Documente']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">{data.averagePerDay.toFixed(1)}</p>
          <p className="text-xs text-gray-500">medie/zi</p>
        </div>
        <div>
          <p
            className={`text-lg font-semibold ${data.trendPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {data.trendPercentage >= 0 ? '+' : ''}
            {data.trendPercentage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500">trend</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{data.byType.length}</p>
          <p className="text-xs text-gray-500">tipuri</p>
        </div>
      </div>
    </div>
  );
}
