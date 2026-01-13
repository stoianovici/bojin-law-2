/**
 * Search Service
 * Story 2.10: Basic AI Search Implementation - Tasks 8-12, 17-18
 *
 * Provides full-text search capabilities across cases and documents
 * using PostgreSQL full-text search.
 *
 * Features:
 * - Full-text search with PostgreSQL tsvector/tsquery
 * - Search filters (date range, case type, status, document type)
 * - Redis caching for search results
 * - Cache warming for popular searches
 *
 * References:
 * - PostgreSQL Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
 */

import { prisma, cacheManager } from '@legal-platform/database';
import { CaseType, CaseStatus } from '@legal-platform/database';
import { createHash } from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const SEARCH_RESULTS_LIMIT = parseInt(process.env.SEARCH_RESULTS_LIMIT || '20', 10);
const SEARCH_CACHE_PREFIX = 'search';
const SEARCH_CACHE_TTL = 300; // 5 minutes
const RECENT_SEARCHES_TTL = 900; // 15 minutes

// ============================================================================
// Types
// ============================================================================

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  caseIds?: string[];
  caseTypes?: CaseType[];
  caseStatuses?: CaseStatus[];
  documentTypes?: string[]; // MIME types
  clientIds?: string[];
}

export interface CaseSearchResult {
  type: 'case';
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  caseType: CaseType;
  clientName: string | null;
  openedDate: Date;
  score: number;
  highlight: string | null;
}

export interface DocumentSearchResult {
  type: 'document';
  id: string;
  fileName: string;
  fileType: string;
  clientName: string | null;
  uploadedAt: Date;
  score: number;
  highlight: string | null;
}

export interface ClientSearchResult {
  type: 'client';
  id: string;
  name: string;
  contactInfo: any;
  address: string | null;
  caseCount: number;
  score: number;
  highlight: string | null;
}

export type SearchResult = CaseSearchResult | DocumentSearchResult | ClientSearchResult;

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number; // milliseconds
  query: string;
}

// ============================================================================
// Search Service Class
// ============================================================================

export class SearchService {
  // ==========================================================================
  // Main Search Methods (Tasks 8, 9, 10, 11)
  // ==========================================================================

  /**
   * Main search method - performs full-text search across cases, documents, and clients
   *
   * @param query - Search query string
   * @param firmId - Firm UUID for data isolation
   * @param filters - Optional search filters
   * @param limit - Maximum results to return
   * @param offset - Pagination offset
   */
  async search(
    query: string,
    firmId: string,
    filters: SearchFilters = {},
    limit: number = SEARCH_RESULTS_LIMIT,
    offset: number = 0
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(firmId, query, filters);
    const cached = await cacheManager.get<SearchResponse>(`${SEARCH_CACHE_PREFIX}:${cacheKey}`);
    if (cached) {
      console.log(`[Search Service] Cache hit for query: "${query}"`);
      return {
        ...cached,
        searchTime: Date.now() - startTime,
      };
    }

    const results = await this.fullTextSearch(query, firmId, filters, limit, offset);

    const response: SearchResponse = {
      results,
      totalCount: results.length,
      searchTime: Date.now() - startTime,
      query,
    };

    // Cache results
    await cacheManager.set(`${SEARCH_CACHE_PREFIX}:${cacheKey}`, response, SEARCH_CACHE_TTL);

    console.log(
      `[Search Service] Search completed in ${response.searchTime}ms, ${results.length} results`
    );
    return response;
  }

