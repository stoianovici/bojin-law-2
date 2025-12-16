/**
 * Explain Tab Component
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Provides plain-language explanations of legal text with references.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api-client';

interface ExplanationResult {
  explanation: string;
  legalBasis?: string;
  sourceReferences?: string[];
  processingTimeMs: number;
}

interface ExplainTabProps {
  selectedText: string;
  onError: (error: string) => void;
}

export function ExplainTab({ selectedText, onError }: ExplainTabProps) {
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = useCallback(async () => {
    if (!selectedText) {
      onError('Please select some text to explain');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await apiClient.explainText({
        documentId: await getDocumentId(),
        selectedText,
      });

      setResult(response);
    } catch (err: any) {
      onError(err.message || 'Failed to explain text');
    } finally {
      setLoading(false);
    }
  }, [selectedText, onError]);

  return (
    <div className="section">
      {/* Explain Button */}
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleExplain}
          disabled={loading || !selectedText}
          style={{ width: '100%' }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 16, height: 16, margin: 0 }}></span>
              Analyzing...
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              Explain Selection
            </>
          )}
        </button>
      </div>

      {/* Explanation Result */}
      {result && (
        <div className="explanation-panel" style={{ marginTop: 16 }}>
          <div className="explanation-title">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}
            >
              <path d="M12 3v18" />
              <path d="M8 8l4-4 4 4" />
            </svg>
            Plain Language Explanation
          </div>

          <div className="explanation-content">{result.explanation}</div>

          {result.legalBasis && (
            <div className="legal-basis">
              <div className="legal-basis-label">Legal Basis</div>
              <div className="legal-basis-text">{result.legalBasis}</div>
            </div>
          )}

          {result.sourceReferences && result.sourceReferences.length > 0 && (
            <div className="source-references">
              <div className="source-references-label">References</div>
              <div>
                {result.sourceReferences.map((ref, index) => (
                  <span key={index} className="source-tag">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}

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
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="empty-state-text">
            Select legal text in your document and click "Explain Selection" to get a plain-language
            explanation.
          </p>
        </div>
      )}

      {/* Help Text */}
      <div style={{ marginTop: 24, padding: 12, background: '#f3f2f1', borderRadius: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Tips</div>
        <ul style={{ fontSize: 12, color: '#605e5c', paddingLeft: 16, margin: 0, lineHeight: 1.6 }}>
          <li>Select a clause or paragraph for best results</li>
          <li>Legal jargon will be translated to plain Romanian</li>
          <li>References to Romanian legal codes will be identified</li>
        </ul>
      </div>
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
