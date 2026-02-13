/**
 * Jurisprudence Submit Handler
 *
 * Implements the submit_jurisprudence_notes tool for capturing research output.
 * Features: provenance verification, citation validation, deduplication.
 */

import { ToolHandler } from './ai-client.service';
import {
  JurisprudenceCitation,
  JurisprudenceResearchOutput,
  JURISPRUDENCE_CONSTRAINTS,
} from './jurisprudence-agent.types';
import {
  safeValidateSubmitInput,
  isValidJurisprudenceUrl,
  extractDomain,
  normalizeUrl,
  normalizeDateToIso,
  isoToRomanianDate,
} from './jurisprudence-agent.validation';
import { RedisUrlTracker } from './jurisprudence-url-tracker';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Validation statistics for provenance tracking */
interface CitationValidationStats {
  total: number;
  valid: number;
  skippedMissingFields: number;
  skippedDuplicates: number;
  skippedInvalidDomain: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract structured error information for logging.
 */
function extractErrorInfo(error: unknown): {
  message: string;
  name: string;
  stack?: string;
  cause?: unknown;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: (error as Error & { cause?: unknown }).cause,
    };
  }
  return {
    message: String(error),
    name: 'UnknownError',
  };
}

// ============================================================================
// Citation Validation
// ============================================================================

/**
 * Validate and process citations with provenance checking.
 *
 * Provenance Tracking Strategy:
 * 1. URL Tracking: When search returns results, each URL is stored in Redis
 *    with its normalized form and metadata.
 * 2. Normalization: URLs are normalized before comparison to handle variations.
 * 3. Verification: Each citation URL is normalized and checked against tracked
 *    URLs. Citations are marked as `verified: true` if found.
 * 4. Domain Validation: URLs must match known jurisprudence source patterns.
 */
async function validateCitationsWithProvenance(
  citations: unknown[],
  trackedUrls: RedisUrlTracker,
  correlationId: string
): Promise<{ citations: JurisprudenceCitation[]; stats: CitationValidationStats }> {
  const validatedCitations: JurisprudenceCitation[] = [];
  const seenUrls = new Set<string>(); // For deduplication
  const stats: CitationValidationStats = {
    total: Math.min(citations.length, JURISPRUDENCE_CONSTRAINTS.MAX_CITATIONS),
    valid: 0,
    skippedMissingFields: 0,
    skippedDuplicates: 0,
    skippedInvalidDomain: 0,
  };

  for (const citation of citations.slice(0, JURISPRUDENCE_CONSTRAINTS.MAX_CITATIONS)) {
    const c = citation as Record<string, unknown>;

    // Validate required citation fields
    if (!c.id || !c.decisionNumber || !c.court || !c.url) {
      stats.skippedMissingFields++;
      logger.warn('[JurisprudenceAgent] Skipping citation with missing required fields', {
        correlationId,
        hasId: !!c.id,
        hasDecisionNumber: !!c.decisionNumber,
        hasCourt: !!c.court,
        hasUrl: !!c.url,
      });
      continue;
    }

    const url = String(c.url);
    const normalizedUrl = normalizeUrl(url);

    // Deduplication: skip if we've already seen this URL
    if (seenUrls.has(normalizedUrl)) {
      stats.skippedDuplicates++;
      logger.info('[JurisprudenceAgent] Skipping duplicate citation', {
        correlationId,
        url,
        citationId: c.id,
      });
      continue;
    }
    seenUrls.add(normalizedUrl);

    // 1. Check domain is from known jurisprudence sources
    if (!isValidJurisprudenceUrl(url)) {
      stats.skippedInvalidDomain++;
      logger.warn('[JurisprudenceAgent] Citation rejected: unknown domain', {
        correlationId,
        url,
        domain: extractDomain(url),
      });
      continue; // REJECT - unknown domain
    }

    // 2. Check if URL was in search results (provenance tracking with normalized URLs)
    const isTracked = await trackedUrls.has(normalizedUrl);
    if (!isTracked) {
      const trackedUrlCount = await trackedUrls.size();
      logger.warn(
        '[JurisprudenceAgent] Citation URL not from search results (flagged as unverified)',
        {
          correlationId,
          url,
          normalizedUrl,
          trackedUrlCount,
        }
      );
    }

    // 3. Normalize and validate dates
    let date = '';
    let dateFormatted = '';

    const rawDate = c.date ? String(c.date) : '';
    const rawDateFormatted = c.dateFormatted ? String(c.dateFormatted) : '';

    // Try ISO date first
    if (rawDate) {
      const normalized = normalizeDateToIso(rawDate);
      if (normalized) {
        date = normalized;
        dateFormatted = isoToRomanianDate(normalized);
      } else {
        logger.warn('[JurisprudenceAgent] Could not normalize ISO date, trying Romanian format', {
          correlationId,
          date: rawDate,
          citationId: c.id,
        });
      }
    }

    // If ISO failed but Romanian format was provided, try that
    if (!date && rawDateFormatted) {
      const normalized = normalizeDateToIso(rawDateFormatted);
      if (normalized) {
        date = normalized;
        dateFormatted = isoToRomanianDate(normalized);
      } else {
        logger.warn('[JurisprudenceAgent] Could not normalize Romanian date', {
          correlationId,
          dateFormatted: rawDateFormatted,
          citationId: c.id,
        });
      }
    }

    // If we still don't have a date but have a raw formatted one, use it as-is
    if (!dateFormatted && rawDateFormatted) {
      dateFormatted = rawDateFormatted;
    }

    validatedCitations.push({
      id: String(c.id),
      decisionType: (c.decisionType as 'decizie' | 'sentință' | 'încheiere') || 'decizie',
      decisionNumber: String(c.decisionNumber),
      court: String(c.court),
      courtFull: String(c.courtFull || c.court),
      section: c.section ? String(c.section) : undefined,
      date,
      dateFormatted,
      url,
      caseNumber: c.caseNumber ? String(c.caseNumber) : undefined,
      summary: String(c.summary || '').slice(0, JURISPRUDENCE_CONSTRAINTS.MAX_SUMMARY_LENGTH),
      relevance: String(c.relevance || ''),
      officialGazette: c.officialGazette ? String(c.officialGazette) : undefined,
      verified: isTracked,
    });
    stats.valid++;
  }

  return { citations: validatedCitations, stats };
}

