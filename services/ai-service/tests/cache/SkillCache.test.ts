/**
 * SkillCache Unit Tests
 *
 * Comprehensive test coverage for Redis-based skill result caching:
 * - Cache operations (get, set, invalidate, has)
 * - Cache key generation and hashing
 * - TTL management
 * - Cache hit/miss tracking
 * - Cache warming
 * - Metrics and monitoring
 * - Error handling and edge cases
 */

import { SkillCache } from '../../src/cache/SkillCache';
import type { AIRequest } from '../../src/routing/SkillSelector';

// Mock ioredis
interface MockRedisData {
  value: string;
  expiry: number;
}

interface MockRedis {
  data: Map<string, MockRedisData>;
  get: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  exists: jest.Mock;
  keys: jest.Mock;
  info: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
}

jest.mock('ioredis', () => {
  const createMockRedis = (): MockRedis => {
    const data = new Map<string, MockRedisData>();

    return {
      data,
      get: jest.fn(async (key: string) => {
        const entry = data.get(key);
        if (!entry || (entry.expiry && Date.now() > entry.expiry)) {
          return null;
        }
        return entry.value;
      }),

      setex: jest.fn(async (key: string, ttl: number, value: string) => {
        data.set(key, {
          value,
          expiry: Date.now() + ttl * 1000,
        });
        return 'OK';
      }),

      del: jest.fn(async (...keys: string[]) => {
        keys.forEach((key) => data.delete(key));
        return keys.length;
      }),

      exists: jest.fn(async (key: string) => {
        const entry = data.get(key);
        return entry && (!entry.expiry || Date.now() <= entry.expiry) ? 1 : 0;
      }),

      keys: jest.fn(async (pattern: string) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(data.keys()).filter((key: string) => regex.test(key));
      }),

      info: jest.fn(async () => 'used_memory:1048576'),

      quit: jest.fn(async () => 'OK'),

      on: jest.fn(),
    };
  };

  return jest.fn(() => createMockRedis());
});

