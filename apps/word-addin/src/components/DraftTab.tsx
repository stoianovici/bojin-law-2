/**
 * Draft Tab Component
 * Provides AI-powered document drafting based on case context and user prompts.
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api-client';
import {
  insertMarkdown,
  insertHtml,
  insertOoxml,
  getDocumentContent,
  getDocumentName,
  getDocumentProperties,
  getDocumentUrl,
  getDocumentFileName,
} from '../services/word-api';

interface DraftResult {
  content: string;
  /** OOXML fragment for style-aware insertion */
  ooxmlContent?: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
}

interface ActiveCase {
  id: string;
  title: string;
  caseNumber: string;
}

interface ActiveClient {
  id: string;
  name: string;
  type: 'Individual' | 'Company';
}

type ContextType = 'case' | 'client' | 'internal';

interface DraftTabProps {
  onError: (error: string) => void;
}

export function DraftTab({ onError }: DraftTabProps) {
  const [contextType, setContextType] = useState<ContextType>('case');
  const [caseId, setCaseId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [includeExistingContent, setIncludeExistingContent] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [useTwoPhaseResearch, setUseTwoPhaseResearch] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [cases, setCases] = useState<ActiveCase[]>([]);
  const [clients, setClients] = useState<ActiveClient[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [autoDetectedCase, setAutoDetectedCase] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [progressEvents, setProgressEvents] = useState<
    Array<{ type: string; tool?: string; input?: Record<string, unknown>; text?: string }>
  >([]);

  // Load cases and clients
  const loadCasesAndClients = useCallback(async () => {
    setLoadingData(true);
    try {
      const [casesResponse, clientsResponse] = await Promise.all([
        apiClient.getActiveCases(),
        apiClient.getActiveClients(),
      ]);
      setCases(casesResponse.cases);
      setClients(clientsResponse.clients);
    } catch (err) {
      console.error('Failed to load cases/clients:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Load document info and cases on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Get document name
        const name = await getDocumentName();
        setDocumentName(name);

        // Try to get case ID from document properties first
        const props = await getDocumentProperties();
        let foundCaseId = props['PlatformCaseId'];

        // If no case ID in properties, try to look it up by document URL or filename
        if (!foundCaseId) {
          try {
            const docUrl = await getDocumentUrl();
            const docFileName = await getDocumentFileName();

            if (docUrl || docFileName) {
              const lookupResult = await apiClient.lookupCaseByDocument({
                url: docUrl || undefined,
                path: docFileName || undefined,
              });

              if (lookupResult.case) {
                foundCaseId = lookupResult.case.id;
                setAutoDetectedCase(`${lookupResult.case.caseNumber} - ${lookupResult.case.title}`);
                console.log('Auto-detected case from document:', lookupResult.case);
              }
            }
          } catch (lookupErr) {
            console.warn('Could not lookup case for document:', lookupErr);
          }
        }

        if (foundCaseId) {
          setCaseId(foundCaseId);
        }

        // Load cases and clients
        await loadCasesAndClients();
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setLoadingData(false);
      }
    }

    loadInitialData();
  }, [loadCasesAndClients]);

  // Check if context selection is valid
  const isContextValid = useCallback(() => {
    if (contextType === 'case') return !!caseId;
    if (contextType === 'client') return !!clientId;
    return true; // 'internal' always valid
  }, [contextType, caseId, clientId]);

  const handleDraft = useCallback(async () => {
    if (!isContextValid()) {
      if (contextType === 'case') {
        onError('Selectați un dosar');
      } else if (contextType === 'client') {
        onError('Selectați un client');
      }
      return;
    }

    if (!prompt.trim()) {
      onError('Introduceți instrucțiunile pentru document');
      return;
    }

    setLoading(true);
    setResult(null);
    setInserted(false);
    setStreamingContent('');
    setProgressEvents([]);

    try {
      // Optionally include existing document content for context
      let existingContent: string | undefined;
      if (includeExistingContent) {
        existingContent = await getDocumentContent(2000);
      }

      // Use streaming API to show real-time AI output
      const response = await apiClient.draftStream(
        {
          contextType,
          caseId: contextType === 'case' ? caseId : undefined,
          clientId: contextType === 'client' ? clientId : undefined,
          documentName: documentName || 'Document nou',
          prompt: prompt.trim(),
          existingContent,
          enableWebSearch: enableWebSearch || undefined, // Only send if true, let backend auto-detect otherwise
          useTwoPhaseResearch: useTwoPhaseResearch || undefined, // Two-phase research for better academic quality
        },
        (chunk) => {
          // Update streaming content with each chunk
          setStreamingContent((prev) => prev + chunk);
        },
        (progressEvent) => {
          // Add progress events (tool usage, thinking)
          setProgressEvents((prev) => [...prev, progressEvent]);
        }
      );

      // Validate response content before proceeding
      const contentToInsert = response.content || streamingContent;
      console.log('[DraftTab] Stream completed', {
        responseContent: response.content?.length ?? 'undefined',
        streamingContent: streamingContent?.length ?? 'undefined',
        contentToInsert: contentToInsert?.length ?? 'undefined',
      });

      if (!contentToInsert) {
        throw new Error('Nu s-a primit conținut de la server');
      }

      // Fetch OOXML via REST (avoids SSE chunking issues with large content)
      let ooxmlContent: string | undefined;
      try {
        console.log('[DraftTab] Fetching OOXML for content of length:', contentToInsert.length);
        const ooxmlResponse = await apiClient.getOoxml(contentToInsert);
        ooxmlContent = ooxmlResponse.ooxmlContent;
        console.log('[DraftTab] OOXML fetched, length:', ooxmlContent?.length ?? 'undefined');
      } catch (ooxmlErr) {
        console.warn('[DraftTab] Failed to fetch OOXML, falling back to markdown:', ooxmlErr);
      }

      // Auto-insert formatted content directly into the document
      // Pass content as fallback for Word Online where OOXML doesn't work
      if (ooxmlContent) {
        await insertOoxml(ooxmlContent, contentToInsert);
      } else if (enableWebSearch) {
        // Research documents output HTML - insert directly
        await insertHtml(contentToInsert);
      } else {
        // Contract documents output markdown
        await insertMarkdown(contentToInsert);
      }

      setResult({ ...response, ooxmlContent });
      setInserted(true);
      setStreamingContent('');
    } catch (err) {
      onError((err as Error).message || 'Nu s-a putut genera conținutul');
      setStreamingContent('');
      setProgressEvents([]);
    } finally {
      setLoading(false);
    }
  }, [
    contextType,
    caseId,
    clientId,
    documentName,
    prompt,
    includeExistingContent,
    enableWebSearch,
    onError,
    isContextValid,
  ]);

  return (
    <div className="section">
      {/* Context Type Selector */}
      <div
        className="section-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          Context
        </div>
        <button
          onClick={loadCasesAndClients}
          disabled={loadingData}
          style={{
            background: 'none',
            border: 'none',
            cursor: loadingData ? 'wait' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            color: '#0078d4',
          }}
          title="Reîmprospătare liste"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }}
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>

      {/* Context Type Toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <button
          onClick={() => setContextType('case')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d2d0ce',
            borderRadius: 4,
            backgroundColor: contextType === 'case' ? '#0078d4' : '#fff',
            color: contextType === 'case' ? '#fff' : '#323130',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Dosar
        </button>
        <button
          onClick={() => setContextType('client')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d2d0ce',
            borderRadius: 4,
            backgroundColor: contextType === 'client' ? '#0078d4' : '#fff',
            color: contextType === 'client' ? '#fff' : '#323130',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Client
        </button>
        <button
          onClick={() => setContextType('internal')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d2d0ce',
            borderRadius: 4,
            backgroundColor: contextType === 'internal' ? '#0078d4' : '#fff',
            color: contextType === 'internal' ? '#fff' : '#323130',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Intern
        </button>
      </div>

      {/* Case/Client Selector based on context type */}
      <div style={{ marginBottom: 16 }}>
        {loadingData ? (
          <div style={{ fontSize: 12, color: '#605e5c' }}>Se încarcă...</div>
        ) : contextType === 'case' ? (
          <>
            {cases.length > 0 ? (
              <select
                className="input-field"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Selectați dosarul</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input-field"
                placeholder="ID dosar (ex: abc123...)"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                style={{ width: '100%' }}
              />
            )}
            <div style={{ fontSize: 11, color: '#a19f9d', marginTop: 4 }}>
              {autoDetectedCase ? (
                <span style={{ color: '#107c10' }}>Dosar detectat automat: {autoDetectedCase}</span>
              ) : (
                'Contextul dosarului va fi utilizat pentru generare'
              )}
            </div>
          </>
        ) : contextType === 'client' ? (
          <>
            {clients.length > 0 ? (
              <select
                className="input-field"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Selectați clientul</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === 'Individual' ? 'PF' : 'PJ'})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input-field"
                placeholder="ID client (ex: abc123...)"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ width: '100%' }}
              />
            )}
            <div style={{ fontSize: 11, color: '#a19f9d', marginTop: 4 }}>
              Contextul clientului va fi utilizat pentru generare
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#605e5c', padding: '8px 0' }}>
            Document intern - fără context specific de dosar sau client
          </div>
        )}
      </div>

      {/* Document Name */}
      <div className="section-title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Nume Document
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="input-field"
          placeholder="ex: Cerere de chemare în judecată"
          value={documentName}
          onChange={(e) => setDocumentName(e.target.value)}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: 11, color: '#a19f9d', marginTop: 4 }}>
          Tipul de document ajută AI-ul să genereze conținut potrivit
        </div>
      </div>

      {/* Prompt */}
      <div className="section-title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Instrucțiuni
      </div>

      <div style={{ marginBottom: 16 }}>
        <textarea
          className="input-field"
          placeholder="Descrieți ce doriți să generați...&#10;&#10;Exemple:&#10;- Generează introducerea pentru cererea de chemare în judecată&#10;- Redactează secțiunea cu situația de fapt&#10;- Scrie motivele de drept bazate pe Codul Civil"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          style={{ width: '100%', resize: 'vertical', minHeight: 100 }}
        />
      </div>

      {/* Options checkboxes */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeExistingContent}
            onChange={(e) => setIncludeExistingContent(e.target.checked)}
          />
          <span style={{ fontSize: 12 }}>Include conținutul existent pentru context</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.target.checked)}
          />
          <span style={{ fontSize: 12 }}>Cercetare online (legislație, jurisprudență)</span>
        </label>
        <div style={{ fontSize: 11, color: '#a19f9d', marginLeft: 24 }}>
          {enableWebSearch
            ? 'AI-ul va căuta pe internet informații actualizate'
            : 'Activat automat pentru termeni precum „cercetare", „legislație", „jurisprudență"'}
        </div>
        {enableWebSearch && (
          <>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              <input
                type="checkbox"
                checked={useTwoPhaseResearch}
                onChange={(e) => setUseTwoPhaseResearch(e.target.checked)}
              />
              <span style={{ fontSize: 12 }}>Cercetare în două faze (calitate academică)</span>
            </label>
            <div style={{ fontSize: 11, color: '#a19f9d', marginLeft: 24 }}>
              Separă cercetarea de redactare pentru documente cu greutate științifică
            </div>
          </>
        )}
      </div>

      {/* Generate Button */}
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleDraft}
          disabled={loading || !isContextValid() || !prompt.trim()}
          style={{ width: '100%' }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" style={{ width: 16, height: 16, margin: 0 }}></span>
              Se generează...
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
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Generează
            </>
          )}
        </button>
      </div>

      {/* Loading State - AI is working with streaming output */}
      {loading && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              color: '#0078d4',
            }}
          >
            <span className="loading-spinner" style={{ width: 16, height: 16 }}></span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Opus generează...</span>
          </div>

          {/* Progress Events - Tool usage and thinking */}
          {progressEvents.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {progressEvents.map((event, index) => (
                <div
                  key={index}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    marginBottom: 4,
                    borderRadius: 4,
                    backgroundColor:
                      event.type === 'tool_start'
                        ? '#fff4ce'
                        : event.type === 'tool_end'
                          ? '#dff6dd'
                          : '#e8f4fd',
                    color:
                      event.type === 'tool_start'
                        ? '#8a6d3b'
                        : event.type === 'tool_end'
                          ? '#107c10'
                          : '#0078d4',
                  }}
                >
                  {event.type === 'tool_start' && (
                    <>
                      🔍 <strong>Căutare:</strong>{' '}
                      {(event.input as { query?: string })?.query || 'web search'}
                    </>
                  )}
                  {event.type === 'tool_end' && <>✓ Rezultate găsite</>}
                  {event.type === 'thinking' && (
                    <>
                      💭 {event.text?.substring(0, 150)}
                      {(event.text?.length || 0) > 150 ? '...' : ''}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Streaming Content */}
          <div
            style={{
              padding: 12,
              backgroundColor: '#f3f2f1',
              borderRadius: 4,
              maxHeight: 300,
              overflowY: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              color: '#323130',
            }}
          >
            {streamingContent || (
              <span style={{ color: '#a19f9d', fontStyle: 'italic' }}>
                {progressEvents.length > 0
                  ? 'Se procesează rezultatele cercetării...'
                  : 'Se analizează contextul dosarului...'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Result - Success confirmation */}
      {result && inserted && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              backgroundColor: '#dff6dd',
              borderRadius: 4,
              color: '#107c10',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontWeight: 500 }}>Conținut inserat în document</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: '#a19f9d' }}>
            Generat în {result.processingTimeMs}ms · {result.tokensUsed} tokens
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setResult(null);
              setInserted(false);
            }}
            style={{ marginTop: 12 }}
          >
            Generează alt conținut
          </button>
        </div>
      )}
    </div>
  );
}
