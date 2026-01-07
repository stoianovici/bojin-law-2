/**
 * Recommendations Panel Component
 * Story 5.7: Platform Intelligence Dashboard - Task 19
 *
 * Displays actionable recommendations based on platform intelligence analysis.
 * AC: 1-6 - Provides recommendations across all analytics categories
 */

'use client';

import React, { useState, useMemo } from 'react';
import type {
  PlatformRecommendation,
  RecommendationCategory,
  RecommendationPriority,
} from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface RecommendationsPanelProps {
  recommendations: PlatformRecommendation[];
  loading?: boolean;
  onMarkAsAddressed?: (index: number) => void;
  addressedRecommendations?: number[];
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<
  RecommendationCategory,
  { label: string; icon: React.ReactNode; bgColor: string; textColor: string; borderColor: string }
> = {
  efficiency: {
    label: 'Eficiență',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    bgColor: 'bg-linear-accent/10',
    textColor: 'text-linear-accent',
    borderColor: 'border-linear-accent/30',
  },
  communication: {
    label: 'Comunicare',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    bgColor: 'bg-linear-success/10',
    textColor: 'text-linear-success',
    borderColor: 'border-linear-success/30',
  },
  quality: {
    label: 'Calitate',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    bgColor: 'bg-linear-accent/10',
    textColor: 'text-linear-accent',
    borderColor: 'border-linear-accent/30',
  },
  adoption: {
    label: 'Adopție',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    bgColor: 'bg-linear-warning/10',
    textColor: 'text-linear-warning',
    borderColor: 'border-linear-warning/30',
  },
};

const PRIORITY_CONFIG: Record<
  RecommendationPriority,
  { label: string; bgColor: string; textColor: string; order: number }
> = {
  high: {
    label: 'Prioritate ridicată',
    bgColor: 'bg-linear-error/15',
    textColor: 'text-linear-error',
    order: 0,
  },
  medium: {
    label: 'Prioritate medie',
    bgColor: 'bg-linear-warning/15',
    textColor: 'text-linear-warning',
    order: 1,
  },
  low: {
    label: 'Prioritate scăzută',
    bgColor: 'bg-linear-bg-tertiary',
    textColor: 'text-linear-text-secondary',
    order: 2,
  },
};

type FilterOption = 'all' | RecommendationCategory;

// ============================================================================
// Component
// ============================================================================

export function RecommendationsPanel({
  recommendations,
  loading = false,
  onMarkAsAddressed,
  addressedRecommendations = [],
}: RecommendationsPanelProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FilterOption>('all');

  // Sort by priority (high first), then filter by category
  const sortedAndFilteredRecommendations = useMemo(() => {
    let filtered = recommendations;

    if (filter !== 'all') {
      filtered = recommendations.filter((r) => r.category === filter);
    }

    return [...filtered].sort((a, b) => {
      // Addressed items go to the bottom
      const aAddressed = addressedRecommendations.includes(recommendations.indexOf(a));
      const bAddressed = addressedRecommendations.includes(recommendations.indexOf(b));
      if (aAddressed !== bAddressed) return aAddressed ? 1 : -1;

      // Sort by priority (default to lowest priority if not found)
      const aOrder = PRIORITY_CONFIG[a.priority]?.order ?? 999;
      const bOrder = PRIORITY_CONFIG[b.priority]?.order ?? 999;
      return aOrder - bOrder;
    });
  }, [recommendations, filter, addressedRecommendations]);

  const toggleExpand = (originalIndex: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(originalIndex)) {
        next.delete(originalIndex);
      } else {
        next.add(originalIndex);
      }
      return next;
    });
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: recommendations.length };
    recommendations.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [recommendations]);

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Se încarcă recomandările">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-linear-bg-tertiary animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12 bg-linear-success/10 rounded-lg border border-linear-success/30">
        <svg
          className="w-12 h-12 mx-auto text-linear-success mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-linear-success">Platforma funcționează optim</h3>
        <p className="text-sm text-linear-success mt-1">
          Nu există recomandări de îmbunătățire în acest moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-linear-text-primary">
            Recomandări de îmbunătățire
          </h3>
          <p className="text-sm text-linear-text-tertiary">
            {recommendations.length} recomandări bazate pe analiza platformei
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-violet-600">
            {recommendations.filter((r) => r.priority === 'high').length}
          </span>
          <span className="text-sm text-linear-text-tertiary ml-1">prioritare</span>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrează după categorie">
        <button
          role="tab"
          aria-selected={filter === 'all'}
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-linear-accent text-white'
              : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
          }`}
        >
          Toate ({categoryCounts.all})
        </button>
        {(Object.keys(CATEGORY_CONFIG) as RecommendationCategory[]).map((category) => {
          const config = CATEGORY_CONFIG[category];
          const count = categoryCounts[category] || 0;
          if (count === 0) return null;

          return (
            <button
              key={category}
              role="tab"
              aria-selected={filter === category}
              onClick={() => setFilter(category)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                filter === category
                  ? 'bg-linear-accent text-white'
                  : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
              }`}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4" role="list" aria-label="Lista de recomandări">
        {sortedAndFilteredRecommendations.map((recommendation) => {
          const originalIndex = recommendations.indexOf(recommendation);
          const isExpanded = expandedItems.has(originalIndex);
          const isAddressed = addressedRecommendations.includes(originalIndex);
          const categoryConfig = CATEGORY_CONFIG[recommendation.category] ?? {
            label: recommendation.category ?? 'General',
            icon: null,
            bgColor: 'bg-linear-bg-tertiary',
            textColor: 'text-linear-text-secondary',
            borderColor: 'border-linear-border-subtle',
          };
          const priorityConfig = PRIORITY_CONFIG[recommendation.priority] ?? {
            label: recommendation.priority ?? 'Nedefinit',
            bgColor: 'bg-linear-bg-tertiary',
            textColor: 'text-linear-text-secondary',
            order: 999,
          };

          return (
            <div
              key={originalIndex}
              role="listitem"
              className={`bg-linear-bg-secondary rounded-lg border overflow-hidden transition-opacity ${
                isAddressed ? 'opacity-60' : ''
              } ${categoryConfig.borderColor}`}
            >
              {/* Recommendation Header */}
              <div
                className={`p-4 cursor-pointer hover:bg-linear-bg-hover transition-colors ${
                  isAddressed ? 'bg-linear-bg-tertiary' : ''
                }`}
                onClick={() => toggleExpand(originalIndex)}
                role="button"
                aria-expanded={isExpanded}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(originalIndex);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Category Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${categoryConfig.bgColor} ${categoryConfig.textColor}`}
                  >
                    {categoryConfig.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {/* Priority Badge */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${priorityConfig.bgColor} ${priorityConfig.textColor}`}
                      >
                        {priorityConfig.label}
                      </span>
                      {/* Category Badge */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${categoryConfig.bgColor} ${categoryConfig.textColor}`}
                      >
                        {categoryConfig.label}
                      </span>
                      {/* Addressed Badge */}
                      {isAddressed && (
                        <span className="text-xs px-2 py-0.5 rounded bg-linear-success/15 text-linear-success">
                          Rezolvat
                        </span>
                      )}
                    </div>

                    {/* Message */}
                    <p
                      className={`text-sm ${isAddressed ? 'text-linear-text-tertiary line-through' : 'text-linear-text-primary'}`}
                    >
                      {recommendation.message}
                    </p>

                    {/* Action steps count hint */}
                    {(recommendation.actionableSteps?.length ?? 0) > 0 && !isExpanded && (
                      <p className="text-xs text-linear-text-muted mt-1">
                        {recommendation.actionableSteps.length} pași de acțiune
                      </p>
                    )}
                  </div>

                  {/* Expand Icon */}
                  <button
                    className="flex-shrink-0 text-linear-text-muted hover:text-linear-text-secondary"
                    aria-label={isExpanded ? 'Restrânge' : 'Extinde'}
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Action Steps */}
              {isExpanded && (recommendation.actionableSteps?.length ?? 0) > 0 && (
                <div className="border-t border-linear-border-subtle p-4 bg-linear-bg-tertiary">
                  <h4 className="text-sm font-medium text-linear-text-secondary mb-3">
                    Pași de acțiune:
                  </h4>
                  <ol className="space-y-2">
                    {recommendation.actionableSteps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-linear-accent/10 text-linear-accent flex items-center justify-center text-xs font-medium">
                          {stepIndex + 1}
                        </span>
                        <span className="text-sm text-linear-text-secondary">{step}</span>
                      </li>
                    ))}
                  </ol>

                  {/* Mark as addressed action */}
                  {onMarkAsAddressed && !isAddressed && (
                    <div className="mt-4 pt-4 border-t border-linear-border-subtle">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsAddressed(originalIndex);
                        }}
                        className="px-4 py-2 text-sm bg-linear-success text-white rounded-lg hover:bg-linear-success/90 transition-colors"
                      >
                        Marchează ca rezolvat
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sortedAndFilteredRecommendations.length === 0 && (
          <div className="text-center py-8 text-linear-text-tertiary">
            Nicio recomandare pentru categoria selectată
          </div>
        )}
      </div>

      {/* Accessibility: Summary Table */}
      <details className="mt-4">
        <summary className="text-sm text-linear-text-tertiary cursor-pointer hover:text-linear-text-secondary">
          Vizualizare tabel (accesibilitate)
        </summary>
        <table className="mt-2 w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Prioritate</th>
              <th className="text-left py-2 px-3">Categorie</th>
              <th className="text-left py-2 px-3">Recomandare</th>
              <th className="text-left py-2 px-3">Pași</th>
              <th className="text-left py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredRecommendations.map((rec) => {
              const originalIndex = recommendations.indexOf(rec);
              const isAddressed = addressedRecommendations.includes(originalIndex);
              return (
                <tr key={originalIndex} className="border-b">
                  <td className="py-2 px-3">
                    {PRIORITY_CONFIG[rec.priority]?.label ?? rec.priority ?? 'N/A'}
                  </td>
                  <td className="py-2 px-3">
                    {CATEGORY_CONFIG[rec.category]?.label ?? rec.category ?? 'N/A'}
                  </td>
                  <td className="py-2 px-3">{rec.message}</td>
                  <td className="py-2 px-3">{rec.actionableSteps?.length ?? 0}</td>
                  <td className="py-2 px-3">{isAddressed ? 'Rezolvat' : 'Deschis'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default RecommendationsPanel;
