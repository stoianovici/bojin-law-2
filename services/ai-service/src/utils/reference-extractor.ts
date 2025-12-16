/**
 * Reference Extractor Utility
 * OPS-029: AI Email Classification Service
 *
 * Extracts Romanian legal reference numbers and other identifiers from text.
 * Used for matching emails to cases based on reference numbers.
 */

// ============================================================================
// Types
// ============================================================================

export type ReferenceType = 'court_file' | 'contract' | 'invoice' | 'unknown';

export interface ExtractedReference {
  type: ReferenceType;
  value: string; // Original matched text
  normalized: string; // Canonical form for comparison
  position: number; // Position in text
}

// ============================================================================
// Regular Expressions
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
 * - Just "1234/3/2024" (in context)
 */
const COURT_FILE_PATTERNS = [
  // With explicit "dosar" prefix
  /(?:dosar(?:ul)?|nr\.?\s*dosar)\s*(?:nr\.?\s*)?(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})/gi,
  // With just "nr." prefix followed by pattern
  /(?<!\d)nr\.?\s*(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})/gi,
  // Standalone pattern (with word boundaries to avoid false matches)
  /(?<![/\d])(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})(?![/\d])/gi,
];

/**
 * Contract Number Patterns
 *
 * Examples:
 * - "Contract nr. 123/2024"
 * - "Contract #123"
 * - "Contractul nr. 456/2024"
 * - "Acord nr. 789/2024"
 */
const CONTRACT_PATTERNS = [
  /(?:contract(?:ul)?|acord(?:ul)?)\s*(?:nr\.?|#)\s*(\d{1,6}(?:\s*\/\s*\d{4})?)/gi,
];

/**
 * Invoice Number Patterns
 *
 * Examples:
 * - "Factura 123456"
 * - "Factura nr. 123456"
 * - "Fact. 123456"
 */
const INVOICE_PATTERNS = [/(?:factur[aă]|fact\.?)\s*(?:nr\.?\s*)?(\d{4,10})/gi];

// ============================================================================
// Functions
// ============================================================================

/**
 * Extract all reference numbers from text
 *
 * @param text - Text to search (email subject, body, etc.)
 * @returns Array of extracted references
 */
export function extractReferences(text: string): ExtractedReference[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const references: ExtractedReference[] = [];
  const seenNormalized = new Set<string>();

  // Extract court files
  for (const pattern of COURT_FILE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const normalized = normalizeCourtFile(value);

      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        references.push({
          type: 'court_file',
          value: match[0].trim(),
          normalized,
          position: match.index,
        });
      }
    }
  }

  // Extract contracts
  for (const pattern of CONTRACT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const normalized = normalizeContract(value);

      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        references.push({
          type: 'contract',
          value: match[0].trim(),
          normalized,
          position: match.index,
        });
      }
    }
  }

  // Extract invoices
  for (const pattern of INVOICE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const normalized = normalizeInvoice(value);

      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        references.push({
          type: 'invoice',
          value: match[0].trim(),
          normalized,
          position: match.index,
        });
      }
    }
  }

  // Sort by position in text
  return references.sort((a, b) => a.position - b.position);
}

/**
 * Extract only court file references
 */
export function extractCourtFiles(text: string): ExtractedReference[] {
  return extractReferences(text).filter((r) => r.type === 'court_file');
}

/**
 * Check if text contains a specific reference number
 *
 * @param text - Text to search
 * @param reference - Reference to find (normalized or raw)
 * @returns True if reference is found
 */
export function containsReference(text: string, reference: string): boolean {
  const extracted = extractReferences(text);
  const normalizedTarget = normalizeAny(reference);

  return extracted.some((r) => r.normalized === normalizedTarget);
}

/**
 * Match extracted references against a list of case reference numbers
 *
 * @param extracted - References extracted from email
 * @param caseReferences - Reference numbers stored on cases
 * @returns Matching references
 */
export function matchReferences(
  extracted: ExtractedReference[],
  caseReferences: string[]
): ExtractedReference[] {
  const normalizedCaseRefs = new Set(caseReferences.map((r) => normalizeAny(r)));

  return extracted.filter((r) => normalizedCaseRefs.has(r.normalized));
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize court file number to canonical form: "XXXXX/Y/YYYY"
 */
function normalizeCourtFile(value: string): string {
  // Remove all spaces and convert to uppercase
  const cleaned = value.replace(/\s+/g, '').toUpperCase();

  // Match pattern: digits/digits/year
  const match = cleaned.match(/(\d{1,5})\/(\d{1,3})\/(\d{4})/);

  if (match) {
    const [, caseNum, section, year] = match;
    return `${caseNum}/${section}/${year}`;
  }

  return cleaned;
}

/**
 * Normalize contract number
 */
function normalizeContract(value: string): string {
  const cleaned = value.replace(/\s+/g, '').toUpperCase();
  // Remove any leading/trailing punctuation
  return cleaned.replace(/^[#\-]+|[#\-]+$/g, '');
}

/**
 * Normalize invoice number
 */
function normalizeInvoice(value: string): string {
  // Keep only digits
  return value.replace(/\D/g, '');
}

/**
 * Normalize any reference (try to detect type)
 */
function normalizeAny(value: string): string {
  const cleaned = value.trim();

  // Check if it looks like a court file (X/Y/YYYY pattern)
  if (/\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4}/.test(cleaned)) {
    return normalizeCourtFile(cleaned);
  }

  // Default: remove spaces and uppercase
  return cleaned.replace(/\s+/g, '').toUpperCase();
}

/**
 * Get domain from email address
 */
export function getEmailDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Check if an email address matches a domain pattern
 *
 * @param email - Email address to check
 * @param domains - Array of domain patterns (e.g., ["just.ro", "tribunalul-*.ro"])
 */
export function matchesDomain(email: string, domains: string[]): boolean {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) return false;

  return domains.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern.toLowerCase().replace(/\./g, '\\.').replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(emailDomain);
  });
}