describe('SkillCache', () => {
  let cache: SkillCache;
  let mockRequest: AIRequest;

  beforeEach(() => {
    // Create cache instance
    cache = new SkillCache({
      redisUrl: 'redis://localhost:6379',
      ttl: 3600,
      maxSize: 100,
      enableMetrics: true,
      warmingEnabled: true,
    });

    // Create mock request
    mockRequest = {
      task: 'Review contract for compliance issues',
      context: {
        documentType: 'contract',
        complexity: 'medium',
      },
    };

    // Clear mock calls
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cache.disconnect();
  });

  // ==========================================================================
  // Cache Operations Tests
  // ==========================================================================

  describe('Cache Operations', () => {
    it('should store and retrieve cached results', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Contract is compliant' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store in cache
      await cache.set(mockRequest, skillIds, result, metadata);

      // Retrieve from cache
      const cached = await cache.get(mockRequest, skillIds);

      expect(cached).not.toBeNull();
      expect(cached?.result).toEqual(result);
      expect(cached?.model).toBe(metadata.model);
      expect(cached?.skillIds).toEqual(skillIds);
      expect(cached?.tokensEstimate).toBe(metadata.tokensEstimate);
      expect(cached?.cost).toBe(metadata.cost);
    });

    it('should return null for cache miss', async () => {
      const skillIds = ['contract-analysis'];
      const cached = await cache.get(mockRequest, skillIds);

      expect(cached).toBeNull();
    });

    it('should increment hit count on repeated gets', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Contract is compliant' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      await cache.set(mockRequest, skillIds, result, metadata);

      // First get
      const cached1 = await cache.get(mockRequest, skillIds);
      expect(cached1?.hitCount).toBe(1);

      // Second get
      const cached2 = await cache.get(mockRequest, skillIds);
      expect(cached2?.hitCount).toBe(2);

      // Third get
      const cached3 = await cache.get(mockRequest, skillIds);
      expect(cached3?.hitCount).toBe(3);
    });

    it('should check if entry exists in cache', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Contract is compliant' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Should not exist initially
      let exists = await cache.has(mockRequest, skillIds);
      expect(exists).toBe(false);

      // Store in cache
      await cache.set(mockRequest, skillIds, result, metadata);

      // Should exist now
      exists = await cache.has(mockRequest, skillIds);
      expect(exists).toBe(true);
    });

    it('should invalidate specific cache entry', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Contract is compliant' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store and verify
      await cache.set(mockRequest, skillIds, result, metadata);
      let cached = await cache.get(mockRequest, skillIds);
      expect(cached).not.toBeNull();

      // Invalidate
      await cache.invalidate(mockRequest, skillIds);

      // Should be gone
      cached = await cache.get(mockRequest, skillIds);
      expect(cached).toBeNull();
    });

    it('should invalidate all cache entries', async () => {
      const skillIds1 = ['contract-analysis'];
      const skillIds2 = ['document-drafting'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store multiple entries
      await cache.set(mockRequest, skillIds1, result, metadata);
      await cache.set(mockRequest, skillIds2, result, metadata);

      // Verify both exist
      expect(await cache.has(mockRequest, skillIds1)).toBe(true);
      expect(await cache.has(mockRequest, skillIds2)).toBe(true);

      // Invalidate all
      await cache.invalidate();

      // Both should be gone
      expect(await cache.has(mockRequest, skillIds1)).toBe(false);
      expect(await cache.has(mockRequest, skillIds2)).toBe(false);
    });
  });

  // ==========================================================================
  // Cache Key Generation Tests
  // ==========================================================================

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same request', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store with first request
      await cache.set(mockRequest, skillIds, result, metadata);

      // Create identical request
      const sameRequest: AIRequest = {
        task: 'Review contract for compliance issues',
        context: {
          documentType: 'contract',
          complexity: 'medium',
        },
      };

      // Should retrieve same cached result
      const cached = await cache.get(sameRequest, skillIds);
      expect(cached).not.toBeNull();
      expect(cached?.result).toEqual(result);
    });

    it('should generate different keys for different requests', async () => {
      const skillIds = ['contract-analysis'];
      const result1 = { analysis: 'Result 1' };
      const result2 = { analysis: 'Result 2' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store first request
      await cache.set(mockRequest, skillIds, result1, metadata);

      // Create different request
      const differentRequest: AIRequest = {
        task: 'Different task',
        context: {
          documentType: 'agreement',
        },
      };

      // Store different request
      await cache.set(differentRequest, skillIds, result2, metadata);

      // Should retrieve different results
      const cached1 = await cache.get(mockRequest, skillIds);
      const cached2 = await cache.get(differentRequest, skillIds);

      expect(cached1?.result).toEqual(result1);
      expect(cached2?.result).toEqual(result2);
      expect(cached1?.result).not.toEqual(cached2?.result);
    });

    it('should generate different keys for different skill combinations', async () => {
      const skillIds1 = ['contract-analysis'];
      const skillIds2 = ['contract-analysis', 'compliance-check'];
      const result1 = { analysis: 'Result 1' };
      const result2 = { analysis: 'Result 2' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store with different skill combinations
      await cache.set(mockRequest, skillIds1, result1, metadata);
      await cache.set(mockRequest, skillIds2, result2, metadata);

      // Should retrieve different results
      const cached1 = await cache.get(mockRequest, skillIds1);
      const cached2 = await cache.get(mockRequest, skillIds2);

      expect(cached1?.result).toEqual(result1);
      expect(cached2?.result).toEqual(result2);
      expect(cached1?.skillIds).toEqual(skillIds1);
      expect(cached2?.skillIds).toEqual(skillIds2);
    });

    it('should be order-independent for skill IDs', async () => {
      const skillIds1 = ['contract-analysis', 'compliance-check'];
      const skillIds2 = ['compliance-check', 'contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store with first order
      await cache.set(mockRequest, skillIds1, result, metadata);

      // Retrieve with different order
      const cached = await cache.get(mockRequest, skillIds2);

      // Should retrieve same result (order-independent)
      expect(cached).not.toBeNull();
      expect(cached?.result).toEqual(result);
    });
  });

  // ==========================================================================
  // Metrics Tests
  // ==========================================================================

  describe('Metrics Tracking', () => {
    it('should track cache hits and misses', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Initial metrics
      let metrics = await cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);

      // Cache miss
      await cache.get(mockRequest, skillIds);
      metrics = await cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(1);

      // Store in cache
      await cache.set(mockRequest, skillIds, result, metadata);

      // Cache hit
      await cache.get(mockRequest, skillIds);
      metrics = await cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);

      // Another hit
      await cache.get(mockRequest, skillIds);
      metrics = await cache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Store in cache
      await cache.set(mockRequest, skillIds, result, metadata);

      // 2 hits, 1 miss = 66.67% hit rate
      await cache.get(mockRequest, skillIds); // Hit
      await cache.get(mockRequest, skillIds); // Hit
      await cache.get({ task: 'Different task' }, skillIds); // Miss

      const metrics = await cache.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(0.6667, 4);
    });

    it('should reset metrics', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      // Generate some metrics
      await cache.set(mockRequest, skillIds, result, metadata);
      await cache.get(mockRequest, skillIds);
      await cache.get({ task: 'Different task' }, skillIds);

      let metrics = await cache.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);

      // Reset
      cache.resetMetrics();

      metrics = await cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });

    it('should return complete stats', async () => {
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      await cache.set(mockRequest, skillIds, result, metadata);
      await cache.get(mockRequest, skillIds);

      const stats = await cache.getStats();

      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('warmingPatterns');
      expect(stats.config.ttl).toBe(3600);
      expect(stats.config.maxSize).toBe(100);
    });
  });

  // ==========================================================================
  // Cache Warming Tests
  // ==========================================================================

  describe('Cache Warming', () => {
    it('should register warming patterns', () => {
      const pattern1 = 'Review contract for compliance';
      const pattern2 = 'Draft NDA agreement';
      const skillIds = ['contract-analysis'];

      cache.registerWarmingPattern(pattern1, skillIds, 10);
      cache.registerWarmingPattern(pattern2, skillIds, 5);

      const patterns = cache.getWarmingPatterns();

      expect(patterns).toHaveLength(2);
      expect(patterns[0].taskPattern).toBe(pattern1); // Higher frequency first
      expect(patterns[0].frequency).toBe(10);
      expect(patterns[1].taskPattern).toBe(pattern2);
      expect(patterns[1].frequency).toBe(5);
    });

    it('should increment frequency for existing patterns', () => {
      const pattern = 'Review contract for compliance';
      const skillIds = ['contract-analysis'];

      cache.registerWarmingPattern(pattern, skillIds, 10);
      cache.registerWarmingPattern(pattern, skillIds, 5);

      const patterns = cache.getWarmingPatterns();

      expect(patterns).toHaveLength(1);
      expect(patterns[0].frequency).toBe(15); // 10 + 5
    });

    it('should warm cache for common requests', async () => {
      const commonRequests = [
        {
          request: { task: 'Review contract 1' },
          skillIds: ['contract-analysis'],
        },
        {
          request: { task: 'Review contract 2' },
          skillIds: ['contract-analysis'],
        },
        {
          request: { task: 'Draft NDA' },
          skillIds: ['document-drafting'],
        },
      ];

      const warmingFunction = jest.fn(async (request, skillIds) => ({
        result: { analysis: `Result for ${request.task}` },
        metadata: {
          model: 'claude-3-5-haiku-20241022',
          tokensEstimate: 1000,
          cost: 0.01,
        },
      }));

      const warmedCount = await cache.warmCache(commonRequests, warmingFunction);

      expect(warmedCount).toBe(3);
      expect(warmingFunction).toHaveBeenCalledTimes(3);

      // Verify all requests are now cached
      for (const { request, skillIds } of commonRequests) {
        const cached = await cache.get(request, skillIds);
        expect(cached).not.toBeNull();
      }
    });

    it('should skip warming for already cached entries', async () => {
      const request = { task: 'Review contract' };
      const skillIds = ['contract-analysis'];

      // Pre-cache one entry
      await cache.set(
        request,
        skillIds,
        { analysis: 'Existing' },
        {
          model: 'claude-3-5-haiku-20241022',
          tokensEstimate: 1000,
          cost: 0.01,
        }
      );

      const commonRequests = [
        { request, skillIds },
        { request: { task: 'Different task' }, skillIds },
      ];

      const warmingFunction = jest.fn(async (request, skillIds) => ({
        result: { analysis: `Result for ${request.task}` },
        metadata: {
          model: 'claude-3-5-haiku-20241022',
          tokensEstimate: 1000,
          cost: 0.01,
        },
      }));

      const warmedCount = await cache.warmCache(commonRequests, warmingFunction);

      // Should only warm 1 (skip the already cached one)
      expect(warmedCount).toBe(1);
      expect(warmingFunction).toHaveBeenCalledTimes(1);
    });

    it('should return 0 when warming is disabled', async () => {
      const disabledCache = new SkillCache({
        warmingEnabled: false,
      });

      const commonRequests = [
        {
          request: { task: 'Review contract' },
          skillIds: ['contract-analysis'],
        },
      ];

      const warmingFunction = jest.fn();
      const warmedCount = await disabledCache.warmCache(commonRequests, warmingFunction);

      expect(warmedCount).toBe(0);
      expect(warmingFunction).not.toHaveBeenCalled();

      await disabledCache.disconnect();
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultCache = new SkillCache();
      const stats = defaultCache.getRedisClient();

      expect(stats).toBeDefined();
    });

    it('should use custom configuration', async () => {
      const customCache = new SkillCache({
        ttl: 7200,
        maxSize: 500,
        keyPrefix: 'custom:',
        enableMetrics: false,
        warmingEnabled: false,
      });

      const stats = await customCache.getStats();

      expect(stats.config.ttl).toBe(7200);
      expect(stats.config.maxSize).toBe(500);
      expect(stats.config.keyPrefix).toBe('custom:');
      expect(stats.config.enableMetrics).toBe(false);
      expect(stats.config.warmingEnabled).toBe(false);

      await customCache.disconnect();
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty skill IDs array', async () => {
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      await cache.set(mockRequest, [], result, metadata);
      const cached = await cache.get(mockRequest, []);

      expect(cached).not.toBeNull();
      expect(cached?.skillIds).toEqual([]);
    });

    it('should handle requests with no context', async () => {
      const simpleRequest: AIRequest = {
        task: 'Simple task',
      };
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      await cache.set(simpleRequest, skillIds, result, metadata);
      const cached = await cache.get(simpleRequest, skillIds);

      expect(cached).not.toBeNull();
    });

    it('should handle large result objects', async () => {
      const largeResult = {
        analysis: 'x'.repeat(100000), // 100KB string
        metadata: {
          details: Array(1000).fill({ key: 'value' }),
        },
      };
      const skillIds = ['contract-analysis'];
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      await cache.set(mockRequest, skillIds, largeResult, metadata);
      const cached = await cache.get(mockRequest, skillIds);

      expect(cached).not.toBeNull();
      expect(cached?.result).toEqual(largeResult);
    });

    it('should handle special characters in task strings', async () => {
      const specialRequest: AIRequest = {
        task: 'Review "contract" with $pecial ch@racters & symbols!',
      };
      const skillIds = ['contract-analysis'];
      const result = { analysis: 'Result' };
      const metadata = {
        model: 'claude-3-5-haiku-20241022',
        tokensEstimate: 1000,
        cost: 0.01,
      };

      await cache.set(specialRequest, skillIds, result, metadata);
      const cached = await cache.get(specialRequest, skillIds);

      expect(cached).not.toBeNull();
    });
  });
});
