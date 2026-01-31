/**
 * Anchor Matching Utility
 *
 * Fuzzy matching for user corrections after comprehension regeneration.
 * Uses rolling hash windows with Levenshtein similarity to find where
 * corrections should be applied in newly generated content.
 */

// ============================================================================
// Types
// ============================================================================

export interface CorrectionWithAnchor {
  id: string;
  anchorText: string;
  anchorHash: string;
}

export interface AnchorMatch {
  correctionId: string;
  matchedText: string;
  similarity: number;
  position: number;
}

// ============================================================================
// Similarity Functions
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching anchor text.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio (0-1) between two strings.
 * 1.0 = identical, 0.0 = completely different
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * Normalize text for matching (lowercase, collapse whitespace).
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ============================================================================
// Anchor Matching
// ============================================================================

/**
 * Find matches for anchor texts in new content using sliding window + fuzzy match.
 *
 * @param text - The newly generated content to search in
 * @param corrections - Corrections with anchor text to find
 * @param similarityThreshold - Minimum similarity to consider a match (default: 0.8)
 * @returns Array of matches with position and similarity score
 */
export function findAnchorMatches(
  text: string,
  corrections: CorrectionWithAnchor[],
  similarityThreshold = 0.8
): AnchorMatch[] {
  const matches: AnchorMatch[] = [];
  const normalizedText = normalizeText(text);

  for (const correction of corrections) {
    const normalizedAnchor = normalizeText(correction.anchorText);
    const anchorLength = normalizedAnchor.length;

    // Skip if anchor is too short for meaningful matching
    if (anchorLength < 10) {
      continue;
    }

    // Sliding window: check windows of similar size to anchor
    const windowSizes = [
      anchorLength,
      Math.floor(anchorLength * 0.9),
      Math.floor(anchorLength * 1.1),
    ];

    let bestMatch: AnchorMatch | null = null;

    for (const windowSize of windowSizes) {
      if (windowSize < 10) continue;

      // Slide window through text
      for (let pos = 0; pos <= normalizedText.length - windowSize; pos += 5) {
        const window = normalizedText.slice(pos, pos + windowSize);
        const sim = similarity(normalizedAnchor, window);

        if (sim >= similarityThreshold && (!bestMatch || sim > bestMatch.similarity)) {
          // Find actual position in original (non-normalized) text
          const originalPosition = findOriginalPosition(text, pos, window);

          bestMatch = {
            correctionId: correction.id,
            matchedText: text.slice(
              originalPosition,
              originalPosition + correction.anchorText.length
            ),
            similarity: sim,
            position: originalPosition,
          };
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
    }
  }

  return matches;
}

/**
 * Find the position in the original text corresponding to normalized position.
 * Accounts for whitespace normalization differences.
 */
function findOriginalPosition(originalText: string, normalizedPos: number, window: string): number {
  // Simple approach: find first occurrence of window start in original
  const windowStart = window.slice(0, Math.min(20, window.length));
  const normalizedOriginal = normalizeText(originalText);

  // Find the character position mapping
  let normalizedIndex = 0;
  let originalIndex = 0;
  const normalizedLower = normalizeText(originalText);

  while (normalizedIndex < normalizedPos && originalIndex < originalText.length) {
    const origChar = originalText[originalIndex].toLowerCase();
    const normChar = normalizedLower[normalizedIndex];

    if (/\s/.test(originalText[originalIndex])) {
      // In original, consume all whitespace for one normalized space
      while (originalIndex < originalText.length && /\s/.test(originalText[originalIndex])) {
        originalIndex++;
      }
      normalizedIndex++; // One space in normalized
    } else if (origChar === normChar) {
      originalIndex++;
      normalizedIndex++;
    } else {
      originalIndex++;
    }
  }

  return originalIndex;
}

/**
 * Check if a correction's anchor text exists exactly in the content.
 * Used as a quick check before fuzzy matching.
 */
export function hasExactMatch(text: string, anchorText: string): boolean {
  return normalizeText(text).includes(normalizeText(anchorText));
}
