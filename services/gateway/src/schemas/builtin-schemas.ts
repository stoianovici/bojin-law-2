/**
 * Builtin Document Schemas
 *
 * Pre-defined schemas for common legal document types:
 * - research: Research notes, legal memoranda, studies
 * - notificare: Notifications, summons, default notices
 * - court-filing: Court submissions, petitions, responses
 * - contract: Contracts, agreements, addendums
 * - generic: Fallback for unrecognized document types
 */

import type {
  DocumentSchema,
  TypographyConfig,
  FormattingConfig,
  StructureConfig,
  SectionDefinition,
} from './document-schema.types';
import { schemaRegistry } from './schema-registry';
import { NOTIFICARI_KNOWLEDGE } from '../services/word-ai-prompts';

// ============================================================================
// Shared Typography Configurations
// ============================================================================

const ACADEMIC_TYPOGRAPHY: TypographyConfig = {
  bodyFont: 'Georgia',
  bodySize: 11,
  headingFont: 'Inter',
  headingSizes: { h1: 24, h2: 18, h3: 14, h4: 12, h5: 11, h6: 11 },
  headingColors: {
    h1: '#333333',
    h2: '#9B2335', // Bojin brand red
    h3: '#333333',
    h4: '#666666',
    h5: '#666666',
    h6: '#666666',
  },
  lineHeight: 1.5,
  firstLineIndent: 20,
};

const LEGAL_LETTER_TYPOGRAPHY: TypographyConfig = {
  bodyFont: 'Times New Roman',
  bodySize: 12,
  headingFont: 'Times New Roman',
  headingSizes: { h1: 16, h2: 14, h3: 13, h4: 12, h5: 12, h6: 12 },
  headingColors: {
    h1: '#000000',
    h2: '#000000',
    h3: '#333333',
    h4: '#333333',
    h5: '#333333',
    h6: '#333333',
  },
  lineHeight: 1.15,
  firstLineIndent: 0,
};

const COURT_TYPOGRAPHY: TypographyConfig = {
  bodyFont: 'Times New Roman',
  bodySize: 12,
  headingFont: 'Times New Roman',
  headingSizes: { h1: 14, h2: 13, h3: 12, h4: 12, h5: 12, h6: 12 },
  headingColors: {
    h1: '#000000',
    h2: '#000000',
    h3: '#000000',
    h4: '#333333',
    h5: '#333333',
    h6: '#333333',
  },
  lineHeight: 1.15,
  firstLineIndent: 0,
};

// ============================================================================
// Shared Formatting Configurations
// ============================================================================

const STANDARD_CALLOUTS = {
  note: { bgColor: '#f8f9fa', borderColor: '#0066cc' },
  important: { bgColor: '#fff8e6', borderColor: '#9B2335' },
  definition: { bgColor: '#e8f4f8', borderColor: '#17a2b8' },
};

const STANDARD_BLOCKQUOTE = {
  indent: 0.5,
  borderLeft: { width: 3, color: '#cccccc' },
};

const STANDARD_TABLE = {
  captionPosition: 'above' as const,
  headerBgColor: '#f0f0f0',
};

const STANDARD_FOOTNOTES = {
  size: 10,
  afterPunctuation: true,
};

// ============================================================================
// Research Document Schema
// ============================================================================

const RESEARCH_SECTIONS: SectionDefinition[] = [
  {
    id: 'introduction',
    name: 'Introducere',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/introducere/i, /^1\.\s*introducere/i, /scopul\s+(cercetării|studiului)/i],
    order: 1,
  },
  {
    id: 'legal-framework',
    name: 'Cadrul juridic',
    required: true,
    headingLevel: 2,
    detectionPatterns: [
      /cadrul?\s+(juridic|legislativ|legal)/i,
      /reglementare/i,
      /legislația?\s+aplicabil/i,
    ],
    order: 2,
  },
  {
    id: 'analysis',
    name: 'Analiză',
    required: true,
    headingLevel: 2,
    detectionPatterns: [
      /analiz[aă]/i,
      /examinare/i,
      /studiu(l)?\s+de\s+caz/i,
      /aspecte\s+(practice|teoretice)/i,
    ],
    order: 3,
  },
  {
    id: 'conclusions',
    name: 'Concluzii',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/concluzii/i, /rezumat/i, /^[\d.]+\s*concluzii/i, /sintez[aă]/i],
    order: 4,
  },
  {
    id: 'recommendations',
    name: 'Recomandări',
    required: false,
    headingLevel: 2,
    detectionPatterns: [/recomandări/i, /propuneri/i, /soluții\s+propuse/i],
    order: 5,
  },
];

