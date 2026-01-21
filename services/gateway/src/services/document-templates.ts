/**
 * Document Templates
 *
 * Defines formatting rules and structure for different document types.
 * Templates control cover page, pagination, and normalizer behavior.
 */

// ============================================================================
// Types
// ============================================================================

export type DocumentRoute = 'research' | 'generic' | 'court-filing';

export interface HeadingSpacing {
  before: number; // twips (20 twips = 1pt)
  after: number;
}

export interface PaginationRules {
  /** Force page break before H1 headings (except first after cover) */
  pageBreakBeforeH1: boolean;

  /** Minimum paragraphs to keep with heading (prevents orphaned headings) */
  minParagraphsAfterHeading: number;

  /** Spacing for each heading level */
  headingSpacing: {
    h1: HeadingSpacing;
    h2: HeadingSpacing;
    h3: HeadingSpacing;
    h4: HeadingSpacing;
  };
}

export interface CoverPageConfig {
  /** Include a separate cover page (content starts on page 2) */
  enabled: boolean;

  /** Fields to show on cover page */
  fields: ('title' | 'subtitle' | 'documentType' | 'client' | 'author' | 'date')[];
}

export interface NormalizerRules {
  /** Remove emoji characters from content */
  stripEmojis: boolean;

  /** Reset list numbering for each new list */
  restartListNumbering: boolean;

  /** Normalize heading numbers to consistent format */
  normalizeHeadingNumbers: 'arabic' | 'roman' | 'keep';

  /** Remove emoji prefixes from callout headers */
  normalizeCallouts: boolean;
}

export interface DocumentTemplate {
  id: DocumentRoute;
  name: string;
  description: string;

  coverPage: CoverPageConfig;
  pagination: PaginationRules;
  normalizer: NormalizerRules;

  /** Optional style configuration for semantic HTML normalization */
  style?: DocumentStyleConfig;
}

// ============================================================================
// Style Configuration (for Semantic HTML Normalization)
// ============================================================================

/**
 * Typography configuration for document styling.
 * Controls fonts, sizes, and colors applied by the semantic normalizer.
 */
export interface TypographyConfig {
  /** Body text font family */
  bodyFont: string;
  /** Body text size in pt */
  bodySize: number;
  /** Heading font family */
  headingFont: string;
  /** Heading sizes for each level (pt) */
  headingSizes: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
  /** Heading colors (hex) */
  headingColors: { h1: string; h2: string; h3: string; h4: string; h5: string; h6: string };
  /** Line height multiplier */
  lineHeight: number;
  /** First line indent in px */
  firstLineIndent: number;
}

/**
 * Callout styling configuration.
 * Controls background and border colors for aside elements.
 */
export interface CalloutConfig {
  /** Background color (hex) */
  bgColor: string;
  /** Left border color (hex) */
  borderColor: string;
}

/**
 * Complete style configuration for document formatting.
 * Used by the semantic HTML normalizer to apply consistent styling.
 */
export interface DocumentStyleConfig {
  typography: TypographyConfig;

  numbering: {
    /** Numbering format: 'decimal' (1, 1.1, 1.2) or 'roman' (I, II, III for h1) */
    format: 'decimal' | 'roman';
    /** Starting level for numbering (1 = h1, 2 = h2) */
    startLevel: number;
  };

  footnotes: {
    /** Footnote text size in pt */
    size: number;
    /** Place footnote markers after punctuation */
    afterPunctuation: boolean;
  };

  blockquote: {
    /** Left indent in inches */
    indent: number;
    /** Left border styling */
    borderLeft: { width: number; color: string };
  };

  callouts: {
    note: CalloutConfig;
    important: CalloutConfig;
    definition: CalloutConfig;
  };

  table: {
    /** Caption position: 'above' or 'below' */
    captionPosition: 'above' | 'below';
    /** Header row background color (hex) */
    headerBgColor: string;
  };
}

// ============================================================================
// Default Style Configuration
// ============================================================================

/**
 * Default style configuration for research documents.
 * Academic paper formatting with professional typography.
 */
export const RESEARCH_STYLE_CONFIG: DocumentStyleConfig = {
  typography: {
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
  },

  numbering: {
    format: 'decimal',
    startLevel: 1,
  },

  footnotes: {
    size: 10,
    afterPunctuation: true,
  },

  blockquote: {
    indent: 0.5,
    borderLeft: { width: 3, color: '#cccccc' },
  },

  callouts: {
    note: { bgColor: '#f8f9fa', borderColor: '#0066cc' },
    important: { bgColor: '#fff8e6', borderColor: '#9B2335' },
    definition: { bgColor: '#e8f4f8', borderColor: '#17a2b8' },
  },

  table: {
    captionPosition: 'above',
    headerBgColor: '#f0f0f0',
  },
};

