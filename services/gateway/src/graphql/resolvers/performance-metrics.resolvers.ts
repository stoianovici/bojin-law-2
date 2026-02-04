/**
 * Performance Metrics GraphQL Resolvers
 * Story 3.8: Document System Testing and Performance - Task 17
 *
 * Implements resolvers for performance metrics dashboard
 * Requires Partner or Admin role for access
 */

import { GraphQLError } from 'graphql';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  PerformanceMetricsService,
  getPerformanceMetricsService,
  PERFORMANCE_THRESHOLDS,
} from '../../services/performance-metrics.service';

// Types for resolver context
interface Context {
  prisma: PrismaClient;
  redis: Redis;
  user?: {
    id: string;
    role: string;
    firmId?: string;
    hasOperationalOversight?: boolean;
  };
}

// Authorization helper
function requirePartnerOrAdmin(context: Context): void {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  const allowedRoles = ['Partner', 'BusinessOwner', 'Admin'];
  if (!allowedRoles.includes(context.user.role) && !context.user.hasOperationalOversight) {
    throw new GraphQLError(
      'Access denied. Requires Partner, Admin role or operational oversight.',
      {
        extensions: { code: 'FORBIDDEN' },
      }
    );
  }
}

// Get service instance from context
function getService(context: Context): PerformanceMetricsService {
  return getPerformanceMetricsService(context.prisma, context.redis);
}