const RESEARCH_STRUCTURE: StructureConfig = {
  sections: RESEARCH_SECTIONS,
  headingHierarchy: {
    maxDepth: 4,
    h1Count: 'single',
    requireH1: true,
    numberingFormat: 'decimal',
    numberingStartLevel: 1,
  },
  citations: {
    required: true,
    format: 'footnote',
    minCount: 5,
    requireSourcesBlock: true,
  },
  requiredElements: ['sources'],
};

const RESEARCH_FORMATTING: FormattingConfig = {
  typography: ACADEMIC_TYPOGRAPHY,
  pagination: {
    pageBreakBeforeH1: true,
    minParagraphsAfterHeading: 4,
    headingSpacing: {
      h1: { before: 480, after: 240 },
      h2: { before: 360, after: 180 },
      h3: { before: 280, after: 140 },
      h4: { before: 240, after: 120 },
    },
  },
  coverPage: {
    enabled: true,
    fields: ['documentType', 'title', 'subtitle', 'client', 'author', 'date'],
  },
  callouts: STANDARD_CALLOUTS,
  blockquote: STANDARD_BLOCKQUOTE,
  table: STANDARD_TABLE,
  footnotes: STANDARD_FOOTNOTES,
};

export const researchSchema: DocumentSchema = {
  id: 'research',
  name: 'Notă de cercetare',
  description: 'Document de cercetare juridică cu analiză aprofundată și citări',
  category: 'research',

  detection: {
    keywords: [
      'cercetare',
      'research',
      'notă de cercetare',
      'memoriu',
      'studiu',
      'analiză',
      'raport juridic',
      'opinie juridică',
      'notă juridică',
    ],
    priority: 50,
  },

  structure: RESEARCH_STRUCTURE,
  formatting: RESEARCH_FORMATTING,

  validation: {
    mode: 'strict',
    autoFix: false,
    maxFixAttempts: 1,
    customRules: ['check-sources-block', 'check-citation-count'],
  },

  normalization: {
    standardRules: [
      'strip-emojis',
      'normalize-callouts',
      'normalize-heading-numbers',
      'restart-list-numbering',
      'remove-empty-callouts',
      'remove-duplicate-headings',
    ],
    headingNumberFormat: 'arabic',
  },

  promptConfig: {
    injectInSystemPrompt: true,
    formattingInstructions: 'detailed',
    customPromptAdditions: `
## STRUCTURĂ DOCUMENT
- Un SINGUR H1 (titlul documentului)
- Secțiuni obligatorii: Introducere (H2), Cadrul juridic (H2), Analiză (H2), Concluzii (H2)
- Minimum 5 citări cu <ref id="srcN"/>
- Bloc <sources> obligatoriu la final

## FORMAT CITĂRI
- În text: <ref id="src1"/>, <ref id="src2"/>
- La final, bloc <sources> cu toate sursele:
<sources>
  <source id="src1" type="legislation">Legea nr. X/YYYY</source>
  <source id="src2" type="jurisprudence" author="ÎCCJ">Decizia nr. X/YYYY</source>
  <source id="src3" type="doctrine" author="Nume" url="...">Titlu articol</source>
</sources>
`,
  },
};

// ============================================================================
// Nota de Fundamentare (Justification Note) Schema
// ============================================================================

