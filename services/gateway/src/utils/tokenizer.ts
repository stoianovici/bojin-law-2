/**
 * Token Estimation Utility
 * Phase 5: Accurate Token Counting
 *
 * Provides improved token estimation for Romanian legal text.
 * Claude uses byte-pair encoding (BPE) where Romanian text typically
 * has a different characters-per-token ratio than English.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Average characters per token for different text types.
 * Romanian legal text uses more complex words with diacritics,
 * resulting in fewer characters per token than English.
 *
 * These values are calibrated against Claude's tokenizer.
 */
const CHARS_PER_TOKEN = {
  /** Romanian text: ~3.5 chars per token (vs 4 for English) */
  romanian: 3.5,
  /** English text: ~4 chars per token */
  english: 4.0,
  /** Code: ~3.5 chars per token (similar to Romanian due to symbols) */
  code: 3.5,
  /** Mixed content: average */
  mixed: 3.75,
};

/**
 * Calibration factors for specific content types.
 * Applied on top of base CHARS_PER_TOKEN estimates.
 *
 * These factors account for:
 * - Domain-specific terminology
 * - Legal citations and references
 * - Formal/technical language patterns
 */
const CALIBRATION_FACTORS: Record<string, number> = {
  /** Romanian legal text tends to use longer words and complex phrases */
  romanian_legal: 1.15,
  /** Legal citations (art., alin., etc.) tokenize differently */
  legal_citations: 1.1,
  /** Technical/financial terms */
  technical: 1.05,
  /** Default: no adjustment */
  default: 1.0,
};

// ============================================================================
// Types
// ============================================================================

