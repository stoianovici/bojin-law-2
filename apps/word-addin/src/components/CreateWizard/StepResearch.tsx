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
  /** Expert mode enables premium features (extended thinking) */
  isExpertMode?: boolean;
}

type ResearchSource = 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative';
type ResearchDepth = 'quick' | 'deep';

/** Jurisprudence citation from the research agent */
interface JurisprudenceCitation {
  id: string;
  decisionType: 'decizie' | 'sentință' | 'încheiere';
  decisionNumber: string;
  court: string;
  courtFull: string;
  section?: string;
  date: string;
  dateFormatted: string;
  url: string;
  caseNumber?: string;
  summary: string;
  relevance: string;
  officialGazette?: string;
}

/** Output from jurisprudence research */
interface JurisprudenceOutput {
  topic: string;
  generatedAt: string;
  citations: JurisprudenceCitation[];
  analysis: string;
  gaps: string[];
  metadata: {
    searchCount: number;
    sourcesSearched: string[];
    durationMs: number;
    costEur: number;
  };
}

/**
 * Format jurisprudence research output as HTML for Word insertion.
 */
function formatJurisprudenceAsHtml(output: JurisprudenceOutput): string {
  const sections: string[] = [];

  // Header
  sections.push(`<h1>Notă jurisprudențială</h1>`);
  sections.push(`<p><strong>Subiect:</strong> ${escapeHtml(output.topic)}</p>`);
  sections.push(
    `<p><em>Generată la: ${new Date(output.generatedAt).toLocaleDateString('ro-RO')}</em></p>`
  );
  sections.push('<hr/>');

  // Analysis section
  sections.push('<h2>Analiză</h2>');
  sections.push(`<p>${escapeHtml(output.analysis).replace(/\n/g, '</p><p>')}</p>`);

  // Citations section
  if (output.citations.length > 0) {
    sections.push('<h2>Jurisprudență relevantă</h2>');

    for (const citation of output.citations) {
      const decisionTypeLabel =
        citation.decisionType === 'decizie'
          ? 'Decizia'
          : citation.decisionType === 'sentință'
            ? 'Sentința'
            : 'Încheierea';

      sections.push(
        '<div style="margin-bottom: 1em; padding: 0.5em; border-left: 3px solid #0078d4;">'
      );

      // Citation header
      let citationHeader = `<strong>${decisionTypeLabel} nr. ${escapeHtml(citation.decisionNumber)}</strong>`;
      citationHeader += `, ${escapeHtml(citation.courtFull)}`;
      if (citation.section) {
        citationHeader += `, ${escapeHtml(citation.section)}`;
      }
      citationHeader += `, din ${escapeHtml(citation.dateFormatted)}`;
      sections.push(`<p>${citationHeader}</p>`);

      // Case number if available
      if (citation.caseNumber) {
        sections.push(`<p><em>${escapeHtml(citation.caseNumber)}</em></p>`);
      }

      // Official Gazette for CCR decisions
      if (citation.officialGazette) {
        sections.push(`<p><em>Publicată în ${escapeHtml(citation.officialGazette)}</em></p>`);
      }

      // Summary
      sections.push(`<p>${escapeHtml(citation.summary)}</p>`);

      // Relevance
      sections.push(`<p><strong>Relevanță:</strong> ${escapeHtml(citation.relevance)}</p>`);

      // URL
      sections.push(`<p><a href="${escapeHtml(citation.url)}">${escapeHtml(citation.url)}</a></p>`);

      sections.push('</div>');
    }
  }

  // Gaps section
  if (output.gaps.length > 0) {
    sections.push('<h2>Limitări și observații</h2>');
    sections.push('<ul>');
    for (const gap of output.gaps) {
      sections.push(`<li>${escapeHtml(gap)}</li>`);
    }
    sections.push('</ul>');
  }

  // Metadata
  sections.push('<hr/>');
  sections.push('<p style="font-size: 0.9em; color: #666;">');
  sections.push(`<em>Căutări efectuate: ${output.metadata.searchCount} | `);
  sections.push(`Surse: ${output.metadata.sourcesSearched.join(', ')} | `);
  sections.push(`Durată: ${(output.metadata.durationMs / 1000).toFixed(1)}s</em>`);
  sections.push('</p>');

  return sections.join('\n');
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  isExpertMode = false,
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

  // Check if this is a jurisprudence-only research (uses dedicated agent)
  const isJurisprudenceOnly = sources.length === 1 && sources[0] === 'jurisprudence';

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

      // Use dedicated jurisprudence agent when only jurisprudence is selected
      if (isJurisprudenceOnly) {
        onProgress({ type: 'phase_start', text: 'Cercetare jurisprudențială specializată...' });

        const result = await apiClient.jurisprudenceResearch(
          question.trim(),
          existingContent,
          state.contextType === 'case' ? state.caseId : undefined,
          depth,
          (event) => {
            onProgress({
              type: event.type === 'search_start' ? 'search' : 'thinking',
              text: event.message,
            });
          }
        );

        if (!result.success || !result.output) {
          throw new Error(result.error || 'Cercetarea jurisprudențială a eșuat');
        }

        // Format the jurisprudence output as HTML
        const contentToInsert = formatJurisprudenceAsHtml(result.output);

        onProgress({ type: 'phase_start', text: 'Formatez documentul pentru Word...' });

        let ooxmlContent: string | undefined;
        try {
          const ooxmlResponse = await apiClient.getOoxml(contentToInsert, 'html', {
            title: state.documentName || 'Notă jurisprudențială',
            subtitle: question.trim(),
          });
          ooxmlContent = ooxmlResponse.ooxmlContent;
          onProgress({ type: 'phase_complete', text: 'Document formatat' });
        } catch (ooxmlErr) {
          console.warn('[StepResearch] Failed to fetch OOXML:', ooxmlErr);
          onProgress({ type: 'phase_complete', text: 'Formatare simplificată' });
        }

        if (ooxmlContent) {
          await insertOoxml(ooxmlContent, contentToInsert);
        } else {
          await insertHtml(contentToInsert);
        }

        onComplete({
          content: contentToInsert,
          ooxmlContent,
          title: 'Notă jurisprudențială',
          tokensUsed: result.tokenUsage?.total ?? 0,
          processingTimeMs: result.durationMs,
        });

        return;
      }

      // Standard research flow for other source types
      const sourceLabels = sources
        .map((s) => RESEARCH_SOURCES.find((rs) => rs.value === s)?.label)
        .filter(Boolean)
        .join(', ');

      const researchPrompt = `Cercetare juridică ${depth === 'deep' ? 'aprofundată' : 'rapidă'}:

Întrebare: ${question.trim()}

Surse de cercetat: ${sourceLabels}

${depth === 'deep' ? 'Efectuați o analiză detaliată cu citate complete și referințe exacte.' : 'Efectuați o analiză concisă cu punctele principale și referințe-cheie.'}`;

      // Stream the generation with fan-out/fan-in multi-agent architecture
      // Expert mode enables premium features (Opus 4.5 + extended thinking)
      const response = await apiClient.draftStream(
        {
          contextType: state.contextType,
          caseId: state.contextType === 'case' ? state.caseId : undefined,
          clientId: state.contextType === 'client' ? state.clientId : undefined,
          documentName: state.documentName || 'Notă de cercetare',
          prompt: researchPrompt,
          existingContent,
          enableWebSearch: true,
          useMultiAgent: false, // Single-writer flow with semantic HTML for proper footnotes
          sourceTypes: sources, // Determines breadth (more sources = more sections)
          researchDepth: depth, // Determines depth (quick vs deep = words per section)
          premiumMode: isExpertMode, // Expert mode = premium (extended thinking)
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
      // Pass title and subtitle for cover page generation
      onProgress({ type: 'phase_start', text: 'Formatez documentul pentru Word...' });

      let ooxmlContent: string | undefined;
      try {
        const ooxmlResponse = await apiClient.getOoxml(contentToInsert, 'html', {
          title: state.documentName || 'Notă de cercetare',
          subtitle: question.trim(),
        });
        ooxmlContent = ooxmlResponse.ooxmlContent;
        onProgress({ type: 'phase_complete', text: 'Document formatat' });
      } catch (ooxmlErr) {
        console.warn('[StepResearch] Failed to fetch OOXML:', ooxmlErr);
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
      console.error('[StepResearch] Generation error:', err);
      const errorMsg = (err as Error)?.message || 'Nu s-a putut genera cercetarea';
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    canGenerate,
    isJurisprudenceOnly,
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
    isExpertMode,
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
              {isJurisprudenceOnly ? 'Se cercetează jurisprudența...' : 'Se cercetează...'}
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
                {isJurisprudenceOnly ? (
                  // Gavel icon for jurisprudence
                  <path d="M14.5 2.5l5 5M2 22l5-5M7 17l10-10M12 12l5-5M2 12l5.5-5.5" />
                ) : (
                  // Search icon for general research
                  <>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </>
                )}
              </svg>
              {isJurisprudenceOnly ? 'Cercetează jurisprudența' : 'Cercetează'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
