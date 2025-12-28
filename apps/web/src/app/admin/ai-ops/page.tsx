/**
 * AI Ops Overview Page
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Main dashboard showing AI usage statistics, cost trends, budget status,
 * and feature configurations for Partners.
 */

'use client';

import React from 'react';
import { DollarSign, Zap, Activity, CheckCircle } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { CostTrendChart } from '@/components/admin/CostTrendChart';
import { BudgetProgress } from '@/components/admin/BudgetProgress';
import { FeatureStatusList } from '@/components/admin/FeatureStatusList';
import { useAIOpsOverview } from '@/hooks/useAIOps';
import { PageLayout, PageContent } from '@/components/linear/PageLayout';

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
 * Format large numbers
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString('ro-RO');
}

// ============================================================================
// Page Component
// ============================================================================

export default function AIOpsDashboardPage() {
  const { overview, dailyCosts, features, loading, error } = useAIOpsOverview();

  // Error state
  if (error) {
    return (
      <PageLayout>
        <PageContent className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-linear-text-primary">Operațiuni AI</h1>
            <p className="mt-1 text-linear-text-secondary">Prezentare generală</p>
          </div>

          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="mb-2 font-semibold text-red-400">Eroare la încărcarea datelor</h2>
            <p className="text-sm text-red-300">
              {error.message || 'A apărut o eroare neașteptată. Încercați din nou.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Reîncarcă pagina
            </button>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContent className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-linear-text-primary">Operațiuni AI</h1>
        <p className="mt-1 text-linear-text-secondary">
          Prezentare generală a costurilor și utilizării AI
          {loading && <span className="ml-2 text-linear-accent">(Se încarcă...)</span>}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cost Luna Curentă"
          value={overview ? formatCurrency(overview.totalCost) : '€0.00'}
          icon={DollarSign}
          iconColor="blue"
          loading={loading}
        />
        <StatCard
          title="Total Tokeni"
          value={overview ? formatNumber(overview.totalTokens) : '0'}
          icon={Zap}
          iconColor="yellow"
          loading={loading}
        />
        <StatCard
          title="Apeluri API"
          value={overview ? formatNumber(overview.totalCalls) : '0'}
          icon={Activity}
          iconColor="purple"
          loading={loading}
        />
        <StatCard
          title="Rată de Succes"
          value={overview ? `${overview.successRate.toFixed(1)}%` : '0%'}
          icon={CheckCircle}
          iconColor={overview && overview.successRate >= 95 ? 'green' : 'yellow'}
          loading={loading}
        />
      </div>

      {/* Charts and Budget Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Trend Chart - 2 columns */}
        <div className="lg:col-span-2">
          <CostTrendChart
            data={dailyCosts}
            dailyBudget={null} // TODO: Get from budget settings
            loading={loading}
            height={280}
          />
        </div>

        {/* Budget Progress - 1 column */}
        <div>
          <BudgetProgress
            currentSpend={overview?.totalCost ?? 0}
            budgetLimit={overview?.budgetLimit ?? null}
            projectedSpend={overview?.projectedMonthEnd}
            loading={loading}
          />
        </div>
      </div>

      {/* Features Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Features */}
        <FeatureStatusList features={features.request} loading={loading} maxItems={5} />

        {/* Batch Features */}
        <FeatureStatusList features={features.batch} batchOnly loading={loading} maxItems={5} />
      </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-linear-text-primary">Acțiuni Rapide</h3>
          <div className="flex flex-wrap gap-3">
            <a
              href="/admin/ai-ops/features"
              className="rounded-lg bg-linear-bg-tertiary px-4 py-2 text-sm font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            >
              Gestionare Funcționalități
            </a>
            <a
              href="/admin/ai-ops/costs"
              className="rounded-lg bg-linear-bg-tertiary px-4 py-2 text-sm font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            >
              Detalii Costuri
            </a>
            <a
              href="/admin/ai-ops/history"
              className="rounded-lg bg-linear-bg-tertiary px-4 py-2 text-sm font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            >
              Istoric Joburi
            </a>
            <a
              href="/admin/ai-ops/budget"
              className="rounded-lg bg-linear-bg-tertiary px-4 py-2 text-sm font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            >
              Setări Buget
            </a>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
