/**
 * StepDocument Component
 * Step 2 for "Document nou" creation type.
 *
 * User provides:
 * - Document name
 * - Generation prompt/instructions
 * - Options (include content, web search)
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../../services/api-client';
import { insertOoxml, insertHtml, getDocumentContent } from '../../services/word-api';
import type { WizardState, GenerationResult } from '.';

// ============================================================================
// Types
// ============================================================================

interface StepDocumentProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onBack?: () => void;
  onGenerationStart: () => void;
  onChunk: (chunk: string) => void;
  onProgress: (event: {
    type: string;
    tool?: string;
    input?: Record<string, unknown>;
    text?: string;
  }) => void;
  onComplete: (result: GenerationResult) => void;
  onError: (error: string) => void;
  animationClass?: string;
}

// ============================================================================
// Component
// ============================================================================

export function StepDocument({
  state,
  onUpdate,
  onBack,
  onGenerationStart,
  onChunk,
  onProgress,
  onComplete,
  onError,
  animationClass = '',
}: StepDocumentProps) {
  const [prompt, setPrompt] = useState('');
  const [includeExistingContent, setIncludeExistingContent] = useState(false);
  const [includeCaseContext, setIncludeCaseContext] = useState(true); // Default on when case/client exists
  const [loading, setLoading] = useState(false);

  // Check if there's a case or client context available
  const hasContext = state.contextType !== 'internal' && (state.caseId || state.clientId);
  const contextLabel =
    state.contextType === 'case'
      ? `dosarului${state.caseNumber ? ` ${state.caseNumber}` : ''}`
      : 'clientului';

  const canGenerate = prompt.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (loading || !canGenerate) return;

    setLoading(true);
    onGenerationStart();

    try {
      // Optionally include existing document content for context
      let existingContent: string | undefined;
      if (includeExistingContent) {
        existingContent = await getDocumentContent(2000);
      }

      // Stream the generation - always enable web search
      // Only include case/client context if checkbox is checked
      const response = await apiClient.draftStream(
        {
          contextType: includeCaseContext ? state.contextType : 'internal',
          caseId: includeCaseContext && state.contextType === 'case' ? state.caseId : undefined,
          clientId:
            includeCaseContext && state.contextType === 'client' ? state.clientId : undefined,
          documentName: state.documentName || 'Document nou',
          prompt: prompt.trim(),
          existingContent,
          enableWebSearch: true,
        },
        onChunk,
        onProgress
      );

      // Validate response
      const contentToInsert = response.content;
      if (!contentToInsert) {
        throw new Error('Nu s-a primit conținut de la server');
      }

      // Fetch OOXML for proper formatting
      onProgress({ type: 'phase_start', text: 'Formatez documentul pentru Word...' });

      let ooxmlContent: string | undefined;
      try {
        const ooxmlResponse = await apiClient.getOoxml(contentToInsert, 'html');
        ooxmlContent = ooxmlResponse.ooxmlContent;
        onProgress({ type: 'phase_complete', text: 'Document formatat' });
      } catch (ooxmlErr) {
        console.warn('[StepDocument] Failed to fetch OOXML:', ooxmlErr);
        onProgress({ type: 'phase_complete', text: 'Formatare simplificată' });
      }

      // Insert into document
      if (ooxmlContent) {
        await insertOoxml(ooxmlContent, contentToInsert);
      } else {
        await insertHtml(contentToInsert);
      }

      // Complete
      onComplete({
        content: contentToInsert,
        ooxmlContent,
        title: response.title,
        tokensUsed: response.tokensUsed,
        processingTimeMs: response.processingTimeMs,
      });
    } catch (err) {
      console.error('[StepDocument] Generation error:', err);
      const errorMsg = (err as Error)?.message || 'Nu s-a putut genera conținutul';
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    canGenerate,
    state,
    prompt,
    includeExistingContent,
    includeCaseContext,
    onGenerationStart,
    onChunk,
    onProgress,
    onComplete,
    onError,
  ]);

  return (
    <div className={`wizard-step step-document ${animationClass}`.trim()}>
      {/* Document Name - Compact inline */}
      <div className="document-name-row">
        <label className="document-name-label">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Nume:
        </label>
        <input
          type="text"
          className="document-name-input"
          placeholder="ex: Cerere de chemare în judecată"
          value={state.documentName}
          onChange={(e) => onUpdate({ documentName: e.target.value })}
        />
      </div>

      {/* Prompt - Primary Focus */}
      <div className="wizard-section">
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
        <textarea
          className="input-field textarea"
          placeholder="Descrieți ce doriți să generați...&#10;&#10;Exemple:&#10;- Generează introducerea pentru cererea de chemare în judecată&#10;- Redactează secțiunea cu situația de fapt&#10;- Scrie motivele de drept bazate pe Codul Civil"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Options - Compact */}
      <div className="document-options-compact">
        {hasContext && (
          <label className="compact-checkbox">
            <input
              type="checkbox"
              checked={includeCaseContext}
              onChange={(e) => setIncludeCaseContext(e.target.checked)}
            />
            <span>Include contextul {contextLabel}</span>
          </label>
        )}
        <label className="compact-checkbox">
          <input
            type="checkbox"
            checked={includeExistingContent}
            onChange={(e) => setIncludeExistingContent(e.target.checked)}
          />
          <span>Include conținutul documentului</span>
        </label>
      </div>

      {/* Navigation */}
      <div className="wizard-nav">
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginRight: 8 }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Înapoi
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !canGenerate}
          style={{ flex: 1 }}
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
    </div>
  );
}
