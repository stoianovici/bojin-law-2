/**
 * Session Cleanup Integration Tests
 * Story 2.4: Authentication with Azure AD - Task 14
 *
 * Tests session monitoring and cleanup
 */

// Set environment variables before imports
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-for-integration-tests';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret-at-least-16-chars';
process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3001/auth/callback';

// Mock dependencies
jest.mock('@legal-platform/database');

import request from 'supertest';
import { app } from '../../src/index';
import * as database from '@legal-platform/database';

// Mock cache manager
const mockCacheManager = database.cacheManager as jest.Mocked<typeof database.cacheManager>;
const mockRedis = database.redis as any;

describe('Session Cleanup Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/session-stats', () => {
    it('should return session statistics', async () => {
      // Mock cache manager stats
      mockCacheManager.stats.mockResolvedValue({
        totalKeys: 150,
        sessionKeys: 100,
        cacheKeys: 50,
        memoryUsed: '2.5M',
      });

      const response = await request(app)
        .get('/admin/session-stats');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Session statistics retrieved successfully');
      expect(response.body.stats).toHaveProperty('totalKeys', 150);
      expect(response.body.stats).toHaveProperty('sessionKeys', 100);
      expect(response.body.stats).toHaveProperty('cacheKeys', 50);
      expect(response.body.stats).toHaveProperty('memoryUsed', '2.5M');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle errors when retrieving stats', async () => {
      // Mock error
      mockCacheManager.stats.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/admin/session-stats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('stats_retrieval_failed');
    });
  });

  describe('POST /admin/cleanup-sessions', () => {
    it('should cleanup sessions without TTL', async () => {
      // Mock cache manager stats (before and after)
      mockCacheManager.stats
        .mockResolvedValueOnce({
          totalKeys: 150,
          sessionKeys: 105, // 5 sessions without TTL
          cacheKeys: 50,
          memoryUsed: '2.5M',
        })
        .mockResolvedValueOnce({
          totalKeys: 145,
          sessionKeys: 100, // After cleanup: 5 removed
          cacheKeys: 50,
          memoryUsed: '2.4M',
        });

      // Mock Redis scan to return session keys
      mockRedis.scan = jest.fn()
        .mockResolvedValueOnce(['0', ['sess:key1', 'sess:key2', 'sess:key3', 'sess:key4', 'sess:key5']]);

      // Mock TTL checks: 3 valid, 2 without TTL (-1)
      mockRedis.ttl = jest.fn()
        .mockResolvedValueOnce(3600) // sess:key1 - valid
        .mockResolvedValueOnce(-1)   // sess:key2 - no TTL (cleanup)
        .mockResolvedValueOnce(7200) // sess:key3 - valid
        .mockResolvedValueOnce(-1)   // sess:key4 - no TTL (cleanup)
        .mockResolvedValueOnce(1800); // sess:key5 - valid

      // Mock delete
      mockRedis.del = jest.fn().mockResolvedValue(1);

      const response = await request(app)
        .post('/admin/cleanup-sessions');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Session cleanup completed');
      expect(response.body.cleanup.sessionsRemoved).toBe(2); // 2 sessions without TTL
      expect(response.body.cleanup.sessionsBeforeCleanup).toBe(105);
      expect(response.body.cleanup.sessionsAfterCleanup).toBe(100);
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockCacheManager.stats.mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .post('/admin/cleanup-sessions');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('cleanup_failed');
    });
  });

  describe('GET /admin/health', () => {
    it('should return healthy status when Redis is accessible', async () => {
      mockRedis.ping = jest.fn().mockResolvedValue('PONG');

      const response = await request(app)
        .get('/admin/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.components.redis.healthy).toBe(true);
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockRedis.ping = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/admin/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });
});