const FUNDAMENTARE_SECTIONS: SectionDefinition[] = [
  {
    id: 'context',
    name: 'Context',
    required: true,
    headingLevel: 2,
    detectionPatterns: [
      /context/i,
      /cadrul?\s+general/i,
      /prezentare/i,
      /^1\.\s*context/i,
      /situația\s+premisă/i,
    ],
    order: 1,
  },
  {
    id: 'legal-framework',
    name: 'Cadrul juridic',
    required: true,
    headingLevel: 2,
    detectionPatterns: [
      /cadrul?\s+(juridic|legislativ|legal)/i,
      /reglementare/i,
      /legislația?\s+aplicabil/i,
      /temei(ul)?\s+(de\s+)?drept/i,
    ],
    order: 2,
  },
  {
    id: 'reasoning',
    name: 'Argumentare / Analiză',
    required: true,
    headingLevel: 2,
    detectionPatterns: [
      /argumentare/i,
      /motivare/i,
      /analiz[aă]/i,
      /rațiune/i,
      /justificare/i,
      /fundamentare/i,
    ],
    order: 3,
  },
  {
    id: 'conclusions',
    name: 'Concluzii / Recomandări',
    required: true,
    headingLevel: 2,
    detectionPatterns: [
      /concluzii/i,
      /recomandări/i,
      /propuneri/i,
      /sintez[aă]/i,
      /în\s+concluzie/i,
    ],
    order: 4,
  },
];

const FUNDAMENTARE_STRUCTURE: StructureConfig = {
  sections: FUNDAMENTARE_SECTIONS,
  headingHierarchy: {
    maxDepth: 4,
    h1Count: 'single',
    requireH1: true,
    numberingFormat: 'decimal',
    numberingStartLevel: 2,
  },
  citations: {
    required: false, // Citations are optional for fundamentare
    format: 'footnote',
    minCount: 0,
    requireSourcesBlock: false,
  },
  requiredElements: [],
};

const FUNDAMENTARE_FORMATTING: FormattingConfig = {
  typography: ACADEMIC_TYPOGRAPHY,
  pagination: {
    pageBreakBeforeH1: false,
    minParagraphsAfterHeading: 3,
    headingSpacing: {
      h1: { before: 360, after: 180 },
      h2: { before: 280, after: 140 },
      h3: { before: 200, after: 100 },
      h4: { before: 160, after: 80 },
    },
  },
  coverPage: {
    enabled: false,
    fields: [],
  },
  callouts: STANDARD_CALLOUTS,
  blockquote: STANDARD_BLOCKQUOTE,
  table: STANDARD_TABLE,
  footnotes: STANDARD_FOOTNOTES,
};

export const fundamentareSchema: DocumentSchema = {
  id: 'fundamentare',
  name: 'Notă de fundamentare',
  description: 'Document de argumentare și justificare juridică pentru o poziție sau decizie',
  category: 'legal',

  detection: {
    keywords: [
      'notă de fundamentare',
      'nota de fundamentare',
      'fundamentare',
      'justificare',
      'argumentare',
      'motivare',
      'temei juridic',
      'bază legală',
      'rațiune',
      'notă justificativă',
      'nota justificativa',
      'memoriu justificativ',
    ],
    priority: 75, // High priority - specific document type (between notificare 80 and court-filing 70)
  },

  structure: FUNDAMENTARE_STRUCTURE,
  formatting: FUNDAMENTARE_FORMATTING,

  validation: {
    mode: 'lenient',
    autoFix: false,
    maxFixAttempts: 0,
  },

  normalization: {
    standardRules: [
      'strip-emojis',
      'normalize-callouts',
      'normalize-heading-numbers',
      'restart-list-numbering',
      'remove-empty-callouts',
    ],
    headingNumberFormat: 'arabic',
  },

  promptConfig: {
    injectInSystemPrompt: true,
    formattingInstructions: 'standard',
    customPromptAdditions: `
## PRINCIPIU: NOTĂ DE FUNDAMENTARE

Nota de fundamentare este un document juridic intern care construiește și justifică o poziție, decizie sau strategie.

## STRUCTURĂ OBLIGATORIE

1. **CONTEXT** (H2)
   - Prezintă situația de fapt care necesită fundamentare
   - Identifică problema juridică principală
   - Descrie părțile implicate și interesele lor

2. **CADRUL JURIDIC** (H2)
   - Legislația aplicabilă (legi, ordonanțe, regulamente)
   - Jurisprudența relevantă (opțional, dar recomandat)
   - Doctrina (opțional)

3. **ARGUMENTARE / ANALIZĂ** (H2)
   - Construiește argumentul juridic pas cu pas
   - Analizează fiecare normă în raport cu situația de fapt
   - Anticipează și combate contraargumente
   - Identifică riscuri și vulnerabilități

4. **CONCLUZII / RECOMANDĂRI** (H2)
   - Sintetizează poziția recomandată
   - Oferă recomandări concrete de acțiune
   - Menționează termene sau priorități (dacă e cazul)

## STIL ȘI FORMAT
- Ton: obiectiv, analitic, persuasiv
- Argumentație: logică, structurată, cu referințe la texte de lege
- Evită opiniile personale nejustificate - totul trebuie fundamentat juridic
- Folosește citate din legislație pentru a susține argumentele
- HTML semantic (nu markdown)
`,
  },
};