export const performanceMetricsResolvers = {
  Query: {
    /**
     * Get real-time performance snapshot
     */
    performanceSnapshot: async (_parent: unknown, args: { firmId?: string }, context: Context) => {
      requirePartnerOrAdmin(context);
      const service = getService(context);

      const snapshot = await service.getPerformanceSnapshot(args.firmId);

      // Transform to GraphQL format
      return {
        timestamp: snapshot.timestamp,
        api: {
          totalRequests: snapshot.api.totalRequests,
          avgResponseTime: snapshot.api.avgResponseTime,
          p95ResponseTime: snapshot.api.p95ResponseTime,
          errorRate: snapshot.api.errorRate,
          byEndpoint: snapshot.api.byEndpoint.map((e) => ({
            endpoint: e.endpoint,
            method: e.method,
            requestCount: e.requestCount,
            avgResponseTime: e.avgResponseTime,
            p95ResponseTime: e.p95ResponseTime,
            errorCount: e.errorCount,
            status: e.status.toUpperCase(),
          })),
        },
        ai: {
          totalOperations: snapshot.ai.totalOperations,
          avgLatency: snapshot.ai.avgLatency,
          p95Latency: snapshot.ai.p95Latency,
          byModel: snapshot.ai.byModel.map((m) => ({
            model: m.model,
            requestCount: m.requestCount,
            avgTTFT: m.avgTTFT,
            avgTotalLatency: m.avgTotalLatency,
            errorCount: m.errorCount,
            status: m.status.toUpperCase(),
          })),
          byOperation: snapshot.ai.byOperation.map((o) => ({
            operation: o.operation,
            count: o.count,
            avgLatency: o.avgLatency,
            p95Latency: o.p95Latency,
            successRate: o.successRate,
          })),
        },
        database: {
          queryCount: snapshot.database.queryCount,
          avgQueryTime: snapshot.database.avgQueryTime,
          p95QueryTime: snapshot.database.p95QueryTime,
          connectionPoolUsage: snapshot.database.connectionPoolUsage,
          slowQueries: snapshot.database.slowQueries,
        },
        cache: {
          hitRate: snapshot.cache.hitRate,
          missRate: snapshot.cache.missRate,
          totalRequests: snapshot.cache.totalRequests,
          memoryUsage: snapshot.cache.memoryUsage,
        },
        system: {
          uptime: snapshot.system.uptime,
          memoryUsage: {
            heapUsed: snapshot.system.memoryUsage.heapUsed,
            heapTotal: snapshot.system.memoryUsage.heapTotal,
            external: snapshot.system.memoryUsage.external,
            rss: snapshot.system.memoryUsage.rss,
          },
          cpuUsage: snapshot.system.cpuUsage,
          activeConnections: snapshot.system.activeConnections,
        },
      };
    },

    /**
     * Get historical performance metrics
     */
    performanceHistory: async (
      _parent: unknown,
      args: {
        metricType: 'API' | 'AI' | 'DATABASE' | 'CACHE';
        startDate: Date;
        endDate: Date;
        interval?: 'HOUR' | 'DAY';
      },
      context: Context
    ) => {
      requirePartnerOrAdmin(context);
      const service = getService(context);

      const metricTypeMap: Record<string, 'api' | 'ai' | 'database' | 'cache'> = {
        API: 'api',
        AI: 'ai',
        DATABASE: 'database',
        CACHE: 'cache',
      };

      const intervalMap: Record<string, 'hour' | 'day'> = {
        HOUR: 'hour',
        DAY: 'day',
      };

      return service.getHistoricalMetrics(
        metricTypeMap[args.metricType],
        args.startDate,
        args.endDate,
        intervalMap[args.interval || 'HOUR']
      );
    },

    /**
     * Get active performance alerts
     */
    performanceAlerts: async (
      _parent: unknown,
      args: {
        severity?: 'INFO' | 'WARNING' | 'CRITICAL';
        acknowledged?: boolean;
      },
      context: Context
    ) => {
      requirePartnerOrAdmin(context);
      const service = getService(context);

      const severityMap: Record<string, 'info' | 'warning' | 'critical'> = {
        INFO: 'info',
        WARNING: 'warning',
        CRITICAL: 'critical',
      };

      const alerts = service.getAlerts(
        args.severity ? severityMap[args.severity] : undefined,
        args.acknowledged
      );

      const typeMap: Record<string, string> = {
        api_slow: 'API_SLOW',
        ai_slow: 'AI_SLOW',
        db_slow: 'DB_SLOW',
        cache_low: 'CACHE_LOW',
        error_rate_high: 'ERROR_RATE_HIGH',
        resource_high: 'RESOURCE_HIGH',
      };

      return alerts.map((alert) => ({
        id: alert.id,
        type: typeMap[alert.type] || alert.type.toUpperCase(),
        severity: alert.severity.toUpperCase(),
        metric: alert.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged,
      }));
    },

    /**
     * Get endpoint performance ranking
     */
    endpointRanking: async (
      _parent: unknown,
      args: {
        limit?: number;
        sortBy?: 'SLOWEST' | 'MOST_ERRORS' | 'MOST_REQUESTS';
      },
      context: Context
    ) => {
      requirePartnerOrAdmin(context);
      const service = getService(context);

      const sortByMap: Record<string, 'slowest' | 'most_errors' | 'most_requests'> = {
        SLOWEST: 'slowest',
        MOST_ERRORS: 'most_errors',
        MOST_REQUESTS: 'most_requests',
      };

      const endpoints = await service.getEndpointRanking(
        args.limit || 10,
        sortByMap[args.sortBy || 'SLOWEST']
      );

      return endpoints.map((e) => ({
        endpoint: e.endpoint,
        method: e.method,
        requestCount: e.requestCount,
        avgResponseTime: e.avgResponseTime,
        p95ResponseTime: e.p95ResponseTime,
        errorCount: e.errorCount,
        status: e.status.toUpperCase(),
      }));
    },

    /**
     * Get AI model performance comparison
     */
    aiModelComparison: async (_parent: unknown, _args: unknown, context: Context) => {
      requirePartnerOrAdmin(context);
      const service = getService(context);

      const models = await service.getModelComparison();

      return models.map((m) => ({
        model: m.model,
        requestCount: m.requestCount,
        avgTTFT: m.avgTTFT,
        avgTotalLatency: m.avgTotalLatency,
        errorCount: m.errorCount,
        status: m.status.toUpperCase(),
      }));
    },

    /**
     * Get configured performance thresholds
     */
    performanceThresholds: async (_parent: unknown, _args: unknown, context: Context) => {
      requirePartnerOrAdmin(context);

      return {
        api: {
          documentUpload: {
            p95: PERFORMANCE_THRESHOLDS.api.documentUpload.p95,
            target: PERFORMANCE_THRESHOLDS.api.documentUpload.target,
          },
          documentDownload: {
            p95: PERFORMANCE_THRESHOLDS.api.documentDownload.p95,
            target: PERFORMANCE_THRESHOLDS.api.documentDownload.target,
          },
          search: {
            p95: PERFORMANCE_THRESHOLDS.api.search.p95,
            target: PERFORMANCE_THRESHOLDS.api.search.target,
          },
          graphql: {
            p95: PERFORMANCE_THRESHOLDS.api.graphql.p95,
            target: PERFORMANCE_THRESHOLDS.api.graphql.target,
          },
        },
        ai: {
          haiku: {
            ttft: PERFORMANCE_THRESHOLDS.ai.haiku.ttft,
            total: PERFORMANCE_THRESHOLDS.ai.haiku.total,
          },
          sonnet: {
            ttft: PERFORMANCE_THRESHOLDS.ai.sonnet.ttft,
            total: PERFORMANCE_THRESHOLDS.ai.sonnet.total,
          },
          opus: {
            ttft: PERFORMANCE_THRESHOLDS.ai.opus.ttft,
            total: PERFORMANCE_THRESHOLDS.ai.opus.total,
          },
        },
        database: {
          query: {
            p95: PERFORMANCE_THRESHOLDS.database.query.p95,
            target: PERFORMANCE_THRESHOLDS.database.query.target,
          },
          transaction: {
            p95: PERFORMANCE_THRESHOLDS.database.transaction.p95,
            target: PERFORMANCE_THRESHOLDS.database.transaction.target,
          },
        },
        cache: {
          minHitRate: PERFORMANCE_THRESHOLDS.cache.minHitRate,
        },
      };
    },
  },

  Mutation: {
    /**
     * Acknowledge a performance alert
     */
    acknowledgePerformanceAlert: async (
      _parent: unknown,
      args: { alertId: string },
      context: Context
    ) => {
      requirePartnerOrAdmin(context);
      const service = getService(context);

      return service.acknowledgeAlert(args.alertId);
    },
  },
};
