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

/** Source category for filtering searches */
export type LegalSourceCategory =
  | 'legislation'
  | 'jurisprudence'
  | 'doctrine'
  | 'registries'
  | 'professions'
  | 'regulators'
  | 'eu_legislation'
  | 'eu_courts'
  | 'eu_agencies'
  | 'international_courts'
  | 'international_treaties'
  | 'academic';

/** Research depth controls which tiers are searched */
export type SearchDepth = 'quick' | 'standard' | 'deep';

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
  /** Restrict results to authoritative legal sources (backward compatible) */
  legalOnly?: boolean;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Specific source categories to search (overrides legalOnly) */
  sourceCategories?: LegalSourceCategory[];
  /** User-facing source types that map to categories */
  sourceTypes?: Array<'legislation' | 'jurisprudence' | 'doctrine' | 'comparative'>;
  /** Search depth: quick (tier1), standard (tier1+tier2), deep (all) */
  depth?: SearchDepth;
  /** Timeout in milliseconds (default: 30000). Prevents hanging requests. */
  timeoutMs?: number;
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

/** Maps user-facing source types to internal categories */
export const SOURCE_TYPE_MAPPING: Record<string, LegalSourceCategory[]> = {
  legislation: ['legislation'],
  jurisprudence: ['jurisprudence', 'eu_courts'],
  doctrine: ['doctrine', 'academic'],
  comparative: [
    'eu_legislation',
    'eu_courts',
    'eu_agencies',
    'international_courts',
    'international_treaties',
  ],
};

/**
 * Authoritative legal sources organized by category and authority tier.
 * Tier 1: Official/primary sources (always searched)
 * Tier 2: Secondary/aggregator sources (searched in standard/deep mode)
 *
 * Total: 60 domains across 12 categories
 * Last verified: 2026-01-21
 */
const LEGAL_SOURCES: Record<LegalSourceCategory, { tier1: string[]; tier2: string[] }> = {
  // ===========================================================================
  // ROMANIAN SOURCES
  // ===========================================================================

  legislation: {
    tier1: [
      'legislatie.just.ro', // Official consolidated legislation
      'monitoruloficial.ro', // Official Gazette (laws enter force here)
      'cdep.ro', // Chamber of Deputies
      'senat.ro', // Senate
    ],
    tier2: [
      'lege5.ro', // Commercial aggregator
      'gov.ro', // Government portal
    ],
  },

  jurisprudence: {
    tier1: [
      'scj.ro', // Supreme Court (ÎCCJ)
      'rejust.ro', // Official jurisprudence DB (35M+ decisions)
      'ccr.ro', // Constitutional Court
    ],
    tier2: [
      'rolii.ro', // Free legal info (15M+ decisions)
      'just.ro', // Ministry of Justice portal
      'portal.just.ro',
      'legislatie.just.ro', // Legislation portal (CCR decisions)
    ],
  },

  doctrine: {
    tier1: [
      'juridice.ro', // Established legal commentary
      'pandectele.ro', // Academic journal (since 1921)
    ],
    tier2: [
      'universuljuridic.ro', // Legal publisher/portal
    ],
  },

  registries: {
    tier1: [
      'onrc.ro', // Trade registry (ONRC)
      'portal.onrc.ro', // ONRC online services
      'ancpi.ro', // Land/cadastre registry
      'bpi.ro', // Insolvency bulletin
      'osim.ro', // IP registry (patents, trademarks)
    ],
    tier2: [],
  },

  professions: {
    tier1: [
      'unbr.ro', // Bar association (UNBR)
      'uniuneanotarilor.ro', // Notaries union
      'executori.ro', // Enforcement officers
      'cmediere.ro', // Mediation council
      'csm1909.ro', // Superior Council of Magistracy
    ],
    tier2: [],
  },

  regulators: {
    tier1: [
      'anaf.ro', // Tax authority
      'bnr.ro', // Central bank
      'asfromania.ro', // Financial supervisor
      'dataprotection.ro', // DPA (GDPR)
      'avp.ro', // Ombudsman
    ],
    tier2: [],
  },

  // ===========================================================================
  // EU SOURCES
  // ===========================================================================

  eu_legislation: {
    tier1: [
      'eur-lex.europa.eu', // Official EU law
    ],
    tier2: [],
  },

  eu_courts: {
    tier1: [
      'curia.europa.eu', // CJEU
      'hudoc.echr.coe.int', // ECHR case law database
    ],
    tier2: [
      'venice.coe.int', // Venice Commission (constitutional)
      'fra.europa.eu', // Fundamental Rights Agency
    ],
  },

  eu_agencies: {
    tier1: [
      'competition-cases.ec.europa.eu', // Competition decisions
      'edpb.europa.eu', // Data protection board
      'euipo.europa.eu', // IP office (trademarks, designs)
    ],
    tier2: [
      'eba.europa.eu', // Banking authority
      'esma.europa.eu', // Securities authority
      'echa.europa.eu', // Chemicals agency
    ],
  },

  // ===========================================================================
  // INTERNATIONAL SOURCES
  // ===========================================================================

  international_courts: {
    tier1: [
      'icj-cij.org', // International Court of Justice
      'icsid.worldbank.org', // Investment arbitration
      'pca-cpa.org', // Permanent Court of Arbitration
    ],
    tier2: [
      'italaw.com', // Investment treaty arbitration
      'icc-cpi.int', // International Criminal Court
      'wto.org', // WTO disputes
    ],
  },

  international_treaties: {
    tier1: [
      'treaties.un.org', // UN treaties
      'uncitral.un.org', // Commercial law (UNCITRAL)
      'hcch.net', // Private international law
      'normlex.ilo.org', // Labor standards (ILO)
    ],
    tier2: [
      'wipolex.wipo.int', // IP treaties
      'unilex.info', // CISG case law
    ],
  },

  // ===========================================================================
  // ACADEMIC SOURCES (free only)
  // ===========================================================================

  academic: {
    tier1: [
      'ssrn.com', // Preprints
      'papers.ssrn.com', // SSRN papers
      'scholar.google.com', // Academic search
    ],
    tier2: [
      'ceeol.com', // Central/Eastern European journals
      'doaj.org', // Open access directory
      'worldlii.org', // Free legal information
      'opil.ouplaw.com', // Max Planck Encyclopedia (now OA)
    ],
  },
};

