/**
 * Document Schema Types
 *
 * Core type definitions for the schema-driven document formatting system.
 * Schemas define structure, formatting, and validation rules for each document type.
 */

// ============================================================================
// Schema Categories
// ============================================================================

export type DocumentCategory = 'research' | 'legal' | 'notification' | 'contract';

// ============================================================================
// Detection Configuration
// ============================================================================

/**
 * Configuration for detecting document type from name/prompt.
 */
export interface DetectionConfig {
  /** Keywords that indicate this document type (case-insensitive) */
  keywords: string[];

  /** Priority for resolution when multiple schemas match (higher wins) */
  priority: number;

  /** Optional custom detection function for complex cases */
  customMatcher?: (documentName: string, prompt: string) => boolean;
}

// ============================================================================
// Structure Requirements
// ============================================================================

/**
 * Definition of a required or optional section in a document.
 */
export interface SectionDefinition {
  /** Section identifier (e.g., 'introduction', 'legal-basis') */
  id: string;

  /** Display name in Romanian (e.g., 'Introducere', 'Cadrul juridic') */
  name: string;

  /** Whether this section is required */
  required: boolean;

  /** Expected heading level (1-6) */
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6;

  /** Regex patterns to detect this section in generated content */
  detectionPatterns: RegExp[];

  /** Recommended order (lower = earlier in document) */
  order: number;

  /** Minimum word count for this section (optional) */
  minWordCount?: number;
}

/**
 * Configuration for heading hierarchy in documents.
 */
export interface HeadingHierarchyConfig {
  /** Maximum nesting depth allowed (e.g., 3 = h1, h2, h3) */
  maxDepth: number;

  /** Whether to allow single or multiple H1 headings */
  h1Count: 'single' | 'multiple';

  /** Whether document must have an H1 heading */
  requireH1: boolean;

  /** Numbering format for headings */
  numberingFormat: 'decimal' | 'roman' | 'none';

  /** Starting level for numbering (1 = h1, 2 = h2) */
  numberingStartLevel: number;
}

/**
 * Citation/reference configuration.
 */
export interface CitationConfig {
  /** Whether citations are required */
  required: boolean;

  /** Citation format to use */
  format: 'footnote' | 'inline' | 'endnote';

  /** Minimum number of citations required (if required is true) */
  minCount?: number;

  /** Whether to require a sources block at the end */
  requireSourcesBlock?: boolean;
}

/**
 * Complete structure requirements for a document.
 */
export interface StructureConfig {
  /** Required and optional sections */
  sections: SectionDefinition[];

  /** Heading hierarchy rules */
  headingHierarchy: HeadingHierarchyConfig;

  /** Citation requirements */
  citations: CitationConfig;

  /** Required elements (e.g., 'signature', 'date-location') */
  requiredElements?: string[];
}

// ============================================================================
// Typography Configuration
// ============================================================================

/**
 * Typography settings for document styling.
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

  /** First line indent in px (0 for no indent) */
  firstLineIndent: number;
}

/**
 * Callout styling configuration.
 */
export interface CalloutStyleConfig {
  /** Background color (hex) */
  bgColor: string;

  /** Left border color (hex) */
  borderColor: string;
}

// ============================================================================
// Formatting Configuration
// ============================================================================

/**
 * Pagination rules for document layout.
 */
export interface PaginationConfig {
  /** Force page break before H1 headings */
  pageBreakBeforeH1: boolean;

  /** Minimum paragraphs to keep with heading (orphan prevention) */
  minParagraphsAfterHeading: number;

  /** Heading spacing in twips (20 twips = 1pt) */
  headingSpacing: {
    h1: { before: number; after: number };
    h2: { before: number; after: number };
    h3: { before: number; after: number };
    h4: { before: number; after: number };
  };
}

/**
 * Cover page configuration.
 */
export interface CoverPageConfig {
  /** Whether to include a cover page */
  enabled: boolean;

  /** Fields to show on cover page */
  fields: ('title' | 'subtitle' | 'documentType' | 'client' | 'author' | 'date')[];
}

/**
 * Complete formatting configuration.
 */
export interface FormattingConfig {
  /** Typography settings */
  typography: TypographyConfig;

  /** Pagination rules */
  pagination: PaginationConfig;

  /** Cover page settings */
  coverPage: CoverPageConfig;

  /** Callout styling */
  callouts: {
    note: CalloutStyleConfig;
    important: CalloutStyleConfig;
    definition: CalloutStyleConfig;
  };

  /** Blockquote styling */
  blockquote: {
    indent: number;
    borderLeft: { width: number; color: string };
  };

