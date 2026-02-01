/**
 * Smart Context Truncation Utilities
 *
 * Provides intelligent truncation of context that preserves important information
 * at the start and end of text while summarizing the middle.
 *
 * Configurable limits by content type to balance context quality vs. token usage.
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum character limits by content type.
 * These are tuned for optimal balance between context quality and token usage.
 */
export const CONTEXT_LIMITS = {
  /** Existing document content (expanded from 2000) */
  existingContent: 4000,
  /** Case context from context file */
  caseContext: 8000,
  /** Client/party context */
  clientContext: 2000,
  /** Selected text for suggestions */
  selectedText: 10000,
  /** Cursor context (surrounding text) */
  cursorContext: 3000,
  /** User prompt/instructions */
  prompt: 10000,
  /** Research results */
  researchResults: 15000,
} as const;

export type ContextType = keyof typeof CONTEXT_LIMITS;

// ============================================================================
// Smart Truncation Options
// ============================================================================

export interface TruncateOptions {
  /** Maximum total characters (default: based on type) */
  maxChars?: number;
  /** Characters to preserve at start (default: 40% of maxChars) */
  preserveStart?: number;
  /** Characters to preserve at end (default: 30% of maxChars) */
  preserveEnd?: number;
  /** Add ellipsis indicator when truncated (default: true) */
  addEllipsis?: boolean;
  /** Try to break at sentence boundaries (default: true) */
  breakAtSentence?: boolean;
  /** Content type for auto-configuration */
  type?: ContextType;
}

// ============================================================================
// Core Truncation Functions
// ============================================================================

/**
 * Smart truncation that preserves start and end of text.
 *
 * Strategy:
 * 1. If text fits within limit, return as-is
 * 2. Otherwise, preserve start portion, preserve end portion, add truncation marker in middle
 * 3. Try to break at sentence boundaries for cleaner output
 *
 * @param text - The text to truncate
 * @param options - Truncation options
 * @returns Truncated text with preserved context
 */
export function smartTruncate(text: string, options: TruncateOptions = {}): string {
  if (!text) return '';

  // Get limits based on type or use defaults
  const maxChars = options.maxChars ?? (options.type ? CONTEXT_LIMITS[options.type] : 4000);
  const preserveStart = options.preserveStart ?? Math.floor(maxChars * 0.4);
  const preserveEnd = options.preserveEnd ?? Math.floor(maxChars * 0.3);
  const addEllipsis = options.addEllipsis ?? true;
  const breakAtSentence = options.breakAtSentence ?? true;

  // If text fits, return as-is
  if (text.length <= maxChars) {
    return text;
  }

  // Calculate how much we can keep
  const truncationMarker = addEllipsis ? '\n\n[... conținut trunchiat ...]\n\n' : '\n\n';
  const markerLength = truncationMarker.length;
  const availableChars = maxChars - markerLength;

  // Adjust if preserveStart + preserveEnd > availableChars
  let actualStart = preserveStart;
  let actualEnd = preserveEnd;
  if (actualStart + actualEnd > availableChars) {
    const ratio = preserveStart / (preserveStart + preserveEnd);
    actualStart = Math.floor(availableChars * ratio);
    actualEnd = availableChars - actualStart;
  }

  // Extract start portion
  let startPortion = text.substring(0, actualStart);
  if (breakAtSentence) {
    startPortion = breakAtSentenceBoundary(startPortion, 'end');
  }

  // Extract end portion
  let endPortion = text.substring(text.length - actualEnd);
  if (breakAtSentence) {
    endPortion = breakAtSentenceBoundary(endPortion, 'start');
  }

  return startPortion + truncationMarker + endPortion;
}

/**
 * Break text at a sentence boundary.
 *
 * @param text - Text to adjust
 * @param direction - 'start' to find sentence start, 'end' to find sentence end
 * @returns Text adjusted to sentence boundary
 */
