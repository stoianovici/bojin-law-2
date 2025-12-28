/**
 * AIInsightsPanel - Collapsible AI insights panel
 * Shows AI-generated suggestions and recommendations for the case
 */

'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import { useCaseWorkspaceStore } from '../../stores/case-workspace.store';
import type { AISuggestion } from '../../hooks/useSuggestions';

// Map GraphQL category to icon type
type IconType = 'document' | 'deadline' | 'task' | 'precedent' | 'communication';

export interface AIInsightsPanelProps {
  caseName: string;
  suggestions?: AISuggestion[];
  loading?: boolean;
  onDismissSuggestion?: (suggestionId: string) => void;
  onTakeAction?: (suggestionId: string) => void;
  className?: string;
}

/**
 * Map category/type to icon type
 */
function getIconType(category: string, type: string): IconType {
  // Map by category first
  switch (category) {
    case 'Document':
      return 'document';
    case 'Communication':
      return 'communication';
    case 'Task':
      return 'task';
    case 'Calendar':
      return 'deadline';
    case 'Compliance':
      return 'precedent';
  }
  // Fallback to type mapping
  switch (type) {
    case 'DeadlineWarning':
      return 'deadline';
    case 'TaskSuggestion':
      return 'task';
    case 'DocumentCheck':
      return 'document';
    case 'FollowUp':
      return 'communication';
    case 'RiskAlert':
      return 'deadline';
    default:
      return 'task';
  }
}

/**
 * Suggestion Icon Component
 */
function SuggestionIcon({ type }: { type: IconType }) {
  const iconConfig: Record<IconType, { icon: JSX.Element; color: string }> = {
    document: {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      ),
      color: 'text-linear-accent',
    },
    deadline: {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      ),
      color: 'text-linear-error',
    },
    task: {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      ),
      color: 'text-linear-warning',
    },
    precedent: {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      ),
      color: 'text-linear-accent',
    },
    communication: {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      ),
      color: 'text-linear-success',
    },
  };

  const config = iconConfig[type];

  return (
    <svg
      className={clsx('w-5 h-5', config.color)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {config.icon}
    </svg>
  );
}

/**
 * Get priority color/badge
 */
function getPriorityBadge(priority: string): { color: string; label: string } | null {
  switch (priority) {
    case 'Urgent':
      return { color: 'bg-linear-error/15 text-linear-error', label: 'Urgent' };
    case 'High':
      return { color: 'bg-linear-warning/15 text-linear-warning', label: 'Prioritar' };
    default:
      return null;
  }
}

/**
 * Suggestion Item Component
 */
interface SuggestionItemProps {
  suggestion: AISuggestion;
  onDismiss?: () => void;
  onAction?: () => void;
}

