/**
 * Delta Badge Component
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays period-over-period change with direction indicator.
 * Shows up/down/neutral arrows with color coding.
 */

'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPIDelta } from '../../hooks/useFinancialKPIsComparison';

export interface DeltaBadgeProps {
  /**
   * Delta data from comparison hook
   */
  delta: KPIDelta;

  /**
   * Whether positive changes are good (default: true)
   * For metrics like expenses, positive might be bad
   */
  positiveIsGood?: boolean;

  /**
   * Size variant
   */
  size?: 'sm' | 'md';

  /**
   * Optional additional class names
   */
  className?: string;
}

/**
 * DeltaBadge - Displays percentage change with indicator
 *
 * @example
 * ```tsx
 * <DeltaBadge delta={{ percentage: 12.5, direction: 'up', absolute: 1000 }} />
 * ```
 */
export function DeltaBadge({
  delta,
  positiveIsGood = true,
  size = 'sm',
  className = '',
}: DeltaBadgeProps) {
  // Determine if this change is good, bad, or neutral
  const isGood =
    delta.direction === 'neutral'
      ? null
      : positiveIsGood
        ? delta.direction === 'up'
        : delta.direction === 'down';

  // Get color classes based on whether change is good
  const colorClasses =
    isGood === null
      ? 'bg-linear-bg-tertiary text-linear-text-secondary'
      : isGood
        ? 'bg-linear-success/10 text-linear-success'
        : 'bg-linear-error/10 text-linear-error';

  // Get icon based on direction
  const Icon =
    delta.direction === 'up' ? TrendingUp : delta.direction === 'down' ? TrendingDown : Minus;

  // Size classes
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5 gap-0.5' : 'text-sm px-2 py-1 gap-1';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  // Format percentage
  const percentText =
    delta.direction === 'neutral'
      ? '0%'
      : `${delta.direction === 'up' ? '+' : ''}${delta.percentage.toFixed(1)}%`;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${colorClasses} ${sizeClasses} ${className}`}
      title={`Change: ${delta.absolute >= 0 ? '+' : ''}${delta.absolute.toLocaleString()}`}
    >
      <Icon className={iconSize} />
      <span>{percentText}</span>
    </span>
  );
}

export default DeltaBadge;
