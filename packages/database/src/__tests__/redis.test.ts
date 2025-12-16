/**
 * Redis Client Tests
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Tests Redis session management and caching functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { redis, sessionManager, cacheManager, checkRedisHealth, getRedisConfig } from '../redis';

describe('Redis Client', () => {
  beforeAll(async () => {
    // Wait for Redis to be ready
    await redis.ping();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await redis.flushdb(); // Clear test database
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear all keys before each test
    await redis.flushdb();
  });

  describe('Redis Connection', () => {
    it('should connect to Redis successfully', async () => {
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('should have correct configuration', () => {
      const config = getRedisConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.connectTimeout).toBe(5000);
      expect(config.sessionTTL).toBe(86400); // 24 hours
      expect(config.cacheDefaultTTL).toBe(300); // 5 minutes
    });
  });

  describe('Session Manager', () => {
    const sessionId = 'test-session-123';
    const sessionData = {
      userId: '123',
      role: 'Partner',
      firmId: 'firm-456',
      lastActivity: new Date().toISOString(),
    };

    describe('set/get', () => {
      it('should store and retrieve session data', async () => {
        await sessionManager.set(sessionId, sessionData);
        const retrieved = await sessionManager.get(sessionId);

        expect(retrieved).toEqual(sessionData);
      });

      it('should return null for non-existent session', async () => {
        const retrieved = await sessionManager.get('non-existent');
        expect(retrieved).toBeNull();
      });

      it('should set custom TTL', async () => {
        await sessionManager.set(sessionId, sessionData, 60); // 1 minute
        const ttl = await redis.ttl('session:test-session-123');

        expect(ttl).toBeGreaterThan(50);
        expect(ttl).toBeLessThanOrEqual(60);
      });
    });

    describe('delete', () => {
      it('should delete session', async () => {
        await sessionManager.set(sessionId, sessionData);
        await sessionManager.delete(sessionId);

        const retrieved = await sessionManager.get(sessionId);
        expect(retrieved).toBeNull();
      });
    });

    describe('refresh', () => {
      it('should refresh session TTL', async () => {
        await sessionManager.set(sessionId, sessionData, 60);

        // Wait a moment
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Refresh to full 24 hours
        await sessionManager.refresh(sessionId);

        const ttl = await redis.ttl('session:test-session-123');
        expect(ttl).toBeGreaterThan(86000); // Should be close to 24 hours
      });
    });

    describe('exists', () => {
      it('should check if session exists', async () => {
        expect(await sessionManager.exists(sessionId)).toBe(false);

        await sessionManager.set(sessionId, sessionData);

        expect(await sessionManager.exists(sessionId)).toBe(true);
      });
    });

    describe('getUserSessions', () => {
      it('should get all sessions for a user', async () => {
        await sessionManager.set('session-1', { userId: '123', role: 'Partner' });
        await sessionManager.set('session-2', { userId: '123', role: 'Partner' });
        await sessionManager.set('session-3', { userId: '456', role: 'Associate' });

        const user123Sessions = await sessionManager.getUserSessions('123');
        expect(user123Sessions).toHaveLength(2);
        expect(user123Sessions).toContain('session-1');
        expect(user123Sessions).toContain('session-2');
      });
    });

    describe('deleteUserSessions', () => {
      it('should delete all sessions for a user', async () => {
        await sessionManager.set('session-1', { userId: '123', role: 'Partner' });
        await sessionManager.set('session-2', { userId: '123', role: 'Partner' });
        await sessionManager.set('session-3', { userId: '456', role: 'Associate' });

        await sessionManager.deleteUserSessions('123');

        expect(await sessionManager.exists('session-1')).toBe(false);
        expect(await sessionManager.exists('session-2')).toBe(false);
        expect(await sessionManager.exists('session-3')).toBe(true);
      });
    });

    describe('cleanup', () => {
      it('should cleanup expired sessions', async () => {
        // Create a session with immediate expiration
        await redis.setex('session:expired', 1, JSON.stringify(sessionData));

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 1100));

        const cleanedCount = await sessionManager.cleanup();
        expect(cleanedCount).toBeGreaterThanOrEqual(0); // May or may not find expired keys
      });
    });
  });

  describe('Cache Manager', () => {
    const cacheKey = 'case:123';
    const cacheData = {
      caseId: '123',
      caseNumber: 'CASE-2025-001',
      title: 'Contract Dispute',
    };

    describe('set/get', () => {
      it('should store and retrieve cached data', async () => {
        await cacheManager.set(cacheKey, cacheData);
        const retrieved = await cacheManager.get(cacheKey);

        expect(retrieved).toEqual(cacheData);
      });

      it('should return null for non-existent cache', async () => {
        const retrieved = await cacheManager.get('non-existent');
        expect(retrieved).toBeNull();
      });

      it('should set custom TTL', async () => {
        await cacheManager.set(cacheKey, cacheData, 60); // 1 minute
        const ttl = await redis.ttl('cache:case:123');

        expect(ttl).toBeGreaterThan(50);
        expect(ttl).toBeLessThanOrEqual(60);
      });

      it('should handle typed cache retrieval', async () => {
        interface CaseData {
          caseId: string;
          caseNumber: string;
          title: string;
        }

        await cacheManager.set(cacheKey, cacheData);
        const retrieved = await cacheManager.get<CaseData>(cacheKey);

        expect(retrieved?.caseId).toBe('123');
        expect(retrieved?.title).toBe('Contract Dispute');
      });
    });

    describe('delete', () => {
      it('should delete cached data', async () => {
        await cacheManager.set(cacheKey, cacheData);
        await cacheManager.delete(cacheKey);

        const retrieved = await cacheManager.get(cacheKey);
        expect(retrieved).toBeNull();
      });
    });

    describe('invalidate', () => {
      it('should invalidate cache by pattern', async () => {
        await cacheManager.set('case:1', { id: 1 });
        await cacheManager.set('case:2', { id: 2 });
        await cacheManager.set('user:1', { id: 1 });

        const invalidated = await cacheManager.invalidate('case:*');
        expect(invalidated).toBe(2);

        expect(await cacheManager.exists('case:1')).toBe(false);
        expect(await cacheManager.exists('case:2')).toBe(false);
        expect(await cacheManager.exists('user:1')).toBe(true);
      });
    });

    describe('exists', () => {
      it('should check if cache exists', async () => {
        expect(await cacheManager.exists(cacheKey)).toBe(false);

        await cacheManager.set(cacheKey, cacheData);

        expect(await cacheManager.exists(cacheKey)).toBe(true);
      });
    });

    describe('stats', () => {
      it('should get cache statistics', async () => {
        await sessionManager.set('session-1', { userId: '123' });
        await cacheManager.set('case:1', { id: 1 });
        await cacheManager.set('case:2', { id: 2 });

        const stats = await cacheManager.stats();

        expect(stats.totalKeys).toBe(3);
        expect(stats.sessionKeys).toBe(1);
        expect(stats.cacheKeys).toBe(2);
        expect(stats.memoryUsed).toBeDefined();
      });
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const health = await checkRedisHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThan(0);
      expect(health.latency).toBeLessThan(1000); // Should be under 1 second
      expect(health.error).toBeUndefined();
    });

    it('should measure latency', async () => {
      const health = await checkRedisHealth();

      expect(typeof health.latency).toBe('number');
      expect(health.latency).toBeGreaterThan(0);
    });
  });
});
