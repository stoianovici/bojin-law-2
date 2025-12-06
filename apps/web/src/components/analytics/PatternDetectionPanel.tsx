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
  high: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  low: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
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
          <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nu există date despre tipare
      </div>
    );
  }

  const filteredPatterns = data.patterns.filter((pattern) => {
    if (filter === 'high') return pattern.confidence >= 0.8;
    if (filter === 'actionable') return !pattern.isTemplateCreated && pattern.confidence >= 0.5;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-violet-800">
              Detecție tipare AI
            </h3>
            <p className="text-sm text-violet-600">
              Secvențe de sarcini frecvente detectate în fluxul de lucru
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-violet-600">
              {data.totalPatternsFound}
            </div>
            <div className="text-sm text-violet-500">
              tipare găsite ({data.highConfidenceCount} cu încredere ridicată)
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-violet-500">
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
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              className={`bg-white rounded-lg border ${colors.border} overflow-hidden`}
            >
              {/* Pattern Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedPattern(isExpanded ? null : pattern.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
                        {(pattern.confidence * 100).toFixed(0)}% încredere
                      </span>
                      <span className="text-xs text-gray-500">
                        {pattern.occurrenceCount} apariții
                      </span>
                      {pattern.isTemplateCreated && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Șablon creat
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900">
                      {pattern.suggestedTemplateName}
                    </h4>
                    <div className="mt-2 text-sm text-gray-600">
                      {formatTaskTypes(pattern.taskTypes)}
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
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
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Task Sequence */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-3">
                        Secvență sarcini
                      </h5>
                      <div className="space-y-2">
                        {pattern.taskTypes.map((type, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span className="text-sm">
                              {TASK_TYPE_LABELS[type] || type}
                            </span>
                            {index < pattern.taskTypes.length - 1 && (
                              <span className="text-gray-400 text-xs ml-auto">
                                ~{pattern.avgSequenceGapDays?.toFixed(1) || '?'} zile interval
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Common Assignees */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-3">
                        Responsabili frecvenți
                      </h5>
                      <div className="space-y-2">
                        {pattern.commonAssignees.slice(0, 5).map((assignee) => (
                          <div
                            key={assignee.userId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{assignee.userName}</span>
                            <span className="text-gray-500">
                              de {assignee.frequency} ori
                            </span>
                          </div>
                        ))}
                        {pattern.commonAssignees.length === 0 && (
                          <span className="text-sm text-gray-500">Nicio informație despre responsabili</span>
                        )}
                      </div>
                    </div>

                    {/* Sample Cases */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-3">
                        Exemple de dosare
                      </h5>
                      <div className="space-y-1">
                        {pattern.sampleCases.slice(0, 3).map((sample) => (
                          <div key={sample.caseId} className="text-sm text-gray-600">
                            {sample.caseTitle}
                          </div>
                        ))}
                        {pattern.sampleCases.length === 0 && (
                          <span className="text-sm text-gray-500">Niciun exemplu de dosar</span>
                        )}
                      </div>
                    </div>

                    {/* Case Types */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-3">
                        Tipuri de dosare
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {pattern.caseTypes.map((caseType) => (
                          <span
                            key={caseType}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                          >
                            {caseType}
                          </span>
                        ))}
                        {pattern.caseTypes.length === 0 && (
                          <span className="text-sm text-gray-500">Toate tipurile de dosare</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!pattern.isTemplateCreated && (
                    <div className="mt-6 flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => onCreateTemplate(pattern)}
                        disabled={isCreatingTemplate}
                        className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCreatingTemplate ? 'Se creează...' : 'Creează șablon'}
                      </button>
                      <button
                        onClick={() => onDismissPattern(pattern.id)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
          <div className="text-center py-8 text-gray-500">
            Niciun tipar nu corespunde filtrului curent
          </div>
        )}
      </div>
    </div>
  );
}

export default PatternDetectionPanel;