// ============================================================================
// Notification Document Schema
// ============================================================================

const NOTIFICARE_SECTIONS: SectionDefinition[] = [
  {
    id: 'header',
    name: 'Antet',
    required: true,
    headingLevel: 1,
    detectionPatterns: [/notificare/i, /somație/i, /punere\s+în\s+întârziere/i],
    order: 1,
  },
  {
    id: 'situation',
    name: 'Situația de fapt',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/situația\s+de\s+fapt/i, /în\s+fapt/i, /starea\s+de\s+fapt/i],
    order: 2,
  },
  {
    id: 'legal-basis',
    name: 'Temeiul juridic',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/temei(ul)?\s+(de\s+)?drept/i, /în\s+drept/i, /baza\s+legală/i],
    order: 3,
  },
  {
    id: 'request',
    name: 'Solicitarea/Somația',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/solicit/i, /somăm/i, /vă\s+punem\s+în\s+vedere/i, /vă\s+notific/i],
    order: 4,
  },
  {
    id: 'consequences',
    name: 'Consecințe',
    required: false,
    headingLevel: 2,
    detectionPatterns: [/consecințe/i, /în\s+caz\s+contrar/i, /nerespectare/i],
    order: 5,
  },
];

const NOTIFICARE_STRUCTURE: StructureConfig = {
  sections: NOTIFICARE_SECTIONS,
  headingHierarchy: {
    maxDepth: 3,
    h1Count: 'single',
    requireH1: true,
    numberingFormat: 'roman',
    numberingStartLevel: 2,
  },
  citations: {
    required: false,
    format: 'inline',
    minCount: 0,
    requireSourcesBlock: false,
  },
  requiredElements: ['date-location', 'signature'],
};

const NOTIFICARE_FORMATTING: FormattingConfig = {
  typography: LEGAL_LETTER_TYPOGRAPHY,
  pagination: {
    pageBreakBeforeH1: false,
    minParagraphsAfterHeading: 2,
    headingSpacing: {
      h1: { before: 240, after: 120 },
      h2: { before: 200, after: 100 },
      h3: { before: 160, after: 80 },
      h4: { before: 120, after: 60 },
    },
  },
  coverPage: {
    enabled: false,
    fields: [],
  },
  callouts: {
    note: { bgColor: '#f8f9fa', borderColor: '#333333' },
    important: { bgColor: '#fff3cd', borderColor: '#856404' },
    definition: { bgColor: '#e8f4f8', borderColor: '#0066cc' },
  },
  blockquote: {
    indent: 0.3,
    borderLeft: { width: 2, color: '#666666' },
  },
  table: STANDARD_TABLE,
  footnotes: STANDARD_FOOTNOTES,
};

