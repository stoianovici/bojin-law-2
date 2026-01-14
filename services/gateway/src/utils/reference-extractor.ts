/**
 * Reference Extractor Utility
 * Gateway Service
 *
 * Extracts Romanian court file numbers (dosar nr) from email text.
 * Used for matching emails to court cases based on reference numbers.
 */

// ============================================================================
// Regular Expressions for Romanian Court File Numbers
// ============================================================================

/**
 * Romanian Court File Number Patterns
 *
 * Standard format: XXXX/Y/YYYY or XXXXX/Y/YYYY
 * - XXXX or XXXXX = case number (1-5 digits)
 * - Y = court section/division (1-3 digits)
 * - YYYY = year
 *
 * Variations:
 * - "Dosar nr. 1234/3/2024"
 * - "dosar 1234/3/2024"
 * - "nr. dosar 1234/3/2024"
 * - "dosarul 1234/3/2024"
 * - "dosarul cu numărul 1234/3/2024" (formal notification style)
 * - Just "1234/3/2024" (in context)
 * - "nr. 12345/P/2024" (with letter section like P for penal)
 * - "1234/3/2024/a1" (with appeal suffix - extract base number)
 */
const COURT_FILE_PATTERNS = [
  // With explicit "dosar" prefix (supports letter sections like P for penal)
  // Also handles "dosarul cu numărul" formal style
  /(?:dosar(?:ul)?(?:\s+cu\s+num[aă]rul)?|nr\.?\s*dosar)\s*(?:nr\.?\s*)?(\d{1,5}\s*\/\s*(?:\d{1,3}|[A-Z])\s*\/\s*\d{4})/gi,
  // With just "nr." or "numărul" prefix followed by pattern
  /(?<!\d)(?:nr\.?|num[aă]rul)\s*(\d{1,5}\s*\/\s*(?:\d{1,3}|[A-Z])\s*\/\s*\d{4})/gi,
  // Standalone pattern - allows /a1, /a2 etc. suffixes (appeal markers)
  // Negative lookahead only prevents /digit (another file number component)
  /(?<![/\d])(\d{1,5}\s*\/\s*(?:\d{1,3}|[A-Z])\s*\/\s*\d{4})(?!\/\d)/gi,
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Extract court file numbers from text
 *
 * @param text - Text to search (email subject, body, etc.)
 * @returns Array of extracted court file numbers (normalized format)
 *
 * @example
 * extractCourtFileNumbers("Referitor la dosar nr. 1234/3/2024")
 * // Returns: ["1234/3/2024"]
 *
 * @example
 * extractCourtFileNumbers("Dosarul 5678/P/2023 si dosar 9999/2/2024")
 * // Returns: ["5678/P/2023", "9999/2/2024"]
 */
export function extractCourtFileNumbers(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const seenNormalized = new Set<string>();
  const results: string[] = [];

  for (const pattern of COURT_FILE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const normalized = normalizeCourtFileNumber(value);

      if (normalized && !seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        results.push(normalized);
      }
    }
  }

  return results;
}

/**
 * Normalize court file number to canonical form: "XXXXX/Y/YYYY" or "XXXXX/P/YYYY"
 *
 * Removes extra whitespace and standardizes format for comparison.
 *
 * @param raw - Raw court file number string
 * @returns Normalized court file number
 *
 * @example
 * normalizeCourtFileNumber("1234 / 3 / 2024")
 * // Returns: "1234/3/2024"
 *
 * @example
 * normalizeCourtFileNumber("  5678/P/2023  ")
 * // Returns: "5678/P/2023"
 */
export function normalizeCourtFileNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  // Remove all spaces
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();

  // Match pattern: digits/digits-or-letter/year
  const match = cleaned.match(/(\d{1,5})\/(\d{1,3}|[A-Z])\/(\d{4})/);

  if (match) {
    const [, caseNum, section, year] = match;
    return `${caseNum}/${section}/${year}`;
  }

  // If no match, return cleaned version (may still be useful)
  return cleaned;
}
