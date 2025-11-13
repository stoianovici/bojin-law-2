/**
 * CaseDistributionWidget - Partner Dashboard Case Distribution Chart
 * Pie chart showing case distribution by type
 */

'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { ChartWidget } from '@legal-platform/types';

export interface CaseDistributionWidgetProps {
  widget: ChartWidget;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Custom Label for Pie Chart - Shows percentage
 */
function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-semibold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/**
 * Custom Tooltip for Pie Chart
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-1">{data.name}</p>
        <p className="text-sm text-gray-600">
          {data.value} cazuri ({((data.value / data.payload.total) * 100).toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
}

/**
 * CaseDistributionWidget - Pie chart of case distribution
 *
 * Displays case distribution by type (Litigation, Contract, Advisory, Criminal, Other)
 * with percentage labels and interactive hover tooltips.
 * Uses Recharts library for responsive pie chart visualization.
 */
export function CaseDistributionWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: CaseDistributionWidgetProps) {
  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
      />
    </svg>
  );

  // Chart colors for different case types
  const COLORS: Record<string, string> = {
    Litigiu: '#3b82f6', // blue-500
    Contract: '#10b981', // green-500
    Consultanță: '#f59e0b', // amber-500
    Penal: '#ef4444', // red-500
    Altele: '#8b5cf6', // purple-500
  };

  // Calculate total for tooltip
  const total = (widget.data || []).reduce((sum, item) => sum + (item.value || 0), 0);
  const chartData = (widget.data || []).map((item) => ({ ...item, total }));

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      <div className="w-full h-[320px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[entry.name as string] || '#6b7280'}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: '12px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">
        Total: {total} cazuri - Date mockup
      </div>
    </WidgetContainer>
  );
}

CaseDistributionWidget.displayName = 'CaseDistributionWidget';
