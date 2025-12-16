/**
 * Skill Result Caching Service
 *
 * Redis-based caching layer for skill execution results:
 * - Cache key generation with SHA-256 hashing
 * - TTL management (1 hour default)
 * - Cache hit/miss tracking and metrics
 * - Cache warming for common queries
 * - Deterministic result caching only
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import type { AIRequest } from '../routing/SkillSelector';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SkillCacheConfig {
  redisUrl?: string;
  ttl?: number; // Default: 3600 seconds (1 hour)
  maxSize?: number; // Max cached entries
  keyPrefix?: string;
  enableMetrics?: boolean;
  warmingEnabled?: boolean;
}

export interface CachedSkillResult {
  requestHash: string;
  skillIds: string[];
  result: unknown;
  model: string;
  cachedAt: Date;
  hitCount: number;
  tokensEstimate: number;
  cost: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  totalKeys: number;
  memorySizeBytes: number;
  avgResponseTimeMs: number;
}

export interface CacheWarmingEntry {
  taskPattern: string;
  skillIds: string[];
  frequency: number; // How often this pattern is used
  lastWarmed: Date | null;
}

// ============================================================================
// SkillCache Class
// ============================================================================

export class SkillCache {
  private readonly redis: Redis;
  private readonly config: Required<SkillCacheConfig>;
  private readonly metrics: {
    hits: number;
    misses: number;
    responseTimes: number[];
  };
  private readonly warmingPatterns: Map<string, CacheWarmingEntry>;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<SkillCacheConfig> = {
    redisUrl: 'redis://localhost:6379',
    ttl: 3600, // 1 hour
    maxSize: 1000,
    keyPrefix: 'skill:cache:',
    enableMetrics: true,
    warmingEnabled: true,
  };

  constructor(config?: SkillCacheConfig) {
    this.config = { ...SkillCache.DEFAULT_CONFIG, ...config };

    // Initialize Redis client
    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[SkillCache] Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000); // Exponential backoff
      },
    });

    // Initialize metrics tracking
    this.metrics = {
      hits: 0,
      misses: 0,
      responseTimes: [],
    };

    // Initialize cache warming patterns
    this.warmingPatterns = new Map();

    // Setup Redis event handlers
    this.setupRedisHandlers();

    console.log('[SkillCache] Initialized with config:', this.config);
  }

  // ============================================================================
  // Public Methods - Cache Operations
  // ============================================================================

  /**
   * Get cached result for a request + skills combination
   */
  async get(request: AIRequest, skillIds: string[]): Promise<CachedSkillResult | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateCacheKey(request, skillIds);
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        this.recordMiss();
        console.log(`[SkillCache] MISS - Key: ${cacheKey}`);
        return null;
      }

      // Parse cached result
      const result: CachedSkillResult = JSON.parse(cached);

      // Increment hit count
      result.hitCount++;
      await this.redis.setex(cacheKey, this.config.ttl, JSON.stringify(result));

      // Record metrics
      this.recordHit(Date.now() - startTime);

      console.log(`[SkillCache] HIT - Key: ${cacheKey}, Hit count: ${result.hitCount}`);

      return result;
    } catch (error) {
      console.error('[SkillCache] Error retrieving from cache:', error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * Store result in cache
   */
  async set(
    request: AIRequest,
    skillIds: string[],
    result: unknown,
    metadata: {
      model: string;
      tokensEstimate: number;
      cost: number;
    }
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request, skillIds);
      const requestHash = this.hashRequest(request, skillIds);

      const cacheEntry: CachedSkillResult = {
        requestHash,
        skillIds,
        result,
        model: metadata.model,
        cachedAt: new Date(),
        hitCount: 0,
        tokensEstimate: metadata.tokensEstimate,
        cost: metadata.cost,
      };

      // Check cache size limit
      await this.enforceMaxSize();

      // Store in Redis with TTL
      await this.redis.setex(cacheKey, this.config.ttl, JSON.stringify(cacheEntry));

      console.log(`[SkillCache] SET - Key: ${cacheKey}, TTL: ${this.config.ttl}s`);
    } catch (error) {
      console.error('[SkillCache] Error storing in cache:', error);
    }
  }

  /**
   * Invalidate cache for a specific request or all cache
   */
  async invalidate(request?: AIRequest, skillIds?: string[]): Promise<void> {
    try {
      if (request && skillIds) {
        // Invalidate specific entry
        const cacheKey = this.generateCacheKey(request, skillIds);
        await this.redis.del(cacheKey);
        console.log(`[SkillCache] Invalidated key: ${cacheKey}`);
      } else {
        // Invalidate all cache entries with our prefix
        const pattern = `${this.config.keyPrefix}*`;
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
          await this.redis.del(...keys);
          console.log(`[SkillCache] Invalidated ${keys.length} cache entries`);
        }
      }
    } catch (error) {
      console.error('[SkillCache] Error invalidating cache:', error);
    }
  }

  /**
   * Check if a request result is cached
   */
  async has(request: AIRequest, skillIds: string[]): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(request, skillIds);
      const exists = await this.redis.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      console.error('[SkillCache] Error checking cache existence:', error);
      return false;
    }
  }

  // ============================================================================
  // Public Methods - Cache Warming
  // ============================================================================

  /**
   * Register a pattern for cache warming
   */
  registerWarmingPattern(taskPattern: string, skillIds: string[], frequency: number = 1): void {
    if (!this.config.warmingEnabled) {
      return;
    }

    const existing = this.warmingPatterns.get(taskPattern);

    if (existing) {
      // Increment frequency
      existing.frequency += frequency;
    } else {
      // Add new pattern
      this.warmingPatterns.set(taskPattern, {
        taskPattern,
        skillIds,
        frequency,
        lastWarmed: null,
      });
    }

    console.log(`[SkillCache] Registered warming pattern: ${taskPattern}`);
  }

  /**
   * Warm cache for common queries
   */
  async warmCache(
    commonRequests: Array<{ request: AIRequest; skillIds: string[] }>,
    warmingFunction: (
      request: AIRequest,
      skillIds: string[]
    ) => Promise<{
      result: unknown;
      metadata: { model: string; tokensEstimate: number; cost: number };
    }>
  ): Promise<number> {
    if (!this.config.warmingEnabled) {
      console.log('[SkillCache] Cache warming disabled');
      return 0;
    }

    let warmedCount = 0;

    console.log(`[SkillCache] Starting cache warming for ${commonRequests.length} requests...`);

    for (const { request, skillIds } of commonRequests) {
      try {
        // Check if already cached
        const exists = await this.has(request, skillIds);
        if (exists) {
          console.log(
            `[SkillCache] Skipping warming - already cached: ${request.task.substring(0, 50)}...`
          );
          continue;
        }

        // Execute warming function to get result
        const { result, metadata } = await warmingFunction(request, skillIds);

        // Cache the result
        await this.set(request, skillIds, result, metadata);

        warmedCount++;
        console.log(`[SkillCache] Warmed cache entry ${warmedCount}/${commonRequests.length}`);
      } catch (error) {
        console.error('[SkillCache] Error warming cache entry:', error);
      }
    }

    console.log(`[SkillCache] Cache warming complete. Warmed ${warmedCount} entries.`);

    return warmedCount;
  }

  /**
   * Get warming patterns sorted by frequency
   */
  getWarmingPatterns(): CacheWarmingEntry[] {
    return Array.from(this.warmingPatterns.values()).sort((a, b) => b.frequency - a.frequency);
  }

  // ============================================================================
  // Public Methods - Metrics and Monitoring
  // ============================================================================

  /**
   * Get cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;

    // Get Redis memory info
    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const memorySizeBytes = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

    // Get total keys count
    const pattern = `${this.config.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    const totalKeys = keys.length;

    // Calculate average response time
    const avgResponseTimeMs =
      this.metrics.responseTimes.length > 0
        ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
        : 0;

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate,
      totalRequests,
      totalKeys,
      memorySizeBytes,
      avgResponseTimeMs,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.responseTimes = [];
    console.log('[SkillCache] Metrics reset');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    metrics: CacheMetrics;
    config: Required<SkillCacheConfig>;
    warmingPatterns: CacheWarmingEntry[];
  }> {
    return {
      metrics: await this.getMetrics(),
      config: this.config,
      warmingPatterns: this.getWarmingPatterns(),
    };
  }

  // ============================================================================
  // Private Methods - Cache Key Generation
  // ============================================================================

  /**
   * Generate cache key for a request + skills combination
   */
  private generateCacheKey(request: AIRequest, skillIds: string[]): string {
    const hash = this.hashRequest(request, skillIds);
    return `${this.config.keyPrefix}${hash}`;
  }

  /**
   * Hash request and skill IDs to create deterministic key
   */
  private hashRequest(request: AIRequest, skillIds: string[]): string {
    // Create deterministic string representation
    const requestStr = JSON.stringify({
      task: request.task,
      context: request.context,
      skillIds: skillIds.sort(), // Sort for consistency
    });

    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(requestStr).digest('hex').substring(0, 16); // Use first 16 chars for shorter keys

    return hash;
  }

  // ============================================================================
  // Private Methods - Metrics Tracking
  // ============================================================================

  /**
   * Record cache hit
   */
  private recordHit(responseTime: number): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.hits++;
    this.metrics.responseTimes.push(responseTime);

    // Keep only last 1000 response times
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.misses++;
  }

  // ============================================================================
  // Private Methods - Cache Management
  // ============================================================================

  /**
   * Enforce maximum cache size using LRU strategy
   */
  private async enforceMaxSize(): Promise<void> {
    try {
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length >= this.config.maxSize) {
        // Remove oldest entries (simple LRU)
        const keysToRemove = keys.slice(0, Math.floor(keys.length * 0.1)); // Remove 10%
        if (keysToRemove.length > 0) {
          await this.redis.del(...keysToRemove);
          console.log(`[SkillCache] Removed ${keysToRemove.length} entries to enforce max size`);
        }
      }
    } catch (error) {
      console.error('[SkillCache] Error enforcing max size:', error);
    }
  }

  // ============================================================================
  // Private Methods - Redis Event Handlers
  // ============================================================================

  /**
   * Setup Redis event handlers
   */
  private setupRedisHandlers(): void {
    this.redis.on('connect', () => {
      console.log('[SkillCache] Redis connected');
    });

    this.redis.on('ready', () => {
      console.log('[SkillCache] Redis ready');
    });

    this.redis.on('error', (error) => {
      console.error('[SkillCache] Redis error:', error);
    });

    this.redis.on('close', () => {
      console.warn('[SkillCache] Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      console.log('[SkillCache] Redis reconnecting...');
    });
  }

  // ============================================================================
  // Public Methods - Cleanup
  // ============================================================================

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      console.log('[SkillCache] Redis disconnected');
    } catch (error) {
      console.error('[SkillCache] Error disconnecting Redis:', error);
    }
  }

  /**
   * Get Redis client for advanced operations
   */
  getRedisClient(): Redis {
    return this.redis;
  }
}