export const notificareSchema: DocumentSchema = {
  id: 'notificare',
  name: 'Notificare',
  description: 'Notificări, somații, puneri în întârziere, rezilieri',
  category: 'notification',

  detection: {
    keywords: [
      'notificare',
      'somație',
      'somatie',
      'punere în întârziere',
      'punere in intarziere',
      'reziliere',
      'reziliez',
      'denunțare',
      'denuntare',
      'denunț',
      'evacuare',
      'evacuez',
    ],
    priority: 80, // High priority - specific document type
  },

  structure: NOTIFICARE_STRUCTURE,
  formatting: NOTIFICARE_FORMATTING,

  validation: {
    mode: 'lenient',
    autoFix: false,
    maxFixAttempts: 0,
  },

  normalization: {
    standardRules: [
      'strip-emojis',
      'normalize-callouts',
      'restart-list-numbering',
      'fix-quote-marks',
      'remove-empty-callouts',
    ],
    headingNumberFormat: 'keep',
  },

  promptConfig: {
    injectInSystemPrompt: true,
    formattingInstructions: 'standard',
    domainKnowledge: NOTIFICARI_KNOWLEDGE,
    customPromptAdditions: `
## STRUCTURĂ NOTIFICARE
- Antet: Titlu (NOTIFICARE/SOMAȚIE/etc.)
- Destinatar și expeditor
- I. Situația de fapt
- II. Temeiul juridic (articole de lege)
- III. Solicitarea/Somația (cu termen concret)
- IV. Consecințe (opțional)
- Semnătură

## FORMAT OUTPUT
- HTML semantic (nu markdown)
- <article> ca element principal
- <h1> pentru titlu, <h2> pentru secțiuni
- <strong> pentru termene și sume
- <blockquote> pentru citate legale
`,
  },
};

// ============================================================================
// Court Filing Document Schema
// ============================================================================

const COURT_FILING_SECTIONS: SectionDefinition[] = [
  {
    id: 'court-header',
    name: 'Antet instanță',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/către/i, /judecătoria/i, /tribunalul/i, /curtea/i],
    order: 1,
  },
  {
    id: 'parties',
    name: 'Identificare părți',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/reclamant/i, /pârât/i, /părțile/i],
    order: 2,
  },
  {
    id: 'object',
    name: 'Obiectul cererii',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/obiectul?\s+(cererii|acțiunii)/i, /solicit[ăa]m/i],
    order: 3,
  },
  {
    id: 'facts',
    name: 'Situația de fapt',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/situația\s+de\s+fapt/i, /în\s+fapt/i, /motivele\s+de\s+fapt/i],
    order: 4,
  },
  {
    id: 'legal-grounds',
    name: 'Motivele de drept',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/motivele?\s+de\s+drept/i, /în\s+drept/i, /temeiul\s+juridic/i],
    order: 5,
  },
  {
    id: 'evidence',
    name: 'Probatoriul',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/probe/i, /dovezi/i, /înscrisuri/i, /probatoriu/i],
    order: 6,
  },
  {
    id: 'petitum',
    name: 'Solicitări',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/solicit[ăa]m/i, /pentru\s+aceste\s+motive/i, /vă\s+rugăm/i],
    order: 7,
  },
];

const COURT_FILING_STRUCTURE: StructureConfig = {
  sections: COURT_FILING_SECTIONS,
  headingHierarchy: {
    maxDepth: 3,
    h1Count: 'single',
    requireH1: true,
    numberingFormat: 'roman',
    numberingStartLevel: 2,
  },
  citations: {
    required: false,
    format: 'inline',
    minCount: 0,
    requireSourcesBlock: false,
  },
  requiredElements: ['signature', 'date-location'],
};

const COURT_FILING_FORMATTING: FormattingConfig = {
  typography: COURT_TYPOGRAPHY,
  pagination: {
    pageBreakBeforeH1: false,
    minParagraphsAfterHeading: 2,
    headingSpacing: {
      h1: { before: 360, after: 180 },
      h2: { before: 240, after: 120 },
      h3: { before: 200, after: 100 },
      h4: { before: 160, after: 80 },
    },
  },
  coverPage: {
    enabled: false,
    fields: [],
  },
  callouts: STANDARD_CALLOUTS,
  blockquote: STANDARD_BLOCKQUOTE,
  table: STANDARD_TABLE,
  footnotes: STANDARD_FOOTNOTES,
};

