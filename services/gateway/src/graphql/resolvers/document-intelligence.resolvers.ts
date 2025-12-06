/**
 * Document Intelligence Dashboard GraphQL Resolvers
 * Story 3.7: AI Document Intelligence Dashboard
 *
 * Implements queries for document intelligence analytics:
 * - documentIntelligenceDashboard: All metrics in one call
 * - Individual metric queries for drill-down/refresh
 *
 * Authorization: Partner, BusinessOwner, or Admin roles
 * Data isolation: All queries filtered by firmId
 */

import { GraphQLError } from 'graphql';
import { createDocumentIntelligenceService } from '../../services/document-intelligence.service';
import type { Context } from './case.resolvers';
import type { DocumentIntelligenceFilters } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DateRangeInput {
  startDate: Date | string;
  endDate: Date | string;
}

interface DocumentIntelligenceFiltersInput {
  dateRange: DateRangeInput;
  userIds?: string[];
  documentTypes?: string[];
  compareWithPrevious?: boolean;
}

interface DocumentIntelligenceArgs {
  filters: DocumentIntelligenceFiltersInput;
}

// Authorized roles for dashboard access
const AUTHORIZED_ROLES = ['Partner', 'BusinessOwner', 'Admin'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has authorization to access document intelligence dashboard
 */
function checkAuthorization(context: Context): void {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (!AUTHORIZED_ROLES.includes(context.user.role)) {
    throw new GraphQLError(
      'Access denied. Document Intelligence dashboard requires Partner, BusinessOwner, or Admin role.',
      {
        extensions: { code: 'FORBIDDEN' },
      }
    );
  }

  if (!context.user.firmId) {
    throw new GraphQLError('User must belong to a firm to access analytics', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

/**
 * Parse and validate date range input
 */
function parseFilters(input: DocumentIntelligenceFiltersInput): DocumentIntelligenceFilters {
  const startDate = new Date(input.dateRange.startDate);
  const endDate = new Date(input.dateRange.endDate);

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new GraphQLError('Invalid date format in dateRange', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (startDate > endDate) {
    throw new GraphQLError('dateRange.startDate must be before dateRange.endDate', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  // Limit date range to 1 year max for performance
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  if (endDate.getTime() - startDate.getTime() > oneYearMs) {
    throw new GraphQLError('Date range cannot exceed 1 year', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  return {
    dateRange: {
      startDate,
      endDate,
    },
    userIds: input.userIds,
    documentTypes: input.documentTypes,
    compareWithPrevious: input.compareWithPrevious ?? true,
  };
}

// ============================================================================
// Resolvers
// ============================================================================

export const documentIntelligenceResolvers = {
  Query: {
    /**
     * Get complete document intelligence dashboard data
     *
     * Returns all metrics in a single call:
     * - Document velocity by user and type
     * - AI utilization rates and adoption trends
     * - Error detection statistics
     * - Time savings calculations
     * - Template and clause usage
     * - Document quality trends
     *
     * Authorization: Partner, BusinessOwner, Admin
     * Caching: 5 minutes for dashboard, 1 minute for individual metrics
     */
    documentIntelligenceDashboard: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getDashboardMetrics(filters);
    },

    /**
     * Get document velocity statistics
     *
     * Shows document creation patterns:
     * - Total documents created
     * - Average per day
     * - Breakdown by user (top 10)
     * - Breakdown by document type
     * - Trend vs previous period
     */
    documentVelocityStats: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getDocumentVelocityStats(filters);
    },

    /**
     * Get AI utilization statistics
     *
     * Shows AI adoption metrics:
     * - Overall utilization rate
     * - AI vs manual document counts
     * - Breakdown by user
     * - Adoption trend over time
     */
    aiUtilizationStats: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getAIUtilizationStats(filters);
    },

    /**
     * Get error detection statistics
     *
     * Shows AI-detected concerns:
     * - Total concerns detected
     * - Resolution rate before filing
     * - Breakdown by severity (ERROR, WARNING, INFO)
     * - Breakdown by concern type
     * - Daily trend data
     */
    errorDetectionStats: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getErrorDetectionStats(filters);
    },

    /**
     * Get time savings statistics
     *
     * Calculates efficiency gains from AI:
     * - Total minutes saved
     * - Estimated cost savings (RON)
     * - Breakdown by user
     * - Breakdown by document type
     * - Methodology explanation
     */
    timeSavingsStats: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getTimeSavingsStats(filters);
    },

    /**
     * Get template usage statistics
     *
     * Shows template and clause usage:
     * - Top 10 templates by usage
     * - Top 10 clauses by frequency
     * - Total template usage
     * - Template adoption rate
     */
    templateUsageStats: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getTemplateUsageStats(filters);
    },

    /**
     * Get document quality trends
     *
     * Shows quality metrics:
     * - Overall quality score (0-100)
     * - Average edit percentage
     * - Average revision count
     * - Daily trend data
     * - Breakdown by document type
     * - Quality threshold (30%)
     */
    documentQualityTrends: async (
      _parent: unknown,
      args: DocumentIntelligenceArgs,
      context: Context
    ) => {
      checkAuthorization(context);
      const filters = parseFilters(args.filters);
      const service = createDocumentIntelligenceService(context);
      return service.getDocumentQualityTrends(filters);
    },
  },
};

export default documentIntelligenceResolvers;
