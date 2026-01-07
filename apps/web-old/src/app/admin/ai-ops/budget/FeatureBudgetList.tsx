/**
 * FeatureBudgetList Component
 * OPS-246: Budget Controls & Alerts Page
 *
 * Displays per-feature budget limits with inline editing.
 */

'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Pencil, Check, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FeatureBudgetData {
  feature: string;
  featureName: string;
  monthlyBudgetEur: number | null;
  currentSpendEur: number;
}

interface FeatureBudgetListProps {
  features: FeatureBudgetData[];
  onUpdateBudget: (feature: string, budget: number | null) => void;
  disabled?: boolean;
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatEur(amount: number | null): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// Feature Row Component
// ============================================================================

interface FeatureRowProps {
  feature: FeatureBudgetData;
  onUpdateBudget: (budget: number | null) => void;
  disabled?: boolean;
}

function FeatureRow({ feature, onUpdateBudget, disabled }: FeatureRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const percentUsed =
    feature.monthlyBudgetEur !== null && feature.monthlyBudgetEur > 0
      ? (feature.currentSpendEur / feature.monthlyBudgetEur) * 100
      : 0;

  const handleEdit = () => {
    setEditValue(feature.monthlyBudgetEur?.toString() || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    const value = editValue.trim();
    if (value === '') {
      onUpdateBudget(null);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        onUpdateBudget(numValue);
      }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      {/* Feature name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{feature.featureName}</p>
        <p className="text-xs text-gray-500">Curent: {formatEur(feature.currentSpendEur)}</p>
      </div>

      {/* Budget limit */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                €
              </span>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Fără limită"
                min="0"
                step="0.01"
                autoFocus
                className="w-24 pl-7 pr-2 py-1.5 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <span
              className={clsx(
                'text-sm font-medium min-w-[80px] text-right',
                feature.monthlyBudgetEur !== null ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              {feature.monthlyBudgetEur !== null
                ? `${formatEur(feature.monthlyBudgetEur)}/lună`
                : 'Fără limită'}
            </span>
            <button
              onClick={handleEdit}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Progress indicator (if budget set) */}
      {feature.monthlyBudgetEur !== null && (
        <div className="w-20">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-300',
                percentUsed > 100
                  ? 'bg-red-500'
                  : percentUsed > 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              )}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-0.5">{percentUsed.toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FeatureBudgetList({
  features,
  onUpdateBudget,
  disabled,
  loading,
}: FeatureBudgetListProps) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        Nu există funcționalități configurate
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {features.map((feature) => (
        <FeatureRow
          key={feature.feature}
          feature={feature}
          onUpdateBudget={(budget) => onUpdateBudget(feature.feature, budget)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
