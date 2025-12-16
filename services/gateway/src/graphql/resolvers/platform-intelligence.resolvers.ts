/**
 * Platform Intelligence GraphQL Resolvers
 * Story 5.7: Platform Intelligence Dashboard - Task 6
 *
 * Implements resolvers for platform intelligence queries and mutations
 * AC: 1-6 - All acceptance criteria
 */

import { GraphQLError } from 'graphql';
import {
  PlatformIntelligenceService,
  getPlatformIntelligenceService,
} from '../../services/platform-intelligence.service';
import {
  CommunicationResponseAnalyticsService,
  getCommunicationResponseAnalyticsService,
} from '../../services/communication-response-analytics.service';
import {
  DocumentQualityAnalyticsService,
  getDocumentQualityAnalyticsService,
} from '../../services/document-quality-analytics.service';
import {
  AIUtilizationAnalyticsService,
  getAIUtilizationAnalyticsService,
} from '../../services/ai-utilization-analytics.service';
import type { PlatformDateRange, ExportFormat } from '@legal-platform/types';

// Initialize services
const platformService = getPlatformIntelligenceService();
const commService = getCommunicationResponseAnalyticsService();
const docService = getDocumentQualityAnalyticsService();
const aiService = getAIUtilizationAnalyticsService();

// GraphQL context type
interface GraphQLContext {
  user?: {
    id?: string;
    firmId?: string;
    role?: string;
  };
}

// Role validation helper - Partner/BusinessOwner only
function validatePartnerAccess(context: GraphQLContext): void {
  const role = context.user?.role;
  if (role !== 'Partner' && role !== 'BusinessOwner' && role !== 'Admin') {
    throw new GraphQLError('Access denied. Partner, BusinessOwner, or Admin role required.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// Get firmId from context with validation
function getFirmId(context: GraphQLContext): string {
  const firmId = context.user?.firmId;
  if (!firmId) {
    throw new GraphQLError('Firm ID required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return firmId;
}

// Convert GraphQL date range input to PlatformDateRange
function toDateRange(input: { start: Date; end: Date }): PlatformDateRange {
  const startDate = new Date(input.start);
  const endDate = new Date(input.end);

  if (endDate < startDate) {
    throw new GraphQLError('End date must be after start date', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 365) {
    throw new GraphQLError('Date range cannot exceed 365 days', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  return { startDate, endDate };
}

export const platformIntelligenceResolvers = {
  Query: {
    /**
     * Get full platform intelligence dashboard (AC: 1-6)
     */
    platformIntelligenceDashboard: async (
      _parent: unknown,
      args: { dateRange: { start: Date; end: Date } },
      context: GraphQLContext
    ) => {
      validatePartnerAccess(context);
      const firmId = getFirmId(context);
      const dateRange = toDateRange(args.dateRange);

      return platformService.getDashboard(firmId, dateRange);
    },

    /**
     * Get communication analytics section (AC: 2)
     */
    communicationAnalytics: async (
      _parent: unknown,
      args: { dateRange: { start: Date; end: Date } },
      context: GraphQLContext
    ) => {
      validatePartnerAccess(context);
      const firmId = getFirmId(context);
      const dateRange = toDateRange(args.dateRange);

      return commService.calculateResponseTimes(firmId, dateRange);
    },

    /**
     * Get document quality analytics section (AC: 3)
     */
    documentQualityAnalytics: async (
      _parent: unknown,
      args: { dateRange: { start: Date; end: Date } },
      context: GraphQLContext
    ) => {
      validatePartnerAccess(context);
      const firmId = getFirmId(context);
      const dateRange = toDateRange(args.dateRange);

      return docService.getDocumentQualityAnalytics(firmId, dateRange);
    },

    /**
     * Get AI utilization analytics section (AC: 5)
     */
    aiUtilizationAnalytics: async (
      _parent: unknown,
      args: { dateRange: { start: Date; end: Date } },
      context: GraphQLContext
    ) => {
      validatePartnerAccess(context);
      const firmId = getFirmId(context);
      const dateRange = toDateRange(args.dateRange);

      return aiService.getAIUtilizationByUser(firmId, dateRange);
    },

    /**
     * Get AI utilization for a specific user (AC: 5)
     */
    userAIUtilization: async (
      _parent: unknown,
      args: { userId: string; dateRange: { start: Date; end: Date } },
      context: GraphQLContext
    ) => {
      // Users can view their own utilization, Partners can view anyone's
      const isOwnData = context.user?.id === args.userId;
      if (!isOwnData) {
        validatePartnerAccess(context);
      }

      const dateRange = toDateRange(args.dateRange);
      return aiService.getUserAIUtilization(args.userId, dateRange);
    },
  },

  Mutation: {
    /**
     * Export platform intelligence dashboard
     */
    exportPlatformIntelligence: async (
      _parent: unknown,
      args: {
        dateRange: { start: Date; end: Date };
        format: 'PDF' | 'EXCEL' | 'CSV';
        sections?: {
          efficiency?: boolean;
          communication?: boolean;
          quality?: boolean;
          tasks?: boolean;
          ai?: boolean;
          roi?: boolean;
        };
      },
      context: GraphQLContext
    ) => {
      validatePartnerAccess(context);
      const firmId = getFirmId(context);
      const dateRange = toDateRange(args.dateRange);

      // Export service will be implemented in Task 7
      // For now, return a placeholder
      const format = args.format.toLowerCase() as ExportFormat;

      // TODO: Call dashboard-export.service.ts when implemented
      return {
        url: `https://storage.example.com/exports/${firmId}/dashboard-${Date.now()}.${format}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        format,
      };
    },

    /**
     * Manually refresh cached platform intelligence data
     */
    refreshPlatformIntelligence: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      validatePartnerAccess(context);
      const firmId = getFirmId(context);

      return platformService.refreshDashboard(firmId);
    },
  },

  // Enum resolvers for proper GraphQL mapping
  EmailRecipientType: {
    CLIENT: 'client',
    OPPOSING_COUNSEL: 'opposing_counsel',
    COURT: 'court',
    INTERNAL: 'internal',
  },

  AIFeatureType: {
    EMAIL_DRAFTING: 'email_drafting',
    DOCUMENT_GENERATION: 'document_generation',
    CLAUSE_SUGGESTIONS: 'clause_suggestions',
    TASK_PARSING: 'task_parsing',
    MORNING_BRIEFING: 'morning_briefing',
    PROACTIVE_SUGGESTIONS: 'proactive_suggestions',
    SEMANTIC_SEARCH: 'semantic_search',
    VERSION_COMPARISON: 'version_comparison',
    STYLE_ANALYSIS: 'style_analysis',
  },

  RecommendationCategory: {
    EFFICIENCY: 'efficiency',
    COMMUNICATION: 'communication',
    QUALITY: 'quality',
    ADOPTION: 'adoption',
  },

  RecommendationPriority: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },

  ExportFormat: {
    PDF: 'pdf',
    EXCEL: 'excel',
    CSV: 'csv',
  },
};

export default platformIntelligenceResolvers;
