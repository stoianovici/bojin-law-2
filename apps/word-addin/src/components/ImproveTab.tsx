/**
 * Improve Tab Component
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Provides text improvement suggestions for clarity, formality, brevity, and legal precision.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api-client';
import { replaceSelection } from '../services/word-api';

type ImprovementType = 'clarity' | 'formality' | 'brevity' | 'legal_precision';

interface ImprovementResult {
  original: string;
  improved: string;
  explanation: string;
  processingTimeMs: number;
}

interface ImproveTabProps {
  selectedText: string;
  onError: (error: string) => void;
}

const IMPROVEMENT_OPTIONS: {
  type: ImprovementType;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    type: 'clarity',
    icon: '💡',
    title: 'Clarity',
    description: 'Make text easier to understand',
  },
  {
    type: 'formality',
    icon: '📝',
    title: 'Formality',
    description: 'Professional legal tone',
  },
  {
    type: 'brevity',
    icon: '✂️',
    title: 'Brevity',
    description: 'Make text more concise',
  },
  {
    type: 'legal_precision',
    icon: '⚖️',
    title: 'Legal Precision',
    description: 'Improve legal accuracy',
  },
];

export function ImproveTab({ selectedText, onError }: ImproveTabProps) {
  const [selectedType, setSelectedType] = useState<ImprovementType>('clarity');
  const [result, setResult] = useState<ImprovementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [customInstructions, setCustomInstructions] = useState<string>('');

  const handleImprove = useCallback(async () => {
    if (!selectedText) {
      onError('Please select some text to improve');
      return;
    }

    setLoading(true);
    setResult(null);
    setApplied(false);

    try {
      const response = await apiClient.improveText({
        documentId: await getDocumentId(),
        selectedText,
        improvementType: selectedType,
        customInstructions: customInstructions.trim() || undefined,
      });

      setResult(response);
    } catch (err: any) {
      onError(err.message || 'Failed to improve text');
    } finally {
      setLoading(false);
    }
  }, [selectedText, selectedType, customInstructions, onError]);

  const handleApply = useCallback(async () => {
    if (!result) return;

    try {
      await replaceSelection(result.improved);
      setApplied(true);
    } catch (err: any) {
      onError(err.message || 'Failed to apply improvement');
    }
  }, [result, onError]);

  return (
    <div className="section">
      {/* Improvement Type Selector */}
      <div className="section-title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Select Improvement Type
      </div>

      <div className="improvement-options">
        {IMPROVEMENT_OPTIONS.map((option) => (
          <div
            key={option.type}
            className={`improvement-option ${selectedType === option.type ? 'selected' : ''}`}
            onClick={() => setSelectedType(option.type)}
          >
            <div className="improvement-option-icon">{option.icon}</div>
            <div className="improvement-option-title">{option.title}</div>
          </div>
        ))}
      </div>

      {/* Custom Instructions */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          className="input-field"
          placeholder="Instrucțiuni suplimentare (opțional)... ex: păstrează tonul formal"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'vertical', fontSize: 12 }}
        />
      </div>

      {/* Improve Button */}
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleImprove}
          disabled={loading || !selectedText}
          style={{ width: '100%' }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 16, height: 16, margin: 0 }}></span>
              Improving...
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
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Improve Text
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
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
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            Improved Text
          </div>

          {/* Original vs Improved */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#605e5c', marginBottom: 4 }}>
              Original:
            </div>
            <div className="diff-view">
              <span className="diff-removed">{result.original}</span>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#605e5c', marginBottom: 4 }}>
              Improved:
            </div>
            <div className="diff-view">
              <span className="diff-added">{result.improved}</span>
            </div>
          </div>

          {/* Explanation */}
          <div className="legal-basis">
            <div className="legal-basis-label">What changed</div>
            <div className="legal-basis-text">{result.explanation}</div>
          </div>

          {/* Apply Button */}
          <div className="action-buttons" style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={() => setResult(null)}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleApply} disabled={applied}>
              {applied ? (
                <>
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
                  Applied
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
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Apply Changes
                </>
              )}
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#a19f9d' }}>
            Processed in {result.processingTimeMs}ms
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !result && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <svg
            className="empty-state-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <p className="empty-state-text">
            Select text and choose an improvement type to get AI-powered suggestions for better
            legal writing.
          </p>
        </div>
      )}
    </div>
  );
}

// Helper to get document ID
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
