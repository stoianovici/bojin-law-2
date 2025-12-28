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
    blue: 'bg-linear-accent/15 text-linear-accent',
    green: 'bg-linear-success/15 text-linear-success',
    yellow: 'bg-linear-warning/15 text-linear-warning',
    red: 'bg-linear-error/15 text-linear-error',
    purple: 'bg-purple-100 text-purple-600',
  };

  // Trend color
  const trendPositive = trend !== undefined && trend >= 0;
  const trendColor = trendPositive ? 'text-linear-success' : 'text-linear-error';

  if (loading) {
    return (
      <div
        className={clsx('bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 animate-pulse', className)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-linear-bg-hover" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-linear-bg-hover rounded mb-2" />
            <div className="h-8 w-32 bg-linear-bg-hover rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 transition-shadow hover:shadow-md',
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
          <p className="text-sm font-medium text-linear-text-tertiary truncate">{title}</p>
          <p className="text-2xl font-bold text-linear-text-primary mt-1">{value}</p>

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
                <span className="text-sm text-linear-text-tertiary">{trendLabel || subtitle}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatCard;
