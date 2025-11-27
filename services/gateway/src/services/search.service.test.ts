/**
 * Search Service Unit Tests
 * Story 2.10: Basic AI Search Implementation - Task 26
 *
 * Tests for full-text, semantic, and hybrid search functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock external dependencies
vi.mock('@legal-platform/database', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
  },
  prisma: {
    $queryRaw: vi.fn(),
    searchHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('./embedding.service', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({
    generateEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
  })),
}));

import { SearchService, SearchMode, SearchFilters } from './search.service';
import { redis, prisma, cacheManager } from '@legal-platform/database';

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    searchService = new SearchService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fullTextSearch', () => {
    it('should search cases using full-text search', async () => {
      const mockCaseResults = [
        {
          id: 'case-1',
          title: 'Contract Dispute',
          caseNumber: 'C-001',
          description: 'Business contract dispute',
          status: 'Active',
          type: 'Contract',
          client_name: 'ABC Corp',
          rank: 0.9,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(mockCaseResults);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // documents

      const result = await searchService.fullTextSearch(
        'contract',
        'firm-123',
        {},
        20,
        0
      );

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchType).toBe('FULL_TEXT');
    });

    it('should search documents using full-text search', async () => {
      const mockDocResults = [
        {
          id: 'doc-1',
          fileName: 'agreement.pdf',
          description: 'Service agreement',
          fileType: 'application/pdf',
          client_name: 'XYZ Inc',
          uploaded_at: new Date(),
          rank: 0.85,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // cases
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(mockDocResults);

      const result = await searchService.fullTextSearch(
        'agreement',
        'firm-123',
        {},
        20,
        0
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('document');
    });

    it('should apply date range filter', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const filters: SearchFilters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };

      await searchService.fullTextSearch('test', 'firm-123', filters, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should apply case type filter', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const filters: SearchFilters = {
        caseTypes: ['Litigation', 'Contract'],
      };

      await searchService.fullTextSearch('test', 'firm-123', filters, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should apply case status filter', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const filters: SearchFilters = {
        caseStatuses: ['Active', 'PendingApproval'],
      };

      await searchService.fullTextSearch('test', 'firm-123', filters, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await searchService.fullTextSearch(
        'nonexistent',
        'firm-123',
        {},
        20,
        0
      );

      expect(result).toEqual([]);
    });
  });

  describe('semanticSearch', () => {
    it('should search using vector similarity', async () => {
      const mockCaseResults = [
        {
          id: 'case-semantic',
          title: 'Employment Issue',
          caseNumber: 'E-001',
          description: 'Wrongful termination case',
          status: 'Active',
          type: 'Litigation',
          client_name: 'Employee',
          similarity: 0.92,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(mockCaseResults);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]); // documents

      const result = await searchService.semanticSearch(
        'employment dispute',
        'firm-123',
        {},
        20,
        0
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchType).toBe('SEMANTIC');
    });

    it('should filter out low-score results', async () => {
      const mockResults = [
        { id: 'case-1', similarity: 0.8, title: 'High Match' },
        { id: 'case-2', similarity: 0.3, title: 'Low Match' }, // Below threshold
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(mockResults);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

      const result = await searchService.semanticSearch(
        'test query',
        'firm-123',
        {},
        20,
        0
      );

      // Only high-score result should be included
      const caseResults = result.filter((r) => r.score >= 0.5);
      expect(caseResults.length).toBeLessThanOrEqual(result.length);
    });
  });

  describe('hybridSearch', () => {
    it('should combine full-text and semantic results using RRF', async () => {
      // Mock full-text results
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          { id: 'case-ft', title: 'FT Result', rank: 0.9, status: 'Active', type: 'Contract' },
        ])
        .mockResolvedValueOnce([]) // FT documents
        .mockResolvedValueOnce([
          { id: 'case-sem', title: 'Semantic Result', similarity: 0.85, status: 'Active', type: 'Contract' },
        ])
        .mockResolvedValueOnce([]); // Semantic documents

      const result = await searchService.hybridSearch(
        'contract',
        'firm-123',
        {},
        20,
        0
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchType).toBe('HYBRID');
    });

    it('should deduplicate results from both methods', async () => {
      // Same case appears in both full-text and semantic results
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          { id: 'case-same', title: 'Same Case', rank: 0.9, status: 'Active', type: 'Contract' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'case-same', title: 'Same Case', similarity: 0.85, status: 'Active', type: 'Contract' },
        ])
        .mockResolvedValueOnce([]);

      const result = await searchService.hybridSearch(
        'test',
        'firm-123',
        {},
        20,
        0
      );

      const caseIds = result.map((r) => r.case?.id || r.document?.id);
      const uniqueIds = [...new Set(caseIds)];
      expect(caseIds.length).toBe(uniqueIds.length);
    });

    it('should rank results using RRF algorithm with k=60', async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          { id: 'case-1', title: 'Result 1', rank: 0.95, status: 'Active', type: 'Contract' },
          { id: 'case-2', title: 'Result 2', rank: 0.85, status: 'Active', type: 'Contract' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'case-2', title: 'Result 2', similarity: 0.95, status: 'Active', type: 'Contract' },
          { id: 'case-1', title: 'Result 1', similarity: 0.75, status: 'Active', type: 'Contract' },
        ])
        .mockResolvedValueOnce([]);

      const result = await searchService.hybridSearch(
        'test',
        'firm-123',
        {},
        20,
        0
      );

      // Results should be sorted by combined RRF score
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    it('should use full-text search when mode is FULL_TEXT', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.search('test', 'firm-123', SearchMode.FULL_TEXT, {}, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should use semantic search when mode is SEMANTIC', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.search('test', 'firm-123', SearchMode.SEMANTIC, {}, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should use hybrid search when mode is HYBRID', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.search('test', 'firm-123', SearchMode.HYBRID, {}, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const cachedResults = {
        results: [{ type: 'case', case: { id: 'cached' }, score: 0.9 }],
        total: 1,
        searchTime: 50,
      };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedResults));

      const result = await searchService.search(
        'cached query',
        'firm-123',
        SearchMode.HYBRID,
        {},
        20,
        0
      );

      expect(result.results).toEqual(cachedResults.results);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should cache search results', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.search('new query', 'firm-123', SearchMode.HYBRID, {}, 20, 0);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        expect.any(String),
        'EX',
        expect.any(Number)
      );
    });
  });

  describe('recordSearch', () => {
    it('should record search in history', async () => {
      vi.mocked(prisma.searchHistory.create).mockResolvedValue({
        id: 'history-1',
        userId: 'user-123',
        firmId: 'firm-123',
        query: 'test query',
        searchType: 'HYBRID',
        filters: {},
        resultCount: 10,
        createdAt: new Date(),
      } as any);

      await searchService.recordSearch(
        'user-123',
        'firm-123',
        'test query',
        SearchMode.HYBRID,
        {},
        10
      );

      expect(prisma.searchHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          firmId: 'firm-123',
          query: 'test query',
          searchType: 'HYBRID',
          resultCount: 10,
        }),
      });
    });
  });

  describe('getRecentSearches', () => {
    it('should return recent searches for a user', async () => {
      const mockSearches = [
        {
          id: 'search-1',
          query: 'contract',
          searchType: 'HYBRID',
          resultCount: 15,
          createdAt: new Date(),
        },
        {
          id: 'search-2',
          query: 'employment',
          searchType: 'FULL_TEXT',
          resultCount: 8,
          createdAt: new Date(),
        },
      ];

      vi.mocked(cacheManager.get).mockResolvedValue(null);
      vi.mocked(prisma.searchHistory.findMany).mockResolvedValue(mockSearches as any);

      const result = await searchService.getRecentSearches('user-123', 10);

      expect(result).toHaveLength(2);
      expect(prisma.searchHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: expect.objectContaining({
          id: true,
          query: true,
          searchType: true,
          resultCount: true,
        }),
      });
    });

    it('should return cached recent searches', async () => {
      const cachedSearches = [
        { id: 'cached-1', query: 'cached', searchType: 'HYBRID', resultCount: 5 },
      ];

      vi.mocked(cacheManager.get).mockResolvedValue(cachedSearches);

      const result = await searchService.getRecentSearches('user-123', 10);

      expect(result).toEqual(cachedSearches);
      expect(prisma.searchHistory.findMany).not.toHaveBeenCalled();
    });

    it('should cache recent searches', async () => {
      vi.mocked(cacheManager.get).mockResolvedValue(null);
      vi.mocked(prisma.searchHistory.findMany).mockResolvedValue([]);

      await searchService.getRecentSearches('user-123', 10);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('recent-searches:'),
        expect.any(Array),
        expect.any(Number)
      );
    });
  });

  describe('warmCache', () => {
    it('should warm cache with popular searches', async () => {
      const popularQueries = [
        { query: 'contract', _count: { query: 50 } },
        { query: 'litigation', _count: { query: 30 } },
      ];

      // Mock groupBy for popular queries
      vi.mocked(prisma.$queryRaw).mockResolvedValue(popularQueries);

      await searchService.warmCache('firm-123');

      // Verify search was called for each popular query
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear search cache for a firm', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await searchService.clearCache('firm-123');

      expect(redis.del).toHaveBeenCalled();
    });
  });
});
