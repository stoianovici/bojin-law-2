/**
 * Workload Cache Service
 * Story 4.5 QA Fix: PERF-002
 *
 * Redis-based caching for workload calculations to improve performance.
 * Implements caching as specified in Dev Notes (lines 1346-1351):
 * - Cache workload results per user per day
 * - Invalidate cache on task creation, update, completion
 * - 15-minute TTL for workload calculations
 */

import Redis from 'ioredis';

// Local type definition to avoid type export issues
// Matches the DailyWorkload interface in @legal-platform/types
interface DailyWorkload {
  date: Date;
  allocatedHours: number;
  capacityHours: number;
  utilizationPercent: number;
  taskCount: number;
  overloaded: boolean;
}

// Cache configuration
const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes
const CACHE_PREFIX = 'workload:daily:';

/**
 * Workload Cache Service
 * Caches daily workload calculations in Redis
 */
export class WorkloadCacheService {
  private redis: Redis | null = null;
  private enabled: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('[WorkloadCache] Redis URL not configured, caching disabled');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.enabled = true;
        console.log('[WorkloadCache] Connected to Redis');
      });

      this.redis.on('error', (err) => {
        console.error('[WorkloadCache] Redis error:', err.message);
        this.enabled = false;
      });

      // Attempt connection
      this.redis.connect().catch((err) => {
        console.warn('[WorkloadCache] Failed to connect to Redis:', err.message);
        this.enabled = false;
      });
    } catch (error) {
      console.warn('[WorkloadCache] Failed to initialize Redis:', error);
      this.enabled = false;
    }
  }

  /**
   * Generate cache key for daily workload
   */
  private getDailyWorkloadKey(userId: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${CACHE_PREFIX}${userId}:${dateStr}`;
  }

  /**
   * Get cached daily workload
   */
  async getDailyWorkload(userId: string, date: Date): Promise<DailyWorkload | null> {
    if (!this.enabled || !this.redis) {
      return null;
    }

    try {
      const key = this.getDailyWorkloadKey(userId, date);
      const cached = await this.redis.get(key);

      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date object
        parsed.date = new Date(parsed.date);
        return parsed as DailyWorkload;
      }

      return null;
    } catch (error) {
      console.warn('[WorkloadCache] Failed to get cached workload:', error);
      return null;
    }
  }

  /**
   * Cache daily workload
   */
  async setDailyWorkload(userId: string, date: Date, workload: DailyWorkload): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const key = this.getDailyWorkloadKey(userId, date);
      await this.redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(workload));
    } catch (error) {
      console.warn('[WorkloadCache] Failed to cache workload:', error);
    }
  }

  /**
   * Invalidate cache for a user on a specific date
   * Call this when tasks are created, updated, or completed
   */
  async invalidateForUser(userId: string, date?: Date): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      if (date) {
        // Invalidate specific date
        const key = this.getDailyWorkloadKey(userId, date);
        await this.redis.del(key);
      } else {
        // Invalidate all dates for user
        const pattern = `${CACHE_PREFIX}${userId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      console.warn('[WorkloadCache] Failed to invalidate cache:', error);
    }
  }

  /**
   * Invalidate cache for multiple users (e.g., after batch task update)
   */
  async invalidateForUsers(userIds: string[]): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const patterns = userIds.map((id) => `${CACHE_PREFIX}${id}:*`);
      const pipeline = this.redis.pipeline();

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) {
          pipeline.del(key);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.warn('[WorkloadCache] Failed to batch invalidate cache:', error);
    }
  }

  /**
   * Invalidate all workload cache (e.g., after major data migration)
   */
  async invalidateAll(): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const pattern = `${CACHE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.warn('[WorkloadCache] Failed to invalidate all cache:', error);
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats(): Promise<{ enabled: boolean; keyCount: number } | null> {
    if (!this.enabled || !this.redis) {
      return { enabled: false, keyCount: 0 };
    }

    try {
      const pattern = `${CACHE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      return {
        enabled: true,
        keyCount: keys.length,
      };
    } catch {
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.enabled = false;
    }
  }
}

// Singleton instance
export const workloadCacheService = new WorkloadCacheService();
