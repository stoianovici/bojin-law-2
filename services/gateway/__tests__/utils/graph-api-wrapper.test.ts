/**
 * Graph API Wrapper Utility Tests
 * Story 2.5: Microsoft Graph API Integration Foundation
 * Task 4: Enhance Token Refresh Logic for Graph API
 *
 * Unit tests for automatic retry with token refresh on 401 errors
 */

// Set environment variables before imports
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-for-tests';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret-at-least-16-chars';
process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3001/auth/callback';

// Mock dependencies
jest.mock('@legal-platform/database');
jest.mock('@azure/msal-node');

import { Session, SessionData } from 'express-session';
import { executeWithTokenRefresh, executeWithFreshToken } from '../../src/utils/graph-api-wrapper';
import { AuthService } from '../../src/services/auth.service';
import { AuthenticationResult } from '@azure/msal-node';
import { UserSessionData } from '../../src/config/session.config';

// Mock AuthService
jest.mock('../../src/services/auth.service');

describe('Graph API Wrapper Utility Tests', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSession: Session & Partial<SessionData>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock AuthService
    mockAuthService = AuthService.prototype as jest.Mocked<AuthService>;

    // Mock successful token refresh
    const mockAuthResult: Partial<AuthenticationResult> = {
      accessToken: 'new-access-token',
      expiresOn: new Date(Date.now() + 1800 * 1000), // 30 minutes from now
    };

    mockAuthService.refreshAccessToken = jest.fn().mockResolvedValue(mockAuthResult);

    // Mock session
    const now = Math.floor(Date.now() / 1000);
    mockSession = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Associate',
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token-123',
        accessTokenExpiry: now + 3600, // 1 hour from now
        createdAt: now - 3600,
        lastActivity: now,
      } as UserSessionData,
      destroy: jest.fn((callback) => callback(null)),
    } as any;
  });

  describe('executeWithTokenRefresh - Automatic Retry on 401', () => {
    it('should execute operation successfully without retry when no error', async () => {
      const mockOperation = jest.fn(async (accessToken: string) => {
        return { id: 'user-123', displayName: 'Test User' };
      });

      const result = await executeWithTokenRefresh(mockSession, mockOperation);

      // Should call operation once with current token
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockOperation).toHaveBeenCalledWith('old-access-token');
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'user-123', displayName: 'Test User' });
    });

    it('should retry with refreshed token on 401 error', async () => {
      let callCount = 0;
      const mockOperation = jest.fn(async (accessToken: string) => {
        callCount++;
        if (callCount === 1) {
          // First call: return 401
          const error: any = new Error('Unauthorized');
          error.statusCode = 401;
          error.code = 'InvalidAuthenticationToken';
          throw error;
        }
        // Second call: return success
        return { id: 'user-123', displayName: 'Test User' };
      });

      const result = await executeWithTokenRefresh(mockSession, mockOperation);

      // Should call operation twice (original + retry)
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(mockOperation).toHaveBeenNthCalledWith(1, 'old-access-token');
      expect(mockOperation).toHaveBeenNthCalledWith(2, 'new-access-token');

      // Should have refreshed token
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');

      // Should have updated session
      expect(mockSession.user!.accessToken).toBe('new-access-token');

      // Should return successful result
      expect(result).toEqual({ id: 'user-123', displayName: 'Test User' });
    });

    it('should throw error when operation fails after retry', async () => {
      const mockOperation = jest.fn(async () => {
        const error: any = new Error('Unauthorized');
        error.statusCode = 401;
        error.code = 'InvalidAuthenticationToken';
        throw error;
      });

      await expect(executeWithTokenRefresh(mockSession, mockOperation)).rejects.toThrow();

      // Should call operation twice (original + retry)
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Should have attempted to refresh token
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');
    });

    it('should not retry on non-401 errors', async () => {
      const mockOperation = jest.fn(async () => {
        const error: any = new Error('Not Found');
        error.statusCode = 404;
        throw error;
      });

      await expect(executeWithTokenRefresh(mockSession, mockOperation)).rejects.toThrow(
        'Not Found'
      );

      // Should call operation only once (no retry)
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Should not have refreshed token
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should not retry on 500 server errors', async () => {
      const mockOperation = jest.fn(async () => {
        const error: any = new Error('Internal Server Error');
        error.statusCode = 500;
        throw error;
      });

      await expect(executeWithTokenRefresh(mockSession, mockOperation)).rejects.toThrow(
        'Internal Server Error'
      );

      // Should call operation only once (no retry)
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Should not have refreshed token
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should throw error when token refresh fails', async () => {
      const mockOperation = jest.fn(async () => {
        const error: any = new Error('Unauthorized');
        error.statusCode = 401;
        error.code = 'InvalidAuthenticationToken';
        throw error;
      });

      // Mock refresh failure
      mockAuthService.refreshAccessToken = jest
        .fn()
        .mockRejectedValue(new Error('Refresh token expired'));

      await expect(executeWithTokenRefresh(mockSession, mockOperation)).rejects.toThrow(
        'Access token expired and refresh failed'
      );

      // Should call operation only once (retry failed due to refresh failure)
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Should have attempted to refresh token
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');

      // Should have destroyed session
      expect(mockSession.destroy).toHaveBeenCalled();
    });

    it('should throw error when no session exists', async () => {
      const mockOperation = jest.fn();
      const invalidSession = {} as any;

      await expect(executeWithTokenRefresh(invalidSession, mockOperation)).rejects.toThrow(
        'No active session found'
      );

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should throw error when no access token in session', async () => {
      mockSession.user!.accessToken = '';

      const mockOperation = jest.fn();

      await expect(executeWithTokenRefresh(mockSession, mockOperation)).rejects.toThrow(
        'No access token found in session'
      );

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should throw error when no refresh token in session and 401 occurs', async () => {
      mockSession.user!.refreshToken = '';

      const mockOperation = jest.fn(async () => {
        const error: any = new Error('Unauthorized');
        error.statusCode = 401;
        throw error;
      });

      await expect(executeWithTokenRefresh(mockSession, mockOperation)).rejects.toThrow(
        'No refresh token found in session'
      );

      // Should call operation once (then fail when trying to refresh)
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should update session with new refresh token if provided (token rotation)', async () => {
      let callCount = 0;
      const mockOperation = jest.fn(async (accessToken: string) => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('Unauthorized');
          error.statusCode = 401;
          throw error;
        }
        return { success: true };
      });

      // Mock auth result with new refresh token
      const mockAuthResult: Partial<AuthenticationResult> & { refreshToken?: string } = {
        accessToken: 'new-access-token',
        expiresOn: new Date(Date.now() + 1800 * 1000),
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshAccessToken = jest.fn().mockResolvedValue(mockAuthResult);

      await executeWithTokenRefresh(mockSession, mockOperation);

      // Should update both access and refresh tokens
      expect(mockSession.user!.accessToken).toBe('new-access-token');
      expect(mockSession.user!.refreshToken).toBe('new-refresh-token');
    });
  });

  describe('executeWithFreshToken - Proactive Token Refresh', () => {
    it('should not refresh token when not expiring soon', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 3600; // 1 hour

      const mockOperation = jest.fn(async (accessToken: string) => {
        return { success: true };
      });

      const result = await executeWithFreshToken(mockSession, mockOperation);

      // Should not have refreshed token
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
      expect(mockOperation).toHaveBeenCalledWith('old-access-token');
      expect(result).toEqual({ success: true });
    });

    it('should proactively refresh token when expiring soon', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240; // 4 minutes

      const mockOperation = jest.fn(async (accessToken: string) => {
        return { success: true };
      });

      const result = await executeWithFreshToken(mockSession, mockOperation);

      // Should have refreshed token before calling operation
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');
      expect(mockOperation).toHaveBeenCalledWith('new-access-token');
      expect(mockSession.user!.accessToken).toBe('new-access-token');
      expect(result).toEqual({ success: true });
    });

    it('should force refresh when forceRefresh is true', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 3600; // 1 hour (not expiring soon)

      const mockOperation = jest.fn(async (accessToken: string) => {
        return { success: true };
      });

      const result = await executeWithFreshToken(mockSession, mockOperation, true);

      // Should have refreshed token despite not expiring soon
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');
      expect(mockOperation).toHaveBeenCalledWith('new-access-token');
      expect(result).toEqual({ success: true });
    });

    it('should continue with current token if refresh fails', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240; // 4 minutes

      // Mock refresh failure
      mockAuthService.refreshAccessToken = jest.fn().mockRejectedValue(new Error('Refresh failed'));

      const mockOperation = jest.fn(async (accessToken: string) => {
        return { success: true };
      });

      const result = await executeWithFreshToken(mockSession, mockOperation);

      // Should attempt refresh but continue with old token on failure
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalled();
      expect(mockOperation).toHaveBeenCalledWith('old-access-token');
      expect(result).toEqual({ success: true });
    });

    it('should throw error when no session exists', async () => {
      const mockOperation = jest.fn();
      const invalidSession = {} as any;

      await expect(executeWithFreshToken(invalidSession, mockOperation)).rejects.toThrow(
        'No active session found'
      );

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should throw error when no access token in session', async () => {
      mockSession.user!.accessToken = '';

      const mockOperation = jest.fn();

      await expect(executeWithFreshToken(mockSession, mockOperation)).rejects.toThrow(
        'No access token found in session'
      );

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should update session lastActivity timestamp', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240; // 4 minutes

      const mockOperation = jest.fn(async () => ({ success: true }));

      await executeWithFreshToken(mockSession, mockOperation);

      // Should have updated lastActivity
      expect(mockSession.user!.lastActivity).toBeGreaterThanOrEqual(now);
    });
  });
});
