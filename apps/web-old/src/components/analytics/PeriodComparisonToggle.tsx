/**
 * Period Comparison Toggle Component
 * Story 2.11.4: Financial Dashboard UI
 *
 * Toggle switch for enabling/disabling period-over-period comparison.
 * When enabled, calculates and displays delta values vs previous period.
 */

'use client';

import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { GitCompareArrows } from 'lucide-react';
import { useAnalyticsFiltersStore } from '../../stores/analyticsFiltersStore';

export interface PeriodComparisonToggleProps {
  /**
   * Optional additional class names
   */
  className?: string;
}

/**
 * PeriodComparisonToggle - Switch for period comparison
 *
 * @example
 * ```tsx
 * <PeriodComparisonToggle />
 * ```
 */
export function PeriodComparisonToggle({ className = '' }: PeriodComparisonToggleProps) {
  const { comparisonEnabled, toggleComparison } = useAnalyticsFiltersStore();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Switch.Root
        id="period-comparison"
        checked={comparisonEnabled}
        onCheckedChange={toggleComparison}
        className="w-10 h-6 bg-linear-bg-hover rounded-full relative data-[state=checked]:bg-linear-accent outline-none cursor-pointer transition-colors"
      >
        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>

      <label
        htmlFor="period-comparison"
        className="flex items-center gap-2 text-sm text-linear-text-secondary cursor-pointer select-none"
      >
        <GitCompareArrows className="w-4 h-4 text-linear-text-tertiary" />
        <span>Compară cu perioada anterioară</span>
      </label>
    </div>
  );
}

export default PeriodComparisonToggle;
