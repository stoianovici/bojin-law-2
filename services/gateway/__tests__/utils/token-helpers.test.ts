/**
 * Token Helpers Utility Tests
 * Story 2.5: Microsoft Graph API Integration Foundation
 * Task 5: Implement Token Storage and Retrieval
 *
 * Tests for token storage, retrieval, and validation helpers.
 * Target: 100% coverage
 */

import { redis } from '@legal-platform/database';
import {
  storeUserSessionMapping,
  getUserSessionId,
  deleteUserSessionMapping,
  getSessionData,
  getGraphToken,
  getGraphTokenFromSession,
  getRefreshTokenFromSession,
  isTokenExpired,
  needsTokenRefresh,
  getSecondsUntilExpiry,
  hasValidTokenData,
  DEFAULT_REFRESH_THRESHOLD_SECONDS,
} from '../../src/utils/token-helpers';
import { UserSessionData } from '../../src/config/session.config';

// Mock Redis
jest.mock('@legal-platform/database', () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

describe('Token Helpers Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeUserSessionMapping', () => {
    it('should store userId->sessionId mapping in Redis with default TTL', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';

      await storeUserSessionMapping(userId, sessionId);

      expect(redis.set).toHaveBeenCalledWith(
        'user:session:user-123',
        sessionId,
        'EX',
        7 * 24 * 60 * 60 // 7 days
      );
    });

    it('should store userId->sessionId mapping with custom TTL', async () => {
      const userId = 'user-456';
      const sessionId = 'session-xyz';
      const customTTL = 3600; // 1 hour

      await storeUserSessionMapping(userId, sessionId, customTTL);

      expect(redis.set).toHaveBeenCalledWith('user:session:user-456', sessionId, 'EX', customTTL);
    });

    it('should throw error if Redis operation fails', async () => {
      (redis.set as jest.Mock).mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(storeUserSessionMapping('user-123', 'session-abc')).rejects.toThrow(
        'Redis connection failed'
      );
    });
  });

  describe('getUserSessionId', () => {
    it('should retrieve sessionId for given userId', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';
      (redis.get as jest.Mock).mockResolvedValueOnce(sessionId);

      const result = await getUserSessionId(userId);

      expect(result).toBe(sessionId);
      expect(redis.get).toHaveBeenCalledWith('user:session:user-123');
    });

    it('should return null if userId mapping not found', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);

      const result = await getUserSessionId('user-nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error if Redis operation fails', async () => {
      (redis.get as jest.Mock).mockRejectedValueOnce(new Error('Redis timeout'));

      await expect(getUserSessionId('user-123')).rejects.toThrow('Redis timeout');
    });
  });

  describe('deleteUserSessionMapping', () => {
    it('should delete userId->sessionId mapping from Redis', async () => {
      const userId = 'user-123';

      await deleteUserSessionMapping(userId);

      expect(redis.del).toHaveBeenCalledWith('user:session:user-123');
    });

    it('should throw error if Redis operation fails', async () => {
      (redis.del as jest.Mock).mockRejectedValueOnce(new Error('Redis connection lost'));

      await expect(deleteUserSessionMapping('user-123')).rejects.toThrow('Redis connection lost');
    });
  });

  describe('getSessionData', () => {
    it('should retrieve and parse session data from Redis', async () => {
      const sessionId = 'session-abc';
      const sessionData = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          accessToken: 'token-abc',
          refreshToken: 'refresh-abc',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
        },
      };
      const sessionJson = JSON.stringify(sessionData);
      (redis.get as jest.Mock).mockResolvedValueOnce(sessionJson);

      const result = await getSessionData(sessionId);

      expect(result).toEqual(sessionData);
      expect(redis.get).toHaveBeenCalledWith('sess:session-abc');
    });

    it('should return null if session not found in Redis', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);

      const result = await getSessionData('session-nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error if session JSON is invalid', async () => {
      const sessionId = 'session-bad-json';
      (redis.get as jest.Mock).mockResolvedValueOnce('{ invalid json }');

      await expect(getSessionData(sessionId)).rejects.toThrow(
        'Failed to parse session data for sessionId session-bad-json'
      );
    });

    it('should throw error if Redis operation fails', async () => {
      (redis.get as jest.Mock).mockRejectedValueOnce(new Error('Redis error'));

      await expect(getSessionData('session-abc')).rejects.toThrow('Redis error');
    });
  });

  describe('getGraphToken', () => {
    it('should retrieve valid access token by userId', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';
      const accessToken = 'valid-token-abc';
      const sessionData = {
        user: {
          userId,
          email: 'test@example.com',
          accessToken,
          refreshToken: 'refresh-abc',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
        },
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(sessionId) // getUserSessionId
        .mockResolvedValueOnce(JSON.stringify(sessionData)); // getSessionData

      const result = await getGraphToken(userId);

      expect(result).toBe(accessToken);
    });

    it('should throw error if no session found for userId', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null); // No sessionId found

      await expect(getGraphToken('user-nonexistent')).rejects.toThrow(
        'No active session found for user user-nonexistent'
      );
    });

    it('should throw error if session data not found', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(sessionId) // getUserSessionId
        .mockResolvedValueOnce(null); // getSessionData returns null

      await expect(getGraphToken(userId)).rejects.toThrow(
        'Session data not found for user user-123'
      );
    });

    it('should throw error if session has no user data', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';
      const sessionData = {}; // No user field

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(sessionId)
        .mockResolvedValueOnce(JSON.stringify(sessionData));

      await expect(getGraphToken(userId)).rejects.toThrow(
        'Session data not found for user user-123'
      );
    });

    it('should throw error if no access token in session', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';
      const sessionData = {
        user: {
          userId,
          email: 'test@example.com',
          refreshToken: 'refresh-abc',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
          // accessToken missing
        },
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(sessionId)
        .mockResolvedValueOnce(JSON.stringify(sessionData));

      await expect(getGraphToken(userId)).rejects.toThrow(
        'No access token found in session for user user-123'
      );
    });

    it('should throw error if access token is expired', async () => {
      const userId = 'user-123';
      const sessionId = 'session-abc';
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600; // Expired 1 hour ago
      const sessionData = {
        user: {
          userId,
          email: 'test@example.com',
          accessToken: 'expired-token',
          refreshToken: 'refresh-abc',
          accessTokenExpiry: expiredTimestamp,
        },
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(sessionId)
        .mockResolvedValueOnce(JSON.stringify(sessionData));

      await expect(getGraphToken(userId)).rejects.toThrow(/Access token expired for user user-123/);
    });
  });

  describe('getGraphTokenFromSession', () => {
    it('should extract valid access token from session', () => {
      const session = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          accessToken: 'valid-token',
          refreshToken: 'refresh-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
        } as UserSessionData,
      };

      const result = getGraphTokenFromSession(session as any);

      expect(result).toBe('valid-token');
    });

    it('should throw error if session is null', () => {
      expect(() => getGraphTokenFromSession(null as any)).toThrow('No active session found');
    });

    it('should throw error if session has no user', () => {
      const session = {};

      expect(() => getGraphTokenFromSession(session as any)).toThrow('No active session found');
    });

    it('should throw error if no access token in session', () => {
      const session = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          refreshToken: 'refresh-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
          // accessToken missing
        },
      };

      expect(() => getGraphTokenFromSession(session as any)).toThrow(
        'No access token found in session'
      );
    });

    it('should throw error if access token is expired', () => {
      const session = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) - 3600, // Expired
        } as UserSessionData,
      };

      expect(() => getGraphTokenFromSession(session as any)).toThrow(/Access token expired at/);
    });
  });

  describe('getRefreshTokenFromSession', () => {
    it('should extract refresh token from session', () => {
      const session = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          accessToken: 'access-token',
          refreshToken: 'refresh-token-abc',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
        } as UserSessionData,
      };

      const result = getRefreshTokenFromSession(session as any);

      expect(result).toBe('refresh-token-abc');
    });

    it('should throw error if session is null', () => {
      expect(() => getRefreshTokenFromSession(null as any)).toThrow('No active session found');
    });

    it('should throw error if session has no user', () => {
      const session = {};

      expect(() => getRefreshTokenFromSession(session as any)).toThrow('No active session found');
    });

    it('should throw error if no refresh token in session', () => {
      const session = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          accessToken: 'access-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
          // refreshToken missing
        },
      };

      expect(() => getRefreshTokenFromSession(session as any)).toThrow(
        'No refresh token found in session'
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should return false if token is not expired', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      expect(isTokenExpired(futureTimestamp)).toBe(false);
    });

    it('should return true if token is expired', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(isTokenExpired(pastTimestamp)).toBe(true);
    });

    it('should return true if token expires exactly now', () => {
      const nowTimestamp = Math.floor(Date.now() / 1000);
      expect(isTokenExpired(nowTimestamp)).toBe(true);
    });

    it('should return true if expiry timestamp is 0', () => {
      expect(isTokenExpired(0)).toBe(true);
    });

    it('should return true if expiry timestamp is undefined', () => {
      expect(isTokenExpired(undefined as any)).toBe(true);
    });
  });

  describe('needsTokenRefresh', () => {
    it('should return false if token expires well into the future', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      expect(needsTokenRefresh(futureTimestamp)).toBe(false);
    });

    it('should return true if token expires within default threshold (5 minutes)', () => {
      const soonTimestamp = Math.floor(Date.now() / 1000) + 240; // 4 minutes from now
      expect(needsTokenRefresh(soonTimestamp)).toBe(true);
    });

    it('should return true if token expires exactly at threshold', () => {
      const thresholdTimestamp = Math.floor(Date.now() / 1000) + DEFAULT_REFRESH_THRESHOLD_SECONDS;
      expect(needsTokenRefresh(thresholdTimestamp)).toBe(true);
    });

    it('should return true if token is already expired', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      expect(needsTokenRefresh(pastTimestamp)).toBe(true);
    });

    it('should use custom threshold when provided', () => {
      const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const customThreshold = 7200; // 2 hours

      expect(needsTokenRefresh(timestamp, customThreshold)).toBe(true);
    });

    it('should return false with custom threshold if token valid', () => {
      const timestamp = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const customThreshold = 3600; // 1 hour

      expect(needsTokenRefresh(timestamp, customThreshold)).toBe(false);
    });

    it('should return true if expiry timestamp is 0', () => {
      expect(needsTokenRefresh(0)).toBe(true);
    });

    it('should return true if expiry timestamp is undefined', () => {
      expect(needsTokenRefresh(undefined as any)).toBe(true);
    });
  });

  describe('getSecondsUntilExpiry', () => {
    it('should return positive seconds for future expiry', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const result = getSecondsUntilExpiry(futureTimestamp);

      // Allow 1 second tolerance for test execution time
      expect(result).toBeGreaterThanOrEqual(3599);
      expect(result).toBeLessThanOrEqual(3600);
    });

    it('should return negative seconds for past expiry', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      const result = getSecondsUntilExpiry(pastTimestamp);

      expect(result).toBeLessThan(0);
      expect(result).toBeGreaterThanOrEqual(-3601);
      expect(result).toBeLessThanOrEqual(-3599);
    });

    it('should return approximately 0 for current time', () => {
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const result = getSecondsUntilExpiry(nowTimestamp);

      // Allow small tolerance for test execution
      expect(Math.abs(result)).toBeLessThanOrEqual(1);
    });

    it('should return -1 if expiry timestamp is 0', () => {
      expect(getSecondsUntilExpiry(0)).toBe(-1);
    });

    it('should return -1 if expiry timestamp is undefined', () => {
      expect(getSecondsUntilExpiry(undefined as any)).toBe(-1);
    });
  });

  describe('hasValidTokenData', () => {
    it('should return true for session with valid token data', () => {
      const session = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
        } as UserSessionData,
      };

      expect(hasValidTokenData(session as any)).toBe(true);
    });

    it('should return false if session is null', () => {
      expect(hasValidTokenData(null as any)).toBe(false);
    });

    it('should return false if session has no user', () => {
      const session = {};
      expect(hasValidTokenData(session as any)).toBe(false);
    });

    it('should return false if access token is missing', () => {
      const session = {
        user: {
          refreshToken: 'refresh-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
        },
      };

      expect(hasValidTokenData(session as any)).toBe(false);
    });

    it('should return false if refresh token is missing', () => {
      const session = {
        user: {
          accessToken: 'access-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
        },
      };

      expect(hasValidTokenData(session as any)).toBe(false);
    });

    it('should return false if access token expiry is missing', () => {
      const session = {
        user: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      expect(hasValidTokenData(session as any)).toBe(false);
    });

    it('should return false if access token is expired', () => {
      const session = {
        user: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiry: Math.floor(Date.now() / 1000) - 3600, // Expired
        } as UserSessionData,
      };

      expect(hasValidTokenData(session as any)).toBe(false);
    });
  });
});
