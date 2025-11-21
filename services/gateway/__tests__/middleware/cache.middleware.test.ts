/**
 * Unit Tests for Cache Middleware
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 15
 *
 * Tests Redis caching middleware for Microsoft Graph API responses
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '@legal-platform/database';
import {
  graphCacheMiddleware,
  graphCacheInvalidationMiddleware,
  invalidateUserCache,
  getCacheStats,
  closeRedisConnection,
} from '../../src/middleware/cache.middleware';

// Mock Redis
jest.mock('@legal-platform/database', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
    dbsize: jest.fn(),
    info: jest.fn(),
    quit: jest.fn(),
    status: 'ready',
  },
}));

// Mock logger module - must match the default export structure
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Cache Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock response methods
    jsonMock = jest.fn().mockReturnThis();
    sendMock = jest.fn().mockReturnThis();
    setHeaderMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    mockRequest = {
      method: 'GET',
      path: '/graph/users/me',
      session: {
        userId: 'user123',
      } as any,
    } as any; // Use 'as any' to allow property assignment

    mockResponse = {
      json: jsonMock,
      send: sendMock,
      setHeader: setHeaderMock,
      status: statusMock,
    };

    mockNext = jest.fn();
  });

  describe('graphCacheMiddleware', () => {
    describe('Request filtering', () => {
      it('should skip caching for non-GET requests', async () => {
        mockRequest.method = 'POST';

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(redis.get).not.toHaveBeenCalled();
      });

      it('should skip caching when user is not authenticated (no session)', async () => {
        mockRequest.session = undefined;

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(redis.get).not.toHaveBeenCalled();
      });

      it('should skip caching when user is not authenticated (no userId)', async () => {
        mockRequest.session = {} as any;

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(redis.get).not.toHaveBeenCalled();
      });
    });

    describe('Cache hit scenarios', () => {
      it('should return cached response on cache hit', async () => {
        const cachedData = { id: '123', name: 'Test User' };
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(redis.get).toHaveBeenCalledWith('graph:user123:/graph/users/me');
        expect(setHeaderMock).toHaveBeenCalledWith('X-Cache', 'HIT');
        expect(setHeaderMock).toHaveBeenCalledWith(
          'Cache-Control',
          expect.stringContaining('max-age=')
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(cachedData);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should set correct TTL for user profile requests', async () => {
        const cachedData = { id: '123', name: 'Test User' };
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
        (mockRequest as any).path = '/graph/users/me';

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'max-age=3600'); // 1 hour
      });

      it('should set correct TTL for calendar requests', async () => {
        const cachedData = [{ id: 'event1', subject: 'Meeting' }];
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
        (mockRequest as any).path = '/graph/calendar/events';

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'max-age=300'); // 5 minutes
      });

      it('should set correct TTL for file requests', async () => {
        const cachedData = { id: 'file1', name: 'document.pdf' };
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
        (mockRequest as any).path = '/graph/drive/items/abc123';

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'max-age=900'); // 15 minutes
      });

      it('should set correct TTL for email requests', async () => {
        const cachedData = [{ id: 'msg1', subject: 'Test Email' }];
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
        (mockRequest as any).path = '/graph/messages';

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'max-age=60'); // 1 minute
      });
    });

    describe('Cache miss scenarios', () => {
      it('should continue to handler on cache miss and override res.json', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.setex as jest.Mock).mockResolvedValue('OK');

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(redis.get).toHaveBeenCalledWith('graph:user123:/graph/users/me');
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockResponse.json).not.toBe(jsonMock); // res.json should be overridden
      });

      it('should cache response and set X-Cache: MISS header when res.json is called', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.setex as jest.Mock).mockResolvedValue('OK');

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        // Simulate handler calling res.json
        const responseData = { id: '123', name: 'Test User' };
        await (mockResponse.json as any)(responseData);

        // Wait for async cache operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.setex).toHaveBeenCalledWith(
          'graph:user123:/graph/users/me',
          3600, // user profile TTL
          JSON.stringify(responseData)
        );
        expect(setHeaderMock).toHaveBeenCalledWith('X-Cache', 'MISS');
      });

      it('should handle caching errors gracefully', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.setex as jest.Mock).mockRejectedValue(new Error('Redis error'));

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        // Simulate handler calling res.json
        const responseData = { id: '123', name: 'Test User' };
        await (mockResponse.json as any)(responseData);

        // Wait for async cache operation to fail
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should not throw, just log error
        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });

    describe('Cache key generation', () => {
      it('should generate cache key without query string', async () => {
        (mockRequest as any).path = '/graph/users/me?$select=displayName';
        (redis.get as jest.Mock).mockResolvedValue(null);

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(redis.get).toHaveBeenCalledWith('graph:user123:/graph/users/me');
      });

      it('should include userId in cache key for session isolation', async () => {
        mockRequest.session = { userId: 'user456' } as any;
        (redis.get as jest.Mock).mockResolvedValue(null);

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(redis.get).toHaveBeenCalledWith('graph:user456:/graph/users/me');
      });
    });

    describe('Error handling', () => {
      it('should continue without caching on Redis get error', async () => {
        (redis.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

        await graphCacheMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('graphCacheInvalidationMiddleware', () => {
    describe('Request filtering', () => {
      it('should skip invalidation for GET requests', async () => {
        mockRequest.method = 'GET';

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(redis.keys).not.toHaveBeenCalled();
      });

      it('should skip invalidation when user is not authenticated (no session)', async () => {
        mockRequest.method = 'POST';
        mockRequest.session = undefined;

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(redis.keys).not.toHaveBeenCalled();
      });

      it('should skip invalidation when user is not authenticated (no userId)', async () => {
        mockRequest.method = 'POST';
        mockRequest.session = {} as any;

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(redis.keys).not.toHaveBeenCalled();
      });
    });

    describe('Cache invalidation on POST/PUT/DELETE', () => {
      beforeEach(() => {
        mockRequest.method = 'POST';
        (redis.keys as jest.Mock).mockResolvedValue([
          'graph:user123:/graph/users/me',
          'graph:user123:/graph/users/me/profile',
        ]);
        (redis.del as jest.Mock).mockResolvedValue(2);
      });

      it('should invalidate cache on POST request', async () => {
        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledTimes(1);

        // Simulate handler calling res.json
        await (mockResponse.json as any)({ success: true });

        // Wait for async invalidation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.keys).toHaveBeenCalledWith('graph:user123:/graph/users/me*');
        expect(redis.del).toHaveBeenCalledWith(
          'graph:user123:/graph/users/me',
          'graph:user123:/graph/users/me/profile'
        );
      });

      it('should invalidate cache on PUT request', async () => {
        mockRequest.method = 'PUT';

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Simulate handler calling res.json
        await (mockResponse.json as any)({ success: true });

        // Wait for async invalidation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.keys).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalled();
      });

      it('should invalidate cache on DELETE request', async () => {
        mockRequest.method = 'DELETE';

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Simulate handler calling res.json
        await (mockResponse.json as any)({ success: true });

        // Wait for async invalidation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.keys).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalled();
      });

      it('should invalidate cache when res.send is called', async () => {
        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Simulate handler calling res.send
        await (mockResponse.send as any)('Success');

        // Wait for async invalidation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.keys).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalled();
      });

      it('should not call redis.del when no matching keys found', async () => {
        (redis.keys as jest.Mock).mockResolvedValue([]);

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Simulate handler calling res.json
        await (mockResponse.json as any)({ success: true });

        // Wait for async invalidation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.keys).toHaveBeenCalled();
        expect(redis.del).not.toHaveBeenCalled();
      });
    });

    describe('Invalidation pattern generation', () => {
      it('should generate correct invalidation pattern for resource', async () => {
        (mockRequest as any).method = 'POST';
        (mockRequest as any).path = '/graph/users/me/profile';
        (redis.keys as jest.Mock).mockResolvedValue([]);

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Simulate handler calling res.json
        await (mockResponse.json as any)({ success: true });

        // Wait for async invalidation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(redis.keys).toHaveBeenCalledWith('graph:user123:/graph/users/me/profile*');
      });
    });

    describe('Error handling', () => {
      it('should continue without invalidation on Redis keys error', async () => {
        mockRequest.method = 'POST';
        (redis.keys as jest.Mock).mockRejectedValue(new Error('Redis error'));

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledTimes(1);
      });

      it('should handle invalidation errors gracefully', async () => {
        mockRequest.method = 'POST';
        (redis.keys as jest.Mock).mockResolvedValue(['key1']);
        (redis.del as jest.Mock).mockRejectedValue(new Error('Delete failed'));

        await graphCacheInvalidationMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Simulate handler calling res.json
        await (mockResponse.json as any)({ success: true });

        // Wait for async invalidation to fail
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should not throw, just log error
        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate all user cache with default pattern', async () => {
      (redis.keys as jest.Mock).mockResolvedValue(['graph:user123:key1', 'graph:user123:key2']);
      (redis.del as jest.Mock).mockResolvedValue(2);

      const result = await invalidateUserCache('user123');

      expect(redis.keys).toHaveBeenCalledWith('graph:user123:*');
      expect(redis.del).toHaveBeenCalledWith('graph:user123:key1', 'graph:user123:key2');
      expect(result).toBe(2);
    });

    it('should invalidate user cache with custom pattern', async () => {
      (redis.keys as jest.Mock).mockResolvedValue(['graph:user123:/graph/messages']);
      (redis.del as jest.Mock).mockResolvedValue(1);

      const result = await invalidateUserCache('user123', 'graph:user123:/graph/messages*');

      expect(redis.keys).toHaveBeenCalledWith('graph:user123:/graph/messages*');
      expect(redis.del).toHaveBeenCalledWith('graph:user123:/graph/messages');
      expect(result).toBe(1);
    });

    it('should return 0 when no keys found', async () => {
      (redis.keys as jest.Mock).mockResolvedValue([]);

      const result = await invalidateUserCache('user123');

      expect(redis.del).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should throw error on Redis failure', async () => {
      (redis.keys as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      await expect(invalidateUserCache('user123')).rejects.toThrow('Redis connection failed');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics when Redis is connected', async () => {
      (redis.dbsize as jest.Mock).mockResolvedValue(42);
      (redis.info as jest.Mock).mockResolvedValue('# Stats\r\ntotal_connections_received:123');

      const stats = await getCacheStats();

      expect(stats).toEqual({
        connected: true,
        dbSize: 42,
        info: '# Stats\r\ntotal_connections_received:123',
      });
    });

    it('should return disconnected status on error', async () => {
      (redis.dbsize as jest.Mock).mockRejectedValue(new Error('Redis error'));

      const stats = await getCacheStats();

      expect(stats).toEqual({
        connected: false,
      });
    });
  });

  describe('closeRedisConnection', () => {
    it('should close Redis connection when status is ready', async () => {
      (redis.quit as jest.Mock).mockResolvedValue('OK');
      (redis as any).status = 'ready';

      await closeRedisConnection();

      expect(redis.quit).toHaveBeenCalledTimes(1);
    });

    it('should not call quit when Redis is not ready', async () => {
      (redis as any).status = 'end';

      await closeRedisConnection();

      expect(redis.quit).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (redis.quit as jest.Mock).mockRejectedValue(new Error('Quit failed'));
      (redis as any).status = 'ready';

      await expect(closeRedisConnection()).resolves.not.toThrow();
    });
  });
});
