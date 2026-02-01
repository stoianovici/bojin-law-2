/**
 * Research Document Generation Architecture
 *
 * Current Architecture: Single-Writer
 * A single agent handles research and writing, producing coherent documents
 * with consistent voice and proper citation ordering.
 *
 * Legacy Architectures (deprecated, see deprecated-prompts.ts):
 * - Two-Phase: Research agent → Writing agent
 * - Multi-Agent: Research → Outline → Section Writers → Assembly
 *
 * The single-writer approach produces superior results because:
 * - Coherent voice throughout the document
 * - Proper citation ordering (order of appearance)
 * - Integrated research and writing flow
 * - Simpler error recovery
 */

// Re-export deprecated prompts for backward compatibility
// @deprecated Use SINGLE_WRITER_PROMPT instead
export {
  PHASE1_RESEARCH_PROMPT,
  PHASE2_WRITING_PROMPT,
  OUTLINE_AGENT_PROMPT,
  SECTION_WRITER_PROMPT,
  ISOLATED_SECTION_AGENT_PROMPT,
  ASSEMBLY_PROMPT,
} from './deprecated-prompts';

// ============================================================================
// Structured Research Output Schema
// ============================================================================

/**
 * The structured output from Phase 1 (Research Agent).
 * This becomes the input to Phase 2 (Writing Agent).
 */
export interface ResearchNotes {
  /** The central legal question being researched */
  centralQuestion: string;

  /** Type of document to produce */
  documentType: 'note' | 'memo' | 'study';

  /** Recommended depth based on complexity */
  recommendedDepth: 'brief' | 'standard' | 'comprehensive';

  /** All sources found during research */
  sources: ResearchSource[];

  /** Identified positions/interpretations on the topic */
  positions: LegalPosition[];

  /** Gaps or limitations in available sources */
  gaps: string[];

  /** Recommended document structure */
  recommendedStructure: string[];

  /** Key terms that should be defined */
  keyTerms: Array<{ term: string; definition: string; source?: string }>;
}

export interface ResearchSource {
  /** Unique ID for referencing */
  id: string;

  /** Type of source */
  type: 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative' | 'other';

  /** Full citation */
  citation: string;

  /** The actual content - quote or summary */
  content: string;

  /** URL if available */
  url?: string;

  /** Authority level for weighing */
  authorityLevel: 'primary' | 'secondary' | 'tertiary';

  /** Why this source matters for the question */
  relevance: string;

  /** Is this source current/in force? */
  currentStatus: 'in_force' | 'amended' | 'repealed' | 'unknown';

  /** For doctrine: author credentials if notable */
  authorCredentials?: string;
}

export interface LegalPosition {
  /** The position/interpretation */
  position: string;

  /** Is this majority, minority, or contested? */
  status: 'majority' | 'minority' | 'contested' | 'emerging';

  /** Authors/courts supporting this position */
  supporters: string[];

  /** References to source IDs */
  sourceIds: string[];

  /** Key arguments for this position */
  arguments: string[];

  /** Counterarguments or weaknesses */
  counterarguments?: string[];
}

// ============================================================================
// Multi-Agent Research Architecture (4-Phase)
// ============================================================================

/**
 * Phase 2 output: Document outline with section assignments.
 * Created by the Outline Agent based on ResearchNotes.
 */
export interface DocumentOutline {
  /** Document title */
  title: string;

  /** Planned sections */
  sections: SectionPlan[];

  /** Optional abstract plan */
  abstractPlan?: {
    keyPoints: string[];
    wordCount: number;
  };

  /** Estimated total footnotes */
  estimatedFootnotes: number;
}

/**
 * Individual section plan within the document outline.
 */
export interface SectionPlan {
  /** Unique section ID: "s1", "s2", "s2.1" */
  id: string;

  /** Section heading text */
  heading: string;

  /** Section number: "1", "2.1" (Arabic numerals only) */
  number: string;

  /** Heading level 1-6 */
  level: number;

