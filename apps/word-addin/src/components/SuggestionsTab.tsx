/**
 * Suggestions Tab Component
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Displays AI-powered suggestions for text completion, alternatives, and precedents.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api-client';
import { insertText, replaceSelection } from '../services/word-api';

interface Suggestion {
  id: string;
  type: 'completion' | 'alternative' | 'precedent';
  content: string;
  confidence: number;
  source?: string;
  reasoning?: string;
}

interface SuggestionsTabProps {
  selectedText: string;
  cursorContext: string;
  onError: (error: string) => void;
}

type SuggestionType = 'completion' | 'alternative' | 'precedent';

export function SuggestionsTab({ selectedText, cursorContext, onError }: SuggestionsTabProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<SuggestionType>('completion');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>('');

  const getSuggestions = useCallback(async () => {
    if (!selectedText && selectedType !== 'completion') {
      onError('Please select some text first');
      return;
    }

    setLoading(true);
    setSuggestions([]);

    try {
      const response = await apiClient.getSuggestions({
        documentId: await getDocumentId(),
        selectedText: selectedText || '',
        cursorContext,
        suggestionType: selectedType,
        customInstructions: customInstructions.trim() || undefined,
      });

      setSuggestions(response.suggestions);
    } catch (err: any) {
      onError(err.message || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  }, [selectedText, cursorContext, selectedType, customInstructions, onError]);

  const handleApplySuggestion = useCallback(
    async (suggestion: Suggestion) => {
      try {
        if (suggestion.type === 'completion') {
          await insertText(suggestion.content);
        } else {
          await replaceSelection(suggestion.content);
        }
        setSelectedSuggestion(suggestion.id);
      } catch (err: any) {
        onError(err.message || 'Failed to apply suggestion');
      }
    },
    [onError]
  );

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  };

  return (
    <div className="section">
      {/* Mode Selector */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${selectedType === 'completion' ? 'active' : ''}`}
          onClick={() => setSelectedType('completion')}
        >
          Complete
        </button>
        <button
          className={`mode-btn ${selectedType === 'alternative' ? 'active' : ''}`}
          onClick={() => setSelectedType('alternative')}
        >
          Alternative
        </button>
        <button
          className={`mode-btn ${selectedType === 'precedent' ? 'active' : ''}`}
          onClick={() => setSelectedType('precedent')}
        >
          Precedent
        </button>
      </div>

      {/* Custom Instructions */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          className="input-field"
          placeholder="Instrucțiuni suplimentare (opțional)..."
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'vertical', fontSize: 12 }}
        />
      </div>

      {/* Get Suggestions Button */}
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={getSuggestions}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 16, height: 16, margin: 0 }}></span>
              Getting suggestions...
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4.93 4.93l2.83 2.83" />
                <path d="M16.24 16.24l2.83 2.83" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="M4.93 19.07l2.83-2.83" />
                <path d="M16.24 7.76l2.83-2.83" />
              </svg>
              Get{' '}
              {selectedType === 'completion'
                ? 'Completions'
                : selectedType === 'alternative'
                  ? 'Alternatives'
                  : 'Precedents'}
            </>
          )}
        </button>
      </div>

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Suggestions
          </div>

          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`suggestion-card ${selectedSuggestion === suggestion.id ? 'selected' : ''}`}
              onClick={() => handleApplySuggestion(suggestion)}
            >
              <div className="suggestion-content">{suggestion.content}</div>
              <div className="suggestion-meta">
                <span className={`confidence-badge ${getConfidenceClass(suggestion.confidence)}`}>
                  {Math.round(suggestion.confidence * 100)}% match
                </span>
                {suggestion.source && (
                  <span style={{ fontSize: 11, color: '#605e5c' }}>from: {suggestion.source}</span>
                )}
              </div>
              {suggestion.reasoning && (
                <div style={{ fontSize: 11, color: '#605e5c', marginTop: 8 }}>
                  {suggestion.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && suggestions.length === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <svg
            className="empty-state-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="empty-state-text">
            {selectedType === 'completion'
              ? 'Position your cursor and click "Get Completions" for AI-powered text suggestions.'
              : 'Select text and click the button above to get AI suggestions.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper to get document ID from document properties
async function getDocumentId(): Promise<string> {
  return new Promise((resolve) => {
    Word.run(async (context: Word.RequestContext) => {
      const properties = context.document.properties;
      properties.load('customProperties');
      await context.sync();

      const docIdProp = properties.customProperties.items.find(
        (p: Word.CustomProperty) => p.key === 'PlatformDocumentId'
      );

      resolve(docIdProp?.value || 'unknown');
    }).catch(() => resolve('unknown'));
  });
}
