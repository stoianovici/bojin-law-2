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
  Hourly: 'bg-linear-accent/10 text-linear-accent',
  HOURLY: 'bg-linear-accent/10 text-linear-accent',
  Orar: 'bg-linear-accent/10 text-linear-accent',
  Fixed: 'bg-linear-success/10 text-linear-success',
  FIXED: 'bg-linear-success/10 text-linear-success',
  Fix: 'bg-linear-success/10 text-linear-success',
  Retainer: 'bg-linear-warning/10 text-linear-warning',
  RETAINER: 'bg-linear-warning/10 text-linear-warning',
  Abonament: 'bg-linear-warning/10 text-linear-warning',
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
      ? 'text-linear-success'
      : caseData.marginPercent >= 0
        ? 'text-linear-warning'
        : 'text-linear-error';

  return (
    <Link
      href={`/cases/${caseData.caseId}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-linear-bg-tertiary transition-colors group"
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isTop ? 'bg-linear-success/10' : 'bg-linear-error/10'
        }`}
      >
        {isTop ? (
          <TrendingUp className="w-4 h-4 text-linear-success" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-linear-error" />
        )}
      </div>

      {/* Case info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-linear-text-primary truncate group-hover:text-linear-accent">
          {caseData.caseName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              BILLING_TYPE_COLORS[caseData.billingType] || 'bg-linear-bg-tertiary text-linear-text-secondary'
            }`}
          >
            {BILLING_TYPE_LABELS[caseData.billingType] || caseData.billingType}
          </span>
          <span className="text-xs text-linear-text-tertiary">
            Venit: {formatCurrencyWithCents(caseData.revenue)}
          </span>
        </div>
      </div>

      {/* Margin */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${marginColor}`}>
          {formatPercent(caseData.marginPercent)}
        </p>
        <ExternalLink className="w-3 h-3 text-linear-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
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
        <div className="flex items-start justify-between pb-4 border-b border-linear-border-subtle/50">
          <div>
            <p className="text-sm text-linear-text-tertiary mb-1">Tarif orar efectiv</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-linear-text-primary">
                {formatCurrencyWithCents(effectiveHourlyRate)}/oră
              </span>
            </div>
          </div>
          {delta && <DeltaBadge delta={delta} size="md" />}
        </div>

        {/* Top Performers */}
        {topCases.length > 0 && (
          <div>
            <p className="text-xs font-medium text-linear-text-tertiary uppercase mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-linear-success" />
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
          <div className="border-t border-linear-border-subtle/50 pt-4">
            <p className="text-xs font-medium text-linear-text-tertiary uppercase mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-linear-warning" />
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