/**
 * Get domains for specified categories and depth.
 */
function getDomainsForSearch(
  categories: LegalSourceCategory[],
  depth: SearchDepth = 'standard'
): string[] {
  const domains: Set<string> = new Set();

  for (const category of categories) {
    const source = LEGAL_SOURCES[category];
    if (!source) continue;

    // Always include tier1
    source.tier1.forEach((d) => domains.add(d));

    // Include tier2 for standard and deep
    if (depth !== 'quick') {
      source.tier2.forEach((d) => domains.add(d));
    }
  }

  return Array.from(domains);
}

/**
 * Get all legal domains (for backward compatibility with legalOnly).
 * Returns tier1 from core Romanian + EU categories.
 */
function getAllLegalDomains(): string[] {
  const coreCategories: LegalSourceCategory[] = [
    'legislation',
    'jurisprudence',
    'doctrine',
    'eu_legislation',
    'eu_courts',
  ];
  return getDomainsForSearch(coreCategories, 'quick');
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for search requests (30 seconds) */
const DEFAULT_SEARCH_TIMEOUT_MS = 30000;

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
    logger.info('WebSearchService initialized', {
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      envVarSet: !!process.env.BRAVE_SEARCH_API_KEY,
    });
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
   * @param options - Search options (legalOnly, sourceTypes, sourceCategories, depth, maxResults)
   * @returns Search results with title, URL, and snippet
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResponse> {
    const {
      legalOnly = false,
      maxResults = 5,
      sourceCategories,
      sourceTypes,
      depth = 'standard',
      timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS,
    } = options;

    if (!this.isConfigured()) {
      logger.warn('Web search called but BRAVE_SEARCH_API_KEY not configured');
      return { query, results: [] };
    }

    // Respect Brave's rate limit
    await this.throttle();

    // Determine which domains to search
    let domains: string[] = [];

    if (sourceCategories && sourceCategories.length > 0) {
      // Direct category specification takes priority
      domains = getDomainsForSearch(sourceCategories, depth);
    } else if (sourceTypes && sourceTypes.length > 0) {
      // Map user-facing source types to categories
      const categories: LegalSourceCategory[] = [];
      for (const sourceType of sourceTypes) {
        const mapped = SOURCE_TYPE_MAPPING[sourceType];
        if (mapped) {
          categories.push(...mapped);
        }
      }
      domains = getDomainsForSearch([...new Set(categories)], depth);
    } else if (legalOnly) {
      // Backward compatibility: legalOnly uses core legal domains
      domains = getAllLegalDomains();
    }

    // Build the query - add site filters if domains specified
    let searchQuery = query;
    if (domains.length > 0) {
      // Brave has query length limits, so cap at 20 domains per search
      const limitedDomains = domains.slice(0, 20);
      const siteFilter = limitedDomains.map((d) => `site:${d}`).join(' OR ');
      searchQuery = `${query} (${siteFilter})`;

      if (domains.length > 20) {
        logger.warn('Domain list truncated to 20 for search query', {
          totalDomains: domains.length,
          usedDomains: 20,
        });
      }
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
      sourceTypes,
      sourceCategories,
      depth,
      domainCount: domains.length,
      maxResults,
      timeoutMs,
    });

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          'X-Subscription-Token': this.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

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
      // Clear timeout on error too
      clearTimeout(timeoutId);

      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Web search timed out', {
          query,
          timeoutMs,
        });
        throw new Error(`Search timed out after ${timeoutMs}ms`);
      }

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