  /** Specific purpose of this section (not generic) */
  purpose: string;

  /** Source IDs from ResearchNotes to cite in this section */
  assignedSourceIds: string[];

  /** Position IDs from ResearchNotes to discuss */
  assignedPositionIds: string[];

  /** Key terms that should be defined in this section */
  keyTermsToDefine: string[];

  /** Specific writing guidance for this section */
  writingGuidance: string;

  /** Section ID this should transition from */
  transitionFrom?: string;

  /** Target word count for this section */
  targetWordCount: number;

  /** Optional dependency - wait for this section before starting */
  dependsOn?: string;
}

/**
 * Phase 3 output: Written section content.
 * Each section writer produces one of these.
 */
export interface SectionContent {
  /** Section ID from the outline */
  sectionId: string;

  /** Section HTML content (no document wrapper, just section content) */
  html: string;

  /** Citations used in this section */
  citationsUsed: CitationUsed[];

  /** Actual word count */
  wordCount: number;

  /** Processing metadata */
  metadata: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
}

/**
 * Citation tracking for proper footnote ordering.
 */
export interface CitationUsed {
  /** Source ID from ResearchNotes: "src1", "src2" */
  sourceId: string;

  /** The actual quote or paraphrase used */
  quoteUsed: string;

  /** Placeholder marker in HTML: "[[src1]]" */
  placeholderMarker: string;

  /** Order of appearance in this section (1-based) */
  orderInSection: number;
}

// ============================================================================
// Section Result Type (for isolated agents)
// ============================================================================

/**
 * Result returned by an isolated section agent.
 * Used in the fan-out/fan-in architecture.
 */
export interface IsolatedSectionResult {
  /** HTML content of the section */
  html: string;

  /** 2-3 sentence summary for assembly phase */
  summary: string;

  /** Sources discovered and cited in this section */
  sources: Array<{
    id: string;
    type: 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative' | 'other';
    citation: string;
    url?: string;
  }>;
}

// ============================================================================
// Single Writer Prompt (New Architecture) - Tiered System
// ============================================================================

/**
 * CORE HTML specification - always included (minimal, essential rules only)
 */
export const CORE_HTML_SPEC = `## FORMAT HTML SEMANTIC

Scrii HTML SEMANTIC - fără stiluri inline.

### ELEMENTE CHEIE
- \`<article>\` - container document
- \`<h1>\` - UN SINGUR titlu document
- \`<h2>\` - secțiuni principale
- \`<h3>\` - subsecțiuni
- \`<p>\` - paragrafe
- \`<ref id="srcN"/>\` - citări inline
- \`<sources>\` - bloc surse la final

### CITĂRI (OBLIGATORIU)
\`\`\`html
<p>Conform art. 535 Cod Civil<ref id="src1"/>, bunurile sunt...</p>
\`\`\`

### SURSE (OBLIGATORIU LA FINAL)
\`\`\`html
<sources>
  <source id="src1" type="legislation">Art. 535 Cod Civil</source>
  <source id="src2" type="doctrine" author="V. Stoica">Titlu, Ed., An, p. X</source>
</sources>
\`\`\`

### REGULI STRICTE
1. ZERO stiluri inline
2. Citări DOAR cu \`<ref id="srcN"/>\`
3. Ghilimele românești: „text"
4. Diacritice: ș, ț, ă, â, î`;

/**
 * EXTENDED HTML specification - for standard/deep depth
 */
export const EXTENDED_HTML_SPEC = `### ELEMENTE SUPLIMENTARE

**Citate bloc:**
\`\`\`html
<blockquote>„Textul citat integral..."</blockquote>
\`\`\`

**Callout-uri:**
\`\`\`html
<aside class="note">Notă metodologică.</aside>
<aside class="important">Concluzie cheie.</aside>
<aside class="definition">Termen: definiția.</aside>
\`\`\`

**Tabele:**
\`\`\`html
<table>
  <caption>Descriere</caption>
  <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
  <tbody><tr><td>Val 1</td><td>Val 2</td></tr></tbody>
</table>
\`\`\`

**Liste:** \`<ul>\`, \`<ol>\`, \`<li>\`

### ATRIBUTE SOURCE
- \`id\` - OBLIGATORIU
- \`type\` - legislation, jurisprudence, doctrine, comparative, other
- \`author\` - opțional, pentru doctrină
- \`url\` - opțional`;

