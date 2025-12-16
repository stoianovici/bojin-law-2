/**
 * Authentication Service
 * Story 2.4: Authentication with Azure AD
 *
 * Implements OAuth 2.0 Authorization Code Flow with PKCE for Azure AD authentication.
 *
 * Flow:
 * 1. Generate authorization URL with PKCE challenge
 * 2. User authenticates with Azure AD
 * 3. Azure AD redirects to callback with authorization code
 * 4. Exchange code for access token and refresh token
 * 5. Fetch user profile from Microsoft Graph API
 * 6. Create or update user in database
 * 7. Create session and return tokens
 *
 * Ref: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
 */

import {
  ConfidentialClientApplication,
  AuthorizationUrlRequest,
  AuthorizationCodeRequest,
  RefreshTokenRequest,
  AuthenticationResult,
} from '@azure/msal-node';
import { randomBytes, createHash } from 'crypto';
import { msalConfig, azureAdConfig, defaultScopes } from '../config/auth.config';

/**
 * PKCE (Proof Key for Code Exchange) parameters
 * Prevents authorization code interception attacks
 */
interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

/**
 * OAuth error types from Azure AD
 */
export enum OAuthError {
  InvalidGrant = 'invalid_grant',
  InvalidClient = 'invalid_client',
  InvalidRequest = 'invalid_request',
  UnauthorizedClient = 'unauthorized_client',
  UnsupportedGrantType = 'unsupported_grant_type',
  InvalidScope = 'invalid_scope',
  ConsentRequired = 'consent_required',
  InteractionRequired = 'interaction_required',
}

/**
 * OAuth error response
 */
export interface OAuthErrorResponse {
  error: string;
  errorDescription?: string;
  errorCodes?: number[];
  timestamp?: string;
  traceId?: string;
}

/**
 * Authentication Service
 * Handles OAuth 2.0 flow with Azure AD
 */
export class AuthService {
  private msalClient: ConfidentialClientApplication;

  constructor() {
    this.msalClient = new ConfidentialClientApplication(msalConfig);
  }

  /**
   * Generate PKCE code verifier and challenge
   * Ref: https://tools.ietf.org/html/rfc7636
   *
   * Code verifier: Random 43-128 character string (base64url encoded)
   * Code challenge: SHA256 hash of code verifier (base64url encoded)
   */
  private generatePKCE(): Pick<PKCEParams, 'codeVerifier' | 'codeChallenge'> {
    // Generate random code verifier (43 characters)
    const codeVerifier = randomBytes(32).toString('base64url');

    // Generate code challenge (SHA256 hash of verifier)
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    return {
      codeVerifier,
      codeChallenge,
    };
  }

  /**
   * Generate random state parameter for CSRF protection
   */
  private generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate authorization URL for OAuth flow
   *
   * @returns Authorization URL and PKCE parameters to store in session
   */
  async generateAuthorizationUrl(): Promise<{
    authUrl: string;
    pkceParams: PKCEParams;
  }> {
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const state = this.generateState();

    // Create authorization URL request
    const authUrlRequest: AuthorizationUrlRequest = {
      scopes: defaultScopes,
      redirectUri: azureAdConfig.redirectUri,
      codeChallenge,
      codeChallengeMethod: 'S256',
      state,
      responseMode: 'query',
      prompt: 'select_account', // Allow user to select account or switch accounts
    };

    // Generate authorization URL
    const authUrl = await this.msalClient.getAuthCodeUrl(authUrlRequest);

    return {
      authUrl,
      pkceParams: {
        codeVerifier,
        codeChallenge,
        state,
      },
    };
  }

