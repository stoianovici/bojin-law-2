/**
 * Profitability Widget
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays effective hourly rate and lists top/bottom performing cases.
 * Each case shows name, billing type badge, and margin percentage.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react';
import { BaseWidget } from './BaseWidget';
import { ListSkeleton, KPISkeleton } from './WidgetSkeleton';
import { DeltaBadge } from '../DeltaBadge';
import { formatCurrencyWithCents, formatPercent } from '../utils/formatters';
import type { CaseProfitability } from '../../../hooks/useFinancialKPIs';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

/**
 * Billing type badge colors
 */
const BILLING_TYPE_COLORS: Record<string, string> = {
  Hourly: 'bg-blue-100 text-blue-700',
  HOURLY: 'bg-blue-100 text-blue-700',
  Orar: 'bg-blue-100 text-blue-700',
  Fixed: 'bg-green-100 text-green-700',
  FIXED: 'bg-green-100 text-green-700',
  Fix: 'bg-green-100 text-green-700',
  Retainer: 'bg-amber-100 text-amber-700',
  RETAINER: 'bg-amber-100 text-amber-700',
  Abonament: 'bg-amber-100 text-amber-700',
};

/**
 * Billing type labels in Romanian
 */
const BILLING_TYPE_LABELS: Record<string, string> = {
  Hourly: 'Orar',
  HOURLY: 'Orar',
  Fixed: 'Fix',
  FIXED: 'Fix',
  Retainer: 'Abonament',
  RETAINER: 'Abonament',
};

export interface ProfitabilityWidgetProps {
  /**
   * Effective hourly rate
   */
  effectiveHourlyRate: number;

  /**
   * Profitability data by case
   */
  profitabilityByCase: CaseProfitability[];

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
 * Case item component
 */
function CaseItem({ caseData, isTop }: { caseData: CaseProfitability; isTop: boolean }) {
  const marginColor =
    caseData.marginPercent >= 20
      ? 'text-green-600'
      : caseData.marginPercent >= 0
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <Link
      href={`/cases/${caseData.caseId}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isTop ? 'bg-green-100' : 'bg-red-100'
        }`}
      >
        {isTop ? (
          <TrendingUp className="w-4 h-4 text-green-600" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-600" />
        )}
      </div>

      {/* Case info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
          {caseData.caseName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              BILLING_TYPE_COLORS[caseData.billingType] || 'bg-gray-100 text-gray-600'
            }`}
          >
            {BILLING_TYPE_LABELS[caseData.billingType] || caseData.billingType}
          </span>
          <span className="text-xs text-gray-500">
            Venit: {formatCurrencyWithCents(caseData.revenue)}
          </span>
        </div>
      </div>

      {/* Margin */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${marginColor}`}>
          {formatPercent(caseData.marginPercent)}
        </p>
        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
      </div>
    </Link>
  );
}

/**
 * ProfitabilityWidget - Effective hourly rate and case profitability
 */
export function ProfitabilityWidget({
  effectiveHourlyRate,
  profitabilityByCase,
  isLoading = false,
  error = null,
  onRetry,
  delta,
  className = '',
}: ProfitabilityWidgetProps) {
  // Sort and split into top/bottom performers
  const sortedCases = [...profitabilityByCase].sort((a, b) => b.marginPercent - a.marginPercent);
  const topCases = sortedCases.slice(0, 5);
  const bottomCases = sortedCases
    .filter((c) => c.marginPercent < 20)
    .slice(-5)
    .reverse();

  const hasData = effectiveHourlyRate > 0 || profitabilityByCase.length > 0;

  return (
    <BaseWidget
      title="Profitabilitate"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!hasData && !isLoading && !error}
      emptyMessage="Nu există date pentru această perioadă"
      skeleton={
        <>
          <KPISkeleton className="mb-4" />
          <ListSkeleton rows={3} />
        </>
      }
      className={className}
    >
      <div className="space-y-4">
        {/* Effective Hourly Rate */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-500 mb-1">Tarif orar efectiv</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrencyWithCents(effectiveHourlyRate)}/oră
              </span>
            </div>
          </div>
          {delta && <DeltaBadge delta={delta} size="md" />}
        </div>

        {/* Top Performers */}
        {topCases.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              Cele mai performante
            </p>
            <div className="space-y-1">
              {topCases.map((caseData) => (
                <CaseItem key={caseData.caseId} caseData={caseData} isTop={true} />
              ))}
            </div>
          </div>
        )}

        {/* Bottom Performers */}
        {bottomCases.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Necesită atenție
            </p>
            <div className="space-y-1">
              {bottomCases.map((caseData) => (
                <CaseItem key={caseData.caseId} caseData={caseData} isTop={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}

export default ProfitabilityWidget;
