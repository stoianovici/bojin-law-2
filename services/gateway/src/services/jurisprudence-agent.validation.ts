/**
 * Jurisprudence Agent Validation Schemas
 *
 * Zod schemas for validating inputs to jurisprudence agent tools.
 * Provides URL pattern validation for jurisprudence sources.
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Maximum query length */
const MAX_QUERY_LENGTH = 500;

/** Maximum results per search */
const MAX_RESULTS = 15;

/** Valid year range for jurisprudence searches */
const MIN_YEAR = 1990;
const MAX_YEAR = new Date().getFullYear() + 5;

/** Maximum citations per submission */
const MAX_CITATIONS = 20;

/** Maximum summary length */
const MAX_SUMMARY_LENGTH = 500;

/** Maximum analysis length */
const MAX_ANALYSIS_LENGTH = 3000;

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Valid jurisprudence source URL patterns.
 * These are authoritative Romanian legal databases.
 */
export const VALID_URL_PATTERNS = [
  /^https?:\/\/(www\.)?rejust\.ro\//,
  /^https?:\/\/(www\.)?scj\.ro\//,
  /^https?:\/\/(www\.)?ccr\.ro\//,
  /^https?:\/\/(www\.)?rolii\.ro\//,
  /^https?:\/\/(www\.)?portal\.just\.ro\//,
  /^https?:\/\/(www\.)?just\.ro\//,
  /^https?:\/\/(www\.)?legislatie\.just\.ro\//,
  /^https?:\/\/(www\.)?juridice\.ro\//,
  /^https?:\/\/(www\.)?lege5\.ro\//, // Commercial aggregator with court decisions
  /^https?:\/\/(www\.)?infodosar\.ro\//, // Court decision database
  /^https?:\/\/(www\.)?avocatnet\.ro\//, // Legal portal with jurisprudence
] as const;

/**
 * Check if a URL is from a valid jurisprudence source.
 * Used to reject completely fabricated citations.
 */
export function isValidJurisprudenceUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return VALID_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extract domain from URL for logging.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'invalid-url';
  }
}

/**
 * Decode percent-encoded characters in a URL path for normalization.
 * This ensures %2F and / are treated as equivalent.
 */
function decodeUrlPath(path: string): string {
  try {
    // Decode percent-encoded characters
    return decodeURIComponent(path);
  } catch {
    // If decoding fails (malformed encoding), return original
    return path;
  }
}

/**
 * Normalize a URL for comparison.
 * Removes:
 * - www. prefix
 * - Trailing slashes
 * - Common tracking parameters (utm_*, fbclid, etc.)
 * - Hash fragments
 * Also decodes percent-encoded characters for consistent comparison.
 * Makes comparison more forgiving for provenance tracking.
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url);

    // Normalize hostname (lowercase is already handled by URL constructor)
    parsed.hostname = parsed.hostname.replace(/^www\./, '');

    // Decode and normalize the pathname
    // This ensures %2F and / are treated equivalently
    const decodedPath = decodeUrlPath(parsed.pathname);

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'ref',
      'source',
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));

    // Sort remaining params for consistent comparison
    parsed.searchParams.sort();

    // Remove hash
    parsed.hash = '';

    // Build normalized URL with decoded path
    let normalized = `${parsed.protocol}//${parsed.hostname}${decodedPath}`;

    // Add sorted query string if present
    const queryString = parsed.searchParams.toString();
    if (queryString) {
      normalized += `?${queryString}`;
    }

    // Remove trailing slash (except for root)
    if (normalized.endsWith('/') && decodedPath !== '/') {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    // Return original if parsing fails
    return url;
  }
}

/**
 * Check if two URLs are equivalent after normalization.
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

// ============================================================================
// Date Validation
// ============================================================================

/** ISO date format: YYYY-MM-DD */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Romanian date format: DD.MM.YYYY */
const RO_DATE_REGEX = /^\d{2}\.\d{2}\.\d{4}$/;

/**
 * Validate ISO date format and ensure it's a valid date.
 */
export function isValidIsoDate(date: string): boolean {
  if (!ISO_DATE_REGEX.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
}

/**
 * Validate Romanian date format.
 */
export function isValidRomanianDate(date: string): boolean {
  if (!RO_DATE_REGEX.test(date)) return false;
  const [day, month, year] = date.split('.').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
}

/**
 * Try to parse and normalize a date to ISO format.
 * Handles multiple formats:
 * - ISO: YYYY-MM-DD
 * - Romanian: DD.MM.YYYY
 * - Slash: DD/MM/YYYY
 * - Partial: YYYY or MM/YYYY
 * Returns null if date is unparseable.
 */
export function normalizeDateToIso(date: string): string | null {
  if (!date || typeof date !== 'string') return null;

  const trimmed = date.trim();

  // Already valid ISO
  if (isValidIsoDate(trimmed)) {
    return trimmed;
  }

  // Romanian format: DD.MM.YYYY
  if (RO_DATE_REGEX.test(trimmed)) {
    const [day, month, year] = trimmed.split('.').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Slash format: DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch.map(Number);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Year only: YYYY (assume Jan 1)
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year >= MIN_YEAR && year <= MAX_YEAR) {
      return `${year}-01-01`;
    }
  }

  return null;
}

