// @ts-nocheck
/**
 * Performance Metrics Service
 * Story 3.8: Document System Testing and Performance - Task 17
 *
 * Collects and aggregates system performance metrics:
 * - API response times
 * - AI operation latencies
 * - Database query times
 * - Cache hit/miss rates
 * - System health indicators
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Performance thresholds from story requirements
export const PERFORMANCE_THRESHOLDS = {
  api: {
    documentUpload: { p95: 3000, target: 2000 }, // ms
    documentDownload: { p95: 1000, target: 500 },
    search: { p95: 500, target: 300 },
    graphql: { p95: 200, target: 100 },
  },
  ai: {
    haiku: { ttft: 500, total: 2000 },
    sonnet: { ttft: 1000, total: 5000 },
    opus: { ttft: 2000, total: 15000 },
    semanticDiff: {
      small: { pages: 10, target: 5000 },
      medium: { pages: 50, target: 15000 },
      large: { pages: 100, target: 30000 },
    },
  },
  database: {
    query: { p95: 100, target: 50 },
    transaction: { p95: 500, target: 200 },
  },
  cache: {
    minHitRate: 0.7, // 70% minimum cache hit rate
  },
};

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  operation: string;
  metadata?: Record<string, unknown>;
}

export interface AggregatedMetrics {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface PerformanceSnapshot {
  timestamp: Date;
  api: {
    totalRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    byEndpoint: EndpointMetrics[];
  };
  ai: {
    totalOperations: number;
    avgLatency: number;
    p95Latency: number;
    byModel: ModelMetrics[];
    byOperation: OperationMetrics[];
  };
  database: {
    queryCount: number;
    avgQueryTime: number;
    p95QueryTime: number;
    connectionPoolUsage: number;
    slowQueries: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    memoryUsage: number;
  };
  system: {
    uptime: number;
    memoryUsage: MemoryUsage;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface EndpointMetrics {
  endpoint: string;
  method: string;
  requestCount: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  errorCount: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface ModelMetrics {
  model: string;
  requestCount: number;
  avgTTFT: number;
  avgTotalLatency: number;
  errorCount: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface OperationMetrics {
  operation: string;
  count: number;
  avgLatency: number;
  p95Latency: number;
  successRate: number;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'api_slow' | 'ai_slow' | 'db_slow' | 'cache_low' | 'error_rate_high' | 'resource_high';
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface TimeSeriesData {
  timestamps: string[];
  values: number[];
  label: string;
}

export class PerformanceMetricsService {
  private prisma: PrismaClient;
  private redis: Redis;
  private metricsBuffer: MetricDataPoint[] = [];
  private flushInterval: NodeJS.Timer | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 seconds
  private alerts: Map<string, PerformanceAlert> = new Map();

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    this.startFlushInterval();
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch(console.error);
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Record an API response time metric
   */
  async recordApiMetric(
    endpoint: string,
    method: string,
    responseTimeMs: number,
    statusCode: number,
    firmId?: string
  ): Promise<void> {
    const key = `metrics:api:${method}:${endpoint}`;
    const hourKey = `${key}:${this.getHourKey()}`;

    // Store in Redis for real-time aggregation
    await Promise.all([
      this.redis.lpush(`${hourKey}:times`, responseTimeMs.toString()),
      this.redis.ltrim(`${hourKey}:times`, 0, 999), // Keep last 1000
      this.redis.incr(`${hourKey}:count`),
      statusCode >= 400 && this.redis.incr(`${hourKey}:errors`),
      this.redis.expire(`${hourKey}:times`, 3600),
      this.redis.expire(`${hourKey}:count`, 3600),
      this.redis.expire(`${hourKey}:errors`, 3600),
    ]);

    // Buffer for batch persistence
    this.metricsBuffer.push({
      timestamp: new Date(),
      value: responseTimeMs,
      operation: `${method} ${endpoint}`,
      metadata: { statusCode, firmId },
    });

    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      await this.flushMetrics();
    }

    // Check for alerts
    await this.checkApiThresholds(endpoint, method, responseTimeMs);
  }

  /**
   * Record an AI operation latency metric
   */
  async recordAiMetric(
    operation: string,
    model: string,
    ttftMs: number,
    totalLatencyMs: number,
    tokenCount: number,
    firmId: string,
    success: boolean
  ): Promise<void> {
    const key = `metrics:ai:${model}:${operation}`;
    const hourKey = `${key}:${this.getHourKey()}`;

    await Promise.all([
      this.redis.lpush(`${hourKey}:ttft`, ttftMs.toString()),
      this.redis.lpush(`${hourKey}:total`, totalLatencyMs.toString()),
      this.redis.ltrim(`${hourKey}:ttft`, 0, 999),
      this.redis.ltrim(`${hourKey}:total`, 0, 999),
      this.redis.incr(`${hourKey}:count`),
      this.redis.incrby(`${hourKey}:tokens`, tokenCount),
      !success && this.redis.incr(`${hourKey}:errors`),
      this.redis.expire(`${hourKey}:ttft`, 3600),
      this.redis.expire(`${hourKey}:total`, 3600),
      this.redis.expire(`${hourKey}:count`, 3600),
      this.redis.expire(`${hourKey}:tokens`, 3600),
      this.redis.expire(`${hourKey}:errors`, 3600),
    ]);

    // Check for AI performance alerts
    await this.checkAiThresholds(model, operation, ttftMs, totalLatencyMs);
  }

  /**
   * Record a database query metric
   */
  async recordDbMetric(
    queryType: string,
    durationMs: number,
    table?: string
  ): Promise<void> {
    const key = `metrics:db:${queryType}`;
    const hourKey = `${key}:${this.getHourKey()}`;

    await Promise.all([
      this.redis.lpush(`${hourKey}:times`, durationMs.toString()),
      this.redis.ltrim(`${hourKey}:times`, 0, 999),
      this.redis.incr(`${hourKey}:count`),
      durationMs > PERFORMANCE_THRESHOLDS.database.query.p95 &&
        this.redis.incr(`${hourKey}:slow`),
      this.redis.expire(`${hourKey}:times`, 3600),
      this.redis.expire(`${hourKey}:count`, 3600),
      this.redis.expire(`${hourKey}:slow`, 3600),
    ]);

    // Alert on slow queries
    if (durationMs > PERFORMANCE_THRESHOLDS.database.query.p95) {
      await this.createAlert({
        type: 'db_slow',
        severity: durationMs > 500 ? 'critical' : 'warning',
        metric: `database.${queryType}${table ? `.${table}` : ''}`,
        currentValue: durationMs,
        threshold: PERFORMANCE_THRESHOLDS.database.query.p95,
        message: `Slow database query: ${queryType} took ${durationMs}ms`,
      });
    }
  }

  /**
   * Record cache hit/miss
   */
  async recordCacheMetric(hit: boolean, cacheType: string): Promise<void> {
    const key = `metrics:cache:${cacheType}`;
    const hourKey = `${key}:${this.getHourKey()}`;

    await Promise.all([
      this.redis.incr(`${hourKey}:total`),
      hit && this.redis.incr(`${hourKey}:hits`),
      this.redis.expire(`${hourKey}:total`, 3600),
      this.redis.expire(`${hourKey}:hits`, 3600),
    ]);
  }

  /**
   * Get real-time performance snapshot
   */
  async getPerformanceSnapshot(firmId?: string): Promise<PerformanceSnapshot> {
    const hourKey = this.getHourKey();

    // Gather all metrics in parallel
    const [
      apiMetrics,
      aiMetrics,
      dbMetrics,
      cacheMetrics,
    ] = await Promise.all([
      this.getApiMetrics(hourKey),
      this.getAiMetrics(hourKey),
      this.getDbMetrics(hourKey),
      this.getCacheMetrics(hourKey),
    ]);

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      timestamp: new Date(),
      api: apiMetrics,
      ai: aiMetrics,
      database: dbMetrics,
      cache: cacheMetrics,
      system: {
        uptime,
        memoryUsage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpuUsage: await this.getCpuUsage(),
        activeConnections: await this.getActiveConnections(),
      },
    };
  }

  /**
   * Get historical metrics for a time range
   */
  async getHistoricalMetrics(
    metricType: 'api' | 'ai' | 'database' | 'cache',
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' = 'hour'
  ): Promise<TimeSeriesData[]> {
    const results: TimeSeriesData[] = [];
    const intervalMs = interval === 'hour' ? 3600000 : 86400000;

    // Generate time buckets
    const buckets: Date[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      buckets.push(new Date(current));
      current = new Date(current.getTime() + intervalMs);
    }

    // Fetch data for each metric type
    switch (metricType) {
      case 'api':
        results.push(await this.getApiTimeSeries(buckets));
        break;
      case 'ai':
        results.push(await this.getAiTimeSeries(buckets));
        break;
      case 'database':
        results.push(await this.getDbTimeSeries(buckets));
        break;
      case 'cache':
        results.push(await this.getCacheTimeSeries(buckets));
        break;
    }

    return results;
  }

  /**
   * Get performance alerts
   */
  getAlerts(
    severity?: 'info' | 'warning' | 'critical',
    acknowledged?: boolean
  ): PerformanceAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (severity) {
      alerts = alerts.filter((a) => a.severity === severity);
    }

    if (acknowledged !== undefined) {
      alerts = alerts.filter((a) => a.acknowledged === acknowledged);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get endpoint performance ranking
   */
  async getEndpointRanking(
    limit: number = 10,
    sortBy: 'slowest' | 'most_errors' | 'most_requests' = 'slowest'
  ): Promise<EndpointMetrics[]> {
    const endpoints = await this.getApiMetrics(this.getHourKey());

    switch (sortBy) {
      case 'slowest':
        return endpoints.byEndpoint
          .sort((a, b) => b.p95ResponseTime - a.p95ResponseTime)
          .slice(0, limit);
      case 'most_errors':
        return endpoints.byEndpoint
          .sort((a, b) => b.errorCount - a.errorCount)
          .slice(0, limit);
      case 'most_requests':
        return endpoints.byEndpoint
          .sort((a, b) => b.requestCount - a.requestCount)
          .slice(0, limit);
    }
  }

  /**
   * Get AI model performance comparison
   */
  async getModelComparison(): Promise<ModelMetrics[]> {
    const aiMetrics = await this.getAiMetrics(this.getHourKey());
    return aiMetrics.byModel;
  }

  /**
   * Calculate percentile from array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current hour key for Redis
   */
  private getHourKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  }

  /**
   * Flush buffered metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const toFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    // Store in database for long-term analysis
    try {
      await this.prisma.performanceMetric.createMany({
        data: toFlush.map((m) => ({
          timestamp: m.timestamp,
          value: m.value,
          operation: m.operation,
          metadata: m.metadata || {},
        })),
      });
    } catch (error) {
      // Re-buffer on failure
      this.metricsBuffer = [...toFlush, ...this.metricsBuffer];
      console.error('Failed to flush metrics:', error);
    }
  }

  /**
   * Get API metrics for the current hour
   */
  private async getApiMetrics(hourKey: string): Promise<{
    totalRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    byEndpoint: EndpointMetrics[];
  }> {
    const pattern = `metrics:api:*:${hourKey}:count`;
    const keys = await this.redis.keys(pattern.replace(`:${hourKey}`, '*'));

    const uniqueEndpoints = new Set<string>();
    for (const key of keys) {
      const match = key.match(/metrics:api:(\w+):(.+?):/);
      if (match) {
        uniqueEndpoints.add(`${match[1]}:${match[2]}`);
      }
    }

    const byEndpoint: EndpointMetrics[] = [];
    let totalRequests = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    const allTimes: number[] = [];

    for (const endpoint of uniqueEndpoints) {
      const [method, path] = endpoint.split(':');
      const key = `metrics:api:${method}:${path}:${hourKey}`;

      const [timesStr, countStr, errorsStr] = await Promise.all([
        this.redis.lrange(`${key}:times`, 0, -1),
        this.redis.get(`${key}:count`),
        this.redis.get(`${key}:errors`),
      ]);

      const times = timesStr.map(Number);
      const count = parseInt(countStr || '0', 10);
      const errors = parseInt(errorsStr || '0', 10);

      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const p95 = this.calculatePercentile(times, 95);
        const threshold = this.getEndpointThreshold(path);

        byEndpoint.push({
          endpoint: path,
          method,
          requestCount: count,
          avgResponseTime: avg,
          p95ResponseTime: p95,
          errorCount: errors,
          status: this.getHealthStatus(p95, threshold.p95, errors, count),
        });

        totalRequests += count;
        totalResponseTime += avg * count;
        totalErrors += errors;
        allTimes.push(...times);
      }
    }

    return {
      totalRequests,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      p95ResponseTime: this.calculatePercentile(allTimes, 95),
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      byEndpoint,
    };
  }

  /**
   * Get AI metrics for the current hour
   */
  private async getAiMetrics(hourKey: string): Promise<{
    totalOperations: number;
    avgLatency: number;
    p95Latency: number;
    byModel: ModelMetrics[];
    byOperation: OperationMetrics[];
  }> {
    const pattern = `metrics:ai:*:${hourKey}:count`;
    const keys = await this.redis.keys(pattern.replace(`:${hourKey}`, '*'));

    const models = new Map<string, { ttft: number[]; total: number[]; count: number; errors: number }>();
    const operations = new Map<string, { latencies: number[]; count: number; errors: number }>();

    for (const key of keys) {
      const match = key.match(/metrics:ai:([^:]+):([^:]+):/);
      if (match) {
        const [, model, operation] = match;
        const baseKey = `metrics:ai:${model}:${operation}:${hourKey}`;

        const [ttftStr, totalStr, countStr, errorsStr] = await Promise.all([
          this.redis.lrange(`${baseKey}:ttft`, 0, -1),
          this.redis.lrange(`${baseKey}:total`, 0, -1),
          this.redis.get(`${baseKey}:count`),
          this.redis.get(`${baseKey}:errors`),
        ]);

        const ttft = ttftStr.map(Number);
        const total = totalStr.map(Number);
        const count = parseInt(countStr || '0', 10);
        const errors = parseInt(errorsStr || '0', 10);

        // Aggregate by model
        if (!models.has(model)) {
          models.set(model, { ttft: [], total: [], count: 0, errors: 0 });
        }
        const modelData = models.get(model)!;
        modelData.ttft.push(...ttft);
        modelData.total.push(...total);
        modelData.count += count;
        modelData.errors += errors;

        // Aggregate by operation
        if (!operations.has(operation)) {
          operations.set(operation, { latencies: [], count: 0, errors: 0 });
        }
        const opData = operations.get(operation)!;
        opData.latencies.push(...total);
        opData.count += count;
        opData.errors += errors;
      }
    }

    const byModel: ModelMetrics[] = [];
    for (const [model, data] of models) {
      const avgTTFT = data.ttft.length > 0 ? data.ttft.reduce((a, b) => a + b, 0) / data.ttft.length : 0;
      const avgTotal = data.total.length > 0 ? data.total.reduce((a, b) => a + b, 0) / data.total.length : 0;
      const threshold = this.getModelThreshold(model);

      byModel.push({
        model,
        requestCount: data.count,
        avgTTFT,
        avgTotalLatency: avgTotal,
        errorCount: data.errors,
        status: this.getHealthStatus(avgTTFT, threshold.ttft, data.errors, data.count),
      });
    }

    const byOperation: OperationMetrics[] = [];
    for (const [operation, data] of operations) {
      const avg = data.latencies.length > 0 ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length : 0;
      const p95 = this.calculatePercentile(data.latencies, 95);

      byOperation.push({
        operation,
        count: data.count,
        avgLatency: avg,
        p95Latency: p95,
        successRate: data.count > 0 ? (data.count - data.errors) / data.count : 1,
      });
    }

    const allLatencies = Array.from(models.values()).flatMap((m) => m.total);
    const totalOps = byModel.reduce((sum, m) => sum + m.requestCount, 0);

    return {
      totalOperations: totalOps,
      avgLatency: allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0,
      p95Latency: this.calculatePercentile(allLatencies, 95),
      byModel,
      byOperation,
    };
  }

  /**
   * Get database metrics for the current hour
   */
  private async getDbMetrics(hourKey: string): Promise<{
    queryCount: number;
    avgQueryTime: number;
    p95QueryTime: number;
    connectionPoolUsage: number;
    slowQueries: number;
  }> {
    const key = `metrics:db:query:${hourKey}`;

    const [timesStr, countStr, slowStr] = await Promise.all([
      this.redis.lrange(`${key}:times`, 0, -1),
      this.redis.get(`${key}:count`),
      this.redis.get(`${key}:slow`),
    ]);

    const times = timesStr.map(Number);
    const count = parseInt(countStr || '0', 10);
    const slow = parseInt(slowStr || '0', 10);

    return {
      queryCount: count,
      avgQueryTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      p95QueryTime: this.calculatePercentile(times, 95),
      connectionPoolUsage: 0.5, // Would get from actual pool stats
      slowQueries: slow,
    };
  }

  /**
   * Get cache metrics for the current hour
   */
  private async getCacheMetrics(hourKey: string): Promise<{
    hitRate: number;
    missRate: number;
    totalRequests: number;
    memoryUsage: number;
  }> {
    const key = `metrics:cache:general:${hourKey}`;

    const [totalStr, hitsStr] = await Promise.all([
      this.redis.get(`${key}:total`),
      this.redis.get(`${key}:hits`),
    ]);

    const total = parseInt(totalStr || '0', 10);
    const hits = parseInt(hitsStr || '0', 10);
    const hitRate = total > 0 ? hits / total : 0;

    // Get Redis memory info
    const info = await this.redis.info('memory');
    const memMatch = info.match(/used_memory:(\d+)/);
    const memoryUsage = memMatch ? parseInt(memMatch[1], 10) : 0;

    return {
      hitRate,
      missRate: 1 - hitRate,
      totalRequests: total,
      memoryUsage,
    };
  }

  /**
   * Get time series data for API metrics
   */
  private async getApiTimeSeries(buckets: Date[]): Promise<TimeSeriesData> {
    const values: number[] = [];
    const timestamps: string[] = [];

    for (const bucket of buckets) {
      const hourKey = this.getHourKeyForDate(bucket);
      const key = `metrics:api:*:${hourKey}:times`;
      const keys = await this.redis.keys(key);

      let totalTime = 0;
      let count = 0;

      for (const k of keys) {
        const times = await this.redis.lrange(k, 0, -1);
        times.forEach((t) => {
          totalTime += parseFloat(t);
          count++;
        });
      }

      timestamps.push(bucket.toISOString());
      values.push(count > 0 ? totalTime / count : 0);
    }

    return { timestamps, values, label: 'API Response Time (ms)' };
  }

  /**
   * Get time series data for AI metrics
   */
  private async getAiTimeSeries(buckets: Date[]): Promise<TimeSeriesData> {
    const values: number[] = [];
    const timestamps: string[] = [];

    for (const bucket of buckets) {
      const hourKey = this.getHourKeyForDate(bucket);
      const key = `metrics:ai:*:${hourKey}:total`;
      const keys = await this.redis.keys(key);

      let totalLatency = 0;
      let count = 0;

      for (const k of keys) {
        const latencies = await this.redis.lrange(k, 0, -1);
        latencies.forEach((l) => {
          totalLatency += parseFloat(l);
          count++;
        });
      }

      timestamps.push(bucket.toISOString());
      values.push(count > 0 ? totalLatency / count : 0);
    }

    return { timestamps, values, label: 'AI Latency (ms)' };
  }

  /**
   * Get time series data for database metrics
   */
  private async getDbTimeSeries(buckets: Date[]): Promise<TimeSeriesData> {
    const values: number[] = [];
    const timestamps: string[] = [];

    for (const bucket of buckets) {
      const hourKey = this.getHourKeyForDate(bucket);
      const key = `metrics:db:query:${hourKey}:times`;
      const times = await this.redis.lrange(key, 0, -1);

      timestamps.push(bucket.toISOString());
      values.push(
        times.length > 0
          ? times.map(Number).reduce((a, b) => a + b, 0) / times.length
          : 0
      );
    }

    return { timestamps, values, label: 'Database Query Time (ms)' };
  }

  /**
   * Get time series data for cache metrics
   */
  private async getCacheTimeSeries(buckets: Date[]): Promise<TimeSeriesData> {
    const values: number[] = [];
    const timestamps: string[] = [];

    for (const bucket of buckets) {
      const hourKey = this.getHourKeyForDate(bucket);
      const key = `metrics:cache:general:${hourKey}`;

      const [total, hits] = await Promise.all([
        this.redis.get(`${key}:total`),
        this.redis.get(`${key}:hits`),
      ]);

      const totalNum = parseInt(total || '0', 10);
      const hitsNum = parseInt(hits || '0', 10);

      timestamps.push(bucket.toISOString());
      values.push(totalNum > 0 ? hitsNum / totalNum : 0);
    }

    return { timestamps, values, label: 'Cache Hit Rate' };
  }

  /**
   * Get hour key for a specific date
   */
  private getHourKeyForDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }

  /**
   * Get endpoint threshold based on path
   */
  private getEndpointThreshold(path: string): { p95: number; target: number } {
    if (path.includes('upload')) return PERFORMANCE_THRESHOLDS.api.documentUpload;
    if (path.includes('download')) return PERFORMANCE_THRESHOLDS.api.documentDownload;
    if (path.includes('search')) return PERFORMANCE_THRESHOLDS.api.search;
    return PERFORMANCE_THRESHOLDS.api.graphql;
  }

  /**
   * Get model threshold based on model name
   */
  private getModelThreshold(model: string): { ttft: number; total: number } {
    if (model.includes('haiku')) return PERFORMANCE_THRESHOLDS.ai.haiku;
    if (model.includes('opus')) return PERFORMANCE_THRESHOLDS.ai.opus;
    return PERFORMANCE_THRESHOLDS.ai.sonnet;
  }

  /**
   * Determine health status based on metrics
   */
  private getHealthStatus(
    currentValue: number,
    threshold: number,
    errors: number,
    total: number
  ): 'healthy' | 'degraded' | 'critical' {
    const errorRate = total > 0 ? errors / total : 0;

    if (errorRate > 0.1 || currentValue > threshold * 1.5) return 'critical';
    if (errorRate > 0.05 || currentValue > threshold) return 'degraded';
    return 'healthy';
  }

  /**
   * Check API thresholds and create alerts
   */
  private async checkApiThresholds(
    endpoint: string,
    method: string,
    responseTime: number
  ): Promise<void> {
    const threshold = this.getEndpointThreshold(endpoint);

    if (responseTime > threshold.p95) {
      await this.createAlert({
        type: 'api_slow',
        severity: responseTime > threshold.p95 * 1.5 ? 'critical' : 'warning',
        metric: `api.${method}.${endpoint}`,
        currentValue: responseTime,
        threshold: threshold.p95,
        message: `API endpoint ${method} ${endpoint} response time ${responseTime}ms exceeds threshold ${threshold.p95}ms`,
      });
    }
  }

  /**
   * Check AI thresholds and create alerts
   */
  private async checkAiThresholds(
    model: string,
    operation: string,
    ttft: number,
    totalLatency: number
  ): Promise<void> {
    const threshold = this.getModelThreshold(model);

    if (ttft > threshold.ttft) {
      await this.createAlert({
        type: 'ai_slow',
        severity: ttft > threshold.ttft * 1.5 ? 'critical' : 'warning',
        metric: `ai.${model}.${operation}.ttft`,
        currentValue: ttft,
        threshold: threshold.ttft,
        message: `AI model ${model} TTFT ${ttft}ms exceeds threshold ${threshold.ttft}ms`,
      });
    }
  }

  /**
   * Create a performance alert
   */
  private async createAlert(params: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    // Dedup by metric (only one alert per metric in the window)
    const existingKey = `${params.type}:${params.metric}`;
    const existing = Array.from(this.alerts.values()).find(
      (a) => `${a.type}:${a.metric}` === existingKey && !a.acknowledged
    );

    if (existing) {
      // Update existing alert
      existing.currentValue = params.currentValue;
      existing.timestamp = new Date();
      return;
    }

    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...params,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);

    // Keep only last 1000 alerts
    if (this.alerts.size > 1000) {
      const oldest = Array.from(this.alerts.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())
        .slice(0, 100);
      oldest.forEach(([key]) => this.alerts.delete(key));
    }
  }

  /**
   * Get CPU usage (simplified)
   */
  private async getCpuUsage(): Promise<number> {
    // In production, use os.cpus() or a proper monitoring library
    return 0.3; // 30% placeholder
  }

  /**
   * Get active connections count
   */
  private async getActiveConnections(): Promise<number> {
    // Would get from actual connection pool
    return 10; // Placeholder
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushMetrics();
  }
}

// Export singleton for use across the application
let instance: PerformanceMetricsService | null = null;

export function getPerformanceMetricsService(
  prisma: PrismaClient,
  redis: Redis
): PerformanceMetricsService {
  if (!instance) {
    instance = new PerformanceMetricsService(prisma, redis);
  }
  return instance;
}
