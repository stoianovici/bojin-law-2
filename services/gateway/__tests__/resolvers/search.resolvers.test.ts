/**
 * Search Resolvers Unit Tests
 * Story 2.10: Basic AI Search Implementation - Task 27
 *
 * Tests for GraphQL search query resolvers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the search service
vi.mock('../../src/services/search.service', () => ({
  SearchService: vi.fn().mockImplementation(() => ({
    search: vi.fn(),
    getRecentSearches: vi.fn(),
    recordSearch: vi.fn(),
  })),
  SearchMode: {
    FULL_TEXT: 'FULL_TEXT',
    SEMANTIC: 'SEMANTIC',
    HYBRID: 'HYBRID',
  },
}));

import { searchResolvers } from '../../src/graphql/resolvers/search.resolvers';
import { SearchService, SearchMode } from '../../src/services/search.service';

describe('Search Resolvers', () => {
  let mockSearchService: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSearchService = {
      search: vi.fn(),
      getRecentSearches: vi.fn(),
      recordSearch: vi.fn(),
    };

    // Replace the SearchService constructor to return our mock
    (SearchService as any).mockImplementation(() => mockSearchService);

    mockContext = {
      user: {
        id: 'user-123',
        firmId: 'firm-123',
        role: 'Associate',
      },
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Query.search', () => {
    it('should perform search with all parameters', async () => {
      const mockResults = {
        results: [
          {
            type: 'case',
            case: {
              id: 'case-1',
              title: 'Test Case',
              caseNumber: 'C-001',
              status: 'Active',
            },
            score: 0.95,
            matchType: 'HYBRID',
          },
        ],
        total: 1,
        searchTime: 120,
      };

      mockSearchService.search.mockResolvedValue(mockResults);
      mockSearchService.recordSearch.mockResolvedValue(undefined);

      const args = {
        input: {
          query: 'test query',
          mode: 'HYBRID',
          filters: {
            caseTypes: ['Contract'],
            caseStatuses: ['Active'],
          },
          limit: 20,
          offset: 0,
        },
      };

      const resolver = searchResolvers.Query.search;
      const result = await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'test query',
        'firm-123',
        'HYBRID',
        expect.objectContaining({
          caseTypes: ['Contract'],
          caseStatuses: ['Active'],
        }),
        20,
        0
      );
      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should use default values when not provided', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        searchTime: 50,
      });

      const args = {
        input: {
          query: 'simple query',
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'simple query',
        'firm-123',
        'HYBRID', // default mode
        {}, // empty filters
        20, // default limit
        0 // default offset
      );
    });

    it('should record search in history', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 5,
        searchTime: 80,
      });

      const args = {
        input: {
          query: 'recorded query',
          mode: 'FULL_TEXT',
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.recordSearch).toHaveBeenCalledWith(
        'user-123',
        'firm-123',
        'recorded query',
        'FULL_TEXT',
        {},
        5
      );
    });

    it('should throw error if user not authenticated', async () => {
      const args = {
        input: {
          query: 'test',
        },
      };

      const resolver = searchResolvers.Query.search;

      await expect(resolver(null, args, { user: null })).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should handle search mode SEMANTIC', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        searchTime: 150,
      });

      const args = {
        input: {
          query: 'semantic search query',
          mode: 'SEMANTIC',
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'semantic search query',
        'firm-123',
        'SEMANTIC',
        {},
        20,
        0
      );
    });

    it('should apply date range filter', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        searchTime: 100,
      });

      const args = {
        input: {
          query: 'date filter test',
          filters: {
            dateRange: {
              start: '2024-01-01',
              end: '2024-12-31',
            },
          },
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'date filter test',
        'firm-123',
        'HYBRID',
        expect.objectContaining({
          dateRange: {
            start: expect.any(Date),
            end: expect.any(Date),
          },
        }),
        20,
        0
      );
    });

    it('should apply document type filter', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        searchTime: 90,
      });

      const args = {
        input: {
          query: 'document search',
          filters: {
            documentTypes: ['application/pdf', 'application/msword'],
          },
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'document search',
        'firm-123',
        'HYBRID',
        expect.objectContaining({
          documentTypes: ['application/pdf', 'application/msword'],
        }),
        20,
        0
      );
    });

    it('should handle pagination', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 100,
        searchTime: 75,
      });

      const args = {
        input: {
          query: 'paginated',
          limit: 10,
          offset: 20,
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'paginated',
        'firm-123',
        'HYBRID',
        {},
        10,
        20
      );
    });
  });

  describe('Query.recentSearches', () => {
    it('should return recent searches for authenticated user', async () => {
      const mockRecentSearches = [
        {
          id: 'search-1',
          query: 'contract dispute',
          searchType: 'HYBRID',
          resultCount: 15,
          createdAt: new Date(),
        },
        {
          id: 'search-2',
          query: 'employment law',
          searchType: 'FULL_TEXT',
          resultCount: 8,
          createdAt: new Date(),
        },
      ];

      mockSearchService.getRecentSearches.mockResolvedValue(mockRecentSearches);

      const args = { limit: 10 };

      const resolver = searchResolvers.Query.recentSearches;
      const result = await resolver(null, args, mockContext);

      expect(mockSearchService.getRecentSearches).toHaveBeenCalledWith('user-123', 10);
      expect(result).toHaveLength(2);
      expect(result[0].query).toBe('contract dispute');
    });

    it('should use default limit if not provided', async () => {
      mockSearchService.getRecentSearches.mockResolvedValue([]);

      const resolver = searchResolvers.Query.recentSearches;
      await resolver(null, {}, mockContext);

      expect(mockSearchService.getRecentSearches).toHaveBeenCalledWith('user-123', 10);
    });

    it('should throw error if user not authenticated', async () => {
      const resolver = searchResolvers.Query.recentSearches;

      await expect(resolver(null, {}, { user: null })).rejects.toThrow(
        'Authentication required'
      );
    });
  });

  describe('SearchResult union type resolver', () => {
    it('should resolve CaseSearchResult type', () => {
      const caseResult = {
        type: 'case',
        case: { id: 'case-1' },
        score: 0.9,
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(caseResult);

      expect(result).toBe('CaseSearchResult');
    });

    it('should resolve DocumentSearchResult type', () => {
      const docResult = {
        type: 'document',
        document: { id: 'doc-1' },
        score: 0.85,
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(docResult);

      expect(result).toBe('DocumentSearchResult');
    });

    it('should return null for unknown type', () => {
      const unknownResult = {
        type: 'unknown',
        data: {},
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(unknownResult);

      expect(result).toBeNull();
    });
  });

  describe('CaseSearchResult field resolvers', () => {
    it('should resolve case field', () => {
      const caseResult = {
        case: {
          id: 'case-123',
          title: 'Test Case',
          caseNumber: 'TC-001',
        },
      };

      const caseResolver = searchResolvers.CaseSearchResult.case;
      const result = caseResolver(caseResult);

      expect(result).toEqual(caseResult.case);
    });

    it('should resolve score field', () => {
      const caseResult = {
        score: 0.92,
      };

      const scoreResolver = searchResolvers.CaseSearchResult.score;
      const result = scoreResolver(caseResult);

      expect(result).toBe(0.92);
    });

    it('should resolve matchType field', () => {
      const caseResult = {
        matchType: 'HYBRID',
      };

      const matchTypeResolver = searchResolvers.CaseSearchResult.matchType;
      const result = matchTypeResolver(caseResult);

      expect(result).toBe('HYBRID');
    });

    it('should resolve highlight field', () => {
      const caseResult = {
        highlight: '<em>matching</em> text',
      };

      const highlightResolver = searchResolvers.CaseSearchResult.highlight;
      const result = highlightResolver(caseResult);

      expect(result).toBe('<em>matching</em> text');
    });
  });

  describe('DocumentSearchResult field resolvers', () => {
    it('should resolve document field', () => {
      const docResult = {
        document: {
          id: 'doc-123',
          fileName: 'contract.pdf',
        },
      };

      const docResolver = searchResolvers.DocumentSearchResult.document;
      const result = docResolver(docResult);

      expect(result).toEqual(docResult.document);
    });

    it('should resolve score field', () => {
      const docResult = {
        score: 0.88,
      };

      const scoreResolver = searchResolvers.DocumentSearchResult.score;
      const result = scoreResolver(docResult);

      expect(result).toBe(0.88);
    });

    it('should resolve matchType field', () => {
      const docResult = {
        matchType: 'SEMANTIC',
      };

      const matchTypeResolver = searchResolvers.DocumentSearchResult.matchType;
      const result = matchTypeResolver(docResult);

      expect(result).toBe('SEMANTIC');
    });
  });

  describe('Error handling', () => {
    it('should handle search service errors gracefully', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Search service unavailable'));

      const args = {
        input: {
          query: 'error test',
        },
      };

      const resolver = searchResolvers.Query.search;

      await expect(resolver(null, args, mockContext)).rejects.toThrow(
        'Search service unavailable'
      );
    });

    it('should handle empty query gracefully', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        searchTime: 0,
      });

      const args = {
        input: {
          query: '',
        },
      };

      const resolver = searchResolvers.Query.search;
      const result = await resolver(null, args, mockContext);

      expect(result.results).toEqual([]);
    });
  });
});
