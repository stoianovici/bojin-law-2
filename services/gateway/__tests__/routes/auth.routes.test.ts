/**
 * Auth Routes Integration Tests
 * Story 2.4: Authentication with Azure AD
 *
 * Tests OAuth callback with user provisioning and status validation
 * Target: 80%+ code coverage
 */

// Mock services before imports
const mockAuthService = {
  generateAuthorizationUrl: jest.fn(),
  validateCallbackParams: jest.fn(),
  exchangeCodeForTokens: jest.fn(),
  extractUserProfile: jest.fn(),
};

const mockUserService = {
  provisionUserFromAzureAD: jest.fn(),
};

const mockJWTService = {
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
};

jest.mock('../../src/services/auth.service', () => ({
  AuthService: jest.fn(() => mockAuthService),
}));

jest.mock('../../src/services/user.service', () => ({
  UserService: jest.fn(() => mockUserService),
}));

jest.mock('../../src/services/jwt.service', () => ({
  JWTService: jest.fn(() => mockJWTService),
}));

import request from 'supertest';
import express from 'express';
import { authRouter } from '../../src/routes/auth.routes';
import * as database from '@legal-platform/database';

// Enable manual mock
jest.mock('@legal-platform/database');

// Type the mocked sessionManager
const sessionManager = database.sessionManager as jest.Mocked<typeof database.sessionManager>;

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    jest.clearAllMocks();
  });

  describe('GET /auth/login', () => {
    it('should initiate OAuth flow and redirect to Azure AD', async () => {
      const mockAuthUrl =
        'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize?client_id=...';
      const mockPkceParams = {
        codeVerifier: 'mock-code-verifier',
        codeChallenge: 'mock-code-challenge',
        state: 'mock-state-123',
      };

      mockAuthService.generateAuthorizationUrl.mockResolvedValue({
        authUrl: mockAuthUrl,
        pkceParams: mockPkceParams,
      });

      sessionManager.set.mockResolvedValue(undefined);

      const response = await request(app).get('/auth/login');

      expect(response.status).toBe(302); // Redirect
      expect(response.headers.location).toBe(mockAuthUrl);

      // Verify PKCE session was stored
      expect(sessionManager.set).toHaveBeenCalledWith(
        `pkce:${mockPkceParams.state}`,
        expect.objectContaining({
          codeVerifier: mockPkceParams.codeVerifier,
          codeChallenge: mockPkceParams.codeChallenge,
          state: mockPkceParams.state,
          createdAt: expect.any(Number),
        }),
        15 * 60 // 15 minutes TTL
      );
    });

    it('should return 500 if OAuth flow initiation fails', async () => {
      mockAuthService.generateAuthorizationUrl.mockRejectedValue(
        new Error('MSAL configuration error')
      );

      const response = await request(app).get('/auth/login');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'oauth_error',
        message: 'Failed to initiate authentication flow',
      });

      // Verify PKCE session was NOT stored
      expect(sessionManager.set).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/callback', () => {
    const mockCode = 'mock-authorization-code';
    const mockState = 'mock-state-123';
    const mockPkceSession = {
      codeVerifier: 'mock-code-verifier',
      codeChallenge: 'mock-code-challenge',
      state: mockState,
      createdAt: Date.now(),
    };

    const mockAuthResult = {
      accessToken: 'mock-azure-access-token',
      refreshToken: 'mock-azure-refresh-token',
      idToken: 'mock-id-token',
      expiresOn: new Date(Date.now() + 3600 * 1000), // 1 hour
      idTokenClaims: {
        oid: 'azure-user-123',
        preferred_username: 'john.doe@lawfirm.ro',
        given_name: 'John',
        family_name: 'Doe',
      },
    };

    const mockUserProfile = {
      azureAdId: 'azure-user-123',
      email: 'john.doe@lawfirm.ro',
      firstName: 'John',
      lastName: 'Doe',
    };

    beforeEach(() => {
      mockAuthService.validateCallbackParams.mockReturnValue({
        code: mockCode,
        state: mockState,
        error: null,
        errorDescription: null,
      });

      sessionManager.get.mockResolvedValue(mockPkceSession);
      mockAuthService.exchangeCodeForTokens.mockResolvedValue(mockAuthResult);
      mockAuthService.extractUserProfile.mockReturnValue(mockUserProfile);
    });

    it('should successfully authenticate Active user', async () => {
      const mockActiveUser = {
        id: 'user-123',
        azureAdId: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockUserService.provisionUserFromAzureAD.mockResolvedValue(mockActiveUser);
      mockJWTService.generateAccessToken.mockReturnValue('jwt-access-token');
      mockJWTService.generateRefreshToken.mockReturnValue('jwt-refresh-token');

      const response = await request(app)
        .get('/auth/callback')
        .query({ code: mockCode, state: mockState });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Authentication successful',
        user: {
          id: 'user-123',
          email: 'john.doe@lawfirm.ro',
          firstName: 'John',
          lastName: 'Doe',
          role: 'Partner',
          status: 'Active',
          firmId: 'firm-456',
        },
        tokens: {
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token',
          expiresIn: 1800,
        },
      });

      // Verify user provisioning was called
      expect(mockUserService.provisionUserFromAzureAD).toHaveBeenCalledWith(
        mockAuthResult.accessToken,
        mockAuthResult.idTokenClaims
      );

      // Verify JWT tokens were generated with user status
      expect(mockJWTService.generateAccessToken).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'john.doe@lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        azureAdId: 'azure-user-123',
      });

      // Verify PKCE session was deleted
      expect(sessionManager.delete).toHaveBeenCalledWith(`pkce:${mockState}`);
    });

    it('should block Pending user with 403 Forbidden', async () => {
      const mockPendingUser = {
        id: 'user-pending',
        azureAdId: 'azure-user-pending',
        email: 'pending@lawfirm.ro',
        firstName: 'Pending',
        lastName: 'User',
        role: 'Paralegal',
        status: 'Pending',
        firmId: null,
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockUserService.provisionUserFromAzureAD.mockResolvedValue(mockPendingUser);

      const response = await request(app)
        .get('/auth/callback')
        .query({ code: mockCode, state: mockState });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'account_pending_activation',
        message:
          "Your account is pending activation. Please contact your firm's partner for access.",
        userEmail: 'pending@lawfirm.ro',
        userStatus: 'Pending',
      });

      // Verify JWT tokens were NOT generated
      expect(mockJWTService.generateAccessToken).not.toHaveBeenCalled();
      expect(mockJWTService.generateRefreshToken).not.toHaveBeenCalled();
    });

    it('should block Inactive user with 403 Forbidden', async () => {
      const mockInactiveUser = {
        id: 'user-inactive',
        azureAdId: 'azure-user-inactive',
        email: 'inactive@lawfirm.ro',
        firstName: 'Inactive',
        lastName: 'User',
        role: 'Paralegal',
        status: 'Inactive',
        firmId: null,
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockUserService.provisionUserFromAzureAD.mockResolvedValue(mockInactiveUser);

      const response = await request(app)
        .get('/auth/callback')
        .query({ code: mockCode, state: mockState });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'account_inactive',
        message:
          'Your account has been deactivated. Please contact your administrator for assistance.',
        userEmail: 'inactive@lawfirm.ro',
        userStatus: 'Inactive',
      });

      // Verify JWT tokens were NOT generated
      expect(mockJWTService.generateAccessToken).not.toHaveBeenCalled();
      expect(mockJWTService.generateRefreshToken).not.toHaveBeenCalled();
    });

    it('should return error if PKCE session not found', async () => {
      sessionManager.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/callback')
        .query({ code: mockCode, state: mockState });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'invalid_state',
        message: 'Authentication session expired or invalid. Please try again.',
      });

      // Verify user provisioning was NOT called
      expect(mockUserService.provisionUserFromAzureAD).not.toHaveBeenCalled();
    });

    it('should handle OAuth error in callback', async () => {
      mockAuthService.validateCallbackParams.mockReturnValue({
        code: null,
        state: mockState,
        error: 'access_denied',
        errorDescription: 'User denied consent',
      });

      const response = await request(app).get('/auth/callback').query({
        state: mockState,
        error: 'access_denied',
        error_description: 'User denied consent',
      });

      expect(response.status).toBe(302); // Redirect
      expect(response.headers.location).toContain('error=access_denied');
      expect(response.headers.location).toContain('error_description=User%20denied%20consent');

      // Verify user provisioning was NOT called
      expect(mockUserService.provisionUserFromAzureAD).not.toHaveBeenCalled();
    });

    it('should handle user provisioning error', async () => {
      mockUserService.provisionUserFromAzureAD.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/auth/callback')
        .query({ code: mockCode, state: mockState });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'authentication_failed',
        message: 'Database connection failed',
      });
    });
  });
});