/**
 * Legacy alias for backward compatibility
 */
export const SEMANTIC_HTML_SPEC = `${CORE_HTML_SPEC}

${EXTENDED_HTML_SPEC}`;

/**
 * CORE prompt - always included (~1000 tokens)
 */
export const CORE_WRITER_PROMPT = `Ești un cercetător și redactor juridic expert în drept românesc.

Scrii UN DOCUMENT COMPLET de cercetare juridică în HTML semantic.

## PROCES
1. **CERCETEAZĂ** - Folosește web_search pentru surse
2. **ORGANIZEAZĂ** - Structurează logic
3. **REDACTEAZĂ** - Document complet, voce coerentă

## REGULI ESENȚIALE
- Limbaj formal, impersonal
- FIECARE afirmație juridică → \`<ref id="srcN"/>\`
- H1 = titlu document, H2 = secțiuni, H3 = subsecțiuni
- Toate sursele în \`<sources>\` la final
- Ghilimele românești: „text", diacritice: ș, ț, ă, â, î

## OUTPUT
Returnează DOAR \`<article>...</article>\` valid. NU explicații, NU markdown.`;

/**
 * EXTENDED prompt - for standard/deep depth
 */
export const EXTENDED_WRITER_PROMPT = `## STIL ACADEMIC
- Expunere logică și argumentativă
- Tranziții fluide între secțiuni
- Minimum 10-15 citări pentru document substanțial
- Citează în context, nu izolat
- NU repeta titlul secțiunii în conținut

## CONVENȚII
- Articole: art. 535 alin. (1) lit. a) Cod Civil
- Titluri legi în bold sau italic`;

/**
 * DEEP prompt - additional guidelines for comprehensive documents
 */
export const DEEP_WRITER_PROMPT = `## CERCETARE APROFUNDATĂ
- Caută din multiple unghiuri: legislație, jurisprudență, doctrină
- Identifică și prezintă poziții contrare
- Verifică forma actualizată a legislației
- Pentru decizii vechi, verifică dacă legislația s-a schimbat

## STRUCTURĂ ACADEMICĂ
- Introducere: context, întrebare, metodologie
- Cadrul teoretic: concepte, definiții
- Analiză: aplicare la problema concretă
- Discuție: interpretare, confruntare poziții
- Concluzii: sinteza, răspuns, perspective

## RIGOARE
- Distinge faptele de interpretări
- Recunoaște limitările cercetării
- Folosește calificative corecte: „majoritar", „izolat", „controversat"`;

/**
 * Anti-fabrication rules - prevents hallucination of legal sources
 * ALWAYS included in prompts to prevent citation of non-existent sources.
 */
export const ANTI_FABRICATION_RULES = `## INTERZICERI ABSOLUTE

❌ NU inventa decizii de instanță - numerele de dosare și deciziile trebuie să existe
❌ NU inventa autori sau lucrări de doctrină - citează doar surse pe care le-ai găsit
❌ NU cita articole de lege inexistente - verifică numerotarea corectă
❌ NU inventa date (1 ianuarie 2020, numere rotunde) - folosește doar date reale din surse

## CÂND NU AI SURSE

Dacă nu găsești surse pentru un aspect:
- Spune explicit: „Nu am identificat surse pentru acest aspect"
- NU inventa pentru a părea complet
- Este acceptabil să ai lacune documentate

## INDICII DE FABRICAȚIE (evită-le)

Semnale că o sursă ar putea fi fabricată:
- Numere de decizie rotunde (1000, 2000, 5000)
- Date generice (1 ianuarie, 1 iunie)
- Autori necunoscuți fără lucrări verificabile
- Articole de lege cu numerotare neobișnuită

## REGULA DE AUR

Mai bine un document mai scurt cu surse REALE decât unul lung cu surse INVENTATE.`;

