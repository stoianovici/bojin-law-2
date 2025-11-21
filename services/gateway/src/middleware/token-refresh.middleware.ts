/**
 * Token Refresh Middleware
 * Story 2.5: Microsoft Graph API Integration Foundation
 * Task 4: Enhance Token Refresh Logic for Graph API
 *
 * Middleware that checks Azure AD access token expiry and automatically
 * refreshes it before Graph API calls if token is near expiration.
 *
 * Features:
 * - Checks token expiry before Graph API calls
 * - Automatically refreshes token if expiring within 5 minutes
 * - Updates session with new access token and expiry
 * - Prevents unnecessary API calls with expired tokens
 * - Transparent to the caller - request continues with valid token
 *
 * Usage:
 *   import { tokenRefreshMiddleware } from './middleware/token-refresh.middleware';
 *
 *   app.use('/api/graph', tokenRefreshMiddleware, graphRouter);
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

/**
 * Token refresh threshold: 5 minutes before expiry
 * If token expires within 5 minutes, refresh it proactively
 */
const TOKEN_REFRESH_THRESHOLD_SECONDS = 5 * 60; // 5 minutes

/**
 * Token Refresh Middleware
 *
 * Checks if the user's Azure AD access token is near expiration and
 * automatically refreshes it using the refresh token from the session.
 *
 * Flow:
 * 1. Check if session exists with user data
 * 2. Get access token expiry from session
 * 3. If token expires within 5 minutes, refresh it
 * 4. Update session with new access token and expiry
 * 5. Continue to next middleware/route handler
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function tokenRefreshMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if session exists
    if (!req.session || !req.session.user) {
      res.status(401).json({
        error: 'no_session',
        message: 'No active session found. Please login again.',
      });
      return;
    }

    const sessionUser = req.session.user;

    // Get current time in Unix timestamp (seconds)
    const now = Math.floor(Date.now() / 1000);

    // Check if access token expiry is set
    if (!sessionUser.accessTokenExpiry) {
      console.warn(`No accessTokenExpiry in session for user ${sessionUser.email}`);
      // Allow request to proceed - Graph API will return 401 if token is invalid
      return next();
    }

    // Calculate time until token expires
    const timeUntilExpiry = sessionUser.accessTokenExpiry - now;

    // If token is already expired or will expire within threshold, refresh it
    if (timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD_SECONDS) {
      console.log(
        `Access token expiring soon for user ${sessionUser.email} (${timeUntilExpiry}s remaining). Refreshing...`
      );

      // Check if refresh token exists
      if (!sessionUser.refreshToken) {
        res.status(401).json({
          error: 'no_refresh_token',
          message: 'No refresh token found in session. Please login again.',
        });
        return;
      }

      try {
        // Refresh access token using AuthService
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
          `Access token refreshed successfully for user ${sessionUser.email}. New expiry: ${sessionUser.accessTokenExpiry}`
        );

        // Continue to next middleware with refreshed token
        return next();
      } catch (refreshError: any) {
        console.error(`Token refresh failed for user ${sessionUser.email}:`, refreshError);

        // Clear session if refresh fails (token likely expired)
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
        });

        res.status(401).json({
          error: 'token_refresh_failed',
          message: 'Access token expired and refresh failed. Please login again.',
        });
        return;
      }
    }

    // Token is still valid, continue to next middleware
    next();
  } catch (error: any) {
    console.error('Error in token refresh middleware:', error);
    // Don't block the request - let it proceed and fail at Graph API if needed
    next();
  }
}

/**
 * Check if token is expired
 * Utility function for testing and direct usage
 *
 * @param expiryTimestamp - Unix timestamp in seconds
 * @returns true if token is expired or expiring within threshold
 */
export function isTokenExpiringSoon(expiryTimestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = expiryTimestamp - now;
  return timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD_SECONDS;
}

/**
 * Get time until token expires
 * Utility function for monitoring and logging
 *
 * @param expiryTimestamp - Unix timestamp in seconds
 * @returns Time in seconds until token expires (negative if already expired)
 */
export function getTimeUntilExpiry(expiryTimestamp: number): number {
  const now = Math.floor(Date.now() / 1000);
  return expiryTimestamp - now;
}
