/**
 * Search Service Unit Tests
 * Story 2.10: Basic AI Search Implementation - Task 26
 *
 * Tests for full-text search functionality.
 */

// Mock external dependencies
jest.mock('@legal-platform/database', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
  cacheManager: {
    get: jest.fn(),
    set: jest.fn(),
  },
  prisma: {
    $queryRaw: jest.fn(),
    searchHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { SearchService, SearchFilters } from './search.service';
import { prisma, cacheManager } from '@legal-platform/database';

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService();
  });

  afterEach(() => {
    jest.resetAllMocks();
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

      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValueOnce(mockCaseResults);
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValueOnce([]); // documents

      const result = await searchService.fullTextSearch('contract', 'firm-123', {}, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('case');
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

      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValueOnce([]); // cases
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValueOnce(mockDocResults);

      const result = await searchService.fullTextSearch('agreement', 'firm-123', {}, 20, 0);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('document');
    });

    it('should apply date range filter', async () => {
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

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
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

      const filters: SearchFilters = {
        caseTypes: ['Litigation', 'Contract'],
      };

      await searchService.fullTextSearch('test', 'firm-123', filters, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should apply case status filter', async () => {
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

      const filters: SearchFilters = {
        caseStatuses: ['Active', 'PendingApproval'],
      };

      await searchService.fullTextSearch('test', 'firm-123', filters, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

      const result = await searchService.fullTextSearch('nonexistent', 'firm-123', {}, 20, 0);

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('should use full-text search', async () => {
      (jest.mocked as any)(cacheManager.get).mockResolvedValue(null);
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.search('test', 'firm-123', {}, 20, 0);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const cachedResults = {
        results: [{ type: 'case', case: { id: 'cached' }, score: 0.9 }],
        total: 1,
        searchTime: 50,
      };
      (jest.mocked as any)(cacheManager.get).mockResolvedValue(cachedResults);

      const result = await searchService.search('cached query', 'firm-123', {}, 20, 0);

      expect(result.results).toEqual(cachedResults.results);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should cache search results', async () => {
      (jest.mocked as any)(cacheManager.get).mockResolvedValue(null);
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.search('new query', 'firm-123', {}, 20, 0);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        expect.any(Object),
        expect.any(Number)
      );
    });
  });

  describe('recordSearch', () => {
    it('should record search in history', async () => {
      (jest.mocked as any)(prisma.searchHistory.create).mockResolvedValue({
        id: 'history-1',
        userId: 'user-123',
        firmId: 'firm-123',
        query: 'test query',
        searchType: 'FullText',
        filters: {},
        resultCount: 10,
        createdAt: new Date(),
      } as any);

      await searchService.recordSearch('user-123', 'firm-123', 'test query', {}, 10);

      expect(prisma.searchHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          firmId: 'firm-123',
          query: 'test query',
          searchType: 'FullText',
          resultCount: 10,
        }),
      });
    });
  });

  describe('getRecentSearches', () => {
    it('should return cached recent searches', async () => {
      const cachedSearches = [
        { id: 'cached-1', query: 'cached', searchType: 'FullText', resultCount: 5 },
      ];

      (jest.mocked as any)(cacheManager.get).mockResolvedValue(cachedSearches);

      const result = await searchService.getRecentSearches('user-123', 10);

      expect(result).toEqual(cachedSearches);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should cache recent searches', async () => {
      (jest.mocked as any)(cacheManager.get).mockResolvedValue(null);
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue([]);

      await searchService.getRecentSearches('user-123', 10);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('recentSearches:'),
        expect.any(Array),
        expect.any(Number)
      );
    });
  });

  describe('warmCacheForFirm', () => {
    it('should warm cache with popular searches', async () => {
      const popularQueries = [
        { query: 'contract', count: 50n },
        { query: 'litigation', count: 30n },
      ];

      // Mock getPopularSearches
      (jest.mocked as any)(prisma.$queryRaw).mockResolvedValue(popularQueries);
      (jest.mocked as any)(cacheManager.get).mockResolvedValue(null);

      await searchService.warmCacheForFirm('firm-123');

      // Verify cacheManager.set was called for each popular query
      expect(cacheManager.set).toHaveBeenCalled();
    });
  });
});
