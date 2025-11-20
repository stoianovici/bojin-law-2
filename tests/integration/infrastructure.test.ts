/**
 * Infrastructure Integration Tests
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Tests PostgreSQL, Redis, and overall infrastructure health
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  prisma,
  checkDatabaseHealth,
  redis,
  checkRedisHealth,
  sessionManager,
  cacheManager,
} from '@legal-platform/database';

describe('Infrastructure Integration Tests', () => {
  beforeAll(async () => {
    // Ensure connections are established
    await Promise.all([
      prisma.$connect(),
      redis.ping(),
    ]);
  });

  afterAll(async () => {
    // Clean up connections
    await Promise.all([
      prisma.$disconnect(),
      redis.quit(),
    ]);
  });

  describe('PostgreSQL Database', () => {
    it('should connect to database', async () => {
      const health = await checkDatabaseHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThan(0);
      expect(health.latency).toBeLessThan(1000); // Should be under 1 second
      expect(health.error).toBeUndefined();
    });

    it('should have pgvector extension enabled', async () => {
      const result = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'vector';
      `;

      expect(result).toHaveLength(1);
      expect(result[0].extname).toBe('vector');
    });

    it('should have uuid-ossp extension enabled', async () => {
      const result = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';
      `;

      expect(result).toHaveLength(1);
      expect(result[0].extname).toBe('uuid-ossp');
    });

    it('should have pg_trgm extension enabled', async () => {
      const result = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
      `;

      expect(result).toHaveLength(1);
      expect(result[0].extname).toBe('pg_trgm');
    });

    it('should execute vector similarity queries', async () => {
      // Test that pgvector operations work
      const result = await prisma.$queryRaw`
        SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS distance;
      `;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle concurrent database connections', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        prisma.$queryRaw`SELECT ${i} AS value`
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toEqual([{ value: index }]);
      });
    });

    it('should respect connection timeout', async () => {
      // This should complete within the configured timeout
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(30000); // 30 second timeout
    });
  });

  describe('Redis Cache', () => {
    beforeEach(async () => {
      // Clear test data before each test
      await redis.flushdb();
    });

    it('should connect to Redis', async () => {
      const health = await checkRedisHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThan(0);
      expect(health.latency).toBeLessThan(1000);
      expect(health.error).toBeUndefined();
    });

    it('should store and retrieve session data', async () => {
      const sessionId = 'test-session-integration';
      const sessionData = {
        userId: 'user-123',
        role: 'Partner',
        firmId: 'firm-456',
        lastActivity: new Date().toISOString(),
      };

      await sessionManager.set(sessionId, sessionData);
      const retrieved = await sessionManager.get(sessionId);

      expect(retrieved).toEqual(sessionData);
    });

    it('should expire sessions after TTL', async () => {
      const sessionId = 'test-session-ttl';
      const sessionData = { userId: '123', role: 'Associate' };

      // Set session with 1 second TTL
      await sessionManager.set(sessionId, sessionData, 1);

      // Should exist immediately
      expect(await sessionManager.exists(sessionId)).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(await sessionManager.exists(sessionId)).toBe(false);
    }, 10000); // 10 second timeout for this test

    it('should cache and retrieve data', async () => {
      const cacheKey = 'test:case:123';
      const cacheData = {
        caseId: '123',
        caseNumber: 'CASE-2025-001',
        title: 'Integration Test Case',
      };

      await cacheManager.set(cacheKey, cacheData);
      const retrieved = await cacheManager.get(cacheKey);

      expect(retrieved).toEqual(cacheData);
    });

    it('should invalidate cache by pattern', async () => {
      // Create multiple cache entries
      await Promise.all([
        cacheManager.set('test:case:1', { id: 1 }),
        cacheManager.set('test:case:2', { id: 2 }),
        cacheManager.set('test:user:1', { id: 1 }),
      ]);

      // Invalidate case caches
      const invalidated = await cacheManager.invalidate('test:case:*');

      expect(invalidated).toBe(2);
      expect(await cacheManager.exists('test:case:1')).toBe(false);
      expect(await cacheManager.exists('test:case:2')).toBe(false);
      expect(await cacheManager.exists('test:user:1')).toBe(true);
    });

    it('should handle concurrent Redis operations', async () => {
      const promises = Array.from({ length: 20 }, async (_, i) => {
        await cacheManager.set(`test:concurrent:${i}`, { value: i });
        return cacheManager.get(`test:concurrent:${i}`);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      results.forEach((result, index) => {
        expect(result).toEqual({ value: index });
      });
    });
  });

  describe('Infrastructure Performance', () => {
    it('should have acceptable database query latency', async () => {
      const iterations = 10;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

      expect(avgLatency).toBeLessThan(100); // Average < 100ms
      expect(p95Latency).toBeLessThan(200); // P95 < 200ms
    });

    it('should have acceptable Redis operation latency', async () => {
      const iterations = 10;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await redis.ping();
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
      const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(iterations * 0.99)];

      expect(avgLatency).toBeLessThan(10); // Average < 10ms
      expect(p99Latency).toBeLessThan(50); // P99 < 50ms
    });
  });

  describe('Health Checks', () => {
    it('should return comprehensive health status', async () => {
      const [dbHealth, redisHealth] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
      ]);

      // Database health
      expect(dbHealth.healthy).toBe(true);
      expect(typeof dbHealth.latency).toBe('number');

      // Redis health
      expect(redisHealth.healthy).toBe(true);
      expect(typeof redisHealth.latency).toBe('number');
    });

    it('should provide cache statistics', async () => {
      // Create some test data
      await sessionManager.set('test-session-1', { userId: '1' });
      await cacheManager.set('test:cache:1', { id: 1 });

      const stats = await cacheManager.stats();

      expect(stats.totalKeys).toBeGreaterThanOrEqual(2);
      expect(stats.sessionKeys).toBeGreaterThanOrEqual(1);
      expect(stats.cacheKeys).toBeGreaterThanOrEqual(1);
      expect(stats.memoryUsed).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      await expect(
        prisma.$queryRaw`SELECT * FROM nonexistent_table`
      ).rejects.toThrow();
    });

    it('should handle Redis errors gracefully', async () => {
      // Attempt to get a non-existent key should return null, not throw
      const result = await cacheManager.get('nonexistent:key');
      expect(result).toBeNull();
    });
  });
});
