/**
 * Word AI Auth Middleware Tests
 * Phase 1.2: Integration tests for JWT verification
 *
 * Tests cover:
 * 1. Valid JWT with correct signature
 * 2. Expired JWT rejection
 * 3. Invalid issuer rejection
 * 4. Invalid audience rejection
 * 5. Missing email claim handling
 * 6. User not in database handling
 * 7. Dev bypass conditions
 * 8. Session fallback for web platform
 */

import { Request, Response, NextFunction } from 'express';
import { requireWordAiAuth, AuthenticatedRequest } from './word-ai-auth.middleware';
import { prisma } from '@legal-platform/database';
import * as jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn((kid, callback) => {
      callback(null, {
        getPublicKey: () => 'mock-public-key',
      });
    }),
  })),
}));

describe('requireWordAiAuth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock response
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();
    mockRes = {
      json: mockJson,
      status: mockStatus,
    };

    // Mock next
    mockNext = jest.fn();

    // Mock request (using 'as any' for session since we're mocking partial session data)
    mockReq = {
      headers: {},
      path: '/test',
      session: {} as any,
    };

    // Reset env
    process.env = { ...originalEnv };
    process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
    process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Dev Bypass', () => {
    it('should allow dev bypass when conditions are met', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEV_BYPASS = 'true';
      process.env.DEV_BYPASS_FIRM_ID = 'test-firm-id';

      mockReq.headers = { 'x-dev-bypass': 'word-addin' };

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).sessionUser).toEqual({
        userId: 'dev-user',
        firmId: 'test-firm-id',
        email: 'dev@test.local',
      });
    });

    it('should reject dev bypass in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEV_BYPASS = 'true';

      mockReq.headers = { 'x-dev-bypass': 'word-addin' };

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      // Should not allow bypass in production, so it will fail without auth
      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it('should reject dev bypass without explicit opt-in', async () => {
      process.env.NODE_ENV = 'development';
      // ENABLE_DEV_BYPASS not set

      mockReq.headers = { 'x-dev-bypass': 'word-addin' };

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it('should reject dev bypass when DEV_BYPASS_FIRM_ID not set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEV_BYPASS = 'true';
      delete process.env.DEV_BYPASS_FIRM_ID;

      mockReq.headers = { 'x-dev-bypass': 'word-addin' };

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      // Should reject because DEV_BYPASS_FIRM_ID is required
      // This prevents accidental dev bypass without proper configuration
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('JWT Verification', () => {
    it('should authenticate valid JWT and find user', async () => {
      const mockUser = {
        id: 'user-123',
        firmId: 'firm-456',
        email: 'user@example.com',
        role: 'Lawyer',
      };

      mockReq.headers = { authorization: 'Bearer valid-token' };

      // Mock JWT verification to succeed
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, {
          preferred_username: 'user@example.com',
          iss: `https://login.microsoftonline.com/test-tenant-id/v2.0`,
          aud: 'test-client-id',
        });
      });

      // Mock user lookup
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).sessionUser).toEqual({
        userId: mockUser.id,
        firmId: mockUser.firmId,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should reject expired JWT', async () => {
      mockReq.headers = { authorization: 'Bearer expired-token' };

      // Mock JWT verification to fail with expiration error
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        callback(error, null);
      });

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid or expired token',
      });
    });

    it('should reject JWT with invalid issuer', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-issuer-token' };

      // Mock JWT verification to fail with issuer error
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        const error = new Error('jwt issuer invalid');
        error.name = 'JsonWebTokenError';
        callback(error, null);
      });

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid or expired token',
      });
    });

    it('should reject JWT with invalid audience', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-audience-token' };

      // Mock JWT verification to fail with audience error
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        const error = new Error('jwt audience invalid');
        error.name = 'JsonWebTokenError';
        callback(error, null);
      });

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid or expired token',
      });
    });

    it('should reject JWT missing email claim', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token-no-email' };

      // Mock JWT verification to succeed but without email
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, {
          // No email, upn, or preferred_username
          iss: `https://login.microsoftonline.com/test-tenant-id/v2.0`,
          aud: 'test-client-id',
        });
      });

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Token missing email claim',
      });
    });

    it('should reject when user not found in database', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };

      // Mock JWT verification to succeed
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, {
          preferred_username: 'unknown@example.com',
          iss: `https://login.microsoftonline.com/test-tenant-id/v2.0`,
          aud: 'test-client-id',
        });
      });

      // Mock user not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'User not registered in platform',
      });
    });

    it('should use upn claim when preferred_username not present', async () => {
      const mockUser = {
        id: 'user-123',
        firmId: 'firm-456',
        email: 'user@example.com',
        role: 'Lawyer',
      };

      mockReq.headers = { authorization: 'Bearer valid-token' };

      // Mock JWT verification with upn claim
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, {
          upn: 'user@example.com', // Using upn instead of preferred_username
          iss: `https://login.microsoftonline.com/test-tenant-id/v2.0`,
          aud: 'test-client-id',
        });
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        select: expect.any(Object),
      });
    });
  });

  describe('Session Fallback', () => {
    it('should authenticate via session for web platform', async () => {
      // No Bearer token, but has session
      mockReq.headers = {};
      mockReq.session = {
        user: {
          userId: 'session-user-123',
          firmId: 'session-firm-456',
          email: 'session@example.com',
        },
      } as any;

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).sessionUser).toEqual({
        userId: 'session-user-123',
        firmId: 'session-firm-456',
        email: 'session@example.com',
      });
    });

    it('should reject when no auth method available', async () => {
      mockReq.headers = {};
      mockReq.session = {} as any; // No user in session

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required',
      });
    });

    it('should not fall back to session after JWT verification fails', async () => {
      // This is a security feature - prevents token bypass attacks
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      mockReq.session = {
        user: {
          userId: 'session-user-123',
          firmId: 'session-firm-456',
          email: 'session@example.com',
        },
      } as any;

      // Mock JWT verification to fail
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(new Error('invalid token'), null);
      });

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      // Should reject, not fall back to session
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Invalid or expired token',
      });
    });
  });

  describe('Missing Configuration', () => {
    it('should reject when Azure AD config missing', async () => {
      delete process.env.AZURE_AD_TENANT_ID;
      delete process.env.AZURE_AD_CLIENT_ID;

      mockReq.headers = { authorization: 'Bearer valid-token' };

      // Mock JWT verification to return null when config is missing
      // (The real code checks config before verification)
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        // Simulate failure due to missing config
        callback(new Error('missing configuration'), null);
      });

      await requireWordAiAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      // JWT verification should fail due to missing config
      expect(mockStatus).toHaveBeenCalledWith(401);
    });
  });
});
