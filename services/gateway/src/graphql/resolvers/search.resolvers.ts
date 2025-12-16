/**
 * Search GraphQL Resolvers
 * Story 2.10: Basic AI Search Implementation - Tasks 15-16
 *
 * Resolvers for search queries including full-text, semantic, and hybrid search.
 * All queries require authentication and are scoped to the user's firm.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import {
  searchService,
  SearchMode,
  SearchFilters,
  SearchResult,
  CaseSearchResult,
  DocumentSearchResult,
  ClientSearchResult,
} from '../../services/search.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string | null;
    email: string;
    role: string;
  };
}

interface SearchInput {
  query: string;
  searchMode?: 'FULL_TEXT' | 'SEMANTIC' | 'HYBRID';
  filters?: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    caseIds?: string[];
    caseTypes?: string[];
    caseStatuses?: string[];
    documentTypes?: string[];
    clientIds?: string[];
  };
  limit?: number;
  offset?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map GraphQL search mode to service search mode
 */
function mapSearchMode(mode?: string): SearchMode {
  switch (mode) {
    case 'FULL_TEXT':
      return SearchMode.FULL_TEXT;
    case 'SEMANTIC':
      return SearchMode.SEMANTIC;
    case 'HYBRID':
    default:
      return SearchMode.HYBRID;
  }
}

/**
 * Map service search type to database enum
 */
function mapSearchTypeToDb(mode: SearchMode): 'FullText' | 'Semantic' | 'Hybrid' {
  switch (mode) {
    case SearchMode.FULL_TEXT:
      return 'FullText';
    case SearchMode.SEMANTIC:
      return 'Semantic';
    case SearchMode.HYBRID:
    default:
      return 'Hybrid';
  }
}

/**
 * Validate search input
 */
function validateSearchInput(input: SearchInput): void {
  if (!input.query || input.query.trim().length === 0) {
    throw new GraphQLError('Search query cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (input.query.length > 500) {
    throw new GraphQLError('Search query cannot exceed 500 characters', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (input.limit !== undefined && (input.limit < 1 || input.limit > 100)) {
    throw new GraphQLError('Limit must be between 1 and 100', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (input.offset !== undefined && input.offset < 0) {
    throw new GraphQLError('Offset cannot be negative', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

/**
 * Require authentication and firm membership
 */
function requireAuth(context: Context): { userId: string; firmId: string } {
  if (!context.user?.id) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (!context.user.firmId) {
    throw new GraphQLError('User must be associated with a firm', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return { userId: context.user.id, firmId: context.user.firmId };
}

// ============================================================================
// Resolvers
// ============================================================================

export const searchResolvers = {
  Query: {
    /**
     * Main search query
     * Supports full-text, semantic, and hybrid search modes
     */
    search: async (_: unknown, { input }: { input: SearchInput }, context: Context) => {
      const { userId, firmId } = requireAuth(context);

      // Validate input
      validateSearchInput(input);

      const searchMode = mapSearchMode(input.searchMode);
      const limit = Math.min(input.limit || 20, 100);
      const offset = input.offset || 0;

      // Build filters
      const filters: SearchFilters = {};

      if (input.filters) {
        if (input.filters.dateRange) {
          filters.dateRange = {
            start: new Date(input.filters.dateRange.start),
            end: new Date(input.filters.dateRange.end),
          };
        }

        if (input.filters.caseIds?.length) {
          filters.caseIds = input.filters.caseIds;
        }

        if (input.filters.caseTypes?.length) {
          filters.caseTypes = input.filters.caseTypes as any[];
        }

        if (input.filters.caseStatuses?.length) {
          filters.caseStatuses = input.filters.caseStatuses as any[];
        }

        if (input.filters.documentTypes?.length) {
          filters.documentTypes = input.filters.documentTypes;
        }

        if (input.filters.clientIds?.length) {
          filters.clientIds = input.filters.clientIds;
        }
      }

      // Execute search
      const response = await searchService.search(
        input.query,
        firmId,
        searchMode,
        filters,
        limit,
        offset
      );

      // Record search in history (async, don't await)
      searchService
        .recordSearch(
          userId,
          firmId,
          input.query,
          mapSearchTypeToDb(searchMode),
          filters,
          response.totalCount
        )
        .catch((err) => {
          console.error('[Search Resolver] Failed to record search history:', err);
        });

      return {
        results: response.results,
        totalCount: response.totalCount,
        searchTime: response.searchTime,
        query: response.query,
        searchMode: input.searchMode || 'HYBRID',
      };
    },

    /**
     * Get recent searches for the current user
     */
    recentSearches: async (_: unknown, { limit = 10 }: { limit?: number }, context: Context) => {
      const { userId } = requireAuth(context);

      // Validate limit
      const safeLimit = Math.min(Math.max(limit, 1), 50);

      const searches = await searchService.getRecentSearches(userId, safeLimit);

      return searches.map((s) => ({
        id: s.id,
        query: s.query,
        searchMode: s.searchType.toUpperCase(),
        filters: s.filters,
        resultCount: s.resultCount,
        createdAt: s.createdAt,
      }));
    },
  },

  // Union type resolver
  SearchResult: {
    __resolveType(obj: SearchResult) {
      if (obj.type === 'case') {
        return 'CaseSearchResult';
      }
      if (obj.type === 'document') {
        return 'DocumentSearchResult';
      }
      if (obj.type === 'client') {
        return 'ClientSearchResult';
      }
      return null;
    },
  },

  // Case search result resolver
  CaseSearchResult: {
    case: async (result: CaseSearchResult) => {
      // Fetch full case data
      const caseData = await prisma.case.findUnique({
        where: { id: result.id },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
        },
      });

      return caseData;
    },
    score: (result: CaseSearchResult) => result.score,
    highlight: (result: CaseSearchResult) => result.highlight,
    matchType: (result: CaseSearchResult) => result.matchType,
  },

  // Document search result resolver
  DocumentSearchResult: {
    document: async (result: DocumentSearchResult) => {
      // Fetch full document data
      const document = await prisma.document.findUnique({
        where: { id: result.id },
        include: {
          client: true,
          uploader: true,
        },
      });

      return document;
    },
    score: (result: DocumentSearchResult) => result.score,
    highlight: (result: DocumentSearchResult) => result.highlight,
    matchType: (result: DocumentSearchResult) => result.matchType,
  },

  // Client search result resolver
  ClientSearchResult: {
    client: async (result: ClientSearchResult) => {
      // Fetch full client data
      const client = await prisma.client.findUnique({
        where: { id: result.id },
        include: {
          cases: {
            take: 5,
            orderBy: { openedDate: 'desc' },
          },
        },
      });

      return client;
    },
    score: (result: ClientSearchResult) => result.score,
    highlight: (result: ClientSearchResult) => result.highlight,
    matchType: (result: ClientSearchResult) => result.matchType,
  },
};