  /**
   * Full-text search using PostgreSQL tsvector/tsquery (Task 9)
   */
  async fullTextSearch(
    query: string,
    firmId: string,
    filters: SearchFilters = {},
    limit: number = SEARCH_RESULTS_LIMIT,
    offset: number = 0
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Search cases
    const caseResults = await this.fullTextSearchCases(query, firmId, filters, limit, offset);
    results.push(...caseResults);

    // Search documents
    const docResults = await this.fullTextSearchDocuments(query, firmId, filters, limit, offset);
    results.push(...docResults);

    // Search clients
    const clientResults = await this.fullTextSearchClients(query, firmId, filters, limit, offset);
    results.push(...clientResults);

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Full-text search on cases
   */
  private async fullTextSearchCases(
    query: string,
    firmId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<CaseSearchResult[]> {
    // Build filter conditions as raw SQL parts
    const filterConditions = this.buildCaseFilterConditions(filters);

    // Build WHERE clause parts
    const whereParts: string[] = [];
    const params: any[] = [firmId, query, query, query, limit, offset];
    let paramIndex = 7;

    if (filterConditions.dateRange && filters.dateRange) {
      whereParts.push(
        `AND c.opened_date BETWEEN $${paramIndex}::timestamp AND $${paramIndex + 1}::timestamp`
      );
      params.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    if (filterConditions.caseTypes && filters.caseTypes) {
      whereParts.push(`AND c.type::text = ANY($${paramIndex}::text[])`);
      params.push(filters.caseTypes);
      paramIndex++;
    }

    if (filterConditions.caseStatuses && filters.caseStatuses) {
      whereParts.push(`AND c.status::text = ANY($${paramIndex}::text[])`);
      params.push(filters.caseStatuses);
      paramIndex++;
    }

    if (filterConditions.clientIds && filters.clientIds) {
      whereParts.push(`AND c.client_id = ANY($${paramIndex}::text[])`);
      params.push(filters.clientIds);
      paramIndex++;
    }

    const filterSql = whereParts.join(' ');

    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        case_number: string;
        title: string;
        description: string;
        status: string;
        type: string;
        client_name: string | null;
        opened_date: Date;
        rank: number;
        highlight: string | null;
      }>
    >(
      `SELECT
        c.id,
        c.case_number,
        c.title,
        c.description,
        c.status::text,
        c.type::text,
        cl.name as client_name,
        c.opened_date,
        ts_rank(
          to_tsvector('simple', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '') || ' ' || COALESCE(c.case_number, '') || ' ' || COALESCE(c.search_text, '') || ' ' || COALESCE(c.search_terms, '')),
          plainto_tsquery('simple', $2)
        ) as rank,
        ts_headline(
          'simple',
          COALESCE(c.title, '') || ' ' || COALESCE(c.description, ''),
          plainto_tsquery('simple', $3),
          'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
        ) as highlight
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.firm_id = $1
        AND to_tsvector('simple', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '') || ' ' || COALESCE(c.case_number, '') || ' ' || COALESCE(c.search_text, '') || ' ' || COALESCE(c.search_terms, ''))
            @@ plainto_tsquery('simple', $4)
        ${filterSql}
      ORDER BY rank DESC
      LIMIT $5
      OFFSET $6`,
      ...params
    );

    return results.map((r) => ({
      type: 'case' as const,
      id: r.id,
      caseNumber: r.case_number,
      title: r.title,
      description: r.description,
      status: r.status as CaseStatus,
      caseType: r.type as CaseType,
      clientName: r.client_name,
      openedDate: r.opened_date,
      score: r.rank,
      highlight: r.highlight,
    }));
  }

  /**
   * Full-text search on documents
   */
  private async fullTextSearchDocuments(
    query: string,
    firmId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<DocumentSearchResult[]> {
    const filterConditions = this.buildDocumentFilterConditions(filters);

    // Build WHERE clause parts
    const whereParts: string[] = [];
    const params: any[] = [firmId, query, query, query, limit, offset];
    let paramIndex = 7;

    if (filterConditions.documentTypes && filters.documentTypes) {
      whereParts.push(`AND d.file_type = ANY($${paramIndex}::text[])`);
      params.push(filters.documentTypes);
      paramIndex++;
    }

    if (filterConditions.clientIds && filters.clientIds) {
      whereParts.push(`AND d.client_id = ANY($${paramIndex}::text[])`);
      params.push(filters.clientIds);
      paramIndex++;
    }

    const filterSql = whereParts.join(' ');

    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        file_name: string;
        file_type: string;
        client_name: string | null;
        uploaded_at: Date;
        rank: number;
        highlight: string | null;
      }>
    >(
      `SELECT
        d.id,
        d.file_name,
        d.file_type,
        cl.name as client_name,
        d.uploaded_at,
        ts_rank(
          to_tsvector('simple', COALESCE(d.file_name, '') || ' ' || COALESCE(d.metadata->>'description', '') || ' ' || COALESCE(d.metadata->>'tags', '') || ' ' || COALESCE(d.search_terms, '')),
          plainto_tsquery('simple', $2)
        ) as rank,
        ts_headline(
          'simple',
          COALESCE(d.file_name, '') || ' ' || COALESCE(d.metadata->>'description', ''),
          plainto_tsquery('simple', $3),
          'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
        ) as highlight
      FROM documents d
      LEFT JOIN clients cl ON d.client_id = cl.id
      WHERE d.firm_id = $1
        AND to_tsvector('simple', COALESCE(d.file_name, '') || ' ' || COALESCE(d.metadata->>'description', '') || ' ' || COALESCE(d.metadata->>'tags', '') || ' ' || COALESCE(d.search_terms, ''))
            @@ plainto_tsquery('simple', $4)
        ${filterSql}
      ORDER BY rank DESC
      LIMIT $5
      OFFSET $6`,
      ...params
    );

    return results.map((r) => ({
      type: 'document' as const,
      id: r.id,
      fileName: r.file_name,
      fileType: r.file_type,
      clientName: r.client_name,
      uploadedAt: r.uploaded_at,
      score: r.rank,
      highlight: r.highlight,
    }));
  }

  /**
   * Full-text search on clients
   */
  private async fullTextSearchClients(
    query: string,
    firmId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<ClientSearchResult[]> {
    // If clientIds filter is set and doesn't match any, skip client search
    if (filters.clientIds && filters.clientIds.length > 0) {
      // Client search with clientIds filter would be redundant
      return [];
    }

    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        contact_info: any;
        address: string | null;
        case_count: number;
        rank: number;
        highlight: string | null;
      }>
    >`
      SELECT
        c.id,
        c.name,
        c.contact_info,
        c.address,
        (SELECT COUNT(*) FROM cases ca WHERE ca.client_id = c.id)::int as case_count,
        ts_rank(
          to_tsvector('simple', COALESCE(c.name, '') || ' ' || COALESCE(c.address, '') || ' ' || COALESCE(c.contact_info::text, '')),
          plainto_tsquery('simple', ${query})
        ) as rank,
        ts_headline(
          'simple',
          COALESCE(c.name, '') || ' ' || COALESCE(c.address, ''),
          plainto_tsquery('simple', ${query}),
          'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
        ) as highlight
      FROM clients c
      WHERE c.firm_id = ${firmId}
        AND to_tsvector('simple', COALESCE(c.name, '') || ' ' || COALESCE(c.address, '') || ' ' || COALESCE(c.contact_info::text, ''))
            @@ plainto_tsquery('simple', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return results.map((r) => ({
      type: 'client' as const,
      id: r.id,
      name: r.name,
      contactInfo: r.contact_info,
      address: r.address,
      caseCount: r.case_count,
      score: r.rank,
      highlight: r.highlight,
    }));
  }

  // ==========================================================================
  // Filter Helpers (Task 12)
  // ==========================================================================

  private buildCaseFilterConditions(filters: SearchFilters): {
    dateRange: boolean;
    caseTypes: boolean;
    caseStatuses: boolean;
    clientIds: boolean;
  } {
    return {
      dateRange: !!filters.dateRange?.start && !!filters.dateRange?.end,
      caseTypes: !!filters.caseTypes && filters.caseTypes.length > 0,
      caseStatuses: !!filters.caseStatuses && filters.caseStatuses.length > 0,
      clientIds: !!filters.clientIds && filters.clientIds.length > 0,
    };
  }

  private buildDocumentFilterConditions(filters: SearchFilters): {
    documentTypes: boolean;
    clientIds: boolean;
  } {
    return {
      documentTypes: !!filters.documentTypes && filters.documentTypes.length > 0,
      clientIds: !!filters.clientIds && filters.clientIds.length > 0,
    };
  }

  // ==========================================================================
  // Cache Management (Task 17)
  // ==========================================================================

  /**
   * Generate cache key for search query
   */
  private getCacheKey(firmId: string, query: string, filters: SearchFilters): string {
    const hash = createHash('sha256')
      .update(JSON.stringify({ query, filters }))
      .digest('hex')
      .substring(0, 16);

    return `${firmId}:${hash}`;
  }

  /**
   * Invalidate search cache for a firm
   * Call this when cases/documents are created/updated/deleted
   */
  async invalidateSearchCache(firmId: string): Promise<number> {
    return await cacheManager.invalidate(`${SEARCH_CACHE_PREFIX}:${firmId}:*`);
  }

  // ==========================================================================
  // Search History (removed - searchHistory model no longer exists)
  // ==========================================================================

  /**
   * Record a search in history (no-op: searchHistory model removed)
   * @deprecated Search history feature removed
   */
  async recordSearch(
    _userId: string,
    _firmId: string,
    _query: string,
    _filters: SearchFilters,
    _resultCount: number
  ): Promise<void> {
    // No-op: searchHistory model was removed from schema
  }

  /**
   * Get recent searches for a user (returns empty: searchHistory model removed)
   * @deprecated Search history feature removed
   */
  async getRecentSearches(
    _userId: string,
    _limit: number = 10
  ): Promise<
    Array<{
      id: string;
      query: string;
      searchType: string;
      filters: any;
      resultCount: number;
      createdAt: Date;
    }>
  > {
    // Return empty array: searchHistory model was removed from schema
    return [];
  }

  // ==========================================================================
  // Cache Warming (disabled - depends on removed searchHistory)
  // ==========================================================================

  /**
   * Get top searches for a firm (returns empty: searchHistory model removed)
   * @deprecated Search history feature removed
   */
  async getPopularSearches(
    _firmId: string,
    _limit: number = 10
  ): Promise<Array<{ query: string; count: number }>> {
    // Return empty array: searchHistory model was removed from schema
    return [];
  }

  /**
   * Warm cache with popular searches for a firm (no-op: depends on searchHistory)
   * @deprecated Search history feature removed
   */
  async warmCacheForFirm(_firmId: string): Promise<number> {
    // No-op: depends on searchHistory which was removed
    return 0;
  }
}

// Export singleton instance
export const searchService = new SearchService();
