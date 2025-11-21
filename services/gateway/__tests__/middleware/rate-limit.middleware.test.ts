/**
 * Unit Tests for Rate Limiting Middleware
 * Story 2.5: Microsoft Graph API Integration Foundation - Task 6
 *
 * Tests sliding window rate limiter implementation for Microsoft Graph API
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '@legal-platform/database';
import {
  checkGraphRateLimit,
  createGraphRateLimitMiddleware,
  combinedGraphRateLimitMiddleware,
  DEFAULT_GRAPH_APP_RATE_LIMIT,
  DEFAULT_GRAPH_USER_RATE_LIMIT,
  GraphRateLimitConfig,
} from '../../src/middleware/rate-limit.middleware';

// Mock Redis
jest.mock('@legal-platform/database', () => ({
  redis: {
    multi: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    zadd: jest.fn(),
    expire: jest.fn(),
  },
}));

describe('Rate Limiting Middleware', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkGraphRateLimit', () => {
    const mockConfig: GraphRateLimitConfig = {
      maxRequests: 100,
      windowSeconds: 60,
      keyPrefix: 'test:rate',
      perUser: false,
    };

    it('should allow requests within rate limit', async () => {
      // Mock Redis transaction
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 50], // zcard result - 50 requests in window
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      const result = await checkGraphRateLimit('test-key', mockConfig);

      expect(result).toEqual({
        limit: 100,
        remaining: 49, // 100 - 50 - 1
        reset: expect.any(Number),
      });

      expect(mockMulti.zremrangebyscore).toHaveBeenCalled();
      expect(mockMulti.zcard).toHaveBeenCalled();
      expect(mockMulti.zadd).toHaveBeenCalled();
      expect(mockMulti.expire).toHaveBeenCalledWith(expect.any(String), 60);
    });

    it('should return 0 remaining when at limit', async () => {
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 99], // 99 existing requests, +1 current = 100 (at limit)
          [null, 1],
          [null, 1],
        ]),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      const result = await checkGraphRateLimit('test-key', mockConfig);

      expect(result.remaining).toBe(0);
    });

    it('should handle Redis errors gracefully (fail-open)', async () => {
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await checkGraphRateLimit('test-key', mockConfig);

      // Should fail-open (allow request)
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Graph Rate Limit] Redis error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should calculate correct reset time', async () => {
      const now = Date.now();
      const expectedReset = Math.ceil((now + mockConfig.windowSeconds * 1000) / 1000);

      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 10],
          [null, 1],
          [null, 1],
        ]),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      const result = await checkGraphRateLimit('test-key', mockConfig);

      // Reset should be approximately now + window (allow 5 second variance)
      expect(result.reset).toBeGreaterThanOrEqual(expectedReset - 5);
      expect(result.reset).toBeLessThanOrEqual(expectedReset + 5);
    });

    it('should handle null exec results', async () => {
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      const result = await checkGraphRateLimit('test-key', mockConfig);

      // Should handle null results gracefully
      expect(result.remaining).toBe(99); // maxRequests - 0 - 1
    });
  });

  describe('createGraphRateLimitMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let setHeaderSpy: jest.Mock;
    let statusSpy: jest.Mock;
    let jsonSpy: jest.Mock;

    beforeEach(() => {
      setHeaderSpy = jest.fn();
      statusSpy = jest.fn().mockReturnThis();
      jsonSpy = jest.fn();

      mockReq = {
        ip: '127.0.0.1',
        path: '/api/graph/test',
        session: undefined,
      };

      mockRes = {
        setHeader: setHeaderSpy,
        status: statusSpy,
        json: jsonSpy,
        headersSent: false,
      };

      mockNext = jest.fn();
    });

    describe('App-level rate limiting', () => {
      it('should allow requests within app-level limit', async () => {
        const mockMulti = {
          zremrangebyscore: jest.fn().mockReturnThis(),
          zcard: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            [null, 0],
            [null, 50], // Well under limit
            [null, 1],
            [null, 1],
          ]),
        };

        (redis.multi as jest.Mock).mockReturnValue(mockMulti);

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_APP_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should set rate limit headers
        expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
        expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
        expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));

        // Should call next
        expect(mockNext).toHaveBeenCalled();

        // Should not return 429
        expect(statusSpy).not.toHaveBeenCalled();
      });

      it('should block requests when app-level limit exceeded', async () => {
        const mockMulti = {
          zremrangebyscore: jest.fn().mockReturnThis(),
          zcard: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            [null, 0],
            [null, 10000], // At limit
            [null, 1],
            [null, 1],
          ]),
        };

        (redis.multi as jest.Mock).mockReturnValue(mockMulti);

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_APP_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should return 429
        expect(statusSpy).toHaveBeenCalledWith(429);
        expect(jsonSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'rate_limit_exceeded',
            retryAfter: expect.any(Number),
          })
        );

        // Should set Retry-After header
        expect(setHeaderSpy).toHaveBeenCalledWith('Retry-After', expect.any(String));

        // Should log violation
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Graph Rate Limit] Limit exceeded',
          expect.any(Object)
        );

        // Should not call next
        expect(mockNext).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
      });
    });

    describe('Per-user rate limiting', () => {
      it('should skip per-user limiting when no user session', async () => {
        const mockMulti = {
          zremrangebyscore: jest.fn().mockReturnThis(),
          zcard: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            [null, 0],
            [null, 10],
            [null, 1],
            [null, 1],
          ]),
        };

        (redis.multi as jest.Mock).mockReturnValue(mockMulti);

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_USER_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should call next immediately (skip per-user limiting)
        expect(mockNext).toHaveBeenCalled();

        // Should not check Redis
        expect(redis.multi).not.toHaveBeenCalled();
      });

      it('should apply per-user limiting when user session exists', async () => {
        mockReq.session = { userId: 'test-user-123' } as any;

        const mockMulti = {
          zremrangebyscore: jest.fn().mockReturnThis(),
          zcard: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            [null, 0],
            [null, 50],
            [null, 1],
            [null, 1],
          ]),
        };

        (redis.multi as jest.Mock).mockReturnValue(mockMulti);

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_USER_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should check rate limit for user
        expect(redis.multi).toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
      });

      it('should block requests when per-user limit exceeded', async () => {
        mockReq.session = { userId: 'test-user-123' } as any;

        const mockMulti = {
          zremrangebyscore: jest.fn().mockReturnThis(),
          zcard: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            [null, 0],
            [null, 100], // At user limit
            [null, 1],
            [null, 1],
          ]),
        };

        (redis.multi as jest.Mock).mockReturnValue(mockMulti);

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_USER_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should return 429
        expect(statusSpy).toHaveBeenCalledWith(429);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should fail-open on middleware errors', async () => {
        const mockMulti = {
          zremrangebyscore: jest.fn().mockReturnThis(),
          zcard: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockRejectedValue(new Error('Redis error')),
        };

        (redis.multi as jest.Mock).mockReturnValue(mockMulti);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_APP_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should fail-open (allow request)
        expect(mockNext).toHaveBeenCalled();
        expect(statusSpy).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it('should handle Redis multi() throwing error', async () => {
        (redis.multi as jest.Mock).mockImplementation(() => {
          throw new Error('Redis multi failed');
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const middleware = createGraphRateLimitMiddleware(DEFAULT_GRAPH_APP_RATE_LIMIT);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        // Should fail-open
        expect(mockNext).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('combinedGraphRateLimitMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        ip: '127.0.0.1',
        path: '/api/graph/test',
        session: { userId: 'test-user' } as any,
      };

      mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      };

      mockNext = jest.fn();
    });

    it('should apply both app and user rate limits', async () => {
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 50],
          [null, 1],
          [null, 1],
        ]),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      combinedGraphRateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Allow async middleware to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Both limits should be checked
      expect(redis.multi).toHaveBeenCalled();
    });

    it('should stop at app limit if exceeded', async () => {
      let callCount = 0;
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            // First call (app limit) - exceeded
            return [
              [null, 0],
              [null, 10000],
              [null, 1],
              [null, 1],
            ];
          }
          // Should not reach here
          return [
            [null, 0],
            [null, 50],
            [null, 1],
            [null, 1],
          ];
        }),
      };

      (redis.multi as jest.Mock).mockReturnValue(mockMulti);

      combinedGraphRateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Allow async middleware to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be called once for app limit
      expect(callCount).toBe(1);
    });
  });
});
