/**
 * Feature Usage Breakdown Component
 * Story 5.7: Platform Intelligence Dashboard - Task 17
 *
 * Grid of AI feature cards showing usage counts, acceptance rates,
 * and trends for each AI capability.
 * AC: 5 - AI utilization by user and feature
 */

'use client';

import React from 'react';
import type { FeatureUsage, AIFeatureType } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface FeatureUsageBreakdownProps {
  features: FeatureUsage[];
  loading?: boolean;
  /** Callback when clicking on a feature card */
  onFeatureClick?: (feature: AIFeatureType) => void;
}

// ============================================================================
// Constants
// ============================================================================

const FEATURE_CONFIG: Record<
  AIFeatureType,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    bgLight: string;
  }
> = {
  email_drafting: {
    label: 'Redactare email',
    description: 'Generare și rafinare emailuri',
    icon: '✉️',
    color: '#3B82F6',
    bgLight: 'bg-linear-accent/10',
  },
  document_generation: {
    label: 'Generare documente',
    description: 'Creare documente juridice',
    icon: '📄',
    color: '#10B981',
    bgLight: 'bg-linear-success/10',
  },
  clause_suggestions: {
    label: 'Sugestii clauze',
    description: 'Propuneri de clauze contractuale',
    icon: '📝',
    color: '#8B5CF6',
    bgLight: 'bg-linear-accent/10',
  },
  task_parsing: {
    label: 'Parsare sarcini',
    description: 'Extragere sarcini din text',
    icon: '✅',
    color: '#F59E0B',
    bgLight: 'bg-linear-warning/10',
  },
  morning_briefing: {
    label: 'Briefing matinal',
    description: 'Sumar zilnic personalizat',
    icon: '☀️',
    color: '#EC4899',
    bgLight: 'bg-linear-error/10',
  },
  proactive_suggestions: {
    label: 'Sugestii proactive',
    description: 'Recomandări bazate pe context',
    icon: '💡',
    color: '#06B6D4',
    bgLight: 'bg-linear-accent/10',
  },
  semantic_search: {
    label: 'Căutare semantică',
    description: 'Căutare inteligentă documente',
    icon: '🔍',
    color: '#84CC16',
    bgLight: 'bg-linear-success/10',
  },
  version_comparison: {
    label: 'Comparare versiuni',
    description: 'Diferențe semantice documente',
    icon: '📊',
    color: '#F97316',
    bgLight: 'bg-linear-warning/10',
  },
  style_analysis: {
    label: 'Analiză stil',
    description: 'Învățare stil redactare',
    icon: '🎨',
    color: '#6366F1',
    bgLight: 'bg-linear-accent/10',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function getAcceptanceColor(rate: number | undefined): string {
  if (rate === undefined) return 'text-linear-text-muted';
  if (rate >= 70) return 'text-linear-success';
  if (rate >= 50) return 'text-linear-warning';
  return 'text-linear-error';
}

function getUsageLevel(count: number, maxCount: number): { label: string; width: string } {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
  if (percentage >= 60) return { label: 'Ridicat', width: '100%' };
  if (percentage >= 30) return { label: 'Moderat', width: '60%' };
  if (percentage > 0) return { label: 'Scăzut', width: '30%' };
  return { label: 'Nefolosit', width: '5%' };
}

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 animate-pulse">
      <div className="h-5 bg-linear-bg-hover rounded w-48 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 bg-linear-bg-tertiary rounded-lg" />
        ))}
      </div>
    </div>
  );
}

interface FeatureCardProps {
  feature: FeatureUsage;
  config: (typeof FEATURE_CONFIG)[AIFeatureType];
  maxRequests: number;
  onClick?: () => void;
}

