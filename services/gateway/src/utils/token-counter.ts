/**
 * Token Counter Utility
 *
 * Provides accurate token counting for AI context files.
 * Uses character-based estimation optimized for Romanian legal text,
 * which typically has ~3.5 characters per token due to diacritics and
 * longer compound words common in legal terminology.
 *
 * Future Enhancement:
 * To use tiktoken for exact counts:
 * 1. Install: pnpm add tiktoken
 * 2. Import and use the cl100k_base encoding (used by Claude/GPT-4)
 * 3. Note: tiktoken has WASM dependencies that may need build config
 */

import logger from './logger';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Character to token ratio for Romanian legal text.
 * Standard English is ~4 chars/token, but Romanian legal text is denser:
 * - Diacritics (ă, î, ș, ț) are separate tokens
 * - Legal compound terms (e.g., "contravaloare", "îndeplinire")
 * - Mixed Romanian/English in legal documents
 */
const ROMANIAN_LEGAL_CHARS_PER_TOKEN = 3.5;

/**
 * Standard English character to token ratio (fallback)
 */
const ENGLISH_CHARS_PER_TOKEN = 4.0;

/**
 * Regex to detect Romanian-specific characters
 */
const ROMANIAN_PATTERN = /[ăîșțâĂÎȘȚÂ]/g;

/**
 * Minimum percentage of Romanian characters to classify text as Romanian.
 * Using 1% threshold - if more than 1% of characters are Romanian diacritics,
 * the text is considered Romanian for token estimation purposes.
 */
const ROMANIAN_THRESHOLD = 0.01;

/**
 * Check if text should be classified as Romanian based on character density.
 * Uses percentage-based detection rather than simple presence check to avoid
 * misclassifying English text with occasional Romanian characters.
 *
 * @param text - The text to analyze
 * @returns True if text has significant Romanian character density
 */
function isRomanianText(text: string): boolean {
  if (!text || text.length === 0) return false;

  // Count Romanian characters using global regex
  const matches = text.match(ROMANIAN_PATTERN);
  const romanianCharCount = matches ? matches.length : 0;

  // Use percentage-based detection
  return romanianCharCount / text.length > ROMANIAN_THRESHOLD;
}

// ============================================================================
// Token Counter
// ============================================================================

let encoder: unknown | null = null;
let useExactCounting = false;

/**
 * Initialize the token counter.
 * Attempts to load tiktoken for exact counting, falls back to estimation.
 */
export async function initTokenCounter(): Promise<void> {
  try {
    // Attempt to load tiktoken dynamically
    // tiktoken is an optional dependency - if not installed, we fall back to estimation
    // Using variable for module name to prevent TypeScript static resolution
    const moduleName = 'tiktoken';
    const tiktoken = await import(/* webpackIgnore: true */ moduleName).catch(() => null);
    if (tiktoken && typeof tiktoken.encoding_for_model === 'function') {
      encoder = tiktoken.encoding_for_model('gpt-4');
      useExactCounting = true;
      logger.info('[TokenCounter] Initialized with tiktoken (exact counting)');
    } else {
      logger.info('[TokenCounter] tiktoken not available, using estimation');
    }
  } catch (error) {
    // Module not found or failed to load - this is expected if tiktoken is not installed
    logger.info('[TokenCounter] tiktoken not installed, using character-based estimation', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Count tokens in a text string.
 *
 * Uses tiktoken if available, otherwise falls back to character-based estimation
 * optimized for Romanian legal text.
 *
 * @param text - The text to count tokens for
 * @returns Estimated or exact token count
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // Use tiktoken if available
  if (useExactCounting && encoder) {
    try {
      const enc = encoder as { encode: (text: string) => number[] };
      return enc.encode(text).length;
    } catch (error) {
      logger.warn('[TokenCounter] tiktoken encoding failed, falling back to estimation', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback: Character-based estimation
  return estimateTokens(text);
}

/**
 * Estimate token count based on character analysis.
 * Uses different ratios for Romanian vs English text.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Check if text has significant Romanian character density
  const isRomanian = isRomanianText(text);

  // Use appropriate ratio based on language
  const charsPerToken = isRomanian ? ROMANIAN_LEGAL_CHARS_PER_TOKEN : ENGLISH_CHARS_PER_TOKEN;

  // Round up to ensure we don't underestimate
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Count tokens for multiple text sections and return the total.
 *
 * @param sections - Array of text sections
 * @returns Total token count
 */
export function countTokensForSections(sections: string[]): number {
  return sections.reduce((total, section) => total + countTokens(section), 0);
}

/**
 * Check if text exceeds a token budget.
 *
 * @param text - The text to check
 * @param budget - Maximum allowed tokens
 * @returns True if text exceeds budget
 */
export function exceedsTokenBudget(text: string, budget: number): boolean {
  return countTokens(text) > budget;
}

/**
 * Truncate text to fit within a token budget.
 * Attempts to truncate at sentence boundaries when possible.
 *
 * @param text - The text to truncate
 * @param budget - Maximum allowed tokens
 * @param preserveRatio - Minimum ratio of original content to preserve (0-1)
 * @returns Truncated text
 */
export function truncateToTokenBudget(
  text: string,
  budget: number,
  preserveRatio: number = 0.7
): string {
  if (!text) return '';

  const currentTokens = countTokens(text);
  if (currentTokens <= budget) return text;

  // Calculate target character length based on budget
  const charsPerToken = isRomanianText(text)
    ? ROMANIAN_LEGAL_CHARS_PER_TOKEN
    : ENGLISH_CHARS_PER_TOKEN;

  const targetChars = Math.floor(budget * charsPerToken * preserveRatio);

  // Truncate to target length
  let truncated = text.substring(0, targetChars);

  // Try to end at a sentence boundary
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! ')
  );

  // Use >= to include sentence boundaries at exactly 50% of target
  if (lastSentenceEnd >= targetChars * 0.5) {
    truncated = truncated.substring(0, lastSentenceEnd + 1);
  }

  return truncated.trim() + '...';
}

/**
 * Get token counting statistics for debugging.
 *
 * @param text - The text to analyze
 * @returns Token counting statistics
 */
export function getTokenStats(text: string): {
  charCount: number;
  tokenCount: number;
  charsPerToken: number;
  isRomanian: boolean;
  isExact: boolean;
} {
  const charCount = text.length;
  const tokenCount = countTokens(text);
  const isRomanian = isRomanianText(text);

  return {
    charCount,
    tokenCount,
    charsPerToken: charCount > 0 ? charCount / tokenCount : 0,
    isRomanian,
    isExact: useExactCounting,
  };
}