// ============================================================================
// Default Spacing Values
// ============================================================================

/** Standard heading spacing (in twips: 20 twips = 1pt) */
const STANDARD_HEADING_SPACING: PaginationRules['headingSpacing'] = {
  h1: { before: 480, after: 240 }, // 24pt before, 12pt after
  h2: { before: 360, after: 180 }, // 18pt before, 9pt after
  h3: { before: 280, after: 140 }, // 14pt before, 7pt after
  h4: { before: 240, after: 120 }, // 12pt before, 6pt after
};

// ============================================================================
// Template Definitions
// ============================================================================

export const DOCUMENT_TEMPLATES: Record<DocumentRoute, DocumentTemplate> = {
  /**
   * Research Document Template
   * Used for: Notă de cercetare, Memoriu juridic, Studiu
   *
   * Features:
   * - Separate cover page with metadata
   * - Page breaks before major sections (H1)
   * - Strict orphan prevention
   * - No emojis allowed
   */
  research: {
    id: 'research',
    name: 'Notă de cercetare',
    description: 'Document de cercetare juridică cu pagină de titlu separată',

    coverPage: {
      enabled: true,
      fields: ['documentType', 'title', 'subtitle', 'client', 'author', 'date'],
    },

    pagination: {
      pageBreakBeforeH1: true,
      minParagraphsAfterHeading: 4, // Increased from 3 for stronger orphan prevention
      headingSpacing: STANDARD_HEADING_SPACING,
    },

    normalizer: {
      stripEmojis: true,
      restartListNumbering: true,
      normalizeHeadingNumbers: 'arabic', // I. → 1.
      normalizeCallouts: true,
    },

    style: RESEARCH_STYLE_CONFIG,
  },

  /**
   * Generic Document Template
   * Used for: Free-form documents, quick drafts
   *
   * Features:
   * - No cover page (content starts immediately)
   * - No forced page breaks
   * - Basic orphan prevention
   * - No emojis allowed
   */
  generic: {
    id: 'generic',
    name: 'Document generic',
    description: 'Document fără șablon specific',

    coverPage: {
      enabled: false,
      fields: [],
    },

    pagination: {
      pageBreakBeforeH1: false,
      minParagraphsAfterHeading: 3, // Increased from 2 for better orphan prevention
      headingSpacing: STANDARD_HEADING_SPACING,
    },

    normalizer: {
      stripEmojis: true,
      restartListNumbering: true,
      normalizeHeadingNumbers: 'keep', // Preserve AI's choice
      normalizeCallouts: true,
    },
  },

  /**
   * Court Filing Template
   * Used for: Cereri, întâmpinări, acte procedurale
   *
   * Features:
   * - No cover page (court docs have specific format)
   * - Minimal pagination intervention
   * - Lists may have continuous numbering (legal requirement)
   * - No emojis allowed
   */
  'court-filing': {
    id: 'court-filing',
    name: 'Act procedural',
    description: 'Acte de procedură pentru instanță',

    coverPage: {
      enabled: false,
      fields: [],
    },

    pagination: {
      pageBreakBeforeH1: false,
      minParagraphsAfterHeading: 2,
      headingSpacing: {
        h1: { before: 360, after: 180 }, // Tighter for court docs
        h2: { before: 240, after: 120 },
        h3: { before: 200, after: 100 },
        h4: { before: 160, after: 80 },
      },
    },

    normalizer: {
      stripEmojis: true,
      restartListNumbering: false, // Court docs may need continuous numbering
      normalizeHeadingNumbers: 'keep',
      normalizeCallouts: true,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get template by route ID
 */
export function getTemplate(route: DocumentRoute): DocumentTemplate {
  return DOCUMENT_TEMPLATES[route];
}

/**
 * Determine document route based on context
 *
 * @param isResearch - Whether this is a research document (from StepResearch)
 * @param templateId - Court filing template ID if applicable
 */
export function determineDocumentRoute(isResearch: boolean, templateId?: string): DocumentRoute {
  if (templateId && templateId.startsWith('CF-')) {
    return 'court-filing';
  }
  if (isResearch) {
    return 'research';
  }
  return 'generic';
}

/**
 * Get default template (generic)
 */
export function getDefaultTemplate(): DocumentTemplate {
  return DOCUMENT_TEMPLATES.generic;
}