export interface TokenEstimate {
  /** Estimated total tokens */
  tokens: number;
  /** Characters counted */
  characters: number;
  /** Ratio used for estimation */
  ratio: number;
  /** Content type detected */
  contentType: 'romanian' | 'english' | 'code' | 'mixed';
  /** Calibration factor applied */
  calibrationFactor: number;
  /** Estimation confidence: 'high' (>90%), 'medium' (70-90%), 'low' (<70%) */
  confidence: 'high' | 'medium' | 'low';
  /** Warning message if uncertainty is high */
  warning?: string;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect if text is primarily Romanian based on diacritics and common words.
 */
function detectRomanian(text: string): boolean {
  // Romanian diacritics: ă, â, î, ș, ț
  const romanianDiacritics = /[ăâîșțĂÂÎȘȚ]/g;
  const diacriticCount = (text.match(romanianDiacritics) || []).length;

  // Common Romanian words
  const romanianWords =
    /\b(și|că|în|la|de|pe|pentru|cu|din|care|este|sunt|a|sau|dar|nu|mai|acest|această|acestea|aceasta|doar|foarte|poate|trebuie|fiind|după|când|dacă|ori|fără|între|asupra|prin|precum|conform|potrivit|având|privind)\b/gi;
  const romanianWordCount = (text.match(romanianWords) || []).length;

  // Consider Romanian if significant diacritics or Romanian words present
  const textLength = text.length;
  const diacriticRatio = diacriticCount / Math.max(textLength, 1);
  const wordRatio = romanianWordCount / Math.max(text.split(/\s+/).length, 1);

  return diacriticRatio > 0.005 || wordRatio > 0.1;
}

/**
 * Detect if text is primarily code based on syntax patterns.
 */
function detectCode(text: string): boolean {
  // Code patterns: brackets, semicolons, arrows, etc.
  const codePatterns =
    /[{}[\];=>]|function|const|let|var|class|import|export|interface|type|async|await|return/g;
  const codeMatches = (text.match(codePatterns) || []).length;

  // If more than 5% of words look like code, classify as code
  const words = text.split(/\s+/).length;
  return codeMatches / Math.max(words, 1) > 0.05;
}

/**
 * Detect content type of text for better token estimation.
 */
function detectContentType(text: string): 'romanian' | 'english' | 'code' | 'mixed' {
  const isCode = detectCode(text);
  const isRomanian = detectRomanian(text);

  if (isCode) return 'code';
  if (isRomanian) return 'romanian';

  // Check if mixed (some Romanian, some English)
  const romanianChars = (text.match(/[ăâîșțĂÂÎȘȚ]/g) || []).length;

  if (romanianChars > 0 && romanianChars < text.length * 0.01) {
    return 'mixed';
  }

  return 'english';
}

/**
 * Detect if text contains Romanian legal terminology.
 * Returns a calibration key for more accurate estimation.
 */
function detectLegalContent(text: string): string {
  // Romanian legal citation patterns
  const legalCitations =
    /\b(art\.?\s*\d+|alin\.?\s*\d+|lit\.?\s*[a-z]|C\.?\s*civ\.|C\.?\s*proc\.?\s*civ\.|O\.?\s*U\.?\s*G\.?|H\.?\s*G\.?|Legea\s*nr\.?\s*\d+)\b/gi;
  const citationCount = (text.match(legalCitations) || []).length;

  // Legal terminology
  const legalTerms =
    /\b(hotărâre|decizie|sentință|dosar|instanță|reclamant|pârât|apelant|intimat|recurent|executor|judecător|procuror|avocat|notar|contract|clauză|reziliere|executare|somație|notificare|prejudiciu|despăgubire|daune|penalități|obligație|creanță|debitor|creditor)\b/gi;
  const termCount = (text.match(legalTerms) || []).length;

  const words = text.split(/\s+/).length;
  const citationRatio = citationCount / Math.max(words, 1);
  const termRatio = termCount / Math.max(words, 1);

  // High density of legal content
  if (citationRatio > 0.02 && termRatio > 0.05) {
    return 'romanian_legal';
  }

  // Has citations but less dense
  if (citationRatio > 0.01) {
    return 'legal_citations';
  }

  return 'default';
}

/**
 * Determine estimation confidence based on text characteristics.
 */
function determineConfidence(text: string, contentType: string): 'high' | 'medium' | 'low' {
  const length = text.length;

  // Very short texts are harder to estimate accurately
  if (length < 100) {
    return 'low';
  }

  // Mixed content is harder to estimate
  if (contentType === 'mixed') {
    return 'medium';
  }

  // Code with lots of special characters
  if (contentType === 'code') {
    const specialChars = (text.match(/[{}[\]();=<>]/g) || []).length;
    if (specialChars / length > 0.1) {
      return 'medium';
    }
  }

  // Long, consistent content is easier to estimate
  if (length > 1000) {
    return 'high';
  }

  return 'medium';
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Estimate token count for text.
 *
 * Uses language detection to apply appropriate character-per-token ratio.
 * Romanian legal text typically has ~3.5 chars per token (vs 4 for English).
 *
 * @param text - The text to estimate tokens for
 * @returns Token estimate with metadata including confidence level
 *
 * @example
 * const estimate = estimateTokens("Conform art. 194 C.proc.civ., cererea de chemare în judecată...");
 * console.log(estimate.tokens); // More accurate than text.length / 4
 * if (estimate.confidence === 'low') {
 *   console.warn(estimate.warning);
 * }
 */
export function estimateTokens(text: string): TokenEstimate {
  if (!text || text.length === 0) {
    return {
      tokens: 0,
      characters: 0,
      ratio: CHARS_PER_TOKEN.english,
      contentType: 'english',
      calibrationFactor: 1.0,
      confidence: 'high',
    };
  }

  const contentType = detectContentType(text);
  const ratio = CHARS_PER_TOKEN[contentType];
  const characters = text.length;

  // Detect legal content for calibration
  const legalType = contentType === 'romanian' ? detectLegalContent(text) : 'default';
  const calibrationFactor = CALIBRATION_FACTORS[legalType] || 1.0;

  // Calculate base token count
  let tokens = Math.ceil(characters / ratio);

  // Adjust for whitespace (whitespace is often its own token)
  const whitespaceCount = (text.match(/\s+/g) || []).length;
  tokens += Math.ceil(whitespaceCount * 0.3); // Partial contribution

  // Adjust for punctuation (often separate tokens)
  const punctuationCount = (text.match(/[.,;:!?()[\]{}""''„"]/g) || []).length;
  tokens += Math.ceil(punctuationCount * 0.5);

  // Adjust for numbers (often split into multiple tokens)
  const numberCount = (text.match(/\d+/g) || []).length;
  tokens += Math.ceil(numberCount * 0.2);

  // Apply calibration factor
  tokens = Math.ceil(tokens * calibrationFactor);

  // Determine confidence level
  const confidence = determineConfidence(text, contentType);

  // Generate warning for low confidence estimates
  let warning: string | undefined;
  if (confidence === 'low') {
    if (characters < 100) {
      warning = 'Token estimate may be inaccurate for very short text';
    } else {
      warning = 'Token estimate has high uncertainty due to content characteristics';
    }
  }

  return {
    tokens,
    characters,
    ratio,
    contentType,
    calibrationFactor,
    confidence,
    warning,
  };
}

/**
 * Quick token count estimation (simpler, faster).
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function quickTokenCount(text: string): number {
  if (!text) return 0;

  // Simple heuristic: Romanian text ~3.5 chars per token
  // Add small buffer for safety
  return Math.ceil(text.length / 3.5) + 10;
}

/**
 * Check if content would exceed a token limit.
 *
 * @param text - The text to check
 * @param limit - Maximum allowed tokens
 * @returns true if text would exceed limit
 */
export function wouldExceedTokenLimit(text: string, limit: number): boolean {
  const estimate = estimateTokens(text);
  return estimate.tokens > limit;
}

/**
 * Truncate text to fit within a token limit.
 *
 * @param text - The text to truncate
 * @param limit - Maximum allowed tokens
 * @returns Truncated text that fits within limit
 */
export function truncateToTokenLimit(text: string, limit: number): string {
  const estimate = estimateTokens(text);

  if (estimate.tokens <= limit) {
    return text;
  }

  // Calculate approximate character limit
  const targetChars = Math.floor((limit / estimate.tokens) * text.length * 0.9); // 10% safety margin

  // Truncate at word boundary
  const truncated = text.substring(0, targetChars);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > targetChars * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

// Default export for convenience
export default {
  estimateTokens,
  quickTokenCount,
  wouldExceedTokenLimit,
  truncateToTokenLimit,
};
