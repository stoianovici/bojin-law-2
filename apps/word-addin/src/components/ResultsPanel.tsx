/**
 * ResultsPanel Component
 * Overlay panel for displaying action results.
 *
 * Shows explanations, risks, precedents, alternatives, etc.
 * with apply/insert/dismiss actions.
 */

import { useCallback, useState } from 'react';
import {
  insertText,
  insertMarkdown,
  replaceSelection,
  replaceSelectionFormatted,
  replaceSelectionOoxml,
} from '../services/word-api';

// ============================================================================
// Types
// ============================================================================

interface Suggestion {
  id: string;
  type: 'completion' | 'alternative' | 'precedent';
  content: string;
  confidence: number;
  source?: string;
  reasoning?: string;
}

export interface ResultData {
  type: 'explain' | 'verify' | 'risks' | 'precedents' | 'improve' | 'continue' | 'alternatives';
  title: string;
  content: string;
  original?: string;
  suggestions?: Suggestion[];
  metadata?: {
    explanation?: string;
    legalBasis?: string;
    sourceReferences?: string[];
  };
  canApply?: boolean;
  ooxmlContent?: string;
}

interface ResultsPanelProps {
  result: ResultData;
  onDismiss: () => void;
  onError: (error: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ResultsPanel({ result, onDismiss, onError }: ResultsPanelProps) {
  const [applied, setApplied] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  // Apply improved text (replace selection)
  const handleApply = useCallback(async () => {
    try {
      if (result.ooxmlContent) {
        await replaceSelectionOoxml(result.ooxmlContent);
      } else {
        await replaceSelectionFormatted(result.content);
      }
      setApplied(true);
    } catch (err) {
      console.error('[ResultsPanel] Apply error:', err);
      onError((err as Error)?.message || 'Nu s-a putut aplica');
    }
  }, [result, onError]);

  // Insert content at cursor
  const handleInsert = useCallback(async () => {
    try {
      await insertMarkdown(result.content);
      setApplied(true);
    } catch (err) {
      console.error('[ResultsPanel] Insert error:', err);
      onError((err as Error)?.message || 'Nu s-a putut insera');
    }
  }, [result, onError]);

  // Apply a specific suggestion
  const handleApplySuggestion = useCallback(
    async (suggestion: Suggestion, formatted: boolean = true) => {
      try {
        if (suggestion.type === 'completion') {
          if (formatted) {
            await insertMarkdown(suggestion.content);
          } else {
            await insertText(suggestion.content);
          }
        } else {
          if (formatted) {
            await replaceSelectionFormatted(suggestion.content);
          } else {
            await replaceSelection(suggestion.content);
          }
        }
        setSelectedSuggestion(suggestion.id);
      } catch (err) {
        console.error('[ResultsPanel] Apply suggestion error:', err);
        onError((err as Error)?.message || 'Nu s-a putut aplica sugestia');
      }
    },
    [onError]
  );

  return (
    <div className="results-panel">
      {/* Header */}
      <div className="results-header">
        <div className="results-title">
          <TypeIcon type={result.type} />
          {result.title}
        </div>
        <button className="results-close" onClick={onDismiss} title="Închide">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="results-content">
        {/* Main content */}
        {result.content && <div className="results-text">{result.content}</div>}

        {/* Legal basis */}
        {result.metadata?.legalBasis && (
          <div className="results-legal-basis">
            <div className="legal-basis-label">Bază legală</div>
            <div className="legal-basis-text">{result.metadata.legalBasis}</div>
          </div>
        )}

        {/* Source references */}
        {result.metadata?.sourceReferences && result.metadata.sourceReferences.length > 0 && (
          <div className="results-references">
            <div className="references-label">Referințe</div>
            <div className="references-list">
              {result.metadata.sourceReferences.map((ref, index) => (
                <span key={index} className="reference-tag">
                  {ref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Explanation for improvements */}
        {result.metadata?.explanation && (
          <div className="results-explanation">
            <div className="explanation-label">Ce s-a schimbat</div>
            <div className="explanation-text">{result.metadata.explanation}</div>
          </div>
        )}

        {/* Suggestions list */}
        {result.suggestions && result.suggestions.length > 0 && (
          <div className="results-suggestions">
            {result.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`suggestion-card ${selectedSuggestion === suggestion.id ? 'selected' : ''}`}
              >
                <div className="suggestion-content">{suggestion.content}</div>
                <div className="suggestion-meta">
                  <span className={`confidence-badge ${getConfidenceClass(suggestion.confidence)}`}>
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                  {suggestion.source && (
                    <span className="suggestion-source">{suggestion.source}</span>
                  )}
                </div>
                {suggestion.reasoning && (
                  <div className="suggestion-reasoning">{suggestion.reasoning}</div>
                )}
                <div className="suggestion-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleApplySuggestion(suggestion, false)}
                    disabled={selectedSuggestion === suggestion.id}
                  >
                    Text simplu
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApplySuggestion(suggestion, true)}
                    disabled={selectedSuggestion === suggestion.id}
                  >
                    {selectedSuggestion === suggestion.id ? 'Aplicat' : 'Aplică'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="results-actions">
        {result.canApply && !applied && (
          <>
            <button className="btn btn-secondary" onClick={onDismiss}>
              Renunță
            </button>
            <button className="btn btn-primary" onClick={handleApply}>
              Aplică
            </button>
          </>
        )}
        {result.type === 'continue' && !applied && result.suggestions?.[0] && (
          <>
            <button className="btn btn-secondary" onClick={onDismiss}>
              Renunță
            </button>
            <button className="btn btn-primary" onClick={handleInsert}>
              Inserează
            </button>
          </>
        )}
        {(applied || (!result.canApply && result.type !== 'continue')) && (
          <button className="btn btn-secondary" onClick={onDismiss} style={{ width: '100%' }}>
            {applied ? 'Închide' : 'OK'}
          </button>
        )}
      </div>

      {/* Success indicator */}
      {applied && (
        <div className="results-success">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Aplicat cu succes
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function TypeIcon({ type }: { type: ResultData['type'] }) {
  const icons: Record<ResultData['type'], JSX.Element> = {
    explain: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    verify: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    risks: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    precedents: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    improve: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    continue: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
    alternatives: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  };
  return (
    icons[type] || (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      </svg>
    )
  );
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