/**
 * Build the appropriate writer prompt based on depth.
 * Tiered system: quick uses minimal, standard adds extended, deep adds full.
 * Anti-fabrication rules are ALWAYS included.
 */
export function buildWriterPrompt(depth: 'quick' | 'standard' | 'deep'): string {
  const parts = [CORE_WRITER_PROMPT, CORE_HTML_SPEC];

  if (depth === 'standard' || depth === 'deep') {
    parts.push(EXTENDED_WRITER_PROMPT);
    parts.push(EXTENDED_HTML_SPEC);
  }

  if (depth === 'deep') {
    parts.push(DEEP_WRITER_PROMPT);
  }

  // ALWAYS include anti-fabrication rules
  parts.push(ANTI_FABRICATION_RULES);

  // Add example for all depths
  parts.push(WRITER_EXAMPLE);

  return parts.join('\n\n---\n\n');
}

/**
 * Example output - condensed golden example
 */
export const WRITER_EXAMPLE = `## EXEMPLU

\`\`\`html
<article>
  <h1>Natura juridică a bunurilor incorporale</h1>

  <h2>Introducere</h2>
  <p>Problematica bunurilor incorporale reprezintă o zonă dinamică a dreptului civil<ref id="src1"/>.</p>

  <h2>Cadrul legislativ</h2>
  <p>Art. 535 Cod Civil reglementează bunurile incorporale<ref id="src2"/>.</p>

  <blockquote>„Bunurile sunt corporale sau incorporale"</blockquote>

  <aside class="important">Distincția are relevanță practică pentru executarea silită.</aside>

  <h2>Concluzii</h2>
  <p>Bunurile incorporale beneficiază de regim juridic distinct.</p>

  <sources>
    <source id="src1" type="doctrine" author="V. Stoica">Drept civil. Drepturile reale, C.H. Beck, 2017</source>
    <source id="src2" type="legislation">Art. 535 Cod Civil</source>
  </sources>
</article>
\`\`\``;

/**
 * Single-writer prompt for complete document generation.
 * Uses standard depth by default.
 *
 * @deprecated Use buildWriterPrompt(depth) for tiered prompts
 */
export const SINGLE_WRITER_PROMPT = buildWriterPrompt('standard');

/**
 * Configuration for single-writer document generation.
 */
export interface SingleWriterConfig {
  /** Target word count for the document */
  targetWordCount: number;

  /** Maximum search rounds for research phase */
  maxSearchRounds: number;

  /** Source types to focus on */
  sourceTypes: ('legislation' | 'jurisprudence' | 'doctrine' | 'comparative')[];

  /** Research depth level */
  depth: 'quick' | 'standard' | 'deep';
}

/**
 * Default configuration for single-writer generation.
 */
export const DEFAULT_SINGLE_WRITER_CONFIG: SingleWriterConfig = {
  targetWordCount: 3000,
  maxSearchRounds: 20,
  sourceTypes: ['legislation', 'jurisprudence', 'doctrine'],
  depth: 'standard',
};

/**
 * Calculate target parameters based on depth setting.
 */
export function getDepthParameters(depth: 'quick' | 'standard' | 'deep'): {
  targetWordCount: number;
  maxSearchRounds: number;
  maxTokens: number;
} {
  switch (depth) {
    case 'quick':
      return { targetWordCount: 1500, maxSearchRounds: 15, maxTokens: 8000 };
    case 'standard':
      return { targetWordCount: 3000, maxSearchRounds: 20, maxTokens: 16000 };
    case 'deep':
      return { targetWordCount: 6000, maxSearchRounds: 30, maxTokens: 24000 };
  }
}