/**
 * Convert ISO date to Romanian display format.
 */
export function isoToRomanianDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

// ============================================================================
// Tool Input Schemas
// ============================================================================

/**
 * Court level enum values.
 */
export const CourtLevelSchema = z.enum(['ÎCCJ', 'CCR', 'CA', 'Tribunal', 'Judecătorie']);

/**
 * Schema for search_jurisprudence tool input.
 */
export const SearchJurisprudenceInputSchema = z.object({
  query: z
    .string()
    .min(3, 'Termenii de căutare trebuie să aibă minim 3 caractere')
    .max(MAX_QUERY_LENGTH, `Termenii de căutare sunt prea lungi (max ${MAX_QUERY_LENGTH})`),
  courts: z.array(CourtLevelSchema).optional(),
  yearRange: z
    .object({
      from: z
        .number()
        .int()
        .min(MIN_YEAR, `Anul de început minim: ${MIN_YEAR}`)
        .max(MAX_YEAR, `Anul de început maxim: ${MAX_YEAR}`),
      to: z
        .number()
        .int()
        .min(MIN_YEAR, `Anul de sfârșit minim: ${MIN_YEAR}`)
        .max(MAX_YEAR, `Anul de sfârșit maxim: ${MAX_YEAR}`),
    })
    .optional()
    .refine((data) => !data || data.from <= data.to, {
      message: 'Anul de început trebuie să fie <= anul de sfârșit',
    }),
  maxResults: z
    .number()
    .int()
    .min(1, 'Minim 1 rezultat')
    .max(MAX_RESULTS, `Maxim ${MAX_RESULTS} rezultate`)
    .optional(),
});

/**
 * Decision type enum values.
 */
export const DecisionTypeSchema = z.enum(['decizie', 'sentință', 'încheiere']);

/**
 * Schema for individual citation in submit_jurisprudence_notes.
 */
export const JurisprudenceCitationInputSchema = z.object({
  id: z.string().min(1, 'ID obligatoriu'),
  decisionType: DecisionTypeSchema.optional().default('decizie'),
  decisionNumber: z.string().min(1, 'Numărul deciziei obligatoriu'),
  court: z.string().min(1, 'Instanța obligatorie'),
  courtFull: z.string().optional(),
  section: z.string().optional(),
  date: z.string().optional(),
  dateFormatted: z.string().optional(),
  url: z.string().url('URL invalid'),
  caseNumber: z.string().optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH, `Rezumatul prea lung (max ${MAX_SUMMARY_LENGTH})`),
  relevance: z.string().min(1, 'Relevanța obligatorie'),
  officialGazette: z.string().optional(),
});

/**
 * Schema for submit_jurisprudence_notes tool input.
 */
export const SubmitJurisprudenceNotesInputSchema = z.object({
  topic: z.string().min(1, 'Subiectul obligatoriu').max(500, 'Subiectul prea lung'),
  summary: z.string().min(1, 'Rezumatul obligatoriu').max(2000, 'Rezumatul prea lung'),
  citations: z
    .array(JurisprudenceCitationInputSchema)
    .max(MAX_CITATIONS, `Maxim ${MAX_CITATIONS} citări`),
  analysis: z
    .string()
    .min(1, 'Analiza obligatorie')
    .max(MAX_ANALYSIS_LENGTH, `Analiza prea lungă (max ${MAX_ANALYSIS_LENGTH})`),
  gaps: z.array(z.string()).max(20, 'Maxim 20 lipsuri'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SearchJurisprudenceInputValidated = z.infer<typeof SearchJurisprudenceInputSchema>;
export type JurisprudenceCitationInputValidated = z.infer<typeof JurisprudenceCitationInputSchema>;
export type SubmitJurisprudenceNotesInputValidated = z.infer<
  typeof SubmitJurisprudenceNotesInputSchema
>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate search input and return typed result or throw.
 */
export function validateSearchInput(
  input: Record<string, unknown>
): SearchJurisprudenceInputValidated {
  return SearchJurisprudenceInputSchema.parse(input);
}

/**
 * Validate submit input and return typed result or throw.
 */
export function validateSubmitInput(
  input: Record<string, unknown>
): SubmitJurisprudenceNotesInputValidated {
  return SubmitJurisprudenceNotesInputSchema.parse(input);
}

/**
 * Safe validation that returns result with success/error info.
 */
export function safeValidateSearchInput(input: Record<string, unknown>) {
  return SearchJurisprudenceInputSchema.safeParse(input);
}

export function safeValidateSubmitInput(input: Record<string, unknown>) {
  return SubmitJurisprudenceNotesInputSchema.safeParse(input);
}
