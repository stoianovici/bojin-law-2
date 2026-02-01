/**
 * Citation Validation Utilities
 *
 * Detects potential hallucinated citations in AI-generated legal documents.
 * Used for post-generation validation and logging.
 *
 * This utility helps identify:
 * 1. Orphaned references (refs without matching sources)
 * 2. Suspicious patterns that suggest fabricated sources
 * 3. Citation integrity issues
 */

import logger from './logger';

// ============================================================================
// Types
// ============================================================================

export interface Citation {
  /** Reference ID (e.g., "src1") */
  id: string;
  /** Citation type */
  type?: 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative' | 'other';
  /** Full citation text */
  text: string;
  /** Author if doctrine */
  author?: string;
  /** URL if provided */
  url?: string;
}

export interface ValidationResult {
  /** Overall validity */
  isValid: boolean;
  /** Total references found in text */
  totalRefs: number;
  /** Total sources defined */
  totalSources: number;
  /** References without matching sources */
  orphanedRefs: string[];
  /** Sources never referenced */
  unusedSources: string[];
  /** Sources flagged as potentially suspicious */
  suspiciousSources: SuspiciousSource[];
  /** Validation warnings */
  warnings: string[];
}

export interface SuspiciousSource {
  /** Source ID */
  id: string;
  /** Citation text */
  text: string;
  /** Reason for suspicion */
  reason: string;
  /** Confidence level (0-1) */
  confidence: number;
}

// ============================================================================
// Suspicious Pattern Detection
// ============================================================================

/**
 * Patterns that suggest a citation might be fabricated.
 */
const SUSPICIOUS_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
  confidence: number;
}> = [
  // Round decision numbers
  {
    pattern: /\b(Decizia|Hotărârea|Sentința)\s+(?:nr\.?\s*)?(\d{3}0|1000|2000|3000|5000|10000)\b/i,
    reason: 'Număr de decizie rotund (poate fi fabricat)',
    confidence: 0.6,
  },
  // Generic dates (January 1, June 1, etc.)
  {
    pattern:
      /\b(1|01)\s*(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s*(19\d{2}|20[0-2]\d)\b/i,
    reason: 'Dată generică (prima zi a lunii)',
    confidence: 0.5,
  },
  // Year 2000 exactly
  {
    pattern: /\b(din|în|anul)\s+2000\b/i,
    reason: 'Anul 2000 exact (dată suspectă)',
    confidence: 0.4,
  },
  // Fabricated author patterns (single generic names)
  {
    pattern: /\bauthor="(Ion|Maria|Gheorghe|Elena|Vasile)"\b/i,
    reason: 'Nume de autor generic fără prenume complet',
    confidence: 0.3,
  },
  // Suspiciously round page numbers
  {
    pattern: /\bp\.\s*(100|200|500|1000)\b/,
    reason: 'Număr de pagină rotund',
    confidence: 0.4,
  },
  // Non-existent article numbers (very high)
  {
    pattern: /\bart\.\s*(9999|1234|5678)\b/i,
    reason: 'Număr de articol neobișnuit',
    confidence: 0.7,
  },
  // Fake ISBN patterns
  {
    pattern: /\bISBN\s*(000|111|123|999)/i,
    reason: 'ISBN cu pattern repetitiv',
    confidence: 0.8,
  },
  // Generic publisher names
  {
    pattern: /\bEd\.\s*(Juridică|Legală|Drept)\s*$/i,
    reason: 'Denumire de editură prea generică',
    confidence: 0.3,
  },
];

/**
 * Check if a citation text contains suspicious patterns.
 *
 * @param text - Citation text to check
 * @returns Array of detected suspicious patterns
 */
export function detectSuspiciousPatterns(
  text: string
): Array<{ reason: string; confidence: number }> {
  const matches: Array<{ reason: string; confidence: number }> = [];

  for (const { pattern, reason, confidence } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      matches.push({ reason, confidence });
    }
  }

  return matches;
}

// ============================================================================
// Citation Extraction
// ============================================================================

/**
 * Extract all <ref id="..."/> references from HTML content.
 *
 * @param html - HTML content
 * @returns Array of reference IDs
 */
export function extractRefs(html: string): string[] {
  const refPattern = /<ref\s+id=["']([^"']+)["']\s*\/?>/gi;
  const refs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = refPattern.exec(html)) !== null) {
    if (!refs.includes(match[1])) {
      refs.push(match[1]);
    }
  }

  return refs;
}

/**
 * Extract all <source> definitions from HTML content.
 *
 * @param html - HTML content
 * @returns Array of Citation objects
 */
