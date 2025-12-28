/**
 * Pattern Detection Panel Component
 * Story 4.7: Task Analytics and Optimization - Task 23
 *
 * Displays AI-detected task co-occurrence patterns with template creation option.
 * AC: 4 - AI identifies frequently co-occurring tasks
 */

'use client';

import React, { useState } from 'react';
import type { PatternDetectionResponse, TaskCoOccurrencePattern } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface PatternDetectionPanelProps {
  data: PatternDetectionResponse | undefined;
  loading: boolean;
  onCreateTemplate: (pattern: TaskCoOccurrencePattern) => void;
  onDismissPattern: (patternId: string) => void;
  isCreatingTemplate: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TASK_TYPE_LABELS: Record<string, string> = {
  CourtAppearance: 'Ședință instanță',
  DocumentDrafting: 'Redactare document',
  ClientMeeting: 'Întâlnire client',
  Research: 'Cercetare',
  Filing: 'Depunere',
  Correspondence: 'Corespondență',
  InternalMeeting: 'Întâlnire internă',
  Deadline: 'Termen',
  Review: 'Revizie',
  Other: 'Altele',
};

const CONFIDENCE_COLORS = {
  high: { bg: 'bg-linear-success/10', text: 'text-linear-success', border: 'border-linear-success/30' },
  medium: { bg: 'bg-linear-warning/10', text: 'text-linear-warning', border: 'border-linear-warning/30' },
  low: { bg: 'bg-linear-bg-tertiary', text: 'text-linear-text-secondary', border: 'border-linear-border-subtle' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function formatTaskTypes(types: string[]): string {
  return types.map((t) => TASK_TYPE_LABELS[t] || t).join(' → ');
}

// ============================================================================
// Component
// ============================================================================

export function PatternDetectionPanel({
  data,
  loading,
  onCreateTemplate,
  onDismissPattern,
  isCreatingTemplate,
}: PatternDetectionPanelProps) {
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'actionable'>('all');

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-linear-bg-tertiary animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8 text-linear-text-tertiary">Nu există date despre tipare</div>;
  }

  const filteredPatterns = data.patterns.filter((pattern) => {
    if (filter === 'high') return pattern.confidence >= 0.8;
    if (filter === 'actionable') return !pattern.isTemplateCreated && pattern.confidence >= 0.5;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-linear-accent/10 border border-linear-accent/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-linear-accent">Detecție tipare AI</h3>
            <p className="text-sm text-linear-accent/80">
              Secvențe de sarcini frecvente detectate în fluxul de lucru
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-linear-accent">{data.totalPatternsFound}</div>
            <div className="text-sm text-linear-accent/70">
              tipare găsite ({data.highConfidenceCount} cu încredere ridicată)
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-linear-accent/60">
          Ultima analiză: {new Date(data.analysisDate).toLocaleString('ro-RO')}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Toate tiparele' },
          { id: 'high', label: 'Încredere ridicată' },
          { id: 'actionable', label: 'Acționabile' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === tab.id
                ? 'bg-linear-accent text-white'
                : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pattern Cards */}
      <div className="space-y-4">
        {filteredPatterns.map((pattern) => {
          const confidenceLevel = getConfidenceLevel(pattern.confidence);
          const colors = CONFIDENCE_COLORS[confidenceLevel];
          const isExpanded = expandedPattern === pattern.id;

          return (
            <div
              key={pattern.id}
              className={`bg-linear-bg-secondary rounded-lg border ${colors.border} overflow-hidden`}
            >
              {/* Pattern Header */}
              <div
                className="p-4 cursor-pointer hover:bg-linear-bg-tertiary transition-colors"
                onClick={() => setExpandedPattern(isExpanded ? null : pattern.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
                        {(pattern.confidence * 100).toFixed(0)}% încredere
                      </span>
                      <span className="text-xs text-linear-text-tertiary">
                        {pattern.occurrenceCount} apariții
                      </span>
                      {pattern.isTemplateCreated && (
                        <span className="text-xs bg-linear-accent/10 text-linear-accent px-2 py-1 rounded">
                          Șablon creat
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-linear-text-primary">{pattern.suggestedTemplateName}</h4>
                    <div className="mt-2 text-sm text-linear-text-secondary">
                      {formatTaskTypes(pattern.taskTypes)}
                    </div>
                  </div>
                  <button className="text-linear-text-muted hover:text-linear-text-secondary">
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

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-linear-border-subtle p-4 bg-linear-bg-tertiary">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Task Sequence */}
                    <div>
                      <h5 className="text-sm font-medium text-linear-text-secondary mb-3">Secvență sarcini</h5>
                      <div className="space-y-2">
                        {pattern.taskTypes.map((type, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-linear-accent/10 text-linear-accent flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span className="text-sm">{TASK_TYPE_LABELS[type] || type}</span>
                            {index < pattern.taskTypes.length - 1 && (
                              <span className="text-linear-text-muted text-xs ml-auto">
                                ~{pattern.avgSequenceGapDays?.toFixed(1) || '?'} zile interval
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Common Assignees */}
                    <div>
                      <h5 className="text-sm font-medium text-linear-text-secondary mb-3">
                        Responsabili frecvenți
                      </h5>
                      <div className="space-y-2">
                        {pattern.commonAssignees.slice(0, 5).map((assignee) => (
                          <div
                            key={assignee.userId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{assignee.userName}</span>
                            <span className="text-linear-text-tertiary">de {assignee.frequency} ori</span>
                          </div>
                        ))}
                        {pattern.commonAssignees.length === 0 && (
                          <span className="text-sm text-linear-text-tertiary">
                            Nicio informație despre responsabili
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sample Cases */}
                    <div>
                      <h5 className="text-sm font-medium text-linear-text-secondary mb-3">Exemple de dosare</h5>
                      <div className="space-y-1">
                        {pattern.sampleCases.slice(0, 3).map((sample) => (
                          <div key={sample.caseId} className="text-sm text-linear-text-secondary">
                            {sample.caseTitle}
                          </div>
                        ))}
                        {pattern.sampleCases.length === 0 && (
                          <span className="text-sm text-linear-text-tertiary">Niciun exemplu de dosar</span>
                        )}
                      </div>
                    </div>

                    {/* Case Types */}
                    <div>
                      <h5 className="text-sm font-medium text-linear-text-secondary mb-3">Tipuri de dosare</h5>
                      <div className="flex flex-wrap gap-2">
                        {pattern.caseTypes.map((caseType) => (
                          <span
                            key={caseType}
                            className="text-xs bg-linear-bg-hover text-linear-text-secondary px-2 py-1 rounded"
                          >
                            {caseType}
                          </span>
                        ))}
                        {pattern.caseTypes.length === 0 && (
                          <span className="text-sm text-linear-text-tertiary">Toate tipurile de dosare</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!pattern.isTemplateCreated && (
                    <div className="mt-6 flex gap-3 pt-4 border-t border-linear-border-subtle">
                      <button
                        onClick={() => onCreateTemplate(pattern)}
                        disabled={isCreatingTemplate}
                        className="flex-1 px-4 py-2 bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCreatingTemplate ? 'Se creează...' : 'Creează șablon'}
                      </button>
                      <button
                        onClick={() => onDismissPattern(pattern.id)}
                        className="px-4 py-2 bg-linear-bg-hover text-linear-text-secondary rounded-lg hover:bg-linear-bg-tertiary transition-colors"
                      >
                        Ignoră
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredPatterns.length === 0 && (
          <div className="text-center py-8 text-linear-text-tertiary">
            Niciun tipar nu corespunde filtrului curent
          </div>
        )}
      </div>
    </div>
  );
}

export default PatternDetectionPanel;
