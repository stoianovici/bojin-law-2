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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operațiuni AI</h1>
          <p className="text-gray-500 mt-1">Prezentare generală</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-semibold mb-2">Eroare la încărcarea datelor</h2>
          <p className="text-red-600 text-sm">
            {error.message || 'A apărut o eroare neașteptată. Încercați din nou.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Reîncarcă pagina
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operațiuni AI</h1>
        <p className="text-gray-500 mt-1">
          Prezentare generală a costurilor și utilizării AI
          {loading && <span className="ml-2 text-blue-500">(Se încarcă...)</span>}
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acțiuni Rapide</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="/admin/ai-ops/features"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Gestionare Funcționalități
          </a>
          <a
            href="/admin/ai-ops/costs"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Detalii Costuri
          </a>
          <a
            href="/admin/ai-ops/history"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Istoric Joburi
          </a>
          <a
            href="/admin/ai-ops/budget"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Setări Buget
          </a>
        </div>
      </div>
    </div>
  );
}