function FeatureCard({ feature, config, maxRequests, onClick }: FeatureCardProps) {
  const usageLevel = getUsageLevel(feature.requestCount, maxRequests);
  const isUsed = feature.requestCount > 0;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full p-4 rounded-lg border transition-all text-left ${
        onClick ? 'hover:shadow-md hover:border-linear-border cursor-pointer' : ''
      } ${isUsed ? 'border-linear-border-subtle bg-linear-bg-secondary' : 'border-linear-border-subtle/50 bg-linear-bg-tertiary opacity-60'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${config.bgLight}`}
          >
            {config.icon}
          </span>
          <div>
            <div className="font-medium text-linear-text-primary text-sm">{config.label}</div>
            <div className="text-xs text-linear-text-tertiary">{config.description}</div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {/* Request Count */}
        <div>
          <div className="flex justify-between text-xs text-linear-text-tertiary mb-1">
            <span>Cereri</span>
            <span className="font-medium text-linear-text-primary">
              {formatNumber(feature.requestCount)}
            </span>
          </div>
          <div className="h-1.5 bg-linear-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: usageLevel.width,
                backgroundColor: config.color,
              }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Tokens */}
          <div className="bg-linear-bg-tertiary rounded p-1.5">
            <div className="text-xs text-linear-text-tertiary">Tokeni</div>
            <div className="text-sm font-semibold text-linear-text-primary">
              {formatNumber(feature.tokenCount)}
            </div>
          </div>

          {/* Latency */}
          <div className="bg-linear-bg-tertiary rounded p-1.5">
            <div className="text-xs text-linear-text-tertiary">Latență</div>
            <div className="text-sm font-semibold text-linear-text-primary">
              {formatLatency(feature.avgLatencyMs)}
            </div>
          </div>

          {/* Acceptance Rate */}
          <div className="bg-linear-bg-tertiary rounded p-1.5">
            <div className="text-xs text-linear-text-tertiary">Acceptare</div>
            <div className={`text-sm font-semibold ${getAcceptanceColor(feature.acceptanceRate)}`}>
              {feature.acceptanceRate !== undefined
                ? `${feature.acceptanceRate.toFixed(0)}%`
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Usage Level Badge */}
        <div className="flex justify-end">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isUsed
                ? usageLevel.label === 'Ridicat'
                  ? 'bg-linear-success/10 text-linear-success'
                  : usageLevel.label === 'Moderat'
                    ? 'bg-linear-warning/10 text-linear-warning'
                    : 'bg-linear-bg-tertiary text-linear-text-secondary'
                : 'bg-linear-bg-tertiary text-linear-text-muted'
            }`}
          >
            {usageLevel.label}
          </span>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FeatureUsageBreakdown({
  features,
  loading = false,
  onFeatureClick,
}: FeatureUsageBreakdownProps) {
  // Get all features with their configs, including unused ones
  const allFeatures = React.useMemo(() => {
    const featureMap = new Map(features.map((f) => [f.feature, f]));
    const allFeatureTypes = Object.keys(FEATURE_CONFIG) as AIFeatureType[];

    return allFeatureTypes.map((featureType) => {
      const existing = featureMap.get(featureType);
      return (
        existing || {
          feature: featureType,
          requestCount: 0,
          tokenCount: 0,
          avgLatencyMs: 0,
          acceptanceRate: undefined,
        }
      );
    });
  }, [features]);

  // Calculate max requests for relative sizing
  const maxRequests = React.useMemo(() => {
    return Math.max(...allFeatures.map((f) => f.requestCount), 1);
  }, [allFeatures]);

  // Sort by request count (most used first)
  const sortedFeatures = React.useMemo(() => {
    return [...allFeatures].sort((a, b) => b.requestCount - a.requestCount);
  }, [allFeatures]);

  // Statistics
  const stats = React.useMemo(() => {
    const usedFeatures = allFeatures.filter((f) => f.requestCount > 0);
    const totalRequests = allFeatures.reduce((sum, f) => sum + f.requestCount, 0);
    const totalTokens = allFeatures.reduce((sum, f) => sum + f.tokenCount, 0);
    const withAcceptance = allFeatures.filter((f) => f.acceptanceRate !== undefined);
    const avgAcceptance =
      withAcceptance.length > 0
        ? withAcceptance.reduce((sum, f) => sum + (f.acceptanceRate || 0), 0) /
          withAcceptance.length
        : null;

    return {
      usedCount: usedFeatures.length,
      totalCount: allFeatures.length,
      totalRequests,
      totalTokens,
      avgAcceptance,
    };
  }, [allFeatures]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-linear-text-primary">Funcționalități AI</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-linear-text-tertiary">
            <span className="font-medium text-linear-text-primary">{stats.usedCount}</span>/
            {stats.totalCount} active
          </span>
          {stats.avgAcceptance !== null && (
            <span
              className={`px-2 py-0.5 rounded-full ${getAcceptanceColor(
                stats.avgAcceptance
              )} bg-linear-bg-tertiary`}
            >
              {stats.avgAcceptance.toFixed(0)}% acceptare medie
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-linear-bg-tertiary rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-linear-text-primary">
            {formatNumber(stats.totalRequests)}
          </div>
          <div className="text-xs text-linear-text-tertiary">Total cereri</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-linear-text-primary">
            {formatNumber(stats.totalTokens)}
          </div>
          <div className="text-xs text-linear-text-tertiary">Total tokeni</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-linear-text-primary">{stats.usedCount}</div>
          <div className="text-xs text-linear-text-tertiary">Funcții utilizate</div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFeatures.map((feature) => {
          const config = FEATURE_CONFIG[feature.feature];
          if (!config) return null;

          return (
            <FeatureCard
              key={feature.feature}
              feature={feature}
              config={config}
              maxRequests={maxRequests}
              onClick={onFeatureClick ? () => onFeatureClick(feature.feature) : undefined}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-linear-border-subtle">
        <div className="flex flex-wrap gap-4 text-xs text-linear-text-tertiary">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-linear-success" />
            <span>Ridicat ({'>'}60%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-linear-warning" />
            <span>Moderat (30-60%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-linear-text-muted" />
            <span>Scăzut ({'<'}30%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-linear-bg-hover" />
            <span>Nefolosit</span>
          </div>
        </div>
      </div>

      {/* Accessibility: Data Table */}
      <div className="sr-only">
        <table>
          <caption>Utilizare funcționalități AI</caption>
          <thead>
            <tr>
              <th>Funcție</th>
              <th>Cereri</th>
              <th>Tokeni</th>
              <th>Latență medie</th>
              <th>Rată acceptare</th>
            </tr>
          </thead>
          <tbody>
            {sortedFeatures.map((feature) => (
              <tr key={feature.feature}>
                <td>{FEATURE_CONFIG[feature.feature]?.label || feature.feature}</td>
                <td>{feature.requestCount}</td>
                <td>{feature.tokenCount}</td>
                <td>{formatLatency(feature.avgLatencyMs)}</td>
                <td>
                  {feature.acceptanceRate !== undefined ? `${feature.acceptanceRate}%` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FeatureUsageBreakdown;
