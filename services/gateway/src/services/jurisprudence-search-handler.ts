/**
 * Jurisprudence Search Handler
 *
 * Implements the search_jurisprudence tool for the jurisprudence research agent.
 * Features: caching, retry with backoff, provenance tracking.
 */

import { ToolHandler } from './ai-client.service';
import { webSearchService } from './web-search.service';
import { redis } from '@legal-platform/database';
import {
  JurisprudenceAgentContext,
  JurisprudenceProgressEvent,
  JURISPRUDENCE_CONSTRAINTS,
  CourtLevel,
} from './jurisprudence-agent.types';
import {
  validateSearchInput,
  extractDomain,
  normalizeUrl,
  isValidJurisprudenceUrl,
} from './jurisprudence-agent.validation';
import { RedisUrlTracker } from './jurisprudence-url-tracker';
import {
  isCircuitBreakerClosed,
  getCircuitOpenedAt,
  recordCircuitSuccess,
  recordCircuitFailure,
  CIRCUIT_BREAKER_CONFIG,
} from './jurisprudence-circuit-breaker';
import logger from '../utils/logger';
import { ZodError } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Maximum court terms in query to avoid overly long searches */
const MAX_COURT_TERMS = 3;

/** Redis key prefix for search cache */
const SEARCH_CACHE_PREFIX = 'jurisprudence:search:';

/** Redis retry configuration */
const REDIS_RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 100,
};

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

/**
 * Execute a Redis operation with retry logic.
 */
async function redisWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  correlationId?: string
): Promise<T | null> {
  for (let attempt = 1; attempt <= REDIS_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === REDIS_RETRY_CONFIG.maxRetries;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (isLastAttempt) {
        logger.error('[JurisprudenceAgent] Redis operation failed after retries', {
          correlationId,
          operation: operationName,
          attempts: attempt,
          error: errorMessage,
        });
        return null;
      }

      logger.warn('[JurisprudenceAgent] Redis operation failed, retrying', {
        correlationId,
        operation: operationName,
        attempt,
        error: errorMessage,
      });

      await new Promise((resolve) => setTimeout(resolve, REDIS_RETRY_CONFIG.baseDelayMs * attempt));
    }
  }
  return null;
}

async function redisGetWithRetry(key: string, correlationId?: string): Promise<string | null> {
  return redisWithRetry(() => redis.get(key), `GET ${key}`, correlationId);
}

async function redisSetexWithRetry(
  key: string,
  seconds: number,
  value: string,
  correlationId?: string
): Promise<boolean> {
  const result = await redisWithRetry(
    () => redis.setex(key, seconds, value),
    `SETEX ${key}`,
    correlationId
  );
  return result !== null;
}

/**
 * Generate a cache key for a search query.
 */
function generateSearchCacheKey(
  query: string,
  courts?: CourtLevel[],
  yearRange?: { from?: number; to?: number }
): string {
  const parts = [query];
  if (courts?.length) parts.push(`courts:${courts.sort().join(',')}`);
  if (yearRange?.from) parts.push(`from:${yearRange.from}`);
  if (yearRange?.to) parts.push(`to:${yearRange.to}`);
  return `${SEARCH_CACHE_PREFIX}${Buffer.from(parts.join('|')).toString('base64')}`;
}

/**
 * Romanian regions for court mapping.
 */
const ROMANIAN_REGIONS = [
  'București',
  'Alba Iulia',
  'Bacău',
  'Brașov',
  'Cluj',
  'Constanța',
  'Craiova',
  'Galați',
  'Iași',
  'Oradea',
  'Pitești',
  'Ploiești',
  'Suceava',
  'Târgu Mureș',
  'Timișoara',
] as const;

/**
 * Map court level to search terms.
 */
