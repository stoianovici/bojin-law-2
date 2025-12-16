/**
 * Auth Middleware Unit Tests
 * Story 2.4: Authentication with Azure AD
 */

// Setup test environment variables BEFORE any imports
process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long-for-security';
process.env.JWT_ISSUER = 'https://test.bojin-law.onrender.com';
process.env.JWT_AUDIENCE = 'bojin-law-api-test';

import { Request, Response, NextFunction } from 'express';
import {
  authenticateJWT,
  optionalAuthenticateJWT,
  requireRole,
  requireActiveUser,
} from '../../src/middleware/auth.middleware';
import { JWTService } from '../../src/services/jwt.service';
import { JWTAccessTokenPayload } from '../../src/types/auth.types';

// Mock JWT service
jest.mock('../../src/services/jwt.service');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup response mock
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    nextFunction = jest.fn();
  });

  describe('authenticateJWT', () => {
    it('should return 401 if Authorization header is missing', () => {
      mockRequest.headers = {};

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if Authorization header format is invalid', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat',
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token is not Bearer type', () => {
      mockRequest.headers = {
        authorization: 'Basic token123',
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should validate token and attach user to request', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      // Mock JWT validation
      (JWTService.prototype.validateAccessToken as jest.Mock).mockReturnValue(mockPayload);

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 with token_expired error if token is expired', () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      const expiredError = new Error('Token expired at 2024-01-01');
      (JWTService.prototype.validateAccessToken as jest.Mock).mockImplementation(() => {
        throw expiredError;
      });

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'token_expired',
        message: 'Access token has expired. Please refresh your token.',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid_token error for other validation errors', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      const invalidError = new Error('Invalid signature');
      (JWTService.prototype.validateAccessToken as jest.Mock).mockImplementation(() => {
        throw invalidError;
      });

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'invalid_token',
        message: 'Invalid signature',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthenticateJWT', () => {
    it('should call next without user if no Authorization header', () => {
      mockRequest.headers = {};

      optionalAuthenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should validate token and attach user if Authorization header present', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Associate' as const,
        status: 'Active' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (JWTService.prototype.validateAccessToken as jest.Mock).mockReturnValue(mockPayload);

      optionalAuthenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next even if token validation fails', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (JWTService.prototype.validateAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuthenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 if user is not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = requireRole(['Partner']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if user role is not allowed', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Paralegal' as const,
        status: 'Active' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      } as JWTAccessTokenPayload;

      const middleware = requireRole(['Partner', 'Associate']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Access denied. Required roles: Partner, Associate',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next if user has allowed role (Partner)', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      } as JWTAccessTokenPayload;

      const middleware = requireRole(['Partner']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next if user has one of multiple allowed roles', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Associate' as const,
        status: 'Active' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      } as JWTAccessTokenPayload;

      const middleware = requireRole(['Partner', 'Associate', 'Paralegal']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('requireActiveUser', () => {
    it('should return 401 if user is not authenticated', () => {
      mockRequest.user = undefined;

      requireActiveUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if user status is Pending', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'pending@example.com',
        role: 'Paralegal' as const,
        status: 'Pending' as const,
        firmId: null,
        azureAdId: 'azure-123',
      } as JWTAccessTokenPayload;

      requireActiveUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'account_not_active',
        message:
          "Your account is pending activation. Please contact your firm's partner for access.",
        status: 'Pending',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if user status is Inactive', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'inactive@example.com',
        role: 'Associate' as const,
        status: 'Inactive' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      } as JWTAccessTokenPayload;

      requireActiveUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'account_not_active',
        message: "Your account has been deactivated. Please contact your firm's partner.",
        status: 'Inactive',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next if user status is Active', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'active@example.com',
        role: 'Partner' as const,
        status: 'Active' as const,
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      } as JWTAccessTokenPayload;

      requireActiveUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 403 with generic message for unknown status', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'Partner' as const,
        status: 'Unknown' as any, // Force unknown status
        firmId: 'firm-123',
        azureAdId: 'azure-123',
      } as any;

      requireActiveUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'account_not_active',
        message: 'Access denied',
        status: 'Unknown',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
