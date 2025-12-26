/**
 * BudgetGauge Component
 * OPS-246: Budget Controls & Alerts Page
 *
 * Displays budget progress bars for current spend and projected month-end spend.
 * Colors indicate budget health: green < 75%, yellow 75-90%, red > 90%.
 */

'use client';

import React from 'react';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

interface BudgetGaugeProps {
  /** Current spend in EUR */
  spent: number;
  /** Monthly budget limit in EUR */
  limit: number;
  /** Projected spend at month end in EUR */
  projected: number;
  /** Whether the data is loading */
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get progress bar color based on percentage
 */
function getColorClass(percent: number, isProjected: boolean = false): string {
  if (isProjected) {
    if (percent > 100) return 'bg-red-500';
    if (percent > 90) return 'bg-yellow-500';
    return 'bg-blue-500';
  }

  if (percent > 90) return 'bg-red-500';
  if (percent > 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * Format EUR amount
 */
function formatEur(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// Component
// ============================================================================

export function BudgetGauge({ spent, limit, projected, loading }: BudgetGaugeProps) {
  const percentSpent = limit > 0 ? (spent / limit) * 100 : 0;
  const percentProjected = limit > 0 ? (projected / limit) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-gray-200 rounded-lg" />
        <div className="h-16 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Current spend */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Cheltuială curentă</span>
          <span className="font-medium text-gray-900">
            {formatEur(spent)} ({percentSpent.toFixed(1)}%)
          </span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              getColorClass(percentSpent)
            )}
            style={{ width: `${Math.min(percentSpent, 100)}%` }}
          />
        </div>
        {percentSpent > 100 && (
          <p className="text-xs text-red-600 mt-1">
            Bugetul a fost depășit cu {formatEur(spent - limit)}
          </p>
        )}
      </div>

      {/* Projected */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Estimare sfârșit lună</span>
          <span className="font-medium text-gray-900">{formatEur(projected)}</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              getColorClass(percentProjected, true)
            )}
            style={{ width: `${Math.min(percentProjected, 100)}%` }}
          />
        </div>
        {percentProjected > 100 && (
          <p className="text-xs text-yellow-600 mt-1">
            Se estimează depășirea bugetului cu {formatEur(projected - limit)}
          </p>
        )}
      </div>
    </div>
  );
}
