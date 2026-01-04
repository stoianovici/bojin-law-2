/**
 * Retainer Status Widget
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays retainer case metrics including average utilization gauge.
 * Shows only if firm has retainer cases.
 * Color coding: Green (<80% used), Yellow (80-100%), Red (>100% overage).
 */

'use client';

import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BaseWidget } from './BaseWidget';
import { GaugeSkeleton } from './WidgetSkeleton';
import { DeltaBadge } from '../DeltaBadge';
import { formatPercent, formatNumber } from '../utils/formatters';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

/**
 * Get color based on retainer utilization
 * Inverse of regular utilization - lower is better
 */
function getRetainerColor(rate: number): string {
  if (rate > 100) return '#EF4444'; // Red - overage
  if (rate >= 80) return '#F59E0B'; // Yellow - approaching limit
  return '#10B981'; // Green - healthy
}

/**
 * Get status text based on utilization
 */
function getStatusText(rate: number): string {
  if (rate > 100) return 'Depășit';
  if (rate >= 80) return 'Aproape de limită';
  return 'În regulă';
}

/**
 * Get status icon based on utilization
 */
function getStatusIcon(rate: number) {
  if (rate > 100) return <AlertCircle className="w-4 h-4 text-linear-error" />;
  if (rate >= 80) return <AlertCircle className="w-4 h-4 text-linear-warning" />;
  return <CheckCircle2 className="w-4 h-4 text-linear-success" />;
}

export interface RetainerStatusWidgetProps {
  /**
   * Average retainer utilization (0-100+, can exceed 100 if over)
   */
  retainerUtilizationAverage: number | null;

  /**
   * Number of retainer cases
   */
  retainerCasesCount: number;

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Error state
   */
  error?: Error | null;

  /**
   * Retry callback
   */
  onRetry?: () => void;

  /**
   * Delta for comparison (optional)
   */
  delta?: KPIDelta | null;

  /**
   * Optional class name
   */
  className?: string;
}

/**
 * RetainerStatusWidget - Retainer utilization overview
 */
export function RetainerStatusWidget({
  retainerUtilizationAverage,
  retainerCasesCount,
  isLoading = false,
  error = null,
  onRetry,
  delta,
  className = '',
}: RetainerStatusWidgetProps) {
  // Check if there are any retainer cases
  const hasRetainerCases = retainerCasesCount > 0;
  const utilization = retainerUtilizationAverage ?? 0;

  // If no retainer cases and not loading, show special empty state
  if (!hasRetainerCases && !isLoading && !error) {
    return (
      <BaseWidget title="Status Abonamente" className={className}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Wallet className="w-10 h-10 text-linear-text-muted mb-3" />
          <p className="text-linear-text-tertiary text-sm">Nu există abonamente</p>
          <p className="text-linear-text-muted text-xs mt-1">
            Statisticile vor apărea când aveți contracte de tip abonament active
          </p>
        </div>
      </BaseWidget>
    );
  }

  // Data for radial gauge (cap at 100 for display, but show actual value)
  const displayValue = Math.min(utilization, 100);
  const gaugeData = [
    {
      name: 'Utilization',
      value: displayValue,
      fill: getRetainerColor(utilization),
    },
  ];

  const statusColor = getRetainerColor(utilization);

  return (
    <BaseWidget
      title="Status Abonamente"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      skeleton={<GaugeSkeleton />}
      className={className}
    >
      <div className="space-y-4">
        {/* Gauge Chart */}
        <div className="relative h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              data={gaugeData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#E5E7EB' }} />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-2xl font-bold" style={{ color: statusColor }}>
              {formatPercent(utilization)}
            </span>
            <span className="text-xs text-linear-text-tertiary">utilizare medie</span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2">
          {getStatusIcon(utilization)}
          <span className="text-sm font-medium" style={{ color: statusColor }}>
            {getStatusText(utilization)}
          </span>
          {delta && (
            <DeltaBadge
              delta={delta}
              size="sm"
              positiveIsGood={false} // For retainer, lower is better
            />
          )}
        </div>

        {/* Case count */}
        <div className="bg-linear-bg-tertiary rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-linear-text-tertiary" />
            <span className="text-sm text-linear-text-secondary">Abonamente active</span>
          </div>
          <span className="text-2xl font-bold text-linear-text-primary">
            {formatNumber(retainerCasesCount)}
          </span>
          <span className="text-sm text-linear-text-tertiary ml-1">
            {retainerCasesCount === 1 ? 'dosar' : 'dosare'}
          </span>
        </div>

        {/* Warning for overage */}
        {utilization > 100 && (
          <div className="bg-linear-error/10 border border-linear-error/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-linear-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-linear-error">Ore de abonament depășite</p>
              <p className="text-xs text-linear-error mt-0.5">
                Unele contracte de abonament sunt supra-utilizate. Verificați facturarea pentru
                dosarele afectate.
              </p>
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}

export default RetainerStatusWidget;
