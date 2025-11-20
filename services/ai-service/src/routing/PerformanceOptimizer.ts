/**
 * Performance Optimizer
 *
 * Comprehensive caching and optimization layer for routing performance:
 * - Skill metadata caching with LRU eviction
 * - Pattern match result caching
 * - Effectiveness score caching with TTL
 * - Request deduplication
 * - Performance profiling utilities
 *
 * Target: <100ms routing overhead (AC#8)
 */

import crypto from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  cached: boolean;
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number = 60000 // 1 minute default
  ) {}

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      return null;
    }

    // Update access order (move to end = most recently used)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    // Update stats
    entry.hits++;
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      hits: 0,
    };

    this.cache.set(key, entry);

    // Update access order
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age <= this.ttlMs;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift()!;
    this.cache.delete(lruKey);
  }

  /**
   * Remove key from access order array
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

// ============================================================================
// Performance Optimizer Class
// ============================================================================

export class PerformanceOptimizer {
  // Caches with different TTLs
  private metadataCache: LRUCache<any>;
  private patternMatchCache: LRUCache<string[]>;
  private effectivenessCache: LRUCache<number>;
  private requestCache: LRUCache<any>;

  // Performance tracking
  private performanceMetrics: PerformanceMetrics[] = [];
  private readonly metricsLimit = 1000;

  // Request deduplication
  private inflightRequests = new Map<string, Promise<any>>();

  constructor(
    private readonly config = {
      metadataCacheSize: 100,
      metadataCacheTTL: 300000, // 5 minutes
      patternMatchCacheSize: 500,
      patternMatchCacheTTL: 600000, // 10 minutes
      effectivenessCacheSize: 200,
      effectivenessCacheTTL: 60000, // 1 minute
      requestCacheSize: 50,
      requestCacheTTL: 30000, // 30 seconds
    }
  ) {
    this.metadataCache = new LRUCache(config.metadataCacheSize, config.metadataCacheTTL);
    this.patternMatchCache = new LRUCache(config.patternMatchCacheSize, config.patternMatchCacheTTL);
    this.effectivenessCache = new LRUCache(config.effectivenessCacheSize, config.effectivenessCacheTTL);
    this.requestCache = new LRUCache(config.requestCacheSize, config.requestCacheTTL);
  }

  // ============================================================================
  // Metadata Caching
  // ============================================================================

  /**
   * Get cached skill metadata
   */
  getSkillMetadata<T>(skillId: string): T | null {
    return this.metadataCache.get(skillId);
  }

  /**
   * Cache skill metadata
   */
  setSkillMetadata<T>(skillId: string, metadata: T): void {
    this.metadataCache.set(skillId, metadata);
  }

  // ============================================================================
  // Pattern Match Caching
  // ============================================================================

  /**
   * Get cached pattern match results
   */
  getPatternMatch(task: string): string[] | null {
    const key = this.generateTaskHash(task);
    return this.patternMatchCache.get(key);
  }

  /**
   * Cache pattern match results
   */
  setPatternMatch(task: string, skillIds: string[]): void {
    const key = this.generateTaskHash(task);
    this.patternMatchCache.set(key, skillIds);
  }

  // ============================================================================
  // Effectiveness Caching
  // ============================================================================

  /**
   * Get cached effectiveness score
   */
  getEffectiveness(skillIds: string[]): number | null {
    const key = this.generateSkillSetHash(skillIds);
    return this.effectivenessCache.get(key);
  }

  /**
   * Cache effectiveness score
   */
  setEffectiveness(skillIds: string[], score: number): void {
    const key = this.generateSkillSetHash(skillIds);
    this.effectivenessCache.set(key, score);
  }

  // ============================================================================
  // Request Deduplication
  // ============================================================================

  /**
   * Execute with deduplication - prevent duplicate requests
   */
  async deduplicate<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if request is already in flight
    const inflight = this.inflightRequests.get(key);
    if (inflight) {
      console.log(`[PerformanceOptimizer] Deduplicating request: ${key}`);
      return inflight as Promise<T>;
    }

    // Execute operation
    const promise = operation();
    this.inflightRequests.set(key, promise);

    try {
      const result = await promise;
      this.inflightRequests.delete(key);
      return result;
    } catch (error) {
      this.inflightRequests.delete(key);
      throw error;
    }
  }

  /**
   * Get cached request result
   */
  getRequestResult<T>(requestKey: string): T | null {
    return this.requestCache.get(requestKey);
  }

  /**
   * Cache request result
   */
  setRequestResult<T>(requestKey: string, result: T): void {
    this.requestCache.set(requestKey, result);
  }

  // ============================================================================
  // Performance Profiling
  // ============================================================================

  /**
   * Start performance measurement
   */
  startMeasurement(operationName: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const metric: PerformanceMetrics = {
        operationName,
        startTime,
        endTime,
        duration: endTime - startTime,
        cached: false,
      };

      this.recordMetric(metric);
    };
  }

  /**
   * Measure async operation with caching
   */
  async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const startTime = performance.now();
    let cached = false;

    // Check cache if key provided
    if (cacheKey) {
      const cachedResult = this.requestCache.get(cacheKey);
      if (cachedResult) {
        cached = true;
        const endTime = performance.now();
        this.recordMetric({
          operationName,
          startTime,
          endTime,
          duration: endTime - startTime,
          cached: true,
        });
        return cachedResult as T;
      }
    }

    // Execute operation
    const result = await operation();
    const endTime = performance.now();

    // Cache result if key provided
    if (cacheKey) {
      this.requestCache.set(cacheKey, result);
    }

    this.recordMetric({
      operationName,
      startTime,
      endTime,
      duration: endTime - startTime,
      cached,
    });

    return result;
  }

  /**
   * Record performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);

    // Trim metrics if exceeds limit
    if (this.performanceMetrics.length > this.metricsLimit) {
      this.performanceMetrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    cacheHitRate: number;
    slowestOperations: PerformanceMetrics[];
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        averageDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        cacheHitRate: 0,
        slowestOperations: [],
      };
    }

    const durations = this.performanceMetrics.map(m => m.duration).sort((a, b) => a - b);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    const cachedCount = this.performanceMetrics.filter(m => m.cached).length;
    const cacheHitRate = cachedCount / this.performanceMetrics.length;

    const slowestOperations = [...this.performanceMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      averageDuration,
      p50Duration: durations[p50Index],
      p95Duration: durations[p95Index],
      p99Duration: durations[p99Index],
      cacheHitRate,
      slowestOperations,
    };
  }

  /**
   * Get metrics by operation name
   */
  getMetricsByOperation(operationName: string): PerformanceMetrics[] {
    return this.performanceMetrics.filter(m => m.operationName === operationName);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate consistent hash for task description
   */
  private generateTaskHash(task: string): string {
    // Normalize task (lowercase, trim, remove extra whitespace)
    const normalized = task.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Generate consistent hash for skill set
   */
  private generateSkillSetHash(skillIds: string[]): string {
    // Sort skill IDs for consistent hashing
    const sorted = [...skillIds].sort();
    const key = sorted.join('|');
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  /**
   * Get all cache statistics
   */
  getAllCacheStats(): {
    metadata: CacheStats;
    patternMatch: CacheStats;
    effectiveness: CacheStats;
    request: CacheStats;
  } {
    return {
      metadata: this.metadataCache.getStats(),
      patternMatch: this.patternMatchCache.getStats(),
      effectiveness: this.effectivenessCache.getStats(),
      request: this.requestCache.getStats(),
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.metadataCache.clear();
    this.patternMatchCache.clear();
    this.effectivenessCache.clear();
    this.requestCache.clear();
    this.inflightRequests.clear();
    this.performanceMetrics = [];
  }

  /**
   * Get cache efficiency report
   */
  getCacheEfficiencyReport(): {
    totalCacheSize: number;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    recommendations: string[];
  } {
    const stats = this.getAllCacheStats();

    const totalHits = stats.metadata.hits + stats.patternMatch.hits + stats.effectiveness.hits + stats.request.hits;
    const totalMisses = stats.metadata.misses + stats.patternMatch.misses + stats.effectiveness.misses + stats.request.misses;
    const totalRequests = totalHits + totalMisses;
    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    const recommendations: string[] = [];

    // Analyze cache performance
    if (stats.metadata.hitRate < 0.5 && stats.metadata.size === stats.metadata.maxSize) {
      recommendations.push('Consider increasing metadata cache size');
    }

    if (stats.effectiveness.hitRate < 0.3) {
      recommendations.push('Effectiveness cache hit rate is low - consider longer TTL');
    }

    if (stats.request.hitRate > 0.8) {
      recommendations.push('Request cache is highly effective - current settings are optimal');
    }

    if (overallHitRate < 0.4) {
      recommendations.push('Overall cache hit rate is low - review caching strategy');
    }

    return {
      totalCacheSize: stats.metadata.size + stats.patternMatch.size + stats.effectiveness.size + stats.request.size,
      totalHits,
      totalMisses,
      overallHitRate,
      recommendations,
    };
  }
}