  /**
   * Exchange authorization code for access token and refresh token
   *
   * @param code - Authorization code from OAuth callback
   * @param codeVerifier - PKCE code verifier from session
   * @param state - State parameter from OAuth callback
   * @param expectedState - Expected state parameter from session
   * @returns Authentication result with tokens
   * @throws Error if code exchange fails
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    state: string,
    expectedState: string
  ): Promise<AuthenticationResult> {
    // Verify state parameter (CSRF protection)
    if (state !== expectedState) {
      throw new Error('State parameter mismatch. Possible CSRF attack detected.');
    }

    try {
      // Create token request
      const tokenRequest: AuthorizationCodeRequest = {
        code,
        scopes: defaultScopes,
        redirectUri: azureAdConfig.redirectUri,
        codeVerifier,
      };

      // Exchange code for tokens
      const authResult = await this.msalClient.acquireTokenByCode(tokenRequest);

      return authResult;
    } catch (error: any) {
      // Handle OAuth errors
      const oauthError = this.parseOAuthError(error);
      throw new Error(
        `OAuth token exchange failed: ${oauthError.error} - ${oauthError.errorDescription || 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - Refresh token from session
   * @returns Authentication result with new access token
   * @throws Error if token refresh fails
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthenticationResult> {
    try {
      // Create refresh token request
      const refreshRequest: RefreshTokenRequest = {
        refreshToken,
        scopes: defaultScopes,
      };

      // Refresh access token
      const authResult = await this.msalClient.acquireTokenByRefreshToken(refreshRequest);

      if (!authResult) {
        throw new Error('Token refresh failed: No authentication result returned');
      }

      return authResult;
    } catch (error: any) {
      // Handle OAuth errors
      const oauthError = this.parseOAuthError(error);

      // If refresh token expired, user must re-login
      if (
        oauthError.error === OAuthError.InvalidGrant ||
        oauthError.error === OAuthError.InteractionRequired
      ) {
        throw new Error('Refresh token expired or invalid. User must re-authenticate.');
      }

      throw new Error(
        `Token refresh failed: ${oauthError.error} - ${oauthError.errorDescription || 'Unknown error'}`
      );
    }
  }

  /**
   * Parse OAuth error from Azure AD response
   *
   * @param error - Error object from MSAL
   * @returns Parsed OAuth error response
   */
  private parseOAuthError(error: any): OAuthErrorResponse {
    // MSAL error format
    if (error.errorCode) {
      return {
        error: error.errorCode,
        errorDescription: error.errorMessage,
        errorCodes: error.subError ? [error.subError] : undefined,
        timestamp: error.timestamp,
        traceId: error.correlationId,
      };
    }

    // Generic error
    return {
      error: 'unknown_error',
      errorDescription: error.message || 'An unknown error occurred',
    };
  }

  /**
   * Extract user information from ID token claims
   *
   * @param idTokenClaims - ID token claims from authentication result
   * @returns User profile information
   */
  extractUserProfile(idTokenClaims: any): {
    azureAdId: string;
    email: string;
    firstName: string;
    lastName: string;
  } {
    // Extract user profile from ID token claims
    // Ref: https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
    const azureAdId = idTokenClaims.oid || idTokenClaims.sub; // Object ID (preferred) or Subject
    const email = idTokenClaims.preferred_username || idTokenClaims.email || idTokenClaims.upn; // Email address
    const firstName = idTokenClaims.given_name || '';
    const lastName = idTokenClaims.family_name || '';

    if (!azureAdId) {
      throw new Error('Missing required claim: oid (object ID)');
    }

    if (!email) {
      throw new Error('Missing required claim: email (preferred_username, email, or upn)');
    }

    return {
      azureAdId,
      email,
      firstName,
      lastName,
    };
  }

  /**
   * Validate OAuth callback parameters
   *
   * @param query - Query parameters from OAuth callback
   * @returns Validated code and state
   * @throws Error if validation fails
   */
  validateCallbackParams(query: any): {
    code: string;
    state: string;
    error?: string;
    errorDescription?: string;
  } {
    // Check for OAuth error in callback
    if (query.error) {
      return {
        code: '',
        state: '',
        error: query.error,
        errorDescription: query.error_description,
      };
    }

    // Validate required parameters
    if (!query.code) {
      throw new Error('Missing authorization code in callback');
    }

    if (!query.state) {
      throw new Error('Missing state parameter in callback');
    }

    return {
      code: query.code,
      state: query.state,
    };
  }
}
