/**
 * AI Monitoring GraphQL Resolvers
 * Story 3.1: AI Service Infrastructure
 *
 * Implements resolvers for AI usage statistics and provider health monitoring
 */

import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

// Types for resolver context
interface Context {
  prisma: PrismaClient;
  user?: {
    id: string;
    role: string;
    firmId?: string;
  };
}

interface DateRangeInput {
  start: Date;
  end: Date;
}

// Authorization helper
function requirePartnerOrBusinessOwner(context: Context): void {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  const allowedRoles = ['Partner', 'BusinessOwner'];
  if (!allowedRoles.includes(context.user.role)) {
    throw new GraphQLError('Access denied. Requires Partner or BusinessOwner role.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// Validate firm access
function validateFirmAccess(context: Context, firmId: string): void {
  if (context.user?.firmId && context.user.firmId !== firmId) {
    throw new GraphQLError('Access denied. Cannot access data from another firm.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

export const aiMonitoringResolvers = {
  Query: {
    /**
     * Get AI usage statistics for a firm
     */
    aiUsageStats: async (
      _parent: unknown,
      args: { dateRange: DateRangeInput; firmId: string },
      context: Context
    ) => {
      requirePartnerOrBusinessOwner(context);
      validateFirmAccess(context, args.firmId);

      const where = {
        firmId: args.firmId,
        createdAt: {
          gte: args.dateRange.start,
          lte: args.dateRange.end,
        },
      };

      // Get overall aggregates
      const aggregates = await context.prisma.aITokenUsage.aggregate({
        where,
        _sum: {
          totalTokens: true,
          costCents: true,
        },
        _avg: {
          latencyMs: true,
        },
        _count: true,
      });

      // Get cache hit count
      const cacheHits = await context.prisma.aITokenUsage.count({
        where: {
          ...where,
          cached: true,
        },
      });

      // Get usage by model
      const byModel = await context.prisma.aITokenUsage.groupBy({
        by: ['modelUsed'],
        where,
        _sum: {
          totalTokens: true,
          costCents: true,
        },
        _count: true,
      });

      // Get usage by operation type
      const byOperation = await context.prisma.aITokenUsage.groupBy({
        by: ['operationType'],
        where,
        _sum: {
          totalTokens: true,
          costCents: true,
        },
        _count: true,
      });

      const totalRequests = aggregates._count || 0;
      const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

      return {
        totalTokens: aggregates._sum.totalTokens || 0,
        totalCostCents: aggregates._sum.costCents || 0,
        requestCount: totalRequests,
        avgLatencyMs: aggregates._avg.latencyMs || 0,
        cacheHitRate,
        byModel: byModel.map((m) => ({
          model: m.modelUsed,
          tokens: m._sum.totalTokens || 0,
          costCents: m._sum.costCents || 0,
          requestCount: m._count,
        })),
        byOperation: byOperation.map((o) => ({
          operation: o.operationType,
          tokens: o._sum.totalTokens || 0,
          costCents: o._sum.costCents || 0,
          requestCount: o._count,
        })),
      };
    },

    /**
     * Get health status of AI providers
     * Note: In production, this would call the AI service health endpoint
     */
    aiProviderHealth: async (_parent: unknown, _args: unknown, context: Context) => {
      requirePartnerOrBusinessOwner(context);

      // Return simulated health status
      // In production, this would call the AI service's health check endpoint
      return [
        {
          provider: 'claude',
          status: 'HEALTHY',
          latencyMs: 150,
          lastChecked: new Date(),
          consecutiveFailures: 0,
        },
        {
          provider: 'grok',
          status: 'HEALTHY',
          latencyMs: 200,
          lastChecked: new Date(),
          consecutiveFailures: 0,
        },
      ];
    },

    /**
     * Get daily usage trend for charts
     */
    aiDailyUsageTrend: async (
      _parent: unknown,
      args: { dateRange: DateRangeInput; firmId: string },
      context: Context
    ) => {
      requirePartnerOrBusinessOwner(context);
      validateFirmAccess(context, args.firmId);

      const records = await context.prisma.aITokenUsage.findMany({
        where: {
          firmId: args.firmId,
          createdAt: {
            gte: args.dateRange.start,
            lte: args.dateRange.end,
          },
        },
        select: {
          createdAt: true,
          totalTokens: true,
          costCents: true,
        },
      });

      // Group by date
      const dailyMap = new Map<
        string,
        { tokens: number; costCents: number; requests: number }
      >();

      for (const record of records) {
        const date = record.createdAt.toISOString().split('T')[0];
        const existing = dailyMap.get(date) || {
          tokens: 0,
          costCents: 0,
          requests: 0,
        };
        dailyMap.set(date, {
          tokens: existing.tokens + record.totalTokens,
          costCents: existing.costCents + record.costCents,
          requests: existing.requests + 1,
        });
      }

      // Convert to sorted array
      return Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  },
};
