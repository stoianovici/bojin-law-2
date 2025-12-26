/**
 * Budget Controls & Alerts Page
 * OPS-246: Budget Controls & Alerts Page
 *
 * Admin page for configuring AI spending limits and alert thresholds.
 * Displays current spend, projected spend, and per-feature budget limits.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { Save, RefreshCw } from 'lucide-react';
import { BudgetGauge } from './BudgetGauge';
import { AlertSettings, type AlertSettingsData } from './AlertSettings';
import { FeatureBudgetList, type FeatureBudgetData } from './FeatureBudgetList';

// ============================================================================
// GraphQL Queries & Mutations
// ============================================================================

const GET_BUDGET_DATA = gql`
  query GetBudgetData($startOfMonth: DateTime!, $now: DateTime!) {
    aiUsageOverview {
      totalCost
      projectedMonthEnd
      budgetLimit
    }
    aiBudgetSettings {
      monthlyBudgetEur
      alertAt75Percent
      alertAt90Percent
      autoPauseAt100Percent
      slackWebhookUrl
    }
    aiFeatures {
      feature
      featureName
      monthlyBudgetEur
      dailyCostEstimate
    }
    aiCostsByFeature(dateRange: { start: $startOfMonth, end: $now }) {
      feature
      cost
    }
  }
`;

const UPDATE_BUDGET_SETTINGS = gql`
  mutation UpdateAIBudgetSettings($input: AIBudgetSettingsInput!) {
    updateAIBudgetSettings(input: $input)
  }
`;

const UPDATE_FEATURE_CONFIG = gql`
  mutation UpdateAIFeatureConfig($feature: String!, $input: AIFeatureConfigInput!) {
    updateAIFeatureConfig(feature: $feature, input: $input) {
      feature
      monthlyBudgetEur
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface BudgetData {
  aiUsageOverview: {
    totalCost: number;
    projectedMonthEnd: number;
    budgetLimit: number | null;
  };
  aiBudgetSettings: {
    monthlyBudgetEur: number;
    alertAt75Percent: boolean;
    alertAt90Percent: boolean;
    autoPauseAt100Percent: boolean;
    slackWebhookUrl: string | null;
  } | null;
  aiFeatures: Array<{
    feature: string;
    featureName: string;
    monthlyBudgetEur: number | null;
    dailyCostEstimate: number;
  }>;
  aiCostsByFeature: Array<{
    feature: string;
    cost: number;
  }>;
}

// ============================================================================
// Component
// ============================================================================

export default function BudgetPage() {
  // Date range for current month
  const now = useMemo(() => new Date(), []);
  const startOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);

  // Local state for form
  const [budgetLimit, setBudgetLimit] = useState<string>('100');
  const [alertSettings, setAlertSettings] = useState<AlertSettingsData>({
    alertAt75: true,
    alertAt90: true,
    autoPauseAt100: false,
    slackWebhookUrl: null,
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Track if form has been initialized from server data
  const [initialized, setInitialized] = useState(false);

  // Query data
  const { data, loading, error, refetch } = useQuery<BudgetData>(GET_BUDGET_DATA, {
    variables: {
      startOfMonth: startOfMonth.toISOString(),
      now: now.toISOString(),
    },
  });

  // Initialize form with server data when it loads
  React.useEffect(() => {
    if (data && !initialized) {
      if (data.aiBudgetSettings) {
        setBudgetLimit(data.aiBudgetSettings.monthlyBudgetEur?.toString() || '100');
        setAlertSettings({
          alertAt75: data.aiBudgetSettings.alertAt75Percent ?? true,
          alertAt90: data.aiBudgetSettings.alertAt90Percent ?? true,
          autoPauseAt100: data.aiBudgetSettings.autoPauseAt100Percent ?? false,
          slackWebhookUrl: data.aiBudgetSettings.slackWebhookUrl,
        });
      } else if (data.aiUsageOverview?.budgetLimit) {
        setBudgetLimit(data.aiUsageOverview.budgetLimit.toString());
      }
      setInitialized(true);
    }
  }, [data, initialized]);

  // Mutations
  const [updateBudgetSettings, { loading: savingSettings }] = useMutation(UPDATE_BUDGET_SETTINGS);
  const [updateFeatureConfig, { loading: savingFeature }] = useMutation(UPDATE_FEATURE_CONFIG);

  // Handlers
  const handleBudgetChange = (value: string) => {
    setBudgetLimit(value);
    setHasChanges(true);
  };

  const handleAlertSettingsChange = (settings: AlertSettingsData) => {
    setAlertSettings(settings);
    setHasChanges(true);
  };

  const handleSaveSettings = useCallback(async () => {
    const limitValue = parseFloat(budgetLimit);
    if (isNaN(limitValue) || limitValue < 0) {
      alert('Vă rugăm introduceți o valoare validă pentru buget');
      return;
    }

    try {
      await updateBudgetSettings({
        variables: {
          input: {
            monthlyBudget: limitValue,
            alertAt75: alertSettings.alertAt75,
            alertAt90: alertSettings.alertAt90,
            autoPauseAt100: alertSettings.autoPauseAt100,
            slackWebhookUrl: alertSettings.slackWebhookUrl,
          },
        },
      });
      setHasChanges(false);
      refetch();
    } catch (err) {
      console.error('Failed to save budget settings:', err);
      alert('Eroare la salvarea setărilor');
    }
  }, [budgetLimit, alertSettings, updateBudgetSettings, refetch]);

  const handleUpdateFeatureBudget = useCallback(
    async (feature: string, budget: number | null) => {
      try {
        await updateFeatureConfig({
          variables: {
            feature,
            input: {
              monthlyBudgetEur: budget,
            },
          },
        });
        refetch();
      } catch (err) {
        console.error('Failed to update feature budget:', err);
        alert('Eroare la actualizarea bugetului');
      }
    },
    [updateFeatureConfig, refetch]
  );

  // Build feature budget data
  const featureBudgets: FeatureBudgetData[] = useMemo(() => {
    if (!data?.aiFeatures) return [];

    const costEntries = (data.aiCostsByFeature ?? [])
      .filter((c): c is { feature: string; cost: number } => c != null && c.feature != null)
      .map((c) => [c.feature, c.cost] as [string, number]);
    const costMap = new Map(costEntries);

    return (data.aiFeatures ?? [])
      .filter(
        (
          f
        ): f is {
          feature: string;
          featureName: string;
          monthlyBudgetEur: number | null;
          dailyCostEstimate: number;
        } => f != null && f.feature != null
      )
      .map((f) => ({
        feature: f.feature,
        featureName: f.featureName,
        monthlyBudgetEur: f.monthlyBudgetEur,
        currentSpendEur: costMap.get(f.feature) || 0,
      }));
  }, [data]);

  // Current values
  const currentSpend = data?.aiUsageOverview?.totalCost || 0;
  const projectedSpend = data?.aiUsageOverview?.projectedMonthEnd || 0;
  const limit = parseFloat(budgetLimit) || 100;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Eroare la încărcarea datelor: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Buget & Alerte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurați limitele de cheltuieli și alertele pentru funcționalitățile AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizează
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={!hasChanges || savingSettings}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? 'Se salvează...' : 'Salvează Setări'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Budget Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Buget Lunar</h2>

          {/* Budget limit input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limită buget lunar
            </label>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <input
                type="number"
                value={budgetLimit}
                onChange={(e) => handleBudgetChange(e.target.value)}
                min="0"
                step="1"
                className="w-full pl-8 pr-4 py-2.5 text-lg font-medium border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Budget gauge */}
          <BudgetGauge
            spent={currentSpend}
            limit={limit}
            projected={projectedSpend}
            loading={loading}
          />
        </div>

        {/* Alert Settings Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Praguri Alerte</h2>
          <AlertSettings
            settings={alertSettings}
            onChange={handleAlertSettingsChange}
            disabled={savingSettings}
          />
        </div>
      </div>

      {/* Per-Feature Budgets */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Limite pe Funcționalitate</h2>
        <p className="text-sm text-gray-500 mb-4">
          Setați limite individuale pentru fiecare funcționalitate AI. Lăsați gol pentru fără
          limită.
        </p>
        <FeatureBudgetList
          features={featureBudgets}
          onUpdateBudget={handleUpdateFeatureBudget}
          disabled={savingFeature}
          loading={loading}
        />
      </div>
    </div>
  );
}
