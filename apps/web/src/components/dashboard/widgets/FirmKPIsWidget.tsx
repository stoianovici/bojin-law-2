/**
 * FirmKPIsWidget - Partner Dashboard KPI Metrics
 * Displays firm-wide KPIs with trend indicators
 */

'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { KPIWidget as KPIWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';

export interface FirmKPIsWidgetProps {
  widget: KPIWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * KPI Metric Card Component
 */
function KPIMetricCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    comparison: string;
  };
}) {
  const trendIcon = {
    up: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  const trendColorClass = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col">
        <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>
        <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
        {trend && (
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                trendColorClass[trend.direction]
              )}
            >
              {trendIcon[trend.direction]}
              <span>{trend.percentage}%</span>
            </div>
            <span className="text-xs text-gray-500">{trend.comparison}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FirmKPIsWidget - Displays firm-wide KPI metrics
 *
 * Shows metrics like Total Active Cases, Billable Hours, Revenue Target Progress, Team Utilization
 * with trend indicators comparing to previous period.
 */
export function FirmKPIsWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: FirmKPIsWidgetProps) {
  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(widget.metrics || []).map((metric, index) => (
          <KPIMetricCard
            key={index}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
          />
        ))}
      </div>
    </WidgetContainer>
  );
}

FirmKPIsWidget.displayName = 'FirmKPIsWidget';
