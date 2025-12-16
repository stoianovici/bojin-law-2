/**
 * Unit Tests for Session Middleware
 * Story 2.4: Authentication with Azure AD - Task 11
 *
 * Tests session validation middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  validateSession,
  optionalSession,
  requireRole,
} from '../../src/middleware/session.middleware';
import { UserSessionData } from '../../src/config/session.config';

describe('Session Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      session: {} as any,
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    nextFunction = jest.fn();
  });

  describe('validateSession', () => {
    it('should return 401 if session does not exist', () => {
      mockRequest.session = undefined;

      validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required. Please login.',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if session.user does not exist', () => {
      mockRequest.session = {} as any;

      validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'unauthorized',
        message: 'Authentication required. Please login.',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if access token has expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredSession: UserSessionData = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now - 1000, // Expired 1000 seconds ago
        createdAt: now - 3600,
        lastActivity: now - 3600,
      };

      mockRequest.session = { user: expiredSession } as any;

      validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'token_expired',
        message: 'Access token expired. Please refresh your token or login again.',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if user status is not Active', () => {
      const now = Math.floor(Date.now() / 1000);
      const inactiveSession: UserSessionData = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Partner',
        status: 'Inactive', // Status is Inactive
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now + 1800, // Valid for 30 minutes
        createdAt: now - 3600,
        lastActivity: now - 3600,
      };

      mockRequest.session = { user: inactiveSession } as any;

      validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'account_not_active',
        message: 'Your account is Inactive. Please contact your administrator.',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should attach user to request and call next() for valid session', () => {
      const now = Math.floor(Date.now() / 1000);
      const validSession: UserSessionData = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now + 1800, // Valid for 30 minutes
        createdAt: now - 3600,
        lastActivity: now - 3600,
      };

      mockRequest.session = { user: validSession } as any;

      validateSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe('user-123');
      expect(mockRequest.user?.email).toBe('user@example.com');
      expect((mockRequest.user as UserSessionData)?.lastActivity).toBeGreaterThan(now - 1); // Updated to current time
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('optionalSession', () => {
    it('should call next() without error if session does not exist', () => {
      mockRequest.session = undefined;

      optionalSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should call next() without error if session.user does not exist', () => {
      mockRequest.session = {} as any;

      optionalSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should attach user to request if session is valid', () => {
      const now = Math.floor(Date.now() / 1000);
      const validSession: UserSessionData = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Associate',
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now + 1800,
        createdAt: now - 3600,
        lastActivity: now - 3600,
      };

      mockRequest.session = { user: validSession } as any;

      optionalSession(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe('user-123');
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should not attach user if access token is expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredSession: UserSessionData = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Paralegal',
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now - 1000, // Expired
        createdAt: now - 3600,
        lastActivity: now - 3600,
      };

      mockRequest.session = { user: expiredSession } as any;

      optionalSession(mockRequest as Request, mockResponse as Response, nextFunction);

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

    it('should return 403 if user role is not in allowed roles', () => {
      const now = Math.floor(Date.now() / 1000);
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Paralegal', // Role is Paralegal
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now + 1800,
        createdAt: now - 3600,
        lastActivity: now,
      };

      const middleware = requireRole(['Partner', 'Associate']); // Only Partner or Associate allowed
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'forbidden',
        message: 'Access denied. Required role: Partner or Associate',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() if user role is in allowed roles', () => {
      const now = Math.floor(Date.now() / 1000);
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Partner', // Role is Partner
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now + 1800,
        createdAt: now - 3600,
        lastActivity: now,
      };

      const middleware = requireRole(['Partner', 'Associate']); // Partner is allowed
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should accept multiple roles', () => {
      const now = Math.floor(Date.now() / 1000);
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'Paralegal',
        status: 'Active',
        firmId: 'firm-123',
        azureAdId: 'azure-123',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: now + 1800,
        createdAt: now - 3600,
        lastActivity: now,
      };

      const middleware = requireRole(['Partner', 'Associate', 'Paralegal']); // All roles allowed
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