function breakAtSentenceBoundary(text: string, direction: 'start' | 'end'): string {
  // Sentence-ending patterns in Romanian text
  const sentenceEndPattern = /[.!?]\s+/g;

  if (direction === 'end') {
    // Find the last sentence end within the text
    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = sentenceEndPattern.exec(text)) !== null) {
      // Only use if it's in the last 30% of the text (don't trim too much)
      if (match.index > text.length * 0.7) {
        lastMatch = match;
      }
    }
    if (lastMatch) {
      return text.substring(0, lastMatch.index + 1);
    }
  } else {
    // Find the first sentence start after any partial sentence
    const match = sentenceEndPattern.exec(text);
    if (match && match.index < text.length * 0.3) {
      return text.substring(match.index + match[0].length);
    }
  }

  return text;
}

// ============================================================================
// Specialized Truncation Functions
// ============================================================================

/**
 * Truncate existing document content.
 * Preserves more at the end (recent content is often more relevant).
 */
export function truncateExistingContent(text: string): string {
  return smartTruncate(text, {
    type: 'existingContent',
    preserveStart: 1200, // First ~30%
    preserveEnd: 2000, // Last ~50%
  });
}

/**
 * Truncate case context.
 * Balances start (case metadata) and end (recent events).
 */
export function truncateCaseContext(text: string): string {
  return smartTruncate(text, {
    type: 'caseContext',
    preserveStart: 3500, // ~44% - case details at start
    preserveEnd: 3000, // ~38% - recent activity
  });
}

/**
 * Truncate research results.
 * Preserves structure by keeping intro and conclusions.
 */
export function truncateResearchResults(text: string): string {
  return smartTruncate(text, {
    type: 'researchResults',
    preserveStart: 6000, // Introduction and early findings
    preserveEnd: 5000, // Conclusions and recommendations
  });
}

/**
 * Truncate selected text for AI operations.
 */
export function truncateSelectedText(text: string): string {
  return smartTruncate(text, {
    type: 'selectedText',
    preserveStart: 4500,
    preserveEnd: 4000,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate approximate token count.
 * Uses conservative estimate of 4 chars per token for Romanian/mixed content.
 *
 * @param text - Text to estimate
 * @returns Approximate token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Check if text exceeds the limit for a given type.
 *
 * @param text - Text to check
 * @param type - Content type
 * @returns True if text exceeds the limit
 */
export function exceedsLimit(text: string, type: ContextType): boolean {
  if (!text) return false;
  return text.length > CONTEXT_LIMITS[type];
}

/**
 * Get truncation stats for logging/debugging.
 *
 * @param original - Original text
 * @param truncated - Truncated text
 * @returns Stats object
 */
export function getTruncationStats(
  original: string,
  truncated: string
): {
  originalLength: number;
  truncatedLength: number;
  reductionPercent: number;
  wasTruncated: boolean;
  originalTokens: number;
  truncatedTokens: number;
} {
  const originalLength = original?.length ?? 0;
  const truncatedLength = truncated?.length ?? 0;

  return {
    originalLength,
    truncatedLength,
    reductionPercent:
      originalLength > 0 ? Math.round((1 - truncatedLength / originalLength) * 100) : 0,
    wasTruncated: truncatedLength < originalLength,
    originalTokens: estimateTokens(original),
    truncatedTokens: estimateTokens(truncated),
  };
}

/**
 * Truncate with logging of stats.
 * Useful for debugging and monitoring token usage.
 *
 * @param text - Text to truncate
 * @param type - Content type
 * @param logger - Optional logger function
 * @returns Truncated text
 */
export function truncateWithStats(
  text: string,
  type: ContextType,
  logger?: (stats: ReturnType<typeof getTruncationStats>) => void
): string {
  const truncated = smartTruncate(text, { type });
  const stats = getTruncationStats(text, truncated);

  if (logger && stats.wasTruncated) {
    logger(stats);
  }

  return truncated;
}
