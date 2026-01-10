/**
 * Search GraphQL Resolvers
 * Story 2.10: Basic AI Search Implementation - Tasks 15-16
 *
 * Resolvers for search queries using full-text search.
 * All queries require authentication and are scoped to the user's firm.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import {
  searchService,
  SearchFilters,
  SearchResult,
  CaseSearchResult,
  DocumentSearchResult,
  ClientSearchResult,
} from '../../services/search.service';
import { requireAuthWithFirm, type Context } from '../utils/auth';

// ============================================================================
// Types
// ============================================================================

interface SearchInput {
  query: string;
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

// Alias for backwards compatibility
const requireAuth = requireAuthWithFirm;

// ============================================================================
// Resolvers
// ============================================================================

export const searchResolvers = {
  Query: {
    /**
     * Main search query using PostgreSQL full-text search
     */
    search: async (_: unknown, { input }: { input: SearchInput }, context: Context) => {
      const { userId, firmId } = requireAuth(context);

      // Validate input
      validateSearchInput(input);

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
      const response = await searchService.search(input.query, firmId, filters, limit, offset);

      // Record search in history (async, don't await)
      searchService
        .recordSearch(userId, firmId, input.query, filters, response.totalCount)
        .catch((err) => {
          console.error('[Search Resolver] Failed to record search history:', err);
        });

      return {
        results: response.results,
        totalCount: response.totalCount,
        searchTime: response.searchTime,
        query: response.query,
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
  },
};
