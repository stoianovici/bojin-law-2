/**
 * Jurisprudence URL Tracker
 *
 * Redis-backed URL tracking for provenance verification.
 * Ensures citation URLs came from actual search results.
 */

import { redis } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Tracked URL with metadata for provenance */
export interface TrackedUrl {
  url: string;
  normalizedUrl: string;
  title: string;
  source: string;
  searchQuery: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Redis key prefix for URL tracking */
const URL_TRACKING_PREFIX = 'jurisprudence:urls:';

/** TTL for tracked URLs (30 minutes - longer than typical research session) */
const URL_TRACKING_TTL_SECONDS = 1800;

// ============================================================================
// RedisUrlTracker Class
// ============================================================================

/**
 * Redis-backed URL tracker for provenance verification.
 *
 * Unlike in-memory tracking, this implementation stores tracked URLs in Redis,
 * enabling:
 * - Multi-instance deployments (all instances see the same tracked URLs)
 * - Persistence across request boundaries
 * - Automatic cleanup via TTL
 *
 * Trade-offs:
 * - Slightly higher latency (Redis round-trip vs in-memory)
 * - Requires Redis connection
 * - Falls back gracefully on Redis errors (logs warning, allows unverified)
 */
export class RedisUrlTracker {
  private readonly correlationId: string;
  private readonly redisKey: string;
  private localCache: Map<string, TrackedUrl>; // Local cache for current request
  private syncedToRedis: boolean;

  constructor(correlationId: string) {
    this.correlationId = correlationId;
    this.redisKey = `${URL_TRACKING_PREFIX}${correlationId}`;
    this.localCache = new Map();
    this.syncedToRedis = false;
  }

  /**
   * Add a URL to tracking. Stores in both local cache and Redis.
   */
  async set(key: string, value: TrackedUrl): Promise<void> {
    // Always update local cache for fast access within same request
    this.localCache.set(key, value);

    try {
      // Store in Redis hash with TTL refresh
      await redis.hset(this.redisKey, key, JSON.stringify(value));
      // Refresh TTL on each write to extend session
      await redis.expire(this.redisKey, URL_TRACKING_TTL_SECONDS);
    } catch (error) {
      // Log but don't fail - local cache still works for single-instance
      logger.warn('[JurisprudenceAgent] Failed to sync URL to Redis', {
        correlationId: this.correlationId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if a URL is tracked. Checks local cache first, then Redis.
   */
  async has(key: string): Promise<boolean> {
    // Check local cache first (fast path)
    if (this.localCache.has(key)) {
      return true;
    }

    // Check Redis for URLs tracked by other instances
    try {
      const exists = await redis.hexists(this.redisKey, key);
      return exists === 1;
    } catch (error) {
      logger.warn('[JurisprudenceAgent] Failed to check URL in Redis, using local cache only', {
        correlationId: this.correlationId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get the count of tracked URLs (local cache + Redis).
   */
  async size(): Promise<number> {
    try {
      const redisSize = await redis.hlen(this.redisKey);
      return redisSize;
    } catch {
      return this.localCache.size;
    }
  }

  /**
   * Get local cache size (for logging within single request).
   */
  get localSize(): number {
    return this.localCache.size;
  }

  /**
   * Get all tracked URLs as a Map (for compatibility).
   * Note: This only returns locally cached URLs, not all Redis URLs.
   */
  asMap(): Map<string, TrackedUrl> {
    return this.localCache;
  }

  /**
   * Sync local cache to Redis in batch (for efficiency).
   * Called after processing all search results.
   */
  async syncToRedis(): Promise<void> {
    if (this.syncedToRedis || this.localCache.size === 0) {
      return;
    }

    try {
      const entries: string[] = [];
      for (const [key, value] of this.localCache) {
        entries.push(key, JSON.stringify(value));
      }

      if (entries.length > 0) {
        await redis.hset(this.redisKey, ...entries);
        await redis.expire(this.redisKey, URL_TRACKING_TTL_SECONDS);
        this.syncedToRedis = true;
      }
    } catch (error) {
      logger.warn('[JurisprudenceAgent] Failed to batch sync URLs to Redis', {
        correlationId: this.correlationId,
        urlCount: this.localCache.size,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
