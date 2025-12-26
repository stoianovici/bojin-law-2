/**
 * StatCard Component
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Displays a statistic with icon, value, and optional trend indicator.
 */

'use client';

import React from 'react';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface StatCardProps {
  /** Card title */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Icon to display */
  icon?: LucideIcon;
  /** Icon color theme */
  iconColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  /** Trend percentage (positive = up, negative = down) */
  trend?: number;
  /** Trend label */
  trendLabel?: string;
  /** Loading state */
  loading?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'blue',
  trend,
  trendLabel,
  loading = false,
  className,
}: StatCardProps) {
  // Icon background color mapping
  const iconBgColors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  // Trend color
  const trendPositive = trend !== undefined && trend >= 0;
  const trendColor = trendPositive ? 'text-green-600' : 'text-red-600';

  if (loading) {
    return (
      <div
        className={clsx('bg-white rounded-lg border border-gray-200 p-6 animate-pulse', className)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gray-200" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        {Icon && (
          <div className={clsx('p-3 rounded-lg', iconBgColors[iconColor])}>
            <Icon className="w-6 h-6" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>

          {/* Subtitle or Trend */}
          {(subtitle || trend !== undefined) && (
            <div className="flex items-center gap-2 mt-2">
              {trend !== undefined && (
                <span className={clsx('flex items-center gap-1 text-sm font-medium', trendColor)}>
                  {trendPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {(trendLabel || subtitle) && (
                <span className="text-sm text-gray-500">{trendLabel || subtitle}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatCard;
