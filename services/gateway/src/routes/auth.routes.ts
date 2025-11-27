/**
 * Authentication Routes
 * Story 2.4: Authentication with Azure AD
 *
 * API endpoints for OAuth 2.0 authentication flow:
 * - GET /auth/login - Initiate OAuth flow
 * - GET /auth/callback - Handle OAuth callback
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/logout - Logout and revoke session
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { JWTService } from '../services/jwt.service';
import { sessionManager } from '@legal-platform/database';
import { PKCETempSession } from '../types/auth.types';

export const authRouter: Router = Router();
const authService = new AuthService();
const userService = new UserService();
const jwtService = new JWTService();

/**
 * Rate Limiting Configuration
 * SEC-001: Protection against brute force attacks and abuse
 *
 * References:
 * - OWASP: https://owasp.org/www-community/attacks/Brute_force_attack
 * - express-rate-limit: https://github.com/express-rate-limit/express-rate-limit
 */

// Login rate limiter: 5 attempts per minute per IP
// Prevents brute force attacks on authentication
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: {
    error: 'too_many_requests',
    message: 'Too many login attempts. Please try again in 1 minute.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use IP address as key
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

// Token refresh rate limiter: 10 attempts per minute per session
// Prevents token refresh abuse
const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: {
    error: 'too_many_requests',
    message: 'Too many token refresh attempts. Please try again in 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use session ID as key if available, fallback to IP
  keyGenerator: (req: Request) => {
    return req.sessionID || req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * GET /auth/login
 * Initiates OAuth 2.0 authorization flow with Azure AD
 *
 * Flow:
 * 1. Generate authorization URL with PKCE parameters
 * 2. Store PKCE parameters in temporary session (15 minute TTL)
 * 3. Redirect user to Azure AD login page
 *
 * @returns Redirect to Azure AD authorization URL
 */
authRouter.get('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    // Generate authorization URL and PKCE parameters
    const { authUrl, pkceParams } = await authService.generateAuthorizationUrl();

    // Store PKCE parameters in temporary session
    // Session ID format: pkce:{state}
    // TTL: 15 minutes (enough time for user to authenticate)
    const pkceSession: PKCETempSession = {
      ...pkceParams,
      createdAt: Date.now(),
    };

    await sessionManager.set(
      `pkce:${pkceParams.state}`,
      pkceSession,
      15 * 60 // 15 minutes in seconds
    );

    // Redirect to Azure AD login page
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({
      error: 'oauth_error',
      message: 'Failed to initiate authentication flow',
    });
  }
});

/**
 * GET /auth/callback
 * Handles OAuth callback from Azure AD
 *
 * Flow:
 * 1. Validate callback parameters (code, state)
 * 2. Retrieve PKCE parameters from temporary session
 * 3. Exchange authorization code for tokens
 * 4. Extract user profile from ID token
 * 5. Create or update user in database
 * 6. Validate user status (Pending users cannot access app)
 * 7. Create session with tokens
 * 8. Redirect to frontend with success
 *
 * @query code - Authorization code from Azure AD
 * @query state - State parameter for CSRF protection
 * @query error - Error code if authentication failed
 * @query error_description - Error description
 *
 * @returns Redirect to frontend with authentication result
 */
authRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    // Validate callback parameters
    const callbackParams = authService.validateCallbackParams(req.query);

    // Check for OAuth error
    if (callbackParams.error) {
      console.error('OAuth error in callback:', callbackParams.error);
      return res.redirect(
        `/login?error=${callbackParams.error}&error_description=${encodeURIComponent(callbackParams.errorDescription || '')}`
      );
    }

    const { code, state } = callbackParams;

    // Retrieve PKCE parameters from temporary session
    const pkceSession = await sessionManager.get(`pkce:${state}`);

    if (!pkceSession) {
      console.error('PKCE session not found for state:', state);
      return res.status(400).json({
        error: 'invalid_state',
        message:
          'Authentication session expired or invalid. Please try again.',
      });
    }

    // Delete temporary PKCE session
    await sessionManager.delete(`pkce:${state}`);

    // Exchange authorization code for tokens
    const authResult = await authService.exchangeCodeForTokens(
      code,
      pkceSession.codeVerifier,
      state,
      pkceSession.state
    );

    // Extract user profile from ID token
    const userProfile = authService.extractUserProfile(
      authResult.idTokenClaims
    );

    // Task 8: Create or update user in database (User Provisioning Service)
    const user = await userService.provisionUserFromAzureAD(
      authResult.accessToken,
      authResult.idTokenClaims
    );

    // Task 9: Validate user status - Block Pending and Inactive users
    if (user.status === 'Pending') {
      console.warn(`Access denied for pending user: ${user.email}`);
      return res.status(403).json({
        error: 'account_pending_activation',
        message:
          "Your account is pending activation. Please contact your firm's partner for access.",
        userEmail: user.email,
        userStatus: user.status,
      });
    }

    if (user.status === 'Inactive') {
      console.warn(`Access denied for inactive user: ${user.email}`);
      return res.status(403).json({
        error: 'account_inactive',
        message:
          'Your account has been deactivated. Please contact your administrator for assistance.',
        userEmail: user.email,
        userStatus: user.status,
      });
    }

    // User status is 'Active' - proceed with authentication

    // Task 6: Generate JWT tokens
    const accessToken = jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status, // Include status in JWT payload
      firmId: user.firmId,
      azureAdId: user.azureAdId,
    });

    const refreshToken = jwtService.generateRefreshToken(user.id);

    // Task 11: Store session data in Express session (backed by Redis)
    // Session data structure defined in session.config.ts UserSessionData interface
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    // Note: MSAL manages refresh tokens internally via the token cache
    // We store the access token and account info for Graph API calls
    const azureRefreshToken = (authResult as any).refreshToken || '';

    // Store session data (if session middleware is enabled)
    if (req.session) {
      req.session.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        firmId: user.firmId,
        azureAdId: user.azureAdId,
        accessToken: authResult.accessToken, // Azure AD access token for Graph API
        refreshToken: azureRefreshToken, // Azure AD refresh token (if available)
        accessTokenExpiry: now + (authResult.expiresOn ? Math.floor(authResult.expiresOn.getTime() / 1000) - now : 1800),
        createdAt: now,
        lastActivity: now,
      };
    }

    // Return success response with JWT tokens
    res.json({
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        firmId: user.firmId,
      },
      tokens: {
        accessToken: accessToken, // Application JWT token
        refreshToken: refreshToken, // Application JWT refresh token
        expiresIn: 1800, // 30 minutes in seconds
      },
    });
  } catch (error: any) {
    console.error('Error in OAuth callback:', error);
    res.status(500).json({
      error: 'authentication_failed',
      message: error.message || 'Authentication failed',
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using Azure AD refresh token from session
 *
 * Flow:
 * 1. Validate session exists
 * 2. Get Azure AD refresh token from session
 * 3. Exchange refresh token for new access token via MSAL
 * 4. Update session with new access token and expiry
 * 5. Generate new JWT tokens
 * 6. Return new access token to client
 *
 * @returns New access token and refresh token
 */
authRouter.post('/refresh', refreshRateLimiter, async (req: Request, res: Response) => {
  try {
    // Task 12: Validate session exists
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: 'no_session',
        message: 'No active session found. Please login again.',
      });
    }

    const sessionUser = req.session.user;

    // Check if Azure AD refresh token exists in session
    if (!sessionUser.refreshToken) {
      return res.status(401).json({
        error: 'no_refresh_token',
        message: 'No refresh token found in session. Please login again.',
      });
    }

    // Task 12: Exchange Azure AD refresh token for new access token
    try {
      const authResult = await authService.refreshAccessToken(sessionUser.refreshToken);

      // Update session with new Azure AD access token and expiry
      const now = Math.floor(Date.now() / 1000);
      sessionUser.accessToken = authResult.accessToken;
      sessionUser.accessTokenExpiry = now + (authResult.expiresOn ? Math.floor(authResult.expiresOn.getTime() / 1000) - now : 1800);
      sessionUser.lastActivity = now;

      // Update Azure AD refresh token if provided (token rotation)
      const newAzureRefreshToken = (authResult as any).refreshToken;
      if (newAzureRefreshToken) {
        sessionUser.refreshToken = newAzureRefreshToken;
      }

      // Generate new JWT tokens for the application
      const newAccessToken = jwtService.generateAccessToken({
        userId: sessionUser.userId,
        email: sessionUser.email,
        role: sessionUser.role,
        status: sessionUser.status,
        firmId: sessionUser.firmId,
        azureAdId: sessionUser.azureAdId,
      });

      const newRefreshToken = jwtService.generateRefreshToken(sessionUser.userId);

      // Return new tokens
      res.json({
        message: 'Token refreshed successfully',
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 1800, // 30 minutes in seconds
        },
      });
    } catch (refreshError: any) {
      // Handle refresh token expiration or invalidity
      console.error('Refresh token exchange failed:', refreshError);

      // Clear session if refresh token is invalid/expired
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });

      return res.status(401).json({
        error: 'refresh_token_expired',
        message: 'Refresh token expired or invalid. Please login again.',
      });
    }
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      error: 'token_refresh_failed',
      message: error.message || 'Failed to refresh token',
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and revoke session
 *
 * Flow:
 * 1. Retrieve session ID from request
 * 2. Delete session from Redis
 * 3. Clear session cookie in response
 * 4. Return success response
 *
 * Note: Azure AD tokens cannot be revoked directly via Microsoft Graph API
 * in the standard way. They will expire naturally (30 min for access token,
 * 7 days for refresh token). For immediate revocation, admins can revoke
 * refresh tokens via Azure Portal.
 *
 * @returns Success response
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    // Task 13: Implement logout logic

    // Check if session exists
    if (!req.session) {
      return res.status(200).json({
        message: 'No active session found. Already logged out.',
      });
    }

    const sessionUser = req.session.user;
    const userEmail = sessionUser?.email || 'unknown';

    // Destroy session (removes from Redis and clears cookie)
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session during logout:', err);
        return res.status(500).json({
          error: 'logout_failed',
          message: 'Failed to destroy session',
        });
      }

      // Clear session cookie
      res.clearCookie('sid'); // Session cookie name from session.config.ts

      console.log(`User logged out successfully: ${userEmail}`);

      res.json({
        message: 'Logout successful',
      });
    });
  } catch (error: any) {
    console.error('Error during logout:', error);
    res.status(500).json({
      error: 'logout_failed',
      message: error.message || 'Failed to logout',
    });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user from session
 *
 * @returns Current user data if authenticated
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    // Check if session exists
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'No active session found',
      });
    }

    const sessionUser = req.session.user;

    // Return user data
    res.json({
      id: sessionUser.userId,
      email: sessionUser.email,
      role: sessionUser.role,
      status: sessionUser.status,
      firmId: sessionUser.firmId,
      azureAdId: sessionUser.azureAdId,
    });
  } catch (error: any) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to get user',
    });
  }
});

