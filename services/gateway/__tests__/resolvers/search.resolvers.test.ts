/**
 * Search Resolvers Unit Tests
 * Story 2.10: Basic AI Search Implementation - Task 27
 *
 * Tests for GraphQL search query resolvers.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { searchResolvers } from '../../src/graphql/resolvers/search.resolvers';
import { searchService } from '../../src/services/search.service';

// Mock dependencies
jest.mock('@legal-platform/database');
jest.mock('../../src/services/search.service');

// Type helper for mocked Prisma
const mockPrisma = prisma as unknown as {
  [K in keyof typeof prisma]: {
    [M in keyof (typeof prisma)[K]]: jest.Mock;
  };
};

// Type helper for mocked search service
const mockSearchService = searchService as jest.Mocked<typeof searchService>;

describe('Search Resolvers', () => {
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      user: {
        id: 'user-123',
        firmId: 'firm-123',
        role: 'Associate',
        email: 'user@test.com',
      },
    };
  });

  describe('Query.search', () => {
    it('should perform search with query and return results', async () => {
      const mockResults = {
        results: [
          {
            type: 'case' as const,
            id: 'case-1',
            caseNumber: 'C-001',
            title: 'Test Case',
            description: 'Test description',
            status: 'Active' as any,
            caseType: 'Contract' as any,
            clientName: 'Test Client',
            openedDate: new Date(),
            score: 0.95,
            highlight: 'matching <em>text</em>',
          },
        ],
        totalCount: 1,
        searchTime: 120,
        query: 'test query',
      };

      mockSearchService.search.mockResolvedValue(mockResults as any);
      mockSearchService.recordSearch.mockResolvedValue(undefined);

      const args = {
        input: {
          query: 'test query',
          limit: 20,
          offset: 0,
        },
      };

      const resolver = searchResolvers.Query.search;
      const result = await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'test query',
        'firm-123',
        {},
        20,
        0
      );
      expect(result.results).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.searchTime).toBe(120);
    });

    it('should use default values when not provided', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        totalCount: 0,
        searchTime: 50,
        query: 'simple query',
      });
      mockSearchService.recordSearch.mockResolvedValue(undefined);

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
        {},
        20, // default limit
        0 // default offset
      );
    });

    it('should record search in history', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        totalCount: 5,
        searchTime: 80,
        query: 'recorded query',
      });
      mockSearchService.recordSearch.mockResolvedValue(undefined);

      const args = {
        input: {
          query: 'recorded query',
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      // Wait for async recordSearch to be called
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSearchService.recordSearch).toHaveBeenCalledWith(
        'user-123',
        'firm-123',
        'recorded query',
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

      await expect(resolver(null, args, { user: null })).rejects.toThrow();
    });

    it('should throw error if query is empty', async () => {
      const args = {
        input: {
          query: '',
        },
      };

      const resolver = searchResolvers.Query.search;

      await expect(resolver(null, args, mockContext)).rejects.toThrow(
        'Search query cannot be empty'
      );
    });

    it('should throw error if query exceeds max length', async () => {
      const args = {
        input: {
          query: 'a'.repeat(501),
        },
      };

      const resolver = searchResolvers.Query.search;

      await expect(resolver(null, args, mockContext)).rejects.toThrow(
        'Search query cannot exceed 500 characters'
      );
    });

    it('should apply date range filter', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        totalCount: 0,
        searchTime: 100,
        query: 'date filter test',
      });
      mockSearchService.recordSearch.mockResolvedValue(undefined);

      const args = {
        input: {
          query: 'date filter test',
          filters: {
            dateRange: {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            },
          },
        },
      };

      const resolver = searchResolvers.Query.search;
      await resolver(null, args, mockContext);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'date filter test',
        'firm-123',
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
        totalCount: 0,
        searchTime: 90,
        query: 'document search',
      });
      mockSearchService.recordSearch.mockResolvedValue(undefined);

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
        totalCount: 100,
        searchTime: 75,
        query: 'paginated',
      });
      mockSearchService.recordSearch.mockResolvedValue(undefined);

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
        {},
        10,
        20
      );
    });

    it('should throw error for invalid limit', async () => {
      const args = {
        input: {
          query: 'test',
          limit: 150,
        },
      };

      const resolver = searchResolvers.Query.search;

      await expect(resolver(null, args, mockContext)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should throw error for negative offset', async () => {
      const args = {
        input: {
          query: 'test',
          offset: -5,
        },
      };

      const resolver = searchResolvers.Query.search;

      await expect(resolver(null, args, mockContext)).rejects.toThrow(
        'Offset cannot be negative'
      );
    });
  });

  describe('Query.recentSearches', () => {
    it('should return recent searches for authenticated user', async () => {
      const mockRecentSearches = [
        {
          id: 'search-1',
          query: 'contract dispute',
          searchType: 'FULL_TEXT',
          filters: {},
          resultCount: 15,
          createdAt: new Date(),
        },
        {
          id: 'search-2',
          query: 'employment law',
          searchType: 'FULL_TEXT',
          filters: {},
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

      await expect(resolver(null, {}, { user: null })).rejects.toThrow();
    });
  });

  describe('SearchResult union type resolver', () => {
    it('should resolve CaseSearchResult type', () => {
      const caseResult = {
        type: 'case' as const,
        id: 'case-1',
        caseNumber: 'C-001',
        title: 'Test Case',
        description: '',
        status: 'Active' as any,
        caseType: 'Contract' as any,
        clientName: 'Test',
        openedDate: new Date(),
        score: 0.9,
        highlight: null,
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(caseResult);

      expect(result).toBe('CaseSearchResult');
    });

    it('should resolve DocumentSearchResult type', () => {
      const docResult = {
        type: 'document' as const,
        id: 'doc-1',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        clientName: 'Test',
        uploadedAt: new Date(),
        score: 0.85,
        highlight: null,
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(docResult);

      expect(result).toBe('DocumentSearchResult');
    });

    it('should resolve ClientSearchResult type', () => {
      const clientResult = {
        type: 'client' as const,
        id: 'client-1',
        name: 'Test Client',
        contactInfo: {},
        address: '123 Test St',
        caseCount: 5,
        score: 0.8,
        highlight: null,
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(clientResult);

      expect(result).toBe('ClientSearchResult');
    });

    it('should return null for unknown type', () => {
      const unknownResult = {
        type: 'unknown',
        data: {},
      };

      const typeResolver = searchResolvers.SearchResult.__resolveType;
      const result = typeResolver(unknownResult as any);

      expect(result).toBeNull();
    });
  });

  describe('CaseSearchResult field resolvers', () => {
    it('should resolve case field by fetching from database', async () => {
      const mockCase = {
        id: 'case-123',
        title: 'Test Case',
        caseNumber: 'TC-001',
        client: { id: 'client-1', name: 'Client' },
        teamMembers: [],
      };

      mockPrisma.case.findUnique.mockResolvedValue(mockCase);

      const caseResult = {
        type: 'case' as const,
        id: 'case-123',
        caseNumber: 'TC-001',
        title: 'Test Case',
        description: '',
        status: 'Active' as any,
        caseType: 'Contract' as any,
        clientName: 'Client',
        openedDate: new Date(),
        score: 0.92,
        highlight: null,
      };

      const caseResolver = searchResolvers.CaseSearchResult.case;
      const result = await caseResolver(caseResult);

      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockCase);
    });

    it('should resolve score field', () => {
      const caseResult = {
        type: 'case' as const,
        id: 'case-1',
        caseNumber: 'C-001',
        title: 'Test',
        description: '',
        status: 'Active' as any,
        caseType: 'Contract' as any,
        clientName: null,
        openedDate: new Date(),
        score: 0.92,
        highlight: null,
      };

      const scoreResolver = searchResolvers.CaseSearchResult.score;
      const result = scoreResolver(caseResult);

      expect(result).toBe(0.92);
    });

    it('should resolve highlight field', () => {
      const caseResult = {
        type: 'case' as const,
        id: 'case-1',
        caseNumber: 'C-001',
        title: 'Test',
        description: '',
        status: 'Active' as any,
        caseType: 'Contract' as any,
        clientName: null,
        openedDate: new Date(),
        score: 0.9,
        highlight: '<em>matching</em> text',
      };

      const highlightResolver = searchResolvers.CaseSearchResult.highlight;
      const result = highlightResolver(caseResult);

      expect(result).toBe('<em>matching</em> text');
    });
  });

  describe('DocumentSearchResult field resolvers', () => {
    it('should resolve document field by fetching from database', async () => {
      const mockDocument = {
        id: 'doc-123',
        fileName: 'contract.pdf',
        client: { id: 'client-1', name: 'Client' },
        uploader: { id: 'user-1', name: 'User' },
      };

      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);

      const docResult = {
        type: 'document' as const,
        id: 'doc-123',
        fileName: 'contract.pdf',
        fileType: 'application/pdf',
        clientName: 'Client',
        uploadedAt: new Date(),
        score: 0.88,
        highlight: null,
      };

      const docResolver = searchResolvers.DocumentSearchResult.document;
      const result = await docResolver(docResult);

      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        include: {
          client: true,
          uploader: true,
        },
      });
      expect(result).toEqual(mockDocument);
    });

    it('should resolve score field', () => {
      const docResult = {
        type: 'document' as const,
        id: 'doc-1',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        clientName: null,
        uploadedAt: new Date(),
        score: 0.88,
        highlight: null,
      };

      const scoreResolver = searchResolvers.DocumentSearchResult.score;
      const result = scoreResolver(docResult);

      expect(result).toBe(0.88);
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
  });
});
