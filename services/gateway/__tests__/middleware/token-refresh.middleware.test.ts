/**
 * Token Refresh Middleware Unit Tests
 * Story 2.5: Microsoft Graph API Integration Foundation
 * Task 4: Enhance Token Refresh Logic for Graph API
 *
 * Unit tests for token expiry checking middleware
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

import { Request, Response, NextFunction } from 'express';
import { Session, SessionData } from 'express-session';
import {
  tokenRefreshMiddleware,
  isTokenExpiringSoon,
  getTimeUntilExpiry,
} from '../../src/middleware/token-refresh.middleware';
import { AuthService } from '../../src/services/auth.service';
import { AuthenticationResult } from '@azure/msal-node';
import { UserSessionData } from '../../src/config/session.config';

// Mock AuthService
jest.mock('../../src/services/auth.service');

describe('Token Refresh Middleware Tests', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSession: Session & Partial<SessionData>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

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

    // Mock Express request
    mockRequest = {
      session: mockSession,
    };

    // Mock Express response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  describe('Token Expiry Checking', () => {
    it('should allow request to proceed when token is not expiring soon', async () => {
      // Token expires in 1 hour (not expiring soon)
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 3600; // 1 hour

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should call next() without refreshing token
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
      expect(mockSession.user!.accessToken).toBe('old-access-token');
    });

    it('should refresh token when expiring within 5 minutes', async () => {
      // Token expires in 4 minutes (within threshold)
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240; // 4 minutes

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should refresh token and call next()
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockSession.user!.accessToken).toBe('new-access-token');
      expect(mockSession.user!.accessTokenExpiry).toBeGreaterThan(now + 1700); // ~30 minutes
    });

    it('should refresh token when already expired', async () => {
      // Token expired 1 minute ago
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now - 60;

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should refresh token and call next()
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('refresh-token-123');
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockSession.user!.accessToken).toBe('new-access-token');
    });

    it('should allow request to proceed when accessTokenExpiry is missing', async () => {
      // Remove accessTokenExpiry from session
      (mockSession.user! as any).accessTokenExpiry = undefined;

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should call next() without refreshing (will let Graph API handle it)
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh Failure Handling', () => {
    it('should return 401 when token refresh fails', async () => {
      // Token expires in 4 minutes
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240;

      // Mock refresh failure
      mockAuthService.refreshAccessToken = jest
        .fn()
        .mockRejectedValue(new Error('Refresh token expired'));

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should return 401 and destroy session
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'token_refresh_failed',
        message: 'Access token expired and refresh failed. Please login again.',
      });
      expect(mockSession.destroy).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when no session exists', async () => {
      mockRequest.session = undefined;

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should return 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'no_session',
        message: 'No active session found. Please login again.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when no user in session', async () => {
      mockRequest.session = { destroy: jest.fn() } as any;

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should return 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'no_session',
        message: 'No active session found. Please login again.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when no refresh token in session', async () => {
      // Token expires in 4 minutes but no refresh token
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240;
      mockSession.user!.refreshToken = '';

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should return 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'no_refresh_token',
        message: 'No refresh token found in session. Please login again.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Session Update', () => {
    it('should update session with new access token and expiry', async () => {
      // Token expires in 4 minutes
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240;

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should update session
      expect(mockSession.user!.accessToken).toBe('new-access-token');
      expect(mockSession.user!.accessTokenExpiry).toBeGreaterThan(now + 1700);
      expect(mockSession.user!.lastActivity).toBeGreaterThanOrEqual(now);
    });

    it('should update refresh token if new one is provided (token rotation)', async () => {
      // Token expires in 4 minutes
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240;

      // Mock auth result with new refresh token
      const mockAuthResult: Partial<AuthenticationResult> & { refreshToken?: string } = {
        accessToken: 'new-access-token',
        expiresOn: new Date(Date.now() + 1800 * 1000),
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshAccessToken = jest.fn().mockResolvedValue(mockAuthResult);

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should update both access and refresh tokens
      expect(mockSession.user!.accessToken).toBe('new-access-token');
      expect(mockSession.user!.refreshToken).toBe('new-refresh-token');
    });

    it('should not update refresh token if not provided', async () => {
      // Token expires in 4 minutes
      const now = Math.floor(Date.now() / 1000);
      mockSession.user!.accessTokenExpiry = now + 240;
      const originalRefreshToken = mockSession.user!.refreshToken;

      await tokenRefreshMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should not change refresh token
      expect(mockSession.user!.refreshToken).toBe(originalRefreshToken);
    });
  });

  describe('Utility Functions', () => {
    it('should correctly identify token expiring soon', () => {
      const now = Math.floor(Date.now() / 1000);

      // Token expires in 4 minutes (within 5 minute threshold)
      expect(isTokenExpiringSoon(now + 240)).toBe(true);

      // Token expires in exactly 5 minutes (at threshold)
      expect(isTokenExpiringSoon(now + 300)).toBe(true);

      // Token expires in 10 minutes (not expiring soon)
      expect(isTokenExpiringSoon(now + 600)).toBe(false);

      // Token already expired
      expect(isTokenExpiringSoon(now - 60)).toBe(true);
    });

    it('should correctly calculate time until expiry', () => {
      const now = Math.floor(Date.now() / 1000);

      // Token expires in 10 minutes
      const timeUntilExpiry1 = getTimeUntilExpiry(now + 600);
      expect(timeUntilExpiry1).toBeGreaterThan(590);
      expect(timeUntilExpiry1).toBeLessThanOrEqual(600);

      // Token already expired
      const timeUntilExpiry2 = getTimeUntilExpiry(now - 60);
      expect(timeUntilExpiry2).toBeLessThan(0);
      expect(timeUntilExpiry2).toBeGreaterThanOrEqual(-61);
    });
  });
});
