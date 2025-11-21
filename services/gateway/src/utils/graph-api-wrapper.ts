/**
 * Graph API Wrapper Utility
 * Story 2.5: Microsoft Graph API Integration Foundation
 * Task 4: Enhance Token Refresh Logic for Graph API
 *
 * Wrapper functions that automatically retry Graph API calls with token refresh
 * when receiving 401 Unauthorized errors.
 *
 * Features:
 * - Detects 401 Unauthorized errors from Graph API
 * - Automatically refreshes access token using refresh token
 * - Retries the original Graph API call with new token
 * - Updates session with new access token
 * - Maximum 1 retry attempt to prevent loops
 *
 * Usage:
 *   import { executeWithTokenRefresh } from './utils/graph-api-wrapper';
 *
 *   const user = await executeWithTokenRefresh(
 *     req.session,
 *     async (accessToken) => graphService.getUserProfile(accessToken)
 *   );
 */

import { Session, SessionData } from 'express-session';
import { AuthService } from '../services/auth.service';
import { isAuthError } from './graph-error-handler';

/**
 * Execute a Graph API operation with automatic token refresh on 401 errors
 *
 * This wrapper:
 * 1. Executes the provided Graph API operation
 * 2. If it receives a 401 error, refreshes the access token
 * 3. Updates the session with the new token
 * 4. Retries the operation once with the new token
 * 5. Throws error if retry also fails
 *
 * @param session - Express session containing user data and tokens
 * @param operation - Async function that performs the Graph API call
 * @returns Result from the Graph API operation
 * @throws Error if Graph API call fails after retry
 */
export async function executeWithTokenRefresh<T>(
  session: Session & Partial<SessionData>,
  operation: (accessToken: string) => Promise<T>
): Promise<T> {
  // Validate session exists
  if (!session || !session.user) {
    throw new Error('No active session found');
  }

  const sessionUser = session.user;

  // Validate access token exists
  if (!sessionUser.accessToken) {
    throw new Error('No access token found in session');
  }

  try {
    // Attempt the operation with current access token
    return await operation(sessionUser.accessToken);
  } catch (error: any) {
    // Check if error is a 401 Unauthorized (token expired/invalid)
    const isUnauthorized = isAuthError(error);

    if (!isUnauthorized) {
      // Not an auth error, rethrow original error
      throw error;
    }

    // Log the 401 error and attempt token refresh
    console.log(
      `Received 401 Unauthorized for user ${sessionUser.email}. Attempting token refresh...`
    );

    // Check if refresh token exists
    if (!sessionUser.refreshToken) {
      throw new Error('No refresh token found in session');
    }

    try {
      // Refresh the access token
      const authService = new AuthService();
      const authResult = await authService.refreshAccessToken(sessionUser.refreshToken);

      // Update session with new access token and expiry
      const now = Math.floor(Date.now() / 1000);
      sessionUser.accessToken = authResult.accessToken;
      sessionUser.accessTokenExpiry =
        now +
        (authResult.expiresOn ? Math.floor(authResult.expiresOn.getTime() / 1000) - now : 1800); // Default 30 minutes
      sessionUser.lastActivity = now;

      // Update Azure AD refresh token if provided (token rotation)
      const newAzureRefreshToken = (authResult as any).refreshToken;
      if (newAzureRefreshToken) {
        sessionUser.refreshToken = newAzureRefreshToken;
      }

      console.log(
        `Token refreshed successfully for user ${sessionUser.email}. Retrying Graph API call...`
      );

      // Retry the operation with the new access token
      return await operation(sessionUser.accessToken);
    } catch (refreshError: any) {
      console.error(`Token refresh failed for user ${sessionUser.email}:`, refreshError);

      // Clear session if refresh fails (token likely expired)
      session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });

      throw new Error('Access token expired and refresh failed. Please login again.');
    }
  }
}

/**
 * Execute a Graph API operation with automatic token refresh (no retry)
 *
 * Lighter version that just ensures the token is fresh before making the call.
 * Does not retry on 401 - instead proactively refreshes if needed.
 *
 * @param session - Express session containing user data and tokens
 * @param operation - Async function that performs the Graph API call
 * @param forceRefresh - Force token refresh even if not expired
 * @returns Result from the Graph API operation
 * @throws Error if Graph API call fails
 */
export async function executeWithFreshToken<T>(
  session: Session & Partial<SessionData>,
  operation: (accessToken: string) => Promise<T>,
  forceRefresh: boolean = false
): Promise<T> {
  // Validate session exists
  if (!session || !session.user) {
    throw new Error('No active session found');
  }

  const sessionUser = session.user;

  // Validate tokens exist
  if (!sessionUser.accessToken) {
    throw new Error('No access token found in session');
  }

  // Check if token refresh is needed
  const now = Math.floor(Date.now() / 1000);
  const TOKEN_REFRESH_THRESHOLD = 5 * 60; // 5 minutes
  const timeUntilExpiry = sessionUser.accessTokenExpiry ? sessionUser.accessTokenExpiry - now : 0;
  const needsRefresh = forceRefresh || timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD;

  if (needsRefresh) {
    if (!sessionUser.refreshToken) {
      throw new Error('No refresh token found in session');
    }

    console.log(
      `Proactively refreshing token for user ${sessionUser.email} (${timeUntilExpiry}s until expiry)...`
    );

    try {
      // Refresh the access token
      const authService = new AuthService();
      const authResult = await authService.refreshAccessToken(sessionUser.refreshToken);

      // Update session with new access token and expiry
      sessionUser.accessToken = authResult.accessToken;
      sessionUser.accessTokenExpiry =
        now +
        (authResult.expiresOn ? Math.floor(authResult.expiresOn.getTime() / 1000) - now : 1800); // Default 30 minutes
      sessionUser.lastActivity = now;

      // Update Azure AD refresh token if provided (token rotation)
      const newAzureRefreshToken = (authResult as any).refreshToken;
      if (newAzureRefreshToken) {
        sessionUser.refreshToken = newAzureRefreshToken;
      }

      console.log(
        `Token refreshed proactively for user ${sessionUser.email}. New expiry: ${sessionUser.accessTokenExpiry}`
      );
    } catch (refreshError: any) {
      console.error(`Proactive token refresh failed for user ${sessionUser.email}:`, refreshError);
      // Continue with current token - will fail at Graph API if expired
    }
  }

  // Execute operation with current (possibly refreshed) token
  return await operation(sessionUser.accessToken);
}
