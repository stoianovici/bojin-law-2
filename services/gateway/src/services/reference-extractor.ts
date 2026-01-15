/**
 * Reference Extractor Service
 *
 * Extracts Romanian court reference numbers (dosar) from email content.
 * Supports standard court file number formats used in the Romanian judicial system.
 */

// ============================================================================
// Types
// ============================================================================

export interface ExtractedReference {
  /** The reference number (e.g., "123/45/2025") */
  value: string;
  /** Where the reference was found */
  source: 'SUBJECT' | 'BODY';
  /** Character position where found */
  position: number;
}

// ============================================================================
// Patterns
// ============================================================================

/**
 * Standard court file number pattern: 123/45/2025 or 1234/567/2024
 * Format: digits/digits/year (4 digits)
 */
const STANDARD_PATTERN = /\b(\d{1,6}\/\d{1,4}\/\d{4})\b/g;

/**
 * Court file number with "dosar" prefix
 * Matches: "dosar 123/45/2025", "dosar nr. 123/45/2025", "dosar nr 123/45/2025"
 */
const DOSAR_PATTERN = /dosar(?:\s+nr\.?)?\s*[:\s]*(\d{1,6}\/\d{1,4}\/\d{4})/gi;

/**
 * Court file number with "nr." prefix
 * Matches: "nr. 123/45/2025", "nr 123/45/2025"
 */
const NR_PATTERN = /\bnr\.?\s*(\d{1,6}\/\d{1,4}\/\d{4})/gi;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extracts court reference numbers from email subject and body.
 *
 * @param subject - Email subject line
 * @param body - Email body content
 * @returns Array of extracted references, deduplicated by value and source
 */
export function extractReferences(
  subject: string,
  body: string
): ExtractedReference[] {
  const references: ExtractedReference[] = [];
  const seen = new Set<string>();

  // Extract from subject
  const subjectRefs = extractFromText(subject, 'SUBJECT');
  for (const ref of subjectRefs) {
    const key = `${ref.value}:${ref.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      references.push(ref);
    }
  }

  // Extract from body
  const bodyRefs = extractFromText(body, 'BODY');
  for (const ref of bodyRefs) {
    const key = `${ref.value}:${ref.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      references.push(ref);
    }
  }

  return references;
}

/**
 * Normalizes a reference number for comparison.
 * Converts to lowercase and removes extra whitespace.
 *
 * @param ref - The reference string to normalize
 * @returns Normalized reference string
 */
export function normalizeReference(ref: string): string {
  return ref.toLowerCase().replace(/\s+/g, '').trim();
}

/**
 * Checks if any extracted references match the case reference numbers.
 *
 * @param references - Array of extracted reference values
 * @param caseReferenceNumbers - Array of case reference numbers to match against
 * @returns True if any reference matches
 */
export function matchesCase(
  references: string[],
  caseReferenceNumbers: string[]
): boolean {
  if (references.length === 0 || caseReferenceNumbers.length === 0) {
    return false;
  }

  const normalizedCaseRefs = new Set(
    caseReferenceNumbers.map(normalizeReference)
  );

  for (const ref of references) {
    const normalizedRef = normalizeReference(ref);
    if (normalizedCaseRefs.has(normalizedRef)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts references from a single text string using all patterns.
 *
 * @param text - Text to search for references
 * @param source - Source identifier for the extracted references
 * @returns Array of extracted references
 */
function extractFromText(
  text: string,
  source: 'SUBJECT' | 'BODY'
): ExtractedReference[] {
  if (!text) {
    return [];
  }

  const references: ExtractedReference[] = [];
  const seenPositions = new Set<number>();

  // Extract with dosar prefix pattern (highest priority)
  extractWithPattern(text, DOSAR_PATTERN, source, references, seenPositions);

  // Extract with nr. prefix pattern
  extractWithPattern(text, NR_PATTERN, source, references, seenPositions);

  // Extract standard pattern (catches any remaining)
  extractWithPattern(text, STANDARD_PATTERN, source, references, seenPositions);

  return references;
}

/**
 * Extracts references using a specific regex pattern.
 *
 * @param text - Text to search
 * @param pattern - Regex pattern with capture group for the reference
 * @param source - Source identifier
 * @param references - Array to push results into
 * @param seenPositions - Set of positions already extracted (to avoid duplicates)
 */
function extractWithPattern(
  text: string,
  pattern: RegExp,
  source: 'SUBJECT' | 'BODY',
  references: ExtractedReference[],
  seenPositions: Set<number>
): void {
  // Reset regex lastIndex for global patterns
  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const value = match[1];
    const position = match.index;

    // Skip if we've already extracted a reference at this position
    // (to avoid duplicates from overlapping patterns)
    if (seenPositions.has(position)) {
      continue;
    }

    // Find the actual position of the captured group within the match
    const valuePosition = text.indexOf(value, position);
    if (valuePosition !== -1 && !seenPositions.has(valuePosition)) {
      seenPositions.add(valuePosition);
      references.push({
        value,
        source,
        position: valuePosition,
      });
    }
  }
}