  /** Table styling */
  table: {
    captionPosition: 'above' | 'below';
    headerBgColor: string;
  };

  /** Footnote styling */
  footnotes: {
    size: number;
    afterPunctuation: boolean;
  };
}

// ============================================================================
// Validation Configuration
// ============================================================================

/**
 * Strategy for handling validation errors.
 */
export type FixStrategy =
  | 'prompt-retry' // Re-prompt AI with fix instructions
  | 'insert-placeholder' // Insert placeholder section
  | 'warn-only' // Just warn, don't fix
  | 'none'; // Ignore

/**
 * Severity level for validation issues.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Definition of a validation rule.
 */
export interface ValidationRule {
  /** Unique rule identifier */
  id: string;

  /** Rule description */
  description: string;

  /** Severity level */
  severity: ValidationSeverity;

  /** Strategy for fixing if violated */
  fixStrategy: FixStrategy;

  /** Validation function */
  validate: (content: string, schema: DocumentSchema) => ValidationRuleResult;
}

/**
 * Result of a single validation rule check.
 */
export interface ValidationRuleResult {
  /** Whether the rule passed */
  passed: boolean;

  /** Error message if failed */
  message?: string;

  /** Additional context for debugging */
  details?: Record<string, unknown>;
}

/**
 * Complete validation configuration.
 */
export interface ValidationConfig {
  /** Validation mode: strict (all rules) or lenient (errors only) */
  mode: 'strict' | 'lenient';

  /** Whether to attempt auto-fix of validation failures */
  autoFix: boolean;

  /** Maximum number of fix attempts */
  maxFixAttempts: number;

  /** Custom validation rules (in addition to standard rules) */
  customRules?: string[];
}

// ============================================================================
// Normalization Configuration
// ============================================================================

/**
 * Standard normalization rule identifiers.
 */
export type NormalizationRuleId =
  | 'strip-emojis'
  | 'normalize-callouts'
  | 'normalize-heading-numbers'
  | 'restart-list-numbering'
  | 'fix-quote-marks'
  | 'remove-empty-callouts'
  | 'collapse-whitespace'
  | 'remove-duplicate-headings';

/**
 * Normalization configuration.
 */
export interface NormalizationConfig {
  /** Which standard rules to apply */
  standardRules: NormalizationRuleId[];

  /** Heading number format (for normalize-heading-numbers rule) */
  headingNumberFormat?: 'arabic' | 'roman' | 'keep';
}

// ============================================================================
// Prompt Configuration
// ============================================================================

/**
 * Configuration for how schema requirements are injected into prompts.
 */
export interface PromptConfig {
  /** Whether to inject structure requirements into system prompt */
  injectInSystemPrompt: boolean;

  /** Level of formatting instructions to inject */
  formattingInstructions: 'minimal' | 'standard' | 'detailed';

  /** Custom prompt additions (appended to user prompt) */
  customPromptAdditions?: string;

  /** Domain knowledge to inject (e.g., legal notification knowledge) */
  domainKnowledge?: string;
}

// ============================================================================
// Complete Document Schema
// ============================================================================

/**
 * Complete document schema definition.
 * Defines all aspects of document generation, validation, and formatting.
 */
export interface DocumentSchema {
  /** Unique schema identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description of this document type */
  description: string;

  /** Category for grouping */
  category: DocumentCategory;

  /** Detection configuration */
  detection: DetectionConfig;

  /** Structure requirements */
  structure: StructureConfig;

  /** Formatting configuration */
  formatting: FormattingConfig;

  /** Validation configuration */
  validation: ValidationConfig;

  /** Normalization configuration */
  normalization: NormalizationConfig;

  /** Prompt injection configuration */
  promptConfig: PromptConfig;
}

// ============================================================================
// Validation Results
// ============================================================================

/**
 * Individual validation error.
 */
export interface ValidationError {
  /** Rule that failed */
  ruleId: string;

  /** Error message */
  message: string;

  /** Severity */
  severity: ValidationSeverity;

  /** Suggested fix strategy */
  fixStrategy: FixStrategy;

  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Individual validation warning.
 */
export interface ValidationWarning {
  /** Rule that triggered warning */
  ruleId: string;

  /** Warning message */
  message: string;

  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Complete validation result.
 */
export interface SchemaValidationResult {
  /** Overall validation status */
  valid: boolean;

  /** Schema used for validation */
  schemaId: string;

  /** List of errors (if any) */
  errors: ValidationError[];

  /** List of warnings */
  warnings: ValidationWarning[];

  /** Sections found in content */
  foundSections: string[];

  /** Required sections that were missing */
  missingSections: string[];

  /** Citation count found */
  citationCount: number;
}
