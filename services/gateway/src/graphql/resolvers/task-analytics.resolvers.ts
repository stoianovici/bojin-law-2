/**
 * Task Analytics GraphQL Resolvers
 * Story 4.7: Task Analytics and Optimization - Task 18
 *
 * Implements resolvers for all task analytics queries and mutations
 * AC: 1, 2, 3, 4, 5, 6 - All analytics features
 */

import { GraphQLError } from 'graphql';
import { TaskCompletionAnalyticsService } from '../../services/task-completion-analytics.service';
import { OverdueAnalysisService } from '../../services/overdue-analysis.service';
import { VelocityTrendsService } from '../../services/velocity-trends.service';
import { PatternDetectionService } from '../../services/pattern-detection.service';
import { DelegationAnalyticsService } from '../../services/delegation-analytics.service';
import { ROICalculatorService } from '../../services/roi-calculator.service';
import analyticsAggregationWorker from '../../workers/analytics-aggregation.worker';
import patternAnalysisWorker from '../../workers/pattern-analysis.worker';
import roiMetricsWorker from '../../workers/roi-metrics.worker';
import type {
  AnalyticsFilters,
  VelocityInterval,
  CreateTemplateFromPatternInput,
} from '@legal-platform/types';

// Initialize services
const completionService = new TaskCompletionAnalyticsService();
const overdueService = new OverdueAnalysisService();
const velocityService = new VelocityTrendsService();
const patternService = new PatternDetectionService();
const delegationService = new DelegationAnalyticsService();
const roiService = new ROICalculatorService();

