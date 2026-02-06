/**
 * Format Sandbox Component
 *
 * Full-featured sandbox for testing document formatting without API calls.
 * Allows editing content, testing all insertion methods (HTML, Markdown, OOXML),
 * and viewing the conversion pipeline output.
 *
 * Usage:
 * - Enable via ?sandbox=true URL param or sandbox toggle
 * - Edit content in the textarea
 * - Test insertion with HTML (direct), Markdown (converted), or OOXML (full pipeline)
 * - View OOXML output for debugging
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  MOCK_SAMPLES,
  CATEGORY_LABELS,
  getSamplesByCategory,
  type MockSample,
  type SampleCategory,
} from '../services/debug-mock';
import { insertHtml, insertMarkdown, insertOoxml } from '../services/word-api';
import { apiClient } from '../services/api-client';

// ============================================================================
// Types
// ============================================================================

type ContentFormat = 'html' | 'markdown';
type InsertMethod = 'html' | 'markdown' | 'ooxml';

interface LogEntry {
  id: number;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'ooxml';
  message: string;
  details?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FormatSandbox() {
  // Content state
  const [content, setContent] = useState<string>(MOCK_SAMPLES['doc-court-filing']?.html || '');
  const [contentFormat, setContentFormat] = useState<ContentFormat>('html');
  const [selectedSample, setSelectedSample] = useState<string>('doc-court-filing');

  // UI state
  const [expandedCategories, setExpandedCategories] = useState<Set<SampleCategory>>(
    new Set(['full-documents'])
  );
  const [inserting, setInserting] = useState<InsertMethod | null>(null);
  const [showOoxmlPreview, setShowOoxmlPreview] = useState(false);
  const [ooxmlContent, setOoxmlContent] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refs
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Add log entry
  const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date(),
      type,
      message,
      details,
    };
    setLogs((prev) => [...prev.slice(-50), entry]); // Keep last 50 logs
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  }, [addLog]);

  // Load sample content
  const loadSample = useCallback(
    (sampleKey: string) => {
      const sample = MOCK_SAMPLES[sampleKey];
      if (!sample) return;

      setSelectedSample(sampleKey);

      // Prefer markdown if available and currently in markdown mode
      if (contentFormat === 'markdown' && sample.markdown) {
        setContent(sample.markdown);
        addLog('info', `Loaded "${sample.name}" as Markdown`);
      } else {
        setContent(sample.html);
        setContentFormat('html');
        addLog('info', `Loaded "${sample.name}" as HTML`);
      }
    },
    [contentFormat, addLog]
  );

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

  // Insert content into Word
  const handleInsert = useCallback(
    async (method: InsertMethod) => {
      if (!content.trim()) {
        addLog('error', 'No content to insert');
        return;
      }

      setInserting(method);
      const startTime = Date.now();

      try {
        switch (method) {
          case 'html':
            addLog('info', 'Inserting as HTML...');
            await insertHtml(content);
            addLog('success', `HTML inserted (${Date.now() - startTime}ms)`);
            break;

          case 'markdown':
            addLog('info', 'Inserting as Markdown (converting to HTML)...');
            await insertMarkdown(content);
            addLog('success', `Markdown inserted (${Date.now() - startTime}ms)`);
            break;

          case 'ooxml': {
            addLog('info', 'Converting to OOXML via API...');
            const ooxmlResult = await apiClient.getOoxml(content, contentFormat);
            const ooxml = ooxmlResult.ooxmlContent;

            setOoxmlContent(ooxml);
            addLog(
              'ooxml',
              `OOXML received (${ooxml.length} chars, ${Date.now() - startTime}ms)`,
              ooxml.substring(0, 500) + '...'
            );

            addLog('info', 'Inserting OOXML into Word...');
            await insertOoxml(ooxml, content);
            addLog('success', `OOXML inserted (${Date.now() - startTime}ms total)`);
            break;
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        addLog('error', `Failed: ${errorMessage}`);
        console.error('[FormatSandbox] Insert error:', err);
      } finally {
        setInserting(null);
      }
    },
    [content, contentFormat, addLog]
  );

  // Get OOXML preview without inserting
  const handlePreviewOoxml = useCallback(async () => {
    if (!content.trim()) {
      addLog('error', 'No content to convert');
      return;
    }

    setInserting('ooxml');
    try {
      addLog('info', 'Getting OOXML preview...');
      const result = await apiClient.getOoxml(content, contentFormat);
      setOoxmlContent(result.ooxmlContent);
      setShowOoxmlPreview(true);
      addLog('ooxml', `OOXML preview ready (${result.ooxmlContent.length} chars)`);
    } catch (err) {
      addLog('error', `OOXML conversion failed: ${(err as Error).message}`);
    } finally {
      setInserting(null);
    }
  }, [content, contentFormat, addLog]);

  const samplesByCategory = getSamplesByCategory();

  // Category icon helper
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
    <div className="format-sandbox">
      {/* Header */}
      <div className="sandbox-header">
        <div className="sandbox-title">
          <span className="sandbox-icon">🧪</span>
          <span>Format Sandbox</span>
        </div>
        <div className="sandbox-subtitle">Test formatare fără generare AI</div>
      </div>

      <div className="sandbox-layout">
        {/* Left Panel - Sample Browser */}
        <div className="sandbox-samples">
          <div className="panel-header">Sample-uri</div>
          <div className="samples-list">
            {(Object.entries(samplesByCategory) as [SampleCategory, MockSample[]][]).map(
              ([category, samples]) => {
                if (samples.length === 0) return null;
                const isExpanded = expandedCategories.has(category);

                return (
                  <div key={category} className="sample-category">
                    <button className="category-header" onClick={() => toggleCategory(category)}>
                      <span className="cat-icon">{getCategoryIcon(category)}</span>
                      <span className="cat-label">{CATEGORY_LABELS[category]}</span>
                      <span className="cat-chevron">{isExpanded ? '▼' : '▶'}</span>
                    </button>

                    {isExpanded && (
                      <div className="category-samples">
                        {samples.map((sample) => {
                          const key = Object.entries(MOCK_SAMPLES).find(
                            ([, s]) => s === sample
                          )?.[0];
                          if (!key) return null;

                          return (
                            <button
                              key={key}
                              className={`sample-item ${selectedSample === key ? 'selected' : ''}`}
                              onClick={() => loadSample(key)}
                            >
                              {sample.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Center Panel - Content Editor */}
        <div className="sandbox-editor">
          <div className="panel-header">
            <span>Conținut</span>
            <div className="format-toggle">
              <button
                className={contentFormat === 'html' ? 'active' : ''}
                onClick={() => setContentFormat('html')}
              >
                HTML
              </button>
              <button
                className={contentFormat === 'markdown' ? 'active' : ''}
                onClick={() => setContentFormat('markdown')}
              >
                Markdown
              </button>
            </div>
          </div>
          <textarea
            className="content-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Paste or type ${contentFormat.toUpperCase()} content here...`}
            spellCheck={false}
          />

          {/* Action Buttons */}
          <div className="sandbox-actions">
            <button
              className="btn-action btn-html"
              onClick={() => handleInsert('html')}
              disabled={inserting !== null}
              title="Insert as HTML (direct)"
            >
              {inserting === 'html' ? '...' : '📄 HTML'}
            </button>
            <button
              className="btn-action btn-md"
              onClick={() => handleInsert('markdown')}
              disabled={inserting !== null}
              title="Insert as Markdown (client-side conversion)"
            >
              {inserting === 'markdown' ? '...' : '📝 Markdown'}
            </button>
            <button
              className="btn-action btn-ooxml"
              onClick={() => handleInsert('ooxml')}
              disabled={inserting !== null}
              title="Insert via OOXML (full production pipeline)"
            >
              {inserting === 'ooxml' ? '...' : '🎯 OOXML'}
            </button>
            <button
              className="btn-action btn-preview"
              onClick={handlePreviewOoxml}
              disabled={inserting !== null}
              title="Preview OOXML without inserting"
            >
              👁 Preview
            </button>
          </div>
        </div>

        {/* Right Panel - Logs */}
        <div className="sandbox-logs">
          <div className="panel-header">
            <span>Log</span>
            <button className="btn-clear" onClick={clearLogs}>
              Clear
            </button>
          </div>
          <div className="logs-container" ref={logContainerRef}>
            {logs.map((log) => (
              <div key={log.id} className={`log-entry log-${log.type}`}>
                <span className="log-time">
                  {log.timestamp.toLocaleTimeString('ro-RO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="log-message">{log.message}</span>
                {log.details && <pre className="log-details">{log.details}</pre>}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="logs-empty">No logs yet. Insert content to see activity.</div>
            )}
          </div>
        </div>
      </div>

      {/* OOXML Preview Modal */}
      {showOoxmlPreview && (
        <div className="ooxml-modal-backdrop" onClick={() => setShowOoxmlPreview(false)}>
          <div className="ooxml-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ooxml-modal-header">
              <span>OOXML Preview</span>
              <button onClick={() => setShowOoxmlPreview(false)}>✕</button>
            </div>
            <pre className="ooxml-content">{ooxmlContent}</pre>
            <div className="ooxml-modal-footer">
              <span>{ooxmlContent.length.toLocaleString()} characters</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ooxmlContent);
                  addLog('info', 'OOXML copied to clipboard');
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .format-sandbox {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-primary, #fff);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          font-size: 12px;
        }

        .sandbox-header {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          padding: 12px 16px;
          flex-shrink: 0;
        }

        .sandbox-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
        }

        .sandbox-icon {
          font-size: 20px;
        }

        .sandbox-subtitle {
          font-size: 11px;
          opacity: 0.8;
          margin-top: 2px;
        }

        .sandbox-layout {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Samples Panel */
        .sandbox-samples {
          width: 180px;
          border-right: 1px solid var(--border-color, #e0e0e0);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .panel-header {
          padding: 8px 12px;
          background: var(--bg-secondary, #f5f5f5);
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-secondary, #666);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .samples-list {
          flex: 1;
          overflow-y: auto;
        }

        .sample-category {
          border-bottom: 1px solid var(--border-color, #eee);
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 6px 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          font-size: 11px;
        }

        .category-header:hover {
          background: var(--bg-hover, #f0f0f0);
        }

        .cat-icon {
          width: 16px;
          text-align: center;
        }

        .cat-label {
          flex: 1;
        }

        .cat-chevron {
          font-size: 8px;
          opacity: 0.5;
        }

        .category-samples {
          padding: 4px 8px 8px;
          background: var(--bg-tertiary, #fafafa);
        }

        .sample-item {
          display: block;
          width: 100%;
          padding: 4px 8px;
          margin-bottom: 2px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
          font-size: 10px;
          color: var(--text-primary, #333);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sample-item:hover {
          background: var(--bg-hover, #eee);
        }

        .sample-item.selected {
          background: #e3f2fd;
          border-color: #2196f3;
          color: #1565c0;
        }

        /* Editor Panel */
        .sandbox-editor {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .format-toggle {
          display: flex;
          gap: 4px;
        }

        .format-toggle button {
          padding: 2px 8px;
          font-size: 10px;
          border: 1px solid var(--border-color, #ccc);
          background: white;
          border-radius: 3px;
          cursor: pointer;
        }

        .format-toggle button.active {
          background: #2196f3;
          color: white;
          border-color: #1976d2;
        }

        .content-textarea {
          flex: 1;
          padding: 12px;
          border: none;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          resize: none;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          line-height: 1.5;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #333);
        }

        .content-textarea:focus {
          outline: none;
        }

        .sandbox-actions {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          background: var(--bg-secondary, #f5f5f5);
          flex-shrink: 0;
        }

        .btn-action {
          flex: 1;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-action:disabled {
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

        .btn-ooxml {
          background: #e8f5e9;
          border-color: #4caf50;
          color: #1b5e20;
        }

        .btn-ooxml:hover:not(:disabled) {
          background: #c8e6c9;
        }

        .btn-preview {
          background: #f3e5f5;
          border-color: #9c27b0;
          color: #6a1b9a;
        }

        .btn-preview:hover:not(:disabled) {
          background: #e1bee7;
        }

        /* Logs Panel */
        .sandbox-logs {
          width: 240px;
          border-left: 1px solid var(--border-color, #e0e0e0);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .btn-clear {
          padding: 2px 8px;
          font-size: 9px;
          background: transparent;
          border: 1px solid var(--border-color, #ccc);
          border-radius: 3px;
          cursor: pointer;
        }

        .logs-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          background: #1a1a1a;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        }

        .log-entry {
          padding: 4px 0;
          border-bottom: 1px solid #333;
        }

        .log-time {
          color: #666;
          font-size: 9px;
          margin-right: 6px;
        }

        .log-message {
          font-size: 10px;
        }

        .log-info .log-message {
          color: #64b5f6;
        }

        .log-success .log-message {
          color: #81c784;
        }

        .log-error .log-message {
          color: #e57373;
        }

        .log-ooxml .log-message {
          color: #ba68c8;
        }

        .log-details {
          margin: 4px 0 0;
          padding: 6px;
          background: #111;
          border-radius: 4px;
          font-size: 9px;
          color: #888;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 100px;
        }

        .logs-empty {
          color: #666;
          font-size: 10px;
          padding: 20px;
          text-align: center;
        }

        /* OOXML Modal */
        .ooxml-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }

        .ooxml-modal {
          background: #1a1a1a;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }

        .ooxml-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #333;
          color: white;
          font-weight: 600;
        }

        .ooxml-modal-header button {
          background: transparent;
          border: none;
          color: #999;
          font-size: 18px;
          cursor: pointer;
        }

        .ooxml-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
          margin: 0;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 10px;
          color: #aaa;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .ooxml-modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-top: 1px solid #333;
          color: #666;
          font-size: 11px;
        }

        .ooxml-modal-footer button {
          padding: 6px 12px;
          background: #333;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }

        .ooxml-modal-footer button:hover {
          background: #444;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .format-sandbox {
            background: #1a1a1a;
          }

          .panel-header {
            background: #252525;
            border-color: #333;
          }

          .category-header,
          .sample-item {
            color: #ddd;
          }

          .category-header:hover,
          .sample-item:hover {
            background: #333;
          }

          .sample-item.selected {
            background: #1a365d;
            border-color: #3182ce;
            color: #63b3ed;
          }

          .content-textarea {
            background: #1a1a1a;
            color: #eee;
            border-color: #333;
          }

          .sandbox-actions {
            background: #252525;
          }
        }
      `}</style>
    </div>
  );
}