function mapCourtToSearchTerm(court: CourtLevel | string): string {
  const courtStr = String(court);

  // Check for regional CA
  for (const region of ROMANIAN_REGIONS) {
    if (courtStr.includes(`CA ${region}`) || courtStr.includes(`Curtea de Apel ${region}`)) {
      return `"Curtea de Apel ${region}"`;
    }
    if (courtStr.includes(`Tribunalul ${region}`)) {
      return `"Tribunalul ${region}"`;
    }
    if (courtStr.includes(`Judecătoria ${region}`)) {
      return `"Judecătoria ${region}"`;
    }
  }

  switch (court) {
    case 'ÎCCJ':
      return '"ÎCCJ" OR "Înalta Curte" OR site:scj.ro';
    case 'CCR':
      return '"CCR" OR "Curtea Constituțională" OR site:ccr.ro';
    case 'CA':
      return '"Curtea de Apel"';
    case 'Tribunal':
      return '"Tribunalul"';
    case 'Judecătorie':
      return '"Judecătoria"';
    default:
      return courtStr ? `"${courtStr}"` : '';
  }
}

/**
 * Extract source name from URL.
 */
function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    switch (hostname) {
      case 'rejust.ro':
        return 'ReJust (Portal oficial CSM)';
      case 'scj.ro':
        return 'Înalta Curte de Casație și Justiție';
      case 'ccr.ro':
        return 'Curtea Constituțională';
      case 'rolii.ro':
        return 'ROLII (Romanian Legal Information Institute)';
      case 'portal.just.ro':
        return 'Portal Just';
      case 'just.ro':
        return 'Ministerul Justiției';
      default:
        return hostname;
    }
  } catch {
    return 'Necunoscut';
  }
}

/**
 * Format search results as markdown for the agent.
 */
function formatSearchResults(
  query: string,
  results: Array<{ title: string; url: string; snippet: string }>
): string {
  if (results.length === 0) {
    return `## Rezultate căutare: "${query}"

Nu s-au găsit rezultate pentru această căutare.

**Sugestii:**
- Încearcă termeni mai generali
- Verifică ortografia
- Caută concepte juridice alternative`;
  }

  const sections: string[] = [];
  sections.push(`## Rezultate căutare: "${query}"`);
  sections.push('');
  sections.push(`Găsite ${results.length} rezultate:`);
  sections.push('');

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const source = extractSource(r.url);

    sections.push(`### [${i + 1}] ${r.title}`);
    sections.push(`**Sursă**: ${source}`);
    sections.push(`**URL**: ${r.url}`);
    sections.push('');
    sections.push(r.snippet || '*Fără rezumat disponibil*');
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  sections.push(
    '**IMPORTANT**: Extrage numărul deciziei, instanța, data și secția din fiecare rezultat relevant.'
  );
  sections.push(
    'Dacă aceste informații nu sunt clare din snippet, documentează URL-ul pentru referință.'
  );

  return sections.join('\n');
}

/**
 * Format error result for the agent.
 */
function formatErrorResult(code: string, message: string): string {
  return `[EROARE_CĂUTARE]
Cod: ${code}
Mesaj: ${message}
[/EROARE_CĂUTARE]

Poți încerca din nou cu alți termeni de căutare.`;
}

/**
 * Filter search results to only include valid jurisprudence domains.
 * This prevents off-topic results from web search from being tracked/returned.
 */
function filterValidJurisprudenceResults(
  results: Array<{ title: string; url: string; snippet: string }>,
  correlationId?: string
): Array<{ title: string; url: string; snippet: string }> {
  const filtered = results.filter((r) => isValidJurisprudenceUrl(r.url));

  const removedCount = results.length - filtered.length;
  if (removedCount > 0) {
    logger.info('[JurisprudenceAgent] Filtered non-jurisprudence URLs from results', {
      correlationId,
      originalCount: results.length,
      filteredCount: filtered.length,
      removedCount,
    });
  }

  return filtered;
}

// ============================================================================
// Search Execution
// ============================================================================

/**
 * Execute search with retry, exponential backoff, and circuit breaker.
 */