export function extractSources(html: string): Citation[] {
  const sourcePattern =
    /<source\s+id=["']([^"']+)["'](?:\s+type=["']([^"']+)["'])?(?:\s+author=["']([^"']+)["'])?(?:\s+url=["']([^"']+)["'])?[^>]*>([^<]*)<\/source>/gi;
  const sources: Citation[] = [];
  let match: RegExpExecArray | null;

  while ((match = sourcePattern.exec(html)) !== null) {
    sources.push({
      id: match[1],
      type: match[2] as Citation['type'],
      author: match[3],
      url: match[4],
      text: match[5].trim(),
    });
  }

  return sources;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate citations in an HTML document.
 *
 * Checks for:
 * 1. Orphaned references (refs without sources)
 * 2. Unused sources (sources never referenced)
 * 3. Suspicious patterns suggesting fabrication
 *
 * @param html - HTML content to validate
 * @returns ValidationResult with detailed findings
 */
export function validateCitations(html: string): ValidationResult {
  const refs = extractRefs(html);
  const sources = extractSources(html);

  const sourceIds = sources.map((s) => s.id);
  const orphanedRefs = refs.filter((r) => !sourceIds.includes(r));
  const unusedSources = sourceIds.filter((s) => !refs.includes(s));

  const suspiciousSources: SuspiciousSource[] = [];
  const warnings: string[] = [];

  // Check each source for suspicious patterns
  for (const source of sources) {
    const patterns = detectSuspiciousPatterns(source.text);

    if (patterns.length > 0) {
      // Calculate combined confidence (max of individual confidences)
      const maxConfidence = Math.max(...patterns.map((p) => p.confidence));
      const reasons = patterns.map((p) => p.reason).join('; ');

      suspiciousSources.push({
        id: source.id,
        text: source.text,
        reason: reasons,
        confidence: maxConfidence,
      });

      if (maxConfidence >= 0.6) {
        warnings.push(
          `Sursă potențial fabricată [${source.id}]: ${reasons} (încredere: ${Math.round(maxConfidence * 100)}%)`
        );
      }
    }
  }

  // Add warnings for orphaned refs
  if (orphanedRefs.length > 0) {
    warnings.push(`Referințe fără sursă definită: ${orphanedRefs.join(', ')}`);
  }

  // Add warnings for unused sources
  if (unusedSources.length > 0) {
    warnings.push(`Surse definite dar nefolosite: ${unusedSources.join(', ')}`);
  }

  const isValid =
    orphanedRefs.length === 0 && suspiciousSources.filter((s) => s.confidence >= 0.6).length === 0;

  return {
    isValid,
    totalRefs: refs.length,
    totalSources: sources.length,
    orphanedRefs,
    unusedSources,
    suspiciousSources,
    warnings,
  };
}

/**
 * Validate and log citation issues.
 * Useful for debugging and monitoring.
 *
 * @param html - HTML content to validate
 * @param context - Additional context for logging
 * @returns ValidationResult
 */
export function validateAndLog(
  html: string,
  context: { userId?: string; documentId?: string } = {}
): ValidationResult {
  const result = validateCitations(html);

  if (!result.isValid || result.warnings.length > 0) {
    logger.warn('Citation validation issues detected', {
      ...context,
      totalRefs: result.totalRefs,
      totalSources: result.totalSources,
      orphanedRefs: result.orphanedRefs,
      suspiciousCount: result.suspiciousSources.length,
      warnings: result.warnings,
    });
  }

  return result;
}

/**
 * Quick check if citations are valid (no orphans, no high-confidence suspicious sources).
 *
 * @param html - HTML content
 * @returns True if citations are valid
 */
export function areCitationsValid(html: string): boolean {
  const result = validateCitations(html);
  return result.isValid;
}

/**
 * Get citation stats for a document.
 *
 * @param html - HTML content
 * @returns Stats object
 */
export function getCitationStats(html: string): {
  totalRefs: number;
  totalSources: number;
  citationDensity: number;
  typeBreakdown: Record<string, number>;
} {
  const sources = extractSources(html);
  const refs = extractRefs(html);

  // Estimate word count (rough)
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const wordCount = textContent.split(' ').filter((w) => w.length > 2).length;

  // Calculate citation density (refs per 100 words)
  const citationDensity = wordCount > 0 ? (refs.length / wordCount) * 100 : 0;

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const source of sources) {
    const type = source.type || 'other';
    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
  }

  return {
    totalRefs: refs.length,
    totalSources: sources.length,
    citationDensity: Math.round(citationDensity * 10) / 10,
    typeBreakdown,
  };
}
