/**
 * Fuzzy Search Utility for Romanian Legal Templates
 * Handles diacritics normalization and relevance scoring
 */

// ============================================================================
// Types
// ============================================================================

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: string[]; // Which fields matched
}

export interface SearchableTemplate {
  name: string;
  description: string;
  keywords: string[];
  category: string;
}

// ============================================================================
// Diacritics Normalization
// ============================================================================

/**
 * Romanian diacritics mapping for normalization
 * Maps accented characters to their base ASCII equivalents
 */
const DIACRITICS_MAP: Record<string, string> = {
  // Romanian specific
  ă: 'a',
  â: 'a',
  î: 'i',
  ș: 's',
  ş: 's', // Alternative encoding
  ț: 't',
  ţ: 't', // Alternative encoding
  // Uppercase variants
  Ă: 'a',
  Â: 'a',
  Î: 'i',
  Ș: 's',
  Ş: 's',
  Ț: 't',
  Ţ: 't',
};

/**
 * Normalize Romanian diacritics for matching
 * Converts all diacritics to their base ASCII equivalents
 *
 * @param text - Input text with potential diacritics
 * @returns Normalized text without diacritics, lowercase
 *
 * @example
 * normalizeDiacritics("Întâmpinare") // "intampinare"
 * normalizeDiacritics("Cerere de APEL") // "cerere de apel"
 */
export function normalizeDiacritics(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .split('')
    .map((char) => DIACRITICS_MAP[char] || char)
    .join('');
}

// ============================================================================
// Scoring Configuration
// ============================================================================

/**
 * Weights for different match types
 * Higher weight = more relevant
 */
const SCORE_WEIGHTS = {
  // Exact match bonuses
  exactName: 100,
  exactKeyword: 80,
  exactCategory: 60,

  // Partial match base scores
  nameMatch: 50,
  keywordMatch: 30,
  categoryMatch: 20,
  descriptionMatch: 10,

  // Position bonus (match at start of word)
  wordStartBonus: 15,

  // Length penalty divisor (longer queries should match more)
  lengthFactor: 0.1,
};

// ============================================================================
// Search Implementation
// ============================================================================

/**
 * Check if query matches text and return match details
 */
function matchText(
  normalizedQuery: string,
  text: string
): { matches: boolean; isExact: boolean; isWordStart: boolean } {
  const normalizedText = normalizeDiacritics(text);

  if (!normalizedText || !normalizedQuery) {
    return { matches: false, isExact: false, isWordStart: false };
  }

  const isExact = normalizedText === normalizedQuery;
  const matches = normalizedText.includes(normalizedQuery);

  // Check if match is at the start of a word
  let isWordStart = false;
  if (matches) {
    const index = normalizedText.indexOf(normalizedQuery);
    isWordStart = index === 0 || /\s/.test(normalizedText[index - 1]);
  }

  return { matches, isExact, isWordStart };
}

/**
 * Calculate relevance score for a template against a query
 */
function calculateScore<T extends SearchableTemplate>(
  template: T,
  normalizedQuery: string
): { score: number; matches: string[] } {
  let score = 0;
  const matches: string[] = [];

  // Check name
  const nameMatch = matchText(normalizedQuery, template.name);
  if (nameMatch.matches) {
    matches.push('name');
    if (nameMatch.isExact) {
      score += SCORE_WEIGHTS.exactName;
    } else {
      score += SCORE_WEIGHTS.nameMatch;
      if (nameMatch.isWordStart) {
        score += SCORE_WEIGHTS.wordStartBonus;
      }
    }
  }

  // Check keywords
  for (const keyword of template.keywords) {
    const keywordMatch = matchText(normalizedQuery, keyword);
    if (keywordMatch.matches) {
      if (!matches.includes('keywords')) {
        matches.push('keywords');
      }
      if (keywordMatch.isExact) {
        score += SCORE_WEIGHTS.exactKeyword;
      } else {
        score += SCORE_WEIGHTS.keywordMatch;
        if (keywordMatch.isWordStart) {
          score += SCORE_WEIGHTS.wordStartBonus;
        }
      }
    }
  }

  // Check category
  const categoryMatch = matchText(normalizedQuery, template.category);
  if (categoryMatch.matches) {
    matches.push('category');
    if (categoryMatch.isExact) {
      score += SCORE_WEIGHTS.exactCategory;
    } else {
      score += SCORE_WEIGHTS.categoryMatch;
      if (categoryMatch.isWordStart) {
        score += SCORE_WEIGHTS.wordStartBonus;
      }
    }
  }

  // Check description
  const descriptionMatch = matchText(normalizedQuery, template.description);
  if (descriptionMatch.matches) {
    matches.push('description');
    score += SCORE_WEIGHTS.descriptionMatch;
    if (descriptionMatch.isWordStart) {
      score += SCORE_WEIGHTS.wordStartBonus;
    }
  }

  // Apply length factor - longer queries that match are more specific
  if (score > 0) {
    score += normalizedQuery.length * SCORE_WEIGHTS.lengthFactor;
  }

  return { score, matches };
}

/**
 * Search templates with fuzzy matching and relevance scoring
 *
 * @param templates - Array of templates to search
 * @param query - Search query (handles diacritics automatically)
 * @returns Sorted array of search results with scores
 *
 * @example
 * const results = searchTemplates(templates, "apel");
 * // Returns CF-10, CF-11, CF-14 sorted by relevance
 *
 * @example
 * const results = searchTemplates(templates, "intampinare");
 * // Finds "Întâmpinare" even without diacritics
 */
export function searchTemplates<T extends SearchableTemplate>(
  templates: T[],
  query: string
): SearchResult<T>[] {
  // Handle empty or whitespace-only queries
  if (!query || !query.trim()) {
    return [];
  }

  const normalizedQuery = normalizeDiacritics(query.trim());

  // Skip very short queries that would match everything
  if (normalizedQuery.length === 0) {
    return [];
  }

  const results: SearchResult<T>[] = [];

  for (const template of templates) {
    const { score, matches } = calculateScore(template, normalizedQuery);

    if (score > 0) {
      results.push({
        item: template,
        score,
        matches,
      });
    }
  }

  // Sort by descending score
  results.sort((a, b) => b.score - a.score);

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Highlight matching text in a string
 * Useful for displaying search results with highlighted matches
 *
 * @param text - Original text
 * @param query - Search query to highlight
 * @returns Array of segments with highlight flag
 */
export function highlightMatches(
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> {
  if (!query || !query.trim() || !text) {
    return [{ text, highlight: false }];
  }

  const normalizedQuery = normalizeDiacritics(query.trim());
  const normalizedText = normalizeDiacritics(text);

  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) {
    return [{ text, highlight: false }];
  }

  const segments: Array<{ text: string; highlight: boolean }> = [];

  if (index > 0) {
    segments.push({
      text: text.substring(0, index),
      highlight: false,
    });
  }

  segments.push({
    text: text.substring(index, index + normalizedQuery.length),
    highlight: true,
  });

  if (index + normalizedQuery.length < text.length) {
    segments.push({
      text: text.substring(index + normalizedQuery.length),
      highlight: false,
    });
  }

  return segments;
}