/**
 * Validate the jurisprudence output from the agent.
 */
async function validateJurisprudenceOutput(
  input: Record<string, unknown>,
  trackedUrls: RedisUrlTracker,
  correlationId: string
): Promise<JurisprudenceResearchOutput> {
  // Validate with Zod schema
  const validationResult = safeValidateSubmitInput(input);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Validare input eșuată: ${issues}`);
  }

  const { topic, summary, citations, analysis, gaps } = validationResult.data;

  // Validate citations with provenance checking (async - checks Redis)
  const { citations: validatedCitations, stats } = await validateCitationsWithProvenance(
    citations,
    trackedUrls,
    correlationId
  );

  // Log provenance statistics
  const verifiedCount = validatedCitations.filter((c) => c.verified).length;
  const unverifiedCount = validatedCitations.filter((c) => !c.verified).length;

  logger.info('[JurisprudenceAgent] Citation provenance summary', {
    correlationId,
    inputCitations: stats.total,
    validCitations: stats.valid,
    verified: verifiedCount,
    unverified: unverifiedCount,
    skippedMissingFields: stats.skippedMissingFields,
    skippedDuplicates: stats.skippedDuplicates,
    skippedInvalidDomain: stats.skippedInvalidDomain,
  });

  return {
    topic: topic.trim(),
    generatedAt: new Date().toISOString(),
    summary: summary.slice(0, JURISPRUDENCE_CONSTRAINTS.MAX_EXECUTIVE_SUMMARY_LENGTH),
    citations: validatedCitations,
    analysis: analysis.slice(0, JURISPRUDENCE_CONSTRAINTS.MAX_ANALYSIS_LENGTH),
    gaps: gaps.map((g) => String(g)),
    metadata: {
      searchCount: 0, // Will be filled by service
      sourcesSearched: [],
      durationMs: 0,
      costEur: 0,
    },
  };
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create the submit handler with closure-based output capture.
 */
export function createJurisprudenceSubmitHandler(
  trackedUrls: RedisUrlTracker,
  correlationId: string
): {
  handler: ToolHandler;
  getOutput: () => JurisprudenceResearchOutput | null;
} {
  let capturedOutput: JurisprudenceResearchOutput | null = null;

  return {
    handler: async (input: Record<string, unknown>): Promise<string> => {
      try {
        capturedOutput = await validateJurisprudenceOutput(input, trackedUrls, correlationId);

        logger.info('[JurisprudenceAgent] Notes captured via submit_jurisprudence_notes tool', {
          correlationId,
          topic: capturedOutput.topic,
          citationCount: capturedOutput.citations.length,
          verifiedCount: capturedOutput.citations.filter((c) => c.verified).length,
          gapCount: capturedOutput.gaps.length,
        });

        return `Nota jurisprudențială a fost primită cu succes.

**Rezumat:**
- Subiect: ${capturedOutput.topic}
- Citări: ${capturedOutput.citations.length} (${capturedOutput.citations.filter((c) => c.verified).length} verificate)
- Lipsuri documentate: ${capturedOutput.gaps.length}

Cercetarea este completă.`;
      } catch (error) {
        const errorInfo = extractErrorInfo(error);
        logger.error('[JurisprudenceAgent] Output validation failed', {
          correlationId,
          error: errorInfo.message,
          errorType: errorInfo.name,
          errorCause: errorInfo.cause,
          input: JSON.stringify(input).slice(0, 500),
        });
        throw new Error(`Validare eșuată: ${errorInfo.message}`);
      }
    },
    getOutput: () => capturedOutput,
  };
}