async function executeSearchWithRetry(
  enhancedQuery: string,
  limit: number,
  correlationId: string,
  onRetry?: (attempt: number, maxRetries: number) => void
): Promise<{ query: string; results: Array<{ title: string; url: string; snippet: string }> }> {
  // Check circuit breaker before attempting
  const circuitClosed = await isCircuitBreakerClosed();
  if (!circuitClosed) {
    const openedAt = await getCircuitOpenedAt();
    const resetInMs = CIRCUIT_BREAKER_CONFIG.resetTimeoutSeconds * 1000 - (Date.now() - openedAt);
    logger.warn('[JurisprudenceAgent] Circuit breaker open, rejecting search request', {
      correlationId,
      resetInMs: Math.max(0, resetInMs),
    });
    throw new Error(
      `Serviciul de căutare temporar indisponibil. Încearcă din nou în ${Math.ceil(Math.max(0, resetInMs) / 1000)} secunde.`
    );
  }

  const maxRetries = JURISPRUDENCE_CONSTRAINTS.MAX_RETRY_ATTEMPTS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await webSearchService.search(enhancedQuery, {
        sourceCategories: ['jurisprudence'],
        depth: 'deep',
        maxResults: limit,
        timeoutMs: JURISPRUDENCE_CONSTRAINTS.SEARCH_TIMEOUT_MS,
      });

      // Success - record and return
      await recordCircuitSuccess();
      return response;
    } catch (error) {
      const errorInfo = extractErrorInfo(error);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Record failure for circuit breaker
      await recordCircuitFailure();

      if (attempt < maxRetries) {
        // Check if circuit just opened
        const stillClosed = await isCircuitBreakerClosed();
        if (!stillClosed) {
          logger.warn('[JurisprudenceAgent] Circuit breaker opened during retries', {
            correlationId,
            attempt,
          });
          break;
        }

        const backoffMs =
          JURISPRUDENCE_CONSTRAINTS.RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        logger.warn('[JurisprudenceAgent] Search failed, retrying', {
          correlationId,
          attempt,
          maxRetries,
          backoffMs,
          error: errorInfo.message,
          errorType: errorInfo.name,
        });

        onRetry?.(attempt, maxRetries);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error('Search failed after all retries');
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create the search_jurisprudence tool handler.
 */
export function createSearchJurisprudenceHandler(
  ctx: JurisprudenceAgentContext,
  trackSearch: () => void,
  trackedUrls: RedisUrlTracker,
  onProgress?: (event: JurisprudenceProgressEvent) => void
): ToolHandler {
  return async (input: Record<string, unknown>): Promise<string> => {
    // Validate input with Zod
    let validatedInput;
    try {
      validatedInput = validateSearchInput(input);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        logger.warn('[JurisprudenceAgent] Invalid search input', {
          correlationId: ctx.correlationId,
          errors: issues,
        });
        return formatErrorResult('INVALID_INPUT', `Parametri invalizi: ${issues}`);
      }
      throw error;
    }

    const { query, courts, yearRange, maxResults } = validatedInput;
    const limit = Math.min(maxResults ?? 10, 15);

    logger.info('[JurisprudenceAgent] search_jurisprudence called', {
      correlationId: ctx.correlationId,
      query,
      courts,
      yearRange,
      maxResults: limit,
    });

    // Track this search
    trackSearch();

    try {
      // Check cache first (with retry)
      const cacheKey = generateSearchCacheKey(query, courts, yearRange);
      const cached = await redisGetWithRetry(cacheKey, ctx.correlationId);

      if (cached) {
        try {
          const cachedResponse = JSON.parse(cached) as {
            query: string;
            results: Array<{ title: string; url: string; snippet: string }>;
            cachedAt: string;
          };

          // Validate cache structure
          if (!cachedResponse.results || !Array.isArray(cachedResponse.results)) {
            throw new Error('Invalid cache structure');
          }

          // Validate each result has required fields
          for (const result of cachedResponse.results) {
            if (
              !result.url ||
              typeof result.url !== 'string' ||
              !result.title ||
              typeof result.title !== 'string'
            ) {
              throw new Error('Invalid cache result structure: missing url or title');
            }
          }

          // Filter to only valid jurisprudence domains
          const filteredCachedResults = filterValidJurisprudenceResults(
            cachedResponse.results,
            ctx.correlationId
          );

          logger.info('[JurisprudenceAgent] Cache hit', {
            correlationId: ctx.correlationId,
            query,
            cachedAt: cachedResponse.cachedAt,
            resultCount: filteredCachedResults.length,
          });

          onProgress?.({
            type: 'cache_hit',
            message: 'Rezultate din cache',
            data: { cachedAt: cachedResponse.cachedAt },
          });

          // Track URLs from cached results (async, batched)
          for (const result of filteredCachedResults) {
            const normalized = normalizeUrl(result.url);
            await trackedUrls.set(normalized, {
              url: result.url,
              normalizedUrl: normalized,
              title: result.title,
              source: extractDomain(result.url),
              searchQuery: query,
            });
          }
          // Batch sync to Redis for efficiency
          await trackedUrls.syncToRedis();

          return formatSearchResults(cachedResponse.query, filteredCachedResults);
        } catch (cacheError) {
          logger.warn('[JurisprudenceAgent] Cache corrupted, fetching fresh results', {
            correlationId: ctx.correlationId,
            cacheKey,
            error: cacheError instanceof Error ? cacheError.message : String(cacheError),
          });
        }
      }

      // Build enhanced query with court/year filters
      let enhancedQuery = query;

      if (courts && courts.length > 0) {
        const limitedCourts = courts.slice(0, MAX_COURT_TERMS);
        const courtTerms = limitedCourts.map((c) => mapCourtToSearchTerm(c)).join(' OR ');
        enhancedQuery = `${query} (${courtTerms})`;

        if (courts.length > MAX_COURT_TERMS) {
          logger.info('[JurisprudenceAgent] Court filter limited', {
            correlationId: ctx.correlationId,
            requested: courts.length,
            used: MAX_COURT_TERMS,
          });
        }
      }

      if (yearRange) {
        if (yearRange.from && yearRange.to) {
          enhancedQuery = `${enhancedQuery} ${yearRange.from}..${yearRange.to}`;
        } else if (yearRange.from) {
          enhancedQuery = `${enhancedQuery} after:${yearRange.from}`;
        } else if (yearRange.to) {
          enhancedQuery = `${enhancedQuery} before:${yearRange.to}`;
        }
      }

      // Execute search with retry
      const response = await executeSearchWithRetry(
        enhancedQuery,
        limit,
        ctx.correlationId,
        (attempt, maxRetries) => {
          onProgress?.({
            type: 'search_retry',
            message: `Reîncercare căutare (${attempt}/${maxRetries})...`,
            data: { retryAttempt: attempt, maxRetries },
          });
        }
      );

      // Filter to only valid jurisprudence domains before caching
      const filteredResults = filterValidJurisprudenceResults(response.results, ctx.correlationId);

      // Cache successful filtered results (with retry, non-blocking)
      await redisSetexWithRetry(
        cacheKey,
        JURISPRUDENCE_CONSTRAINTS.SEARCH_CACHE_TTL_SECONDS,
        JSON.stringify({
          query: response.query,
          results: filteredResults,
          cachedAt: new Date().toISOString(),
        }),
        ctx.correlationId
      );

      // Track URLs for provenance verification
      for (const result of filteredResults) {
        const normalized = normalizeUrl(result.url);
        await trackedUrls.set(normalized, {
          url: result.url,
          normalizedUrl: normalized,
          title: result.title,
          source: extractDomain(result.url),
          searchQuery: query,
        });
      }
      await trackedUrls.syncToRedis();

      const trackedUrlsTotal = await trackedUrls.size();
      logger.info('[JurisprudenceAgent] search completed', {
        correlationId: ctx.correlationId,
        originalQuery: query,
        enhancedQuery,
        resultCount: filteredResults.length,
        trackedUrlsTotal,
      });

      return formatSearchResults(response.query, filteredResults);
    } catch (error) {
      const errorInfo = extractErrorInfo(error);
      logger.error('[JurisprudenceAgent] search failed', {
        correlationId: ctx.correlationId,
        query,
        error: errorInfo.message,
        errorType: errorInfo.name,
        errorCause: errorInfo.cause,
      });

      return formatErrorResult(
        'SEARCH_FAILED',
        `Căutarea a eșuat: ${errorInfo.message || 'Eroare necunoscută'}`
      );
    }
  };
}
