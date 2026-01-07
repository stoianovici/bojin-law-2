/**
 * BillableHoursChartWidget - Partner Dashboard Billable Hours Chart
 * Bar chart showing billable hours over time by practice area
 */

'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
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
import type { ChartWidget } from '@legal-platform/types';

export interface BillableHoursChartWidgetProps {
  widget: ChartWidget;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Custom Tooltip for Chart
 */
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value} ore`}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

/**
 * BillableHoursChartWidget - Bar chart of billable hours
 *
 * Displays billable hours over time (last 6 months) broken down by practice area.
 * Uses Recharts library for responsive bar chart visualization.
 */
export function BillableHoursChartWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: BillableHoursChartWidgetProps) {
  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );

  // Chart colors for different practice areas
  const colors = {
    Litigiu: '#3b82f6', // blue-500
    Contract: '#10b981', // green-500
    Consultanță: '#f59e0b', // amber-500
    Penal: '#ef4444', // red-500
    Altele: '#8b5cf6', // purple-500
  };

  // Extract unique practice areas from data
  const practiceAreas = Array.from(
    new Set(
      widget.data.flatMap((item) =>
        Object.keys(item).filter((key) => key !== widget.xAxisKey && key !== 'month')
      )
    )
  );

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
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={widget.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={widget.xAxisKey || 'month'}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              label={{
                value: 'Ore facturabile',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: '12px', fill: '#6b7280' },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="square" />
            {practiceAreas.map((area) => (
              <Bar
                key={area}
                dataKey={area}
                fill={colors[area as keyof typeof colors] || '#6b7280'}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">Ultimele 6 luni - Date mockup</div>
    </WidgetContainer>
  );
}

BillableHoursChartWidget.displayName = 'BillableHoursChartWidget';
