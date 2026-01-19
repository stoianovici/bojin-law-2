/**
 * StepResearch Component
 * Step 2 for "Cercetare" creation type.
 *
 * User provides:
 * - Research question
 * - Source types (Legislație, Jurisprudență, Doctrină, Drept comparat)
 * - Research depth (Rapidă, Aprofundată)
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../../services/api-client';
import { insertOoxml, insertHtml, getDocumentContent } from '../../services/word-api';
import type { WizardState, GenerationResult } from '.';

// ============================================================================
// Types
// ============================================================================

interface StepResearchProps {
  state: WizardState;
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

type ResearchSource = 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative';
type ResearchDepth = 'quick' | 'deep';

const RESEARCH_SOURCES: { value: ResearchSource; label: string }[] = [
  { value: 'legislation', label: 'Legislație' },
  { value: 'jurisprudence', label: 'Jurisprudență' },
  { value: 'doctrine', label: 'Doctrină' },
  { value: 'comparative', label: 'Drept comparat' },
];

// ============================================================================
// Component
// ============================================================================

export function StepResearch({
  state,
  onBack,
  onGenerationStart,
  onChunk,
  onProgress,
  onComplete,
  onError,
  animationClass = '',
}: StepResearchProps) {
  const [question, setQuestion] = useState('');
  const [sources, setSources] = useState<ResearchSource[]>(['legislation', 'jurisprudence']);
  const [depth, setDepth] = useState<ResearchDepth>('quick');
  const [includeExistingContent, setIncludeExistingContent] = useState(false);
  const [loading, setLoading] = useState(false);

  const canGenerate = question.trim().length > 0 && sources.length > 0;

  const toggleSource = useCallback((source: ResearchSource) => {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }, []);

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

      // Build research-specific prompt
      const sourceLabels = sources
        .map((s) => RESEARCH_SOURCES.find((rs) => rs.value === s)?.label)
        .filter(Boolean)
        .join(', ');

      const researchPrompt = `Cercetare juridică ${depth === 'deep' ? 'aprofundată' : 'rapidă'}:

Întrebare: ${question.trim()}

Surse de cercetat: ${sourceLabels}

${depth === 'deep' ? 'Efectuați o analiză detaliată cu citate complete și referințe exacte.' : 'Efectuați o analiză concisă cu punctele principale și referințe-cheie.'}`;

      // Stream the generation with two-phase research for deep mode
      const response = await apiClient.draftStream(
        {
          contextType: state.contextType,
          caseId: state.contextType === 'case' ? state.caseId : undefined,
          clientId: state.contextType === 'client' ? state.clientId : undefined,
          documentName: state.documentName || 'Notă de cercetare',
          prompt: researchPrompt,
          existingContent,
          enableWebSearch: true, // Research always uses web search
          useTwoPhaseResearch: depth === 'deep', // Two-phase for deep research
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
      let ooxmlContent: string | undefined;
      try {
        const ooxmlResponse = await apiClient.getOoxml(contentToInsert, 'html');
        ooxmlContent = ooxmlResponse.ooxmlContent;
      } catch (ooxmlErr) {
        console.warn('[StepResearch] Failed to fetch OOXML:', ooxmlErr);
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
      console.error('[StepResearch] Generation error:', err);
      const errorMsg = (err as Error)?.message || 'Nu s-a putut genera cercetarea';
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    canGenerate,
    state,
    question,
    sources,
    depth,
    includeExistingContent,
    onGenerationStart,
    onChunk,
    onProgress,
    onComplete,
    onError,
  ]);

  return (
    <div className={`wizard-step step-research ${animationClass}`.trim()}>
      {/* Research Question - Primary Focus */}
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Întrebare de cercetare
        </div>
        <textarea
          className="input-field textarea"
          placeholder="Formulați întrebarea juridică pe care doriți să o cercetați...&#10;&#10;Exemple:&#10;- Care sunt condițiile răspunderii civile delictuale?&#10;- Cum se calculează termenele procedurale?&#10;- Ce efecte are nulitatea contractului?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      {/* Compact Options Row */}
      <div className="research-options-compact">
        {/* Sources - Inline Chips */}
        <div className="compact-option-group">
          <span className="compact-label">Surse:</span>
          <div className="source-chips">
            {RESEARCH_SOURCES.map((source) => (
              <button
                key={source.value}
                type="button"
                className={`source-chip ${sources.includes(source.value) ? 'active' : ''}`}
                onClick={() => toggleSource(source.value)}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* Depth - Simple Toggle */}
        <div className="compact-option-group">
          <span className="compact-label">Profunzime:</span>
          <div className="depth-toggle">
            <button
              type="button"
              className={`depth-btn ${depth === 'quick' ? 'active' : ''}`}
              onClick={() => setDepth('quick')}
            >
              Rapidă
            </button>
            <button
              type="button"
              className={`depth-btn ${depth === 'deep' ? 'active' : ''}`}
              onClick={() => setDepth('deep')}
            >
              Aprofundată
            </button>
          </div>
        </div>

        {/* Include Content Checkbox */}
        <label className="compact-checkbox">
          <input
            type="checkbox"
            checked={includeExistingContent}
            onChange={(e) => setIncludeExistingContent(e.target.checked)}
          />
          <span>Include conținutul existent</span>
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
              Se cercetează...
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Cercetează
            </>
          )}
        </button>
      </div>
    </div>
  );
}