// Role validation helper
function validatePartnerAccess(context: { user?: { role?: string } }): void {
  const role = context.user?.role;
  if (role !== 'Partner' && role !== 'BusinessOwner' && role !== 'Admin') {
    throw new GraphQLError('Access denied. Partner, BusinessOwner, or Admin role required.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

function validateAdminAccess(context: { user?: { role?: string } }): void {
  const role = context.user?.role;
  if (role !== 'Admin') {
    throw new GraphQLError('Access denied. Admin role required.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// Convert input to AnalyticsFilters
function toAnalyticsFilters(
  input: {
    dateRange: { start: Date; end: Date };
    taskTypes?: string[];
    userIds?: string[];
    caseIds?: string[];
    limit?: number;
    offset?: number;
  },
  firmId: string
): AnalyticsFilters {
  // Validate date range
  const startDate = new Date(input.dateRange.start);
  const endDate = new Date(input.dateRange.end);

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

  return {
    firmId,
    dateRange: { start: startDate, end: endDate },
    taskTypes: input.taskTypes as AnalyticsFilters['taskTypes'],
    userIds: input.userIds,
    caseIds: input.caseIds,
    limit: Math.min(input.limit || 100, 500),
    offset: input.offset || 0,
  };
}

export const taskAnalyticsResolvers = {
  Query: {
    // AC: 1 - Completion Time Analytics
    taskCompletionAnalytics: async (
      _parent: unknown,
      args: { filters: Parameters<typeof toAnalyticsFilters>[0] },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const filters = toAnalyticsFilters(args.filters, firmId);
      return completionService.getCompletionTimeAnalytics(firmId, filters);
    },

    // AC: 2 - Overdue Analysis
    overdueAnalytics: async (
      _parent: unknown,
      args: { filters: Parameters<typeof toAnalyticsFilters>[0] },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const filters = toAnalyticsFilters(args.filters, firmId);
      return overdueService.getOverdueAnalytics(firmId, filters);
    },

    // AC: 3 - Velocity Trends
    velocityTrends: async (
      _parent: unknown,
      args: {
        filters: Parameters<typeof toAnalyticsFilters>[0];
        interval: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const filters = toAnalyticsFilters(args.filters, firmId);
      const interval = args.interval.toLowerCase() as VelocityInterval;
      return velocityService.getVelocityTrends(firmId, filters, interval);
    },

    // AC: 4 - Pattern Detection
    taskPatterns: async (
      _parent: unknown,
      _args: unknown,
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      return patternService.detectTaskPatterns(firmId);
    },

    taskPattern: async (
      _parent: unknown,
      args: { patternId: string },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      return patternService.getPattern(args.patternId);
    },

    // AC: 5 - Delegation Analysis
    delegationAnalytics: async (
      _parent: unknown,
      args: { filters: Parameters<typeof toAnalyticsFilters>[0] },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const filters = toAnalyticsFilters(args.filters, firmId);
      return delegationService.getDelegationAnalytics(firmId, filters);
    },

    userDelegationPattern: async (
      _parent: unknown,
      args: { userId: string; filters: Parameters<typeof toAnalyticsFilters>[0] },
      context: { user?: { firmId?: string; role?: string; id?: string } }
    ) => {
      // Users can view their own delegation patterns
      const isOwnPattern = context.user?.id === args.userId;
      if (!isOwnPattern) {
        validatePartnerAccess(context);
      }

      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const filters = toAnalyticsFilters(args.filters, firmId);
      return delegationService.analyzeDelegationPatterns(firmId, args.userId, filters);
    },

    // AC: 6 - ROI Dashboard
    roiDashboard: async (
      _parent: unknown,
      args: { filters: Parameters<typeof toAnalyticsFilters>[0] },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const filters = toAnalyticsFilters(args.filters, firmId);
      return roiService.calculateROI(firmId, filters);
    },

    // Worker Health (Admin only)
    analyticsWorkersHealth: async (
      _parent: unknown,
      _args: unknown,
      context: { user?: { role?: string } }
    ) => {
      validateAdminAccess(context);

      const [aggregationHealth, patternHealth, roiHealth] = await Promise.all([
        analyticsAggregationWorker.getHealth(),
        patternAnalysisWorker.getHealth(),
        roiMetricsWorker.getHealth(),
      ]);

      return [aggregationHealth, patternHealth, roiHealth];
    },
  },

  Mutation: {
    // AC: 4 - Create template from pattern
    createTemplateFromPattern: async (
      _parent: unknown,
      args: { input: CreateTemplateFromPatternInput },
      context: { user?: { firmId?: string; role?: string; id?: string } }
    ) => {
      validatePartnerAccess(context);
      const userId = context.user?.id;
      if (!userId) {
        throw new GraphQLError('User ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      return patternService.createTemplateFromPattern(args.input, userId);
    },

    // Admin triggers
    triggerPatternAnalysis: async (
      _parent: unknown,
      _args: unknown,
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validateAdminAccess(context);
      const firmId = context.user?.firmId;
      if (!firmId) {
        throw new GraphQLError('Firm ID required', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      return patternService.detectTaskPatterns(firmId);
    },

    triggerAnalyticsAggregation: async (
      _parent: unknown,
      args: { date?: Date },
      context: { user?: { role?: string } }
    ) => {
      validateAdminAccess(context);
      await analyticsAggregationWorker.trigger(args.date ? new Date(args.date) : undefined);
      return true;
    },

    triggerROIMetricsCalculation: async (
      _parent: unknown,
      args: { month?: Date },
      context: { user?: { role?: string } }
    ) => {
      validateAdminAccess(context);
      await roiMetricsWorker.trigger(args.month ? new Date(args.month) : undefined);
      return true;
    },

    dismissPattern: async (
      _parent: unknown,
      args: { patternId: string },
      context: { user?: { firmId?: string; role?: string } }
    ) => {
      validatePartnerAccess(context);
      return patternService.dismissPattern(args.patternId);
    },
  },

  // Enum resolvers for proper mapping
  TrendDirection: {
    IMPROVING: 'improving',
    STABLE: 'stable',
    DECLINING: 'declining',
  },

  TrendDirectionSimple: {
    UP: 'up',
    STABLE: 'stable',
    DOWN: 'down',
  },

  VelocityInterval: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
  },

  ImpactLevel: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },

  BottleneckType: {
    USER_OVERLOAD: 'user_overload',
    TASK_TYPE_DELAY: 'task_type_delay',
    DEPENDENCY_CHAIN: 'dependency_chain',
    CASE_COMPLEXITY: 'case_complexity',
  },

  TrainingPriority: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },

  WorkerStatus: {
    HEALTHY: 'HEALTHY',
    STALE: 'STALE',
    ERROR: 'ERROR',
    DISABLED: 'DISABLED',
  },
};

export default taskAnalyticsResolvers;