export const courtFilingSchema: DocumentSchema = {
  id: 'court-filing',
  name: 'Act procedural',
  description: 'Cereri, întâmpinări, acte procedurale pentru instanță',
  category: 'legal',

  detection: {
    keywords: [
      'cerere de chemare în judecată',
      'cerere chemare judecată',
      'întâmpinare',
      'intampinare',
      'cerere reconvențională',
      'cerere reconventionala',
      'apel',
      'recurs',
      'contestație',
      'contestatie',
      'plângere',
      'plangere',
      'acțiune',
      'actiune',
    ],
    priority: 70,
  },

  structure: COURT_FILING_STRUCTURE,
  formatting: COURT_FILING_FORMATTING,

  validation: {
    mode: 'lenient',
    autoFix: false,
    maxFixAttempts: 0,
  },

  normalization: {
    standardRules: [
      'strip-emojis',
      'normalize-callouts',
      'fix-quote-marks',
      'remove-empty-callouts',
    ],
    headingNumberFormat: 'keep', // Court docs may use roman numerals
  },

  promptConfig: {
    injectInSystemPrompt: true,
    formattingInstructions: 'standard',
    customPromptAdditions: `
## STRUCTURĂ ACT PROCEDURAL
- Antet: Instanța competentă
- Dosar nr. (dacă există)
- RECLAMANT/PÂRÂT cu identificare completă
- I. Obiectul cererii și valoarea
- II. Situația de fapt
- III. Motivele de drept
- IV. Probatoriul
- V. Solicitări
- Semnătură (cu mențiunea "prin avocat" dacă e cazul)
`,
  },
};

// ============================================================================
// Contract Document Schema
// ============================================================================

const CONTRACT_SECTIONS: SectionDefinition[] = [
  {
    id: 'parties',
    name: 'Părțile contractante',
    required: true,
    headingLevel: 2,
    detectionPatterns: [/părțile/i, /între/i, /prestator/i, /beneficiar/i],
    order: 1,
  },
  {
    id: 'object',
    name: 'Obiectul contractului',
    required: true,
    headingLevel: 3,
    detectionPatterns: [/obiectul\s+contractului/i, /art(icolul)?\s*1/i],
    order: 2,
  },
  {
    id: 'duration',
    name: 'Durata contractului',
    required: true,
    headingLevel: 3,
    detectionPatterns: [/durata\s+contractului/i, /art(icolul)?\s*2/i],
    order: 3,
  },
  {
    id: 'price',
    name: 'Prețul și plata',
    required: true,
    headingLevel: 3,
    detectionPatterns: [/prețul/i, /modalitatea\s+de\s+plată/i, /art(icolul)?\s*3/i],
    order: 4,
  },
  {
    id: 'obligations',
    name: 'Obligațiile părților',
    required: true,
    headingLevel: 3,
    detectionPatterns: [/obligații/i, /îndatoriri/i],
    order: 5,
  },
  {
    id: 'termination',
    name: 'Încetarea contractului',
    required: true,
    headingLevel: 3,
    detectionPatterns: [/încetare/i, /reziliere/i, /denunțare/i],
    order: 6,
  },
  {
    id: 'disputes',
    name: 'Litigii',
    required: false,
    headingLevel: 3,
    detectionPatterns: [/litigii/i, /soluționarea\s+disputelor/i],
    order: 7,
  },
  {
    id: 'final-provisions',
    name: 'Dispoziții finale',
    required: true,
    headingLevel: 3,
    detectionPatterns: [/dispoziții\s+finale/i, /clauze\s+finale/i],
    order: 8,
  },
];

const CONTRACT_STRUCTURE: StructureConfig = {
  sections: CONTRACT_SECTIONS,
  headingHierarchy: {
    maxDepth: 4,
    h1Count: 'single',
    requireH1: true,
    numberingFormat: 'decimal',
    numberingStartLevel: 3, // Articles are numbered, not the title
  },
  citations: {
    required: false,
    format: 'inline',
    minCount: 0,
    requireSourcesBlock: false,
  },
  requiredElements: ['signature', 'date-location'],
};

const CONTRACT_FORMATTING: FormattingConfig = {
  typography: LEGAL_LETTER_TYPOGRAPHY,
  pagination: {
    pageBreakBeforeH1: false,
    minParagraphsAfterHeading: 2,
    headingSpacing: {
      h1: { before: 240, after: 120 },
      h2: { before: 200, after: 100 },
      h3: { before: 160, after: 80 },
      h4: { before: 120, after: 60 },
    },
  },
  coverPage: {
    enabled: false,
    fields: [],
  },
  callouts: STANDARD_CALLOUTS,
  blockquote: STANDARD_BLOCKQUOTE,
  table: STANDARD_TABLE,
  footnotes: STANDARD_FOOTNOTES,
};

