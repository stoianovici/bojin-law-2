/**
 * Format Test Panel Component
 *
 * Dedicated panel for testing document formatting in Word Add-in.
 * Shows when debug mode is enabled. Allows one-click insertion of
 * test samples without going through the generation wizard.
 *
 * Features:
 * - Samples organized by category
 * - Insert as HTML, Markdown, or OOXML
 * - Preview of what formatting features are tested
 * - Collapsible categories for easy navigation
 */

import { useState, useCallback } from 'react';
import {
  MOCK_SAMPLES,
  CATEGORY_LABELS,
  getSamplesByCategory,
  type MockSample,
  type SampleCategory,
} from '../services/debug-mock';
import { insertHtml, insertMarkdown } from '../services/word-api';

// ============================================================================
// Types
// ============================================================================

type InsertFormat = 'html' | 'markdown';

interface FormatTestPanelProps {
  onError: (error: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function FormatTestPanel({ onError }: FormatTestPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<SampleCategory>>(
    new Set(['full-documents']) // Start with full documents expanded
  );
  const [inserting, setInserting] = useState<string | null>(null);
  const [lastInserted, setLastInserted] = useState<string | null>(null);

  const samplesByCategory = getSamplesByCategory();

  // Toggle category expansion
  const toggleCategory = useCallback((category: SampleCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Insert sample content into Word
  const handleInsert = useCallback(
    async (sample: MockSample, format: InsertFormat) => {
      const sampleKey =
        Object.entries(MOCK_SAMPLES).find(([, s]) => s === sample)?.[0] || 'unknown';
      setInserting(sampleKey);

      try {
        if (format === 'markdown' && sample.markdown) {
          await insertMarkdown(sample.markdown);
        } else {
          await insertHtml(sample.html);
        }
        setLastInserted(sampleKey);
        console.log(`[FormatTest] Inserted ${sampleKey} as ${format}`);
      } catch (err) {
        console.error('[FormatTest] Insert error:', err);
        onError((err as Error)?.message || 'Nu s-a putut insera conținutul');
      } finally {
        setInserting(null);
      }
    },
    [onError]
  );

  // Get category icon
  const getCategoryIcon = (category: SampleCategory): string => {
    const icons: Record<SampleCategory, string> = {
      headings: 'H',
      lists: '•',
      tables: '▦',
      blockquotes: '"',
      footnotes: '¹',
      callouts: '!',
      typography: 'T',
      'full-documents': '📄',
      'edge-cases': '⚠',
    };
    return icons[category] || '?';
  };

  return (
    <div className="format-test-panel">
      <div className="format-test-header">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>Test Formatare</span>
      </div>

      <div className="format-test-content">
        {(Object.entries(samplesByCategory) as [SampleCategory, MockSample[]][]).map(
          ([category, samples]) => {
            if (samples.length === 0) return null;
            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="format-test-category">
                <button
                  className="format-test-category-header"
                  onClick={() => toggleCategory(category)}
                >
                  <span className="category-icon">{getCategoryIcon(category)}</span>
                  <span className="category-label">{CATEGORY_LABELS[category]}</span>
                  <span className="category-count">{samples.length}</span>
                  <svg
                    className={`category-chevron ${isExpanded ? 'expanded' : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="format-test-samples">
                    {samples.map((sample) => {
                      const sampleKey =
                        Object.entries(MOCK_SAMPLES).find(([, s]) => s === sample)?.[0] || '';
                      const isInserting = inserting === sampleKey;
                      const wasInserted = lastInserted === sampleKey;

                      return (
                        <div
                          key={sampleKey}
                          className={`format-test-sample ${wasInserted ? 'just-inserted' : ''}`}
                        >
                          <div className="sample-info">
                            <span className="sample-name">{sample.name}</span>
                            <span className="sample-tests">
                              {sample.tests.slice(0, 3).join(', ')}
                            </span>
                          </div>
                          <div className="sample-actions">
                            <button
                              className="btn-insert btn-html"
                              onClick={() => handleInsert(sample, 'html')}
                              disabled={isInserting}
                              title="Inserează ca HTML"
                            >
                              {isInserting ? '...' : 'HTML'}
                            </button>
                            {sample.markdown && (
                              <button
                                className="btn-insert btn-md"
                                onClick={() => handleInsert(sample, 'markdown')}
                                disabled={isInserting}
                                title="Inserează ca Markdown"
                              >
                                MD
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      <div className="format-test-footer">
        <span className="sample-count">{Object.keys(MOCK_SAMPLES).length - 2} sample-uri</span>
        <span className="help-text">Click pentru inserare directă</span>
      </div>

      <style>{`
        .format-test-panel {
          background: var(--bg-secondary, #f5f5f5);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          margin: 8px 0;
          overflow: hidden;
        }

        .format-test-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .format-test-content {
          max-height: 300px;
          overflow-y: auto;
        }

        .format-test-category {
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .format-test-category:last-child {
          border-bottom: none;
        }

        .format-test-category-header {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          font-size: 11px;
          color: var(--text-primary, #333);
          transition: background-color 0.15s;
        }

        .format-test-category-header:hover {
          background: var(--bg-hover, #eee);
        }

        .category-icon {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary, #e0e0e0);
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
        }

        .category-label {
          flex: 1;
          font-weight: 500;
        }

        .category-count {
          color: var(--text-secondary, #666);
          font-size: 10px;
        }

        .category-chevron {
          transition: transform 0.2s;
        }

        .category-chevron.expanded {
          transform: rotate(180deg);
        }

        .format-test-samples {
          padding: 4px 8px 8px;
          background: var(--bg-tertiary, #fafafa);
        }

        .format-test-sample {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 6px 8px;
          background: white;
          border-radius: 4px;
          margin-bottom: 4px;
          transition: all 0.2s;
        }

        .format-test-sample:last-child {
          margin-bottom: 0;
        }

        .format-test-sample:hover {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .format-test-sample.just-inserted {
          background: #e8f5e9;
          border: 1px solid #4caf50;
        }

        .sample-info {
          flex: 1;
          min-width: 0;
        }

        .sample-name {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-primary, #333);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sample-tests {
          display: block;
          font-size: 9px;
          color: var(--text-tertiary, #999);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sample-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-insert {
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-insert:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-html {
          background: #fff3e0;
          border-color: #ff9800;
          color: #e65100;
        }

        .btn-html:hover:not(:disabled) {
          background: #ffe0b2;
        }

        .btn-md {
          background: #e3f2fd;
          border-color: #2196f3;
          color: #0d47a1;
        }

        .btn-md:hover:not(:disabled) {
          background: #bbdefb;
        }

        .format-test-footer {
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--bg-tertiary, #fafafa);
          border-top: 1px solid var(--border-color, #e0e0e0);
          font-size: 9px;
          color: var(--text-tertiary, #999);
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .format-test-panel {
            background: #2a2a2a;
            border-color: #444;
          }

          .format-test-category-header {
            color: #ddd;
          }

          .format-test-category-header:hover {
            background: #333;
          }

          .category-icon {
            background: #444;
          }

          .format-test-samples {
            background: #1a1a1a;
          }

          .format-test-sample {
            background: #2a2a2a;
          }

          .format-test-sample.just-inserted {
            background: #1b5e20;
            border-color: #4caf50;
          }

          .sample-name {
            color: #eee;
          }

          .format-test-footer {
            background: #1a1a1a;
            border-color: #444;
          }
        }

        /* Office dark theme support */
        .office-theme-dark .format-test-panel {
          background: #2a2a2a;
          border-color: #444;
        }

        .office-theme-dark .format-test-category-header {
          color: #ddd;
        }

        .office-theme-dark .format-test-samples {
          background: #1a1a1a;
        }

        .office-theme-dark .format-test-sample {
          background: #2a2a2a;
        }

        .office-theme-dark .sample-name {
          color: #eee;
        }
      `}</style>
    </div>
  );
}
