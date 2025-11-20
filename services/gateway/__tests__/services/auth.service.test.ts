/**
 * Unit tests for Authentication Service
 * Story 2.4: Authentication with Azure AD
 */

// Set up test environment variables BEFORE importing modules
process.env.NODE_ENV = 'test';
process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';

import { AuthService, OAuthError } from '../../src/services/auth.service';
import { ConfidentialClientApplication } from '@azure/msal-node';

// Mock MSAL node
jest.mock('@azure/msal-node');

describe('AuthService', () => {
  let authService: AuthService;
  let mockMsalClient: jest.Mocked<ConfidentialClientApplication>;

  beforeEach(() => {
    // Create mock MSAL client
    mockMsalClient = {
      getAuthCodeUrl: jest.fn(),
      acquireTokenByCode: jest.fn(),
      acquireTokenByRefreshToken: jest.fn(),
    } as any;

    // Mock ConfidentialClientApplication constructor
    (ConfidentialClientApplication as jest.MockedClass<typeof ConfidentialClientApplication>).mockImplementation(
      () => mockMsalClient
    );

    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAuthorizationUrl', () => {
    it('should generate authorization URL with PKCE parameters', async () => {
      const mockAuthUrl =
        'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?client_id=123&scope=openid';
      mockMsalClient.getAuthCodeUrl.mockResolvedValue(mockAuthUrl as any);

      const result = await authService.generateAuthorizationUrl();

      expect(result.authUrl).toBe(mockAuthUrl);
      expect(result.pkceParams.codeVerifier).toBeDefined();
      expect(result.pkceParams.codeChallenge).toBeDefined();
      expect(result.pkceParams.state).toBeDefined();
      expect(result.pkceParams.codeVerifier.length).toBeGreaterThan(40);
      expect(result.pkceParams.codeChallenge.length).toBeGreaterThan(40);
      expect(result.pkceParams.state.length).toBeGreaterThan(40);
    });

    it('should call MSAL getAuthCodeUrl with correct parameters', async () => {
      mockMsalClient.getAuthCodeUrl.mockResolvedValue('https://example.com' as any);

      await authService.generateAuthorizationUrl();

      expect(mockMsalClient.getAuthCodeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining(['openid', 'profile', 'email']),
          redirectUri: 'https://example.com/auth/callback',
          codeChallengeMethod: 'S256',
          responseMode: 'query',
          prompt: 'select_account',
        })
      );
    });

    it('should generate unique PKCE parameters each time', async () => {
      mockMsalClient.getAuthCodeUrl.mockResolvedValue('https://example.com' as any);

      const result1 = await authService.generateAuthorizationUrl();
      const result2 = await authService.generateAuthorizationUrl();

      expect(result1.pkceParams.codeVerifier).not.toBe(
        result2.pkceParams.codeVerifier
      );
      expect(result1.pkceParams.codeChallenge).not.toBe(
        result2.pkceParams.codeChallenge
      );
      expect(result1.pkceParams.state).not.toBe(result2.pkceParams.state);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockAuthResult = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        idToken: 'mock-id-token',
        idTokenClaims: {
          oid: 'user-123',
          preferred_username: 'user@example.com',
          given_name: 'John',
          family_name: 'Doe',
        },
        expiresOn: new Date(Date.now() + 3600000),
      };

      mockMsalClient.acquireTokenByCode.mockResolvedValue(mockAuthResult as any);

      const result = await authService.exchangeCodeForTokens(
        'auth-code-123',
        'code-verifier-123',
        'state-123',
        'state-123'
      );

      expect(result).toEqual(mockAuthResult);
      expect(mockMsalClient.acquireTokenByCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'auth-code-123',
          codeVerifier: 'code-verifier-123',
        })
      );
    });

    it('should throw error if state parameter does not match', async () => {
      await expect(
        authService.exchangeCodeForTokens(
          'auth-code-123',
          'code-verifier-123',
          'state-123',
          'different-state'
        )
      ).rejects.toThrow('State parameter mismatch');
    });

    it('should handle OAuth errors gracefully', async () => {
      const mockError = {
        errorCode: 'invalid_grant',
        errorMessage: 'Authorization code has expired',
      };

      mockMsalClient.acquireTokenByCode.mockRejectedValue(mockError);

      await expect(
        authService.exchangeCodeForTokens(
          'invalid-code',
          'code-verifier-123',
          'state-123',
          'state-123'
        )
      ).rejects.toThrow(/OAuth token exchange failed.*invalid_grant/);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const mockAuthResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresOn: new Date(Date.now() + 3600000),
      };

      mockMsalClient.acquireTokenByRefreshToken.mockResolvedValue(
        mockAuthResult as any
      );

      const result = await authService.refreshAccessToken('old-refresh-token');

      expect(result).toEqual(mockAuthResult);
      expect(mockMsalClient.acquireTokenByRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'old-refresh-token',
        })
      );
    });

    it('should throw error if refresh token is expired', async () => {
      const mockError = {
        errorCode: 'invalid_grant',
        errorMessage: 'Refresh token has expired',
      };

      mockMsalClient.acquireTokenByRefreshToken.mockRejectedValue(mockError);

      await expect(
        authService.refreshAccessToken('expired-refresh-token')
      ).rejects.toThrow(/Refresh token expired or invalid/);
    });

    it('should throw error if interaction is required', async () => {
      const mockError = {
        errorCode: 'interaction_required',
        errorMessage: 'User interaction is required',
      };

      mockMsalClient.acquireTokenByRefreshToken.mockRejectedValue(mockError);

      await expect(
        authService.refreshAccessToken('refresh-token')
      ).rejects.toThrow(/Refresh token expired or invalid/);
    });
  });

  describe('extractUserProfile', () => {
    it('should extract user profile from ID token claims', () => {
      const idTokenClaims = {
        oid: 'user-123',
        preferred_username: 'user@example.com',
        given_name: 'John',
        family_name: 'Doe',
      };

      const result = authService.extractUserProfile(idTokenClaims);

      expect(result).toEqual({
        azureAdId: 'user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should use sub as fallback for azureAdId if oid is missing', () => {
      const idTokenClaims = {
        sub: 'user-456',
        email: 'user@example.com',
        given_name: 'Jane',
        family_name: 'Smith',
      };

      const result = authService.extractUserProfile(idTokenClaims);

      expect(result.azureAdId).toBe('user-456');
    });

    it('should use email as fallback if preferred_username is missing', () => {
      const idTokenClaims = {
        oid: 'user-123',
        email: 'user@example.com',
        given_name: 'John',
        family_name: 'Doe',
      };

      const result = authService.extractUserProfile(idTokenClaims);

      expect(result.email).toBe('user@example.com');
    });

    it('should use upn as fallback if email and preferred_username are missing', () => {
      const idTokenClaims = {
        oid: 'user-123',
        upn: 'user@example.onmicrosoft.com',
        given_name: 'John',
        family_name: 'Doe',
      };

      const result = authService.extractUserProfile(idTokenClaims);

      expect(result.email).toBe('user@example.onmicrosoft.com');
    });

    it('should handle missing firstName and lastName gracefully', () => {
      const idTokenClaims = {
        oid: 'user-123',
        preferred_username: 'user@example.com',
      };

      const result = authService.extractUserProfile(idTokenClaims);

      expect(result.firstName).toBe('');
      expect(result.lastName).toBe('');
    });

    it('should throw error if oid and sub are missing', () => {
      const idTokenClaims = {
        preferred_username: 'user@example.com',
      };

      expect(() => authService.extractUserProfile(idTokenClaims)).toThrow(
        /Missing required claim.*oid/
      );
    });

    it('should throw error if email is missing', () => {
      const idTokenClaims = {
        oid: 'user-123',
      };

      expect(() => authService.extractUserProfile(idTokenClaims)).toThrow(
        /Missing required claim.*email/
      );
    });
  });

  describe('validateCallbackParams', () => {
    it('should validate correct callback parameters', () => {
      const query = {
        code: 'auth-code-123',
        state: 'state-123',
      };

      const result = authService.validateCallbackParams(query);

      expect(result).toEqual({
        code: 'auth-code-123',
        state: 'state-123',
      });
    });

    it('should return error if OAuth error is present', () => {
      const query = {
        error: 'access_denied',
        error_description: 'User cancelled the authentication',
      };

      const result = authService.validateCallbackParams(query);

      expect(result.error).toBe('access_denied');
      expect(result.errorDescription).toBe('User cancelled the authentication');
    });

    it('should throw error if code is missing', () => {
      const query = {
        state: 'state-123',
      };

      expect(() => authService.validateCallbackParams(query)).toThrow(
        /Missing authorization code in callback/
      );
    });

    it('should throw error if state is missing', () => {
      const query = {
        code: 'auth-code-123',
      };

      expect(() => authService.validateCallbackParams(query)).toThrow(
        /Missing state parameter in callback/
      );
    });
  });
});