export const contractSchema: DocumentSchema = {
  id: 'contract',
  name: 'Contract',
  description: 'Contracte, convenții, acte adiționale',
  category: 'contract',

  detection: {
    keywords: [
      'contract',
      'convenție',
      'conventie',
      'act adițional',
      'act aditional',
      'acord',
      'prestări servicii',
      'prestari servicii',
      'vânzare',
      'vanzare',
      'închiriere',
      'inchiriere',
      'locațiune',
      'locatiune',
    ],
    priority: 60,
  },

  structure: CONTRACT_STRUCTURE,
  formatting: CONTRACT_FORMATTING,

  validation: {
    mode: 'lenient',
    autoFix: false,
    maxFixAttempts: 0,
  },

  normalization: {
    standardRules: [
      'strip-emojis',
      'normalize-callouts',
      'normalize-heading-numbers',
      'restart-list-numbering',
      'fix-quote-marks',
    ],
    headingNumberFormat: 'arabic',
  },

  promptConfig: {
    injectInSystemPrompt: true,
    formattingInstructions: 'standard',
    customPromptAdditions: `
## STRUCTURĂ CONTRACT
- Titlu: CONTRACT DE [TIP]
- Nr. și dată
- Părțile contractante (identificare completă)
- Articolul 1. Obiectul contractului
- Articolul 2. Durata contractului
- Articolul 3. Prețul și modalitatea de plată
- Articolul 4-N. Obligațiile părților
- Articolul N+1. Răspunderea contractuală
- Articolul N+2. Forța majoră
- Articolul N+3. Încetarea contractului
- Articolul N+4. Litigii
- Articolul N+5. Dispoziții finale
- Semnături
`,
  },
};

// ============================================================================
// Generic Document Schema (Fallback)
// ============================================================================

const GENERIC_STRUCTURE: StructureConfig = {
  sections: [], // No required sections for generic
  headingHierarchy: {
    maxDepth: 6,
    h1Count: 'multiple',
    requireH1: false,
    numberingFormat: 'none',
    numberingStartLevel: 1,
  },
  citations: {
    required: false,
    format: 'footnote',
    minCount: 0,
    requireSourcesBlock: false,
  },
};

const GENERIC_FORMATTING: FormattingConfig = {
  typography: ACADEMIC_TYPOGRAPHY,
  pagination: {
    pageBreakBeforeH1: false,
    minParagraphsAfterHeading: 3,
    headingSpacing: {
      h1: { before: 480, after: 240 },
      h2: { before: 360, after: 180 },
      h3: { before: 280, after: 140 },
      h4: { before: 240, after: 120 },
    },
  },
  coverPage: {
    enabled: false,
    fields: [],
  },
  callouts: STANDARD_CALLOUTS,
  blockquote: STANDARD_BLOCKQUOTE,
  table: STANDARD_TABLE,
  footnotes: STANDARD_FOOTNOTES,
};

export const genericSchema: DocumentSchema = {
  id: 'generic',
  name: 'Document generic',
  description: 'Document fără șablon specific',
  category: 'legal',

  detection: {
    keywords: [], // Never matches by keywords - only fallback
    priority: 0,
  },

  structure: GENERIC_STRUCTURE,
  formatting: GENERIC_FORMATTING,

  validation: {
    mode: 'lenient',
    autoFix: false,
    maxFixAttempts: 0,
  },

  normalization: {
    standardRules: ['strip-emojis', 'normalize-callouts', 'restart-list-numbering'],
    headingNumberFormat: 'keep',
  },

  promptConfig: {
    injectInSystemPrompt: false,
    formattingInstructions: 'minimal',
  },
};

// ============================================================================
// Schema Registration
// ============================================================================

/**
 * All builtin schemas.
 */
export const BUILTIN_SCHEMAS: DocumentSchema[] = [
  researchSchema,
  fundamentareSchema,
  notificareSchema,
  courtFilingSchema,
  contractSchema,
  genericSchema,
];

/**
 * Initialize the schema registry with all builtin schemas.
 * Call this at application startup.
 */
export function initializeBuiltinSchemas(): void {
  schemaRegistry.registerAll(BUILTIN_SCHEMAS);
  schemaRegistry.setDefault('generic');
}
