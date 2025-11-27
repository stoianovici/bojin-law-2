/**
 * Search Service
 * Story 2.10: Basic AI Search Implementation - Tasks 8-12, 17-18
 *
 * Provides full-text, semantic, and hybrid search capabilities across
 * cases and documents using PostgreSQL full-text search and pgvector.
 *
 * Features:
 * - Full-text search with PostgreSQL tsvector/tsquery
 * - Semantic search using pgvector cosine similarity
 * - Hybrid search with Reciprocal Rank Fusion (RRF) algorithm
 * - Search filters (date range, case type, status, document type)
 * - Redis caching for search results
 * - Cache warming for popular searches
 *
 * References:
 * - PostgreSQL Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
 * - pgvector: https://github.com/pgvector/pgvector
 * - RRF Paper: "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"
 */

import { prisma, cacheManager, redis } from '@legal-platform/database';
import { CaseType, CaseStatus } from '@legal-platform/database';
import { createHash } from 'crypto';
import { embeddingService } from './embedding.service';

// ============================================================================
// Configuration
// ============================================================================

// Search Configuration
const SEARCH_MIN_SIMILARITY = parseFloat(process.env.SEARCH_MIN_SIMILARITY || '0.7');
const SEARCH_RESULTS_LIMIT = parseInt(process.env.SEARCH_RESULTS_LIMIT || '20', 10);
const SEARCH_CACHE_PREFIX = 'search';
const FULL_TEXT_CACHE_TTL = 300; // 5 minutes
const SEMANTIC_CACHE_TTL = 900; // 15 minutes
const RECENT_SEARCHES_TTL = 900; // 15 minutes

// RRF Configuration
const RRF_K = 60; // Standard RRF constant

// ============================================================================
// Types
// ============================================================================

export enum SearchMode {
  FULL_TEXT = 'FULL_TEXT',
  SEMANTIC = 'SEMANTIC',
  HYBRID = 'HYBRID',
}

export enum SearchMatchType {
  FULL_TEXT = 'FULL_TEXT',
  SEMANTIC = 'SEMANTIC',
  HYBRID = 'HYBRID',
}

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
  matchType: SearchMatchType;
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
  matchType: SearchMatchType;
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
  matchType: SearchMatchType;
}

export type SearchResult = CaseSearchResult | DocumentSearchResult | ClientSearchResult;

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number; // milliseconds
  query: string;
  searchMode: SearchMode;
}

interface RankedItem {
  id: string;
  type: 'case' | 'document' | 'client';
  fullTextRank?: number;
  semanticRank?: number;
  rrfScore?: number;
  data?: any;
}

// ============================================================================
// Search Service Class
// ============================================================================

export class SearchService {
  // ==========================================================================
  // Main Search Methods (Tasks 8, 9, 10, 11)
  // ==========================================================================

