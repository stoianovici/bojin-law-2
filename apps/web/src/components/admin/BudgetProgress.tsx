/**
 * BudgetProgress Component
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Progress bar showing budget spend vs limit with projected end-of-month estimate.
 */

'use client';

import React from 'react';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface BudgetProgressProps {
  /** Current spend amount in EUR */
  currentSpend: number;
  /** Budget limit in EUR (null = unlimited) */
  budgetLimit: number | null;
  /** Projected spend by end of month in EUR */
  projectedSpend?: number;
  /** Loading state */
  loading?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format EUR currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-red-500';
  if (percent >= 90) return 'bg-red-400';
  if (percent >= 75) return 'bg-yellow-400';
  return 'bg-blue-500';
}

/**
 * Get projected indicator color based on percentage
 */
function getProjectedColor(percent: number): string {
  if (percent >= 100) return 'text-red-600';
  if (percent >= 90) return 'text-red-500';
  if (percent >= 75) return 'text-yellow-600';
  return 'text-green-600';
}

// ============================================================================
// Component
// ============================================================================

export function BudgetProgress({
  currentSpend,
  budgetLimit,
  projectedSpend,
  loading = false,
  className,
}: BudgetProgressProps) {
  // Calculate percentages
  const currentPercent = budgetLimit ? Math.min((currentSpend / budgetLimit) * 100, 100) : 0;
  const projectedPercent =
    budgetLimit && projectedSpend ? Math.min((projectedSpend / budgetLimit) * 100, 100) : 0;

  if (loading) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
          <div className="h-4 w-full bg-gray-200 rounded mb-4" />
          <div className="flex justify-between">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // No budget limit set
  if (!budgetLimit) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Buget Lunar</h3>
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-lg">∞</span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{formatCurrency(currentSpend)}</p>
            <p className="text-sm text-gray-500">Limită nesetată</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Configurați o limită de buget pentru a monitoriza cheltuielile.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Buget Lunar</h3>

      {/* Progress Bar */}
      <div className="relative mb-4">
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          {/* Current spend */}
          <div
            className={clsx(
              'h-full transition-all duration-500 ease-out',
              getProgressColor(currentPercent)
            )}
            style={{ width: `${currentPercent}%` }}
          />
        </div>

        {/* Projected marker */}
        {projectedSpend && projectedPercent > 0 && projectedPercent <= 100 && (
          <div
            className="absolute top-0 h-4 w-0.5 bg-gray-400"
            style={{ left: `${projectedPercent}%` }}
            title={`Proiecție: ${formatCurrency(projectedSpend)}`}
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-gray-400" />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500">Cheltuieli Curente</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(currentSpend)}</p>
          <p className="text-sm text-gray-500">{currentPercent.toFixed(1)}% din buget</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-500">Limită</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetLimit)}</p>
          <p className="text-sm text-gray-500">
            Rămas: {formatCurrency(Math.max(0, budgetLimit - currentSpend))}
          </p>
        </div>
      </div>

      {/* Projection */}
      {projectedSpend && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Proiecție Sfârșit Lună</span>
            <span className={clsx('text-sm font-medium', getProjectedColor(projectedPercent))}>
              {formatCurrency(projectedSpend)}
              {projectedPercent >= 100 && ' (depășire estimată)'}
            </span>
          </div>
        </div>
      )}

      {/* Warning Messages */}
      {currentPercent >= 90 && (
        <div
          className={clsx(
            'mt-4 p-3 rounded-lg text-sm',
            currentPercent >= 100 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
          )}
        >
          {currentPercent >= 100
            ? 'Bugetul a fost depășit! Funcționalitățile AI ar putea fi dezactivate automat.'
            : 'Aproape de limita bugetului. Monitorizați cheltuielile cu atenție.'}
        </div>
      )}
    </div>
  );
}

export default BudgetProgress;