/**
 * POST /auth/dev-login
 * Development-only endpoint to create mock session
 * ONLY available in development mode
 */
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Not available in production',
    });
  }

  try {
    // Query database for a real Partner user to use for dev login
    const { prisma } = await import('@legal-platform/database');

    const partner = await prisma.user.findFirst({
      where: {
        role: 'Partner',
        status: 'Active',
      },
      include: {
        firm: true,
      },
    });

    if (!partner) {
      return res.status(500).json({
        error: 'no_partner_found',
        message: 'No Partner user found in database. Please run seed script.',
      });
    }

    // Create session with real user data
    const mockUser = {
      userId: partner.id,
      email: partner.email,
      role: partner.role,
      status: partner.status,
      firmId: partner.firmId,
      azureAdId: partner.azureAdId,
      accessToken: 'dev-token',
      refreshToken: 'dev-refresh-token',
      accessTokenExpiry: Math.floor(Date.now() / 1000) + 3600,
      createdAt: Math.floor(Date.now() / 1000),
      lastActivity: Math.floor(Date.now() / 1000),
    };

    // Store user in session
    if (req.session) {
      req.session.user = mockUser;
    }

    res.json({
      user: {
        id: partner.id,
        email: partner.email,
        firstName: partner.firstName,
        lastName: partner.lastName,
        role: partner.role,
        firmId: partner.firmId,
      },
      message: 'Development session created with real Partner user',
    });
  } catch (error: any) {
    console.error('Dev login error:', error);
    res.status(500).json({
      error: 'dev_login_failed',
      message: error.message || 'Failed to create dev session',
    });
  }
});