  /**
   * Main search method - routes to appropriate search type
   *
   * @param query - Search query string
   * @param firmId - Firm UUID for data isolation
   * @param mode - Search mode (full_text, semantic, hybrid)
   * @param filters - Optional search filters
   * @param limit - Maximum results to return
   * @param offset - Pagination offset
   */
  async search(
    query: string,
    firmId: string,
    mode: SearchMode = SearchMode.HYBRID,
    filters: SearchFilters = {},
    limit: number = SEARCH_RESULTS_LIMIT,
    offset: number = 0
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(firmId, query, filters, mode);
    const cached = await cacheManager.get<SearchResponse>(`${SEARCH_CACHE_PREFIX}:${cacheKey}`);
    if (cached) {
      console.log(`[Search Service] Cache hit for query: "${query}"`);
      return {
        ...cached,
        searchTime: Date.now() - startTime,
      };
    }

    let results: SearchResult[];

    switch (mode) {
      case SearchMode.FULL_TEXT:
        results = await this.fullTextSearch(query, firmId, filters, limit, offset);
        break;
      case SearchMode.SEMANTIC:
        results = await this.semanticSearch(query, firmId, filters, limit, offset);
        break;
      case SearchMode.HYBRID:
      default:
        results = await this.hybridSearch(query, firmId, filters, limit, offset);
        break;
    }

    const response: SearchResponse = {
      results,
      totalCount: results.length,
      searchTime: Date.now() - startTime,
      query,
      searchMode: mode,
    };

    // Cache results
    const ttl = mode === SearchMode.SEMANTIC ? SEMANTIC_CACHE_TTL : FULL_TEXT_CACHE_TTL;
    await cacheManager.set(`${SEARCH_CACHE_PREFIX}:${cacheKey}`, response, ttl);

    console.log(`[Search Service] Search completed in ${response.searchTime}ms, ${results.length} results`);
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
      whereParts.push(`AND c.opened_date BETWEEN $${paramIndex}::timestamp AND $${paramIndex + 1}::timestamp`);
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

    const results = await prisma.$queryRawUnsafe<Array<{
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
    }>>(
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
          to_tsvector('simple', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '') || ' ' || COALESCE(c.case_number, '') || ' ' || COALESCE(c.search_text, '')),
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
        AND to_tsvector('simple', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '') || ' ' || COALESCE(c.case_number, '') || ' ' || COALESCE(c.search_text, ''))
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
      matchType: SearchMatchType.FULL_TEXT,
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

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      file_name: string;
      file_type: string;
      client_name: string | null;
      uploaded_at: Date;
      rank: number;
      highlight: string | null;
    }>>(
      `SELECT
        d.id,
        d.file_name,
        d.file_type,
        cl.name as client_name,
        d.uploaded_at,
        ts_rank(
          to_tsvector('simple', COALESCE(d.file_name, '') || ' ' || COALESCE(d.metadata->>'description', '') || ' ' || COALESCE(d.metadata->>'tags', '')),
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
        AND to_tsvector('simple', COALESCE(d.file_name, '') || ' ' || COALESCE(d.metadata->>'description', '') || ' ' || COALESCE(d.metadata->>'tags', ''))
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
      matchType: SearchMatchType.FULL_TEXT,
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

    const results = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      contact_info: any;
      address: string | null;
      case_count: number;
      rank: number;
      highlight: string | null;
    }>>`
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
      matchType: SearchMatchType.FULL_TEXT,
    }));
  }

  /**
   * Semantic search using pgvector cosine similarity (Task 10)
   */
  async semanticSearch(
    query: string,
    firmId: string,
    filters: SearchFilters = {},
    limit: number = SEARCH_RESULTS_LIMIT,
    offset: number = 0
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    const results: SearchResult[] = [];

    // Search cases
    const caseResults = await this.semanticSearchCases(queryEmbedding, firmId, filters, limit, offset);
    results.push(...caseResults);

    // Search documents
    const docResults = await this.semanticSearchDocuments(queryEmbedding, firmId, filters, limit, offset);
    results.push(...docResults);

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Semantic search on cases using pgvector
   */
  private async semanticSearchCases(
    queryEmbedding: number[],
    firmId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<CaseSearchResult[]> {
    const filterConditions = this.buildCaseFilterConditions(filters);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build WHERE clause parts
    const whereParts: string[] = [];
    const params: any[] = [firmId, embeddingStr, embeddingStr, SEARCH_MIN_SIMILARITY, embeddingStr, limit, offset];
    let paramIndex = 8;

    if (filterConditions.dateRange && filters.dateRange) {
      whereParts.push(`AND c.opened_date BETWEEN $${paramIndex}::timestamp AND $${paramIndex + 1}::timestamp`);
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

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      case_number: string;
      title: string;
      description: string;
      status: string;
      type: string;
      client_name: string | null;
      opened_date: Date;
      similarity: number;
    }>>(
      `SELECT
        c.id,
        c.case_number,
        c.title,
        c.description,
        c.status::text,
        c.type::text,
        cl.name as client_name,
        c.opened_date,
        1 - (c.content_embedding <=> $2::vector) as similarity
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.firm_id = $1
        AND c.content_embedding IS NOT NULL
        AND 1 - (c.content_embedding <=> $3::vector) > $4
        ${filterSql}
      ORDER BY c.content_embedding <=> $5::vector
      LIMIT $6
      OFFSET $7`,
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
      score: r.similarity,
      highlight: this.truncateText(r.description, 200), // No term highlighting for semantic
      matchType: SearchMatchType.SEMANTIC,
    }));
  }

  /**
   * Semantic search on documents using pgvector
   */
  private async semanticSearchDocuments(
    queryEmbedding: number[],
    firmId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<DocumentSearchResult[]> {
    const filterConditions = this.buildDocumentFilterConditions(filters);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build WHERE clause parts
    const whereParts: string[] = [];
    const params: any[] = [firmId, embeddingStr, embeddingStr, SEARCH_MIN_SIMILARITY, embeddingStr, limit, offset];
    let paramIndex = 8;

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

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      file_name: string;
      file_type: string;
      client_name: string | null;
      uploaded_at: Date;
      similarity: number;
      description: string | null;
    }>>(
      `SELECT
        d.id,
        d.file_name,
        d.file_type,
        cl.name as client_name,
        d.uploaded_at,
        1 - (d.metadata_embedding <=> $2::vector) as similarity,
        d.metadata->>'description' as description
      FROM documents d
      LEFT JOIN clients cl ON d.client_id = cl.id
      WHERE d.firm_id = $1
        AND d.metadata_embedding IS NOT NULL
        AND 1 - (d.metadata_embedding <=> $3::vector) > $4
        ${filterSql}
      ORDER BY d.metadata_embedding <=> $5::vector
      LIMIT $6
      OFFSET $7`,
      ...params
    );

    return results.map((r) => ({
      type: 'document' as const,
      id: r.id,
      fileName: r.file_name,
      fileType: r.file_type,
      clientName: r.client_name,
      uploadedAt: r.uploaded_at,
      score: r.similarity,
      highlight: this.truncateText(r.description || r.file_name, 200),
      matchType: SearchMatchType.SEMANTIC,
    }));
  }

  /**
   * Hybrid search using Reciprocal Rank Fusion (Task 11)
   */
  async hybridSearch(
    query: string,
    firmId: string,
    filters: SearchFilters = {},
    limit: number = SEARCH_RESULTS_LIMIT,
    offset: number = 0
  ): Promise<SearchResult[]> {
    // Run both searches in parallel
    const [fullTextResults, semanticResults] = await Promise.all([
      this.fullTextSearch(query, firmId, filters, limit * 2, 0), // Get more results for merging
      this.semanticSearch(query, firmId, filters, limit * 2, 0),
    ]);

    // Apply RRF algorithm
    const mergedResults = this.applyRRF(fullTextResults, semanticResults);

    // Apply pagination
    return mergedResults.slice(offset, offset + limit);
  }

  /**
   * Reciprocal Rank Fusion algorithm
   * Combines results from multiple search methods
   */
  private applyRRF(
    fullTextResults: SearchResult[],
    semanticResults: SearchResult[]
  ): SearchResult[] {
    const resultMap = new Map<string, RankedItem>();

    // Add full-text results with rank
    fullTextResults.forEach((result, index) => {
      const key = `${result.type}:${result.id}`;
      resultMap.set(key, {
        id: result.id,
        type: result.type,
        fullTextRank: index + 1,
        data: result,
      });
    });

    // Add/update semantic results with rank
    semanticResults.forEach((result, index) => {
      const key = `${result.type}:${result.id}`;
      const existing = resultMap.get(key);

      if (existing) {
        existing.semanticRank = index + 1;
        // If found in both, update matchType to HYBRID
        existing.data = { ...existing.data, matchType: SearchMatchType.HYBRID };
      } else {
        resultMap.set(key, {
          id: result.id,
          type: result.type,
          semanticRank: index + 1,
          data: result,
        });
      }
    });

    // Compute RRF scores
    const scoredResults: Array<{ result: SearchResult; rrfScore: number }> = [];

    resultMap.forEach((item) => {
      let rrfScore = 0;

      if (item.fullTextRank !== undefined) {
        rrfScore += 1 / (RRF_K + item.fullTextRank);
      }

      if (item.semanticRank !== undefined) {
        rrfScore += 1 / (RRF_K + item.semanticRank);
      }

      // Normalize score to 0-1 range (approximately)
      const normalizedScore = Math.min(rrfScore * RRF_K, 1);

      scoredResults.push({
        result: {
          ...item.data,
          score: normalizedScore,
        },
        rrfScore,
      });
    });

    // Sort by RRF score descending
    scoredResults.sort((a, b) => b.rrfScore - a.rrfScore);

    return scoredResults.map((sr) => sr.result);
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
  private getCacheKey(
    firmId: string,
    query: string,
    filters: SearchFilters,
    mode: SearchMode
  ): string {
    const hash = createHash('sha256')
      .update(JSON.stringify({ query, filters, mode }))
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
  // Search History (Task 16)
  // ==========================================================================

  /**
   * Record a search in history
   */
  async recordSearch(
    userId: string,
    firmId: string,
    query: string,
    searchType: 'FullText' | 'Semantic' | 'Hybrid',
    filters: SearchFilters,
    resultCount: number
  ): Promise<void> {
    await prisma.searchHistory.create({
      data: {
        userId,
        firmId,
        query,
        searchType,
        filters: filters as any,
        resultCount,
      },
    });
  }

  /**
   * Get recent searches for a user
   */
  async getRecentSearches(
    userId: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    query: string;
    searchType: string;
    filters: any;
    resultCount: number;
    createdAt: Date;
  }>> {
    // Check cache first
    const cacheKey = `recentSearches:${userId}`;
    const cached = await cacheManager.get<any[]>(cacheKey);
    if (cached) {
      return cached.slice(0, limit);
    }

    // Query database with deduplication
    const searches = await prisma.$queryRaw<Array<{
      id: string;
      query: string;
      search_type: string;
      filters: any;
      result_count: number;
      created_at: Date;
    }>>`
      SELECT DISTINCT ON (query)
        id,
        query,
        search_type,
        filters,
        result_count,
        created_at
      FROM search_history
      WHERE user_id = ${userId}
      ORDER BY query, created_at DESC
      LIMIT ${limit * 2}
    `;

    const results = searches
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        query: s.query,
        searchType: s.search_type,
        filters: s.filters,
        resultCount: s.result_count,
        createdAt: s.created_at,
      }));

    // Cache results
    await cacheManager.set(cacheKey, results, RECENT_SEARCHES_TTL);

    return results;
  }

  // ==========================================================================
  // Cache Warming (Task 18)
  // ==========================================================================

  /**
   * Get top searches for a firm (for cache warming)
   */
  async getPopularSearches(
    firmId: string,
    limit: number = 10
  ): Promise<Array<{ query: string; count: number }>> {
    const results = await prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
      SELECT query, COUNT(*) as count
      FROM search_history
      WHERE firm_id = ${firmId}
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      query: r.query,
      count: Number(r.count),
    }));
  }

  /**
   * Warm cache with popular searches for a firm
   */
  async warmCacheForFirm(firmId: string): Promise<number> {
    const popularSearches = await this.getPopularSearches(firmId, 10);

    let warmedCount = 0;

    for (const { query } of popularSearches) {
      try {
        // Execute search to populate cache
        await this.search(query, firmId, SearchMode.HYBRID, {}, SEARCH_RESULTS_LIMIT, 0);
        warmedCount++;
      } catch (error) {
        console.error(`[Search Service] Failed to warm cache for query: "${query}"`, error);
      }
    }

    console.log(`[Search Service] Warmed ${warmedCount} searches for firm ${firmId}`);
    return warmedCount;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Truncate text to a maximum length
   */
  private truncateText(text: string | null, maxLength: number): string | null {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }
}

// Export singleton instance
export const searchService = new SearchService();
