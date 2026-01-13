/**
 * Web Search Service
 * Provides web search capabilities for AI research features.
 *
 * Uses Brave Search API for web search queries with optional
 * domain filtering for legal sources.
 */

import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  results: SearchResult[];
  query: string;
}

export interface WebSearchOptions {
  /** Restrict results to authoritative legal sources */
  legalOnly?: boolean;
  /** Maximum number of results to return */
  maxResults?: number;
}

/** Brave Search API response structure */
interface BraveSearchApiResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description?: string;
    }>;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Authoritative legal domains for Romanian and EU law.
 * Used when legalOnly option is enabled.
 */
const LEGAL_DOMAINS = [
  // Romanian legal sources
  'legislatie.just.ro',
  'scj.ro', // Supreme Court (Înalta Curte de Casație și Justiție)
  'just.ro',
  'juridice.ro',
  'lege5.ro',
  'portal.just.ro',
  'gov.ro',
  'cdep.ro', // Chamber of Deputies
  'senat.ro', // Senate
  // EU legal sources
  'eur-lex.europa.eu',
  'curia.europa.eu',
  'echr.coe.int', // European Court of Human Rights
];

// ============================================================================
// Service
// ============================================================================

export class WebSearchService {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';
  private lastRequestTime = 0;
  private minRequestIntervalMs = 50; // Brave paid tier: 20 req/sec

  constructor() {
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY || '';
  }

  /**
   * Throttle requests to respect Brave's rate limit (1 req/sec on free tier).
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestIntervalMs) {
      const waitTime = this.minRequestIntervalMs - timeSinceLastRequest;
      logger.debug('Throttling web search request', { waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Check if the service is properly configured.
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search the web using Brave Search API.
   *
   * @param query - Search query
   * @param options - Search options (legalOnly, maxResults)
   * @returns Search results with title, URL, and snippet
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResponse> {
    const { legalOnly = false, maxResults = 5 } = options;

    if (!this.isConfigured()) {
      logger.warn('Web search called but BRAVE_SEARCH_API_KEY not configured');
      return { query, results: [] };
    }

    // Respect Brave's rate limit
    await this.throttle();

    // Build the query - add site filters for legal-only searches
    let searchQuery = query;
    if (legalOnly) {
      const siteFilter = LEGAL_DOMAINS.map((d) => `site:${d}`).join(' OR ');
      searchQuery = `${query} (${siteFilter})`;
    }

    const params = new URLSearchParams({
      q: searchQuery,
      count: String(Math.min(maxResults, 20)), // Brave API max is 20
      // Note: Brave doesn't support Romanian (ro) as ui_lang, using en-US
      // Results will still include Romanian content based on query terms
    });

    logger.debug('Executing web search', {
      originalQuery: query,
      searchQuery,
      legalOnly,
      maxResults,
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          'X-Subscription-Token': this.apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Brave Search API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Search API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as BraveSearchApiResponse;

      const results: SearchResult[] =
        data.web?.results?.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description || '',
        })) || [];

      logger.info('Web search completed', {
        query,
        legalOnly,
        resultCount: results.length,
      });

      return { query, results };
    } catch (error) {
      logger.error('Web search failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Format search results for inclusion in AI context.
   * Creates a readable text summary of search results.
   */
  formatResultsForAI(response: WebSearchResponse): string {
    if (response.results.length === 0) {
      return 'Nu s-au găsit rezultate pentru această căutare.';
    }

    return response.results
      .map((r, i) => `[${i + 1}] **${r.title}**\n${r.url}\n${r.snippet}`)
      .join('\n\n');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const webSearchService = new WebSearchService();