function SuggestionItem({ suggestion, onDismiss, onAction }: SuggestionItemProps) {
  const iconType = getIconType(suggestion.category, suggestion.type);
  const priorityBadge = getPriorityBadge(suggestion.priority);
  const timestamp = new Date(suggestion.createdAt);

  return (
    <div className="p-4 bg-linear-bg-secondary rounded-lg border border-linear-accent/30 hover:border-linear-accent/50 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <SuggestionIcon type={iconType} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium text-linear-text-primary">{suggestion.title}</h4>
            {priorityBadge && (
              <span
                className={clsx('px-1.5 py-0.5 text-xs font-medium rounded', priorityBadge.color)}
              >
                {priorityBadge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-linear-text-secondary mb-2">{suggestion.description}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-linear-text-tertiary">
                {formatDistanceToNow(timestamp, {
                  addSuffix: true,
                  locale: ro,
                })}
              </span>
              {suggestion.confidence > 0.8 && (
                <span
                  className="text-xs text-linear-success"
                  title={`Încredere: ${Math.round(suggestion.confidence * 100)}%`}
                >
                  • Încredere înaltă
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {suggestion.suggestedAction && (
                <button
                  onClick={onAction}
                  className="text-xs font-medium text-linear-accent hover:text-linear-accent-hover hover:underline"
                >
                  {suggestion.suggestedAction}
                </button>
              )}
              <button
                onClick={onDismiss}
                className="p-1 rounded text-linear-text-muted hover:text-linear-text-secondary hover:bg-linear-bg-hover"
                aria-label="Respinge sugestie"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AIInsightsPanel Component
 *
 * Collapsible panel showing AI-generated suggestions for the case
 *
 * Memoized for performance optimization to prevent unnecessary re-renders
 * when parent component updates but props remain unchanged.
 */
function AIInsightsPanelComponent({
  caseName,
  suggestions = [],
  loading = false,
  onDismissSuggestion,
  onTakeAction,
  className,
}: AIInsightsPanelProps) {
  const { aiPanelCollapsed, toggleAIPanel } = useCaseWorkspaceStore();

  // Filter to show only pending suggestions (not dismissed/accepted/expired)
  const visibleSuggestions = suggestions.filter((s) => s.status === 'Pending');

  return (
    <div
      className={clsx(
        'fixed top-16 right-0 bg-linear-bg-secondary border-l border-linear-border-subtle shadow-lg transition-all duration-300 z-40',
        'h-[calc(100vh-4rem)]', // Full height minus TopBar (4rem = 64px)
        aiPanelCollapsed ? 'w-12' : 'w-80',
        className
      )}
    >
      {/* Collapsed State - Toggle Button */}
      {aiPanelCollapsed && (
        <button
          onClick={toggleAIPanel}
          className="w-full h-16 flex items-center justify-center border-b border-linear-border-subtle hover:bg-linear-accent/10 transition-colors group"
          aria-label="Deschide panoul AI"
        >
          <svg
            className="w-6 h-6 text-linear-accent group-hover:text-linear-accent-hover"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Expanded State */}
      {!aiPanelCollapsed && (
        <>
          {/* Header */}
          <div className="px-4 py-3 border-b border-linear-border-subtle bg-linear-accent/10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-linear-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <h3 className="text-sm font-semibold text-linear-text-primary">Sugestii AI</h3>
              </div>
              <button
                onClick={toggleAIPanel}
                className="p-1 rounded text-linear-text-muted hover:text-linear-text-secondary hover:bg-linear-bg-secondary transition-colors"
                aria-label="Închide panoul"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
            <p className="text-xs text-linear-text-secondary">
              Sugestii pentru <span className="font-medium">{caseName}</span>
            </p>
          </div>

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-linear-accent/15 flex items-center justify-center mb-3 animate-pulse">
                  <svg
                    className="w-8 h-8 text-linear-accent animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-linear-text-primary mb-1">Se încarcă sugestiile...</p>
                <p className="text-xs text-linear-text-secondary">AI analizează cazul dvs.</p>
              </div>
            ) : visibleSuggestions.length > 0 ? (
              visibleSuggestions.map((suggestion) => (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  onDismiss={() => onDismissSuggestion?.(suggestion.id)}
                  onAction={() => onTakeAction?.(suggestion.id)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-linear-accent/15 flex items-center justify-center mb-3">
                  <svg
                    className="w-8 h-8 text-linear-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-linear-text-primary mb-1">Nicio sugestie disponibilă</p>
                <p className="text-xs text-linear-text-secondary">
                  AI analizează cazul dvs. pentru a genera sugestii utile
                </p>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="px-4 py-3 border-t border-linear-border-subtle bg-linear-accent/10">
            <p className="text-xs text-linear-accent">
              <strong>Notă:</strong> Sugestiile AI sunt generate automat și ar trebui verificate de
              un profesionist legal.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Memoized export for performance optimization
export const AIInsightsPanel = React.memo(AIInsightsPanelComponent);
AIInsightsPanel.displayName = 'AIInsightsPanel';
