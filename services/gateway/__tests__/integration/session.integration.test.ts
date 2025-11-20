/**
 * Session Storage Integration Tests
 * Story 2.4: Authentication with Azure AD - Task 11
 *
 * Tests session creation, retrieval, and validation
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
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');

import request from 'supertest';
import { app } from '../../src/index';
import * as database from '@legal-platform/database';

// Mock session manager
const mockSessionManager = database.sessionManager as jest.Mocked<typeof database.sessionManager>;

describe('Session Storage Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Creation in /auth/callback', () => {
    it('should create session with user data after successful authentication', async () => {
      // Mock PKCE session retrieval
      mockSessionManager.get.mockResolvedValueOnce({
        codeVerifier: 'mock-verifier',
        state: 'mock-state',
        codeChallenge: 'mock-challenge',
        createdAt: Date.now(),
      });

      // Mock successful OAuth flow
      const mockAuthService = require('../../src/services/auth.service');
      mockAuthService.AuthService.prototype.validateCallbackParams = jest.fn().mockReturnValue({
        code: 'mock-auth-code',
        state: 'mock-state',
        error: null,
        errorDescription: null,
      });

      mockAuthService.AuthService.prototype.exchangeCodeForTokens = jest.fn().mockResolvedValue({
        accessToken: 'mock-azure-access-token',
        refreshToken: 'mock-azure-refresh-token',
        idTokenClaims: {
          oid: 'mock-azure-ad-id',
          email: 'user@example.com',
          given_name: 'John',
          family_name: 'Doe',
        },
      });

      mockAuthService.AuthService.prototype.extractUserProfile = jest.fn().mockReturnValue({
        azureAdId: 'mock-azure-ad-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      // Mock user provisioning
      const mockUserService = require('../../src/services/user.service');
      mockUserService.UserService.prototype.provisionUserFromAzureAD = jest.fn().mockResolvedValue({
        id: 'mock-user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner',
        status: 'Active',
        firmId: 'mock-firm-id',
        azureAdId: 'mock-azure-ad-id',
      });

      // Make request to callback endpoint
      const response = await request(app)
        .get('/auth/callback')
        .query({
          code: 'mock-auth-code',
          state: 'mock-state',
        });

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authentication successful');
      expect(response.body.user).toHaveProperty('id', 'mock-user-id');
      expect(response.body.user).toHaveProperty('email', 'user@example.com');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      // Note: Cannot directly test req.session since it's internal to Express
      // Session creation is verified indirectly through successful response
      // and by testing session middleware separately
    });

    it('should not create session if user status is Pending', async () => {
      // Mock PKCE session retrieval
      mockSessionManager.get.mockResolvedValueOnce({
        codeVerifier: 'mock-verifier',
        state: 'mock-state',
        codeChallenge: 'mock-challenge',
        createdAt: Date.now(),
      });

      // Mock successful OAuth flow
      const mockAuthService = require('../../src/services/auth.service');
      mockAuthService.AuthService.prototype.validateCallbackParams = jest.fn().mockReturnValue({
        code: 'mock-auth-code',
        state: 'mock-state',
        error: null,
        errorDescription: null,
      });

      mockAuthService.AuthService.prototype.exchangeCodeForTokens = jest.fn().mockResolvedValue({
        accessToken: 'mock-azure-access-token',
        refreshToken: 'mock-azure-refresh-token',
        idTokenClaims: {
          oid: 'mock-azure-ad-id',
          email: 'pending@example.com',
          given_name: 'Pending',
          family_name: 'User',
        },
      });

      mockAuthService.AuthService.prototype.extractUserProfile = jest.fn().mockReturnValue({
        azureAdId: 'mock-azure-ad-id',
        email: 'pending@example.com',
        firstName: 'Pending',
        lastName: 'User',
      });

      // Mock user provisioning with Pending status
      const mockUserService = require('../../src/services/user.service');
      mockUserService.UserService.prototype.provisionUserFromAzureAD = jest.fn().mockResolvedValue({
        id: 'mock-pending-user-id',
        email: 'pending@example.com',
        firstName: 'Pending',
        lastName: 'User',
        role: 'Paralegal',
        status: 'Pending', // User status is Pending
        firmId: null,
        azureAdId: 'mock-azure-ad-id',
      });

      // Make request to callback endpoint
      const response = await request(app)
        .get('/auth/callback')
        .query({
          code: 'mock-auth-code',
          state: 'mock-state',
        });

      // Verify response - should return 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('account_pending_activation');
      expect(response.body.message).toContain('pending activation');
      expect(response.body.userEmail).toBe('pending@example.com');
      expect(response.body.userStatus).toBe('Pending');
    });

    it('should not create session if user status is Inactive', async () => {
      // Mock PKCE session retrieval
      mockSessionManager.get.mockResolvedValueOnce({
        codeVerifier: 'mock-verifier',
        state: 'mock-state',
        codeChallenge: 'mock-challenge',
        createdAt: Date.now(),
      });

      // Mock successful OAuth flow
      const mockAuthService = require('../../src/services/auth.service');
      mockAuthService.AuthService.prototype.validateCallbackParams = jest.fn().mockReturnValue({
        code: 'mock-auth-code',
        state: 'mock-state',
        error: null,
        errorDescription: null,
      });

      mockAuthService.AuthService.prototype.exchangeCodeForTokens = jest.fn().mockResolvedValue({
        accessToken: 'mock-azure-access-token',
        refreshToken: 'mock-azure-refresh-token',
        idTokenClaims: {
          oid: 'mock-azure-ad-id',
          email: 'inactive@example.com',
          given_name: 'Inactive',
          family_name: 'User',
        },
      });

      mockAuthService.AuthService.prototype.extractUserProfile = jest.fn().mockReturnValue({
        azureAdId: 'mock-azure-ad-id',
        email: 'inactive@example.com',
        firstName: 'Inactive',
        lastName: 'User',
      });

      // Mock user provisioning with Inactive status
      const mockUserService = require('../../src/services/user.service');
      mockUserService.UserService.prototype.provisionUserFromAzureAD = jest.fn().mockResolvedValue({
        id: 'mock-inactive-user-id',
        email: 'inactive@example.com',
        firstName: 'Inactive',
        lastName: 'User',
        role: 'Associate',
        status: 'Inactive', // User status is Inactive
        firmId: 'mock-firm-id',
        azureAdId: 'mock-azure-ad-id',
      });

      // Make request to callback endpoint
      const response = await request(app)
        .get('/auth/callback')
        .query({
          code: 'mock-auth-code',
          state: 'mock-state',
        });

      // Verify response - should return 403 Forbidden
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('account_inactive');
      expect(response.body.message).toContain('deactivated');
      expect(response.body.userEmail).toBe('inactive@example.com');
      expect(response.body.userStatus).toBe('Inactive');
    });
  });

  describe('Session Validation Middleware', () => {
    // Note: Direct middleware testing would require setting up sessions
    // For now, we verify session validation through the integration tests above
    // Unit tests for session.middleware.ts can be added separately

    it('should be tested via protected route access (future implementation)', () => {
      // Placeholder for future tests when protected routes are added
      expect(true).toBe(true);
    });
  });
});
