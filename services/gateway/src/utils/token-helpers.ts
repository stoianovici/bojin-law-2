/**
 * Token Storage and Retrieval Helpers
 * Story 2.5: Microsoft Graph API Integration Foundation
 * Task 5: Implement Token Storage and Retrieval
 *
 * Utilities for managing Graph API access tokens in Redis sessions.
 *
 * Features:
 * - Retrieve Graph API tokens by userId (for background jobs/webhooks)
 * - Validate token expiry before API calls
 * - Store userId->sessionId mappings for token retrieval
 * - Check if tokens need proactive refresh
 *
 * Usage:
 *   import { getGraphToken, isTokenExpired, needsTokenRefresh } from './utils/token-helpers';
 *
 *   // In background job or webhook
 *   const token = await getGraphToken(userId);
 *
 *   // In request handler with session
 *   const token = getGraphTokenFromSession(req.session);
 *   if (needsTokenRefresh(req.session.user.accessTokenExpiry)) {
 *     // Trigger refresh
 *   }
 */

import { redis } from '@legal-platform/database';
import { Session, SessionData } from 'express-session';
import { UserSessionData } from '../config/session.config';

/**
 * Redis key pattern for userId->sessionId mapping
 * Allows retrieving session by userId for background tasks
 */
const USER_SESSION_KEY_PREFIX = 'user:session:';

/**
 * Default token refresh threshold (5 minutes)
 * Tokens expiring within this window should be refreshed proactively
 */
export const DEFAULT_REFRESH_THRESHOLD_SECONDS = 5 * 60;

/**
 * Store userId->sessionId mapping in Redis
 *
 * This mapping enables retrieving a user's session (and access token)
 * by userId, which is needed for:
 * - Background jobs processing user data
 * - Webhook handlers that receive userId in payload
 * - Scheduled tasks that need to call Graph API on behalf of users
 *
 * Call this when creating or updating a session.
 *
 * @param userId - User UUID
 * @param sessionId - Express session ID
 * @param ttl - TTL in seconds (default: 7 days to match session TTL)
 * @throws Error if Redis operation fails
 */
export async function storeUserSessionMapping(
  userId: string,
  sessionId: string,
  ttl: number = 7 * 24 * 60 * 60
): Promise<void> {
  const key = `${USER_SESSION_KEY_PREFIX}${userId}`;
  await redis.set(key, sessionId, 'EX', ttl);
}

/**
 * Retrieve sessionId for a given userId
 *
 * @param userId - User UUID
 * @returns Session ID or null if not found
 * @throws Error if Redis operation fails
 */
export async function getUserSessionId(userId: string): Promise<string | null> {
  const key = `${USER_SESSION_KEY_PREFIX}${userId}`;
  return await redis.get(key);
}

/**
 * Delete userId->sessionId mapping
 * Call this when destroying a session
 *
 * @param userId - User UUID
 * @throws Error if Redis operation fails
 */
export async function deleteUserSessionMapping(userId: string): Promise<void> {
  const key = `${USER_SESSION_KEY_PREFIX}${userId}`;
  await redis.del(key);
}

/**
 * Retrieve session data from Redis by sessionId
 *
 * @param sessionId - Express session ID
 * @returns Parsed session data or null if not found
 * @throws Error if Redis operation fails or JSON parse fails
 */
export async function getSessionData(sessionId: string): Promise<SessionData | null> {
  const key = `sess:${sessionId}`; // Express-session prefix
  const sessionJson = await redis.get(key);

  if (!sessionJson) {
    return null;
  }

  try {
    return JSON.parse(sessionJson);
  } catch (error) {
    throw new Error(`Failed to parse session data for sessionId ${sessionId}`);
  }
}

/**
 * Get Graph API access token by userId
 *
 * Retrieves the user's session from Redis and extracts the access token.
 * Validates that:
 * - User session exists
 * - Session contains user data
 * - Access token exists
 * - Access token is not expired
 *
 * This function is designed for use in:
 * - Background jobs (e.g., webhook subscription renewal)
 * - Webhook handlers (e.g., processing Graph notifications)
 * - Scheduled tasks (e.g., syncing user data from Graph API)
 *
 * @param userId - User UUID
 * @returns Access token string
 * @throws Error if session not found, token missing, or token expired
 */
export async function getGraphToken(userId: string): Promise<string> {
  // Get sessionId from userId mapping
  const sessionId = await getUserSessionId(userId);
  if (!sessionId) {
    throw new Error(`No active session found for user ${userId}`);
  }

  // Retrieve session data from Redis
  const sessionData = await getSessionData(sessionId);
  if (!sessionData || !sessionData.user) {
    throw new Error(`Session data not found for user ${userId}`);
  }

  const user = sessionData.user as UserSessionData;

  // Validate access token exists
  if (!user.accessToken) {
    throw new Error(`No access token found in session for user ${userId}`);
  }

  // Validate token is not expired
  if (isTokenExpired(user.accessTokenExpiry)) {
    throw new Error(
      `Access token expired for user ${userId}. Token expired at ${new Date(user.accessTokenExpiry * 1000).toISOString()}`
    );
  }

  return user.accessToken;
}

/**
 * Get Graph API access token from Express session
 *
 * Extracts and validates the access token from a request's session.
 * Use this in route handlers where you have access to req.session.
 *
 * @param session - Express session object
 * @returns Access token string
 * @throws Error if session invalid, token missing, or token expired
 */
export function getGraphTokenFromSession(session: Session & Partial<SessionData>): string {
  // Validate session exists and has user data
  if (!session || !session.user) {
    throw new Error('No active session found');
  }

  const user = session.user as UserSessionData;

  // Validate access token exists
  if (!user.accessToken) {
    throw new Error('No access token found in session');
  }

  // Validate token is not expired
  if (isTokenExpired(user.accessTokenExpiry)) {
    throw new Error(
      `Access token expired at ${new Date(user.accessTokenExpiry * 1000).toISOString()}`
    );
  }

  return user.accessToken;
}

/**
 * Get refresh token from session
 *
 * @param session - Express session object
 * @returns Refresh token string
 * @throws Error if session invalid or refresh token missing
 */
export function getRefreshTokenFromSession(session: Session & Partial<SessionData>): string {
  if (!session || !session.user) {
    throw new Error('No active session found');
  }

  const user = session.user as UserSessionData;

  if (!user.refreshToken) {
    throw new Error('No refresh token found in session');
  }

  return user.refreshToken;
}

/**
 * Check if an access token is expired
 *
 * @param expiryTimestamp - Unix timestamp in seconds when token expires
 * @returns true if token is expired, false otherwise
 */
export function isTokenExpired(expiryTimestamp: number): boolean {
  if (!expiryTimestamp) {
    // If no expiry timestamp, assume expired for safety
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= expiryTimestamp;
}

/**
 * Check if token needs proactive refresh
 *
 * Tokens should be refreshed proactively before they expire to avoid
 * 401 errors during Graph API calls. Default threshold is 5 minutes.
 *
 * @param expiryTimestamp - Unix timestamp in seconds when token expires
 * @param thresholdSeconds - Seconds before expiry to trigger refresh (default: 5 minutes)
 * @returns true if token should be refreshed, false otherwise
 */
export function needsTokenRefresh(
  expiryTimestamp: number,
  thresholdSeconds: number = DEFAULT_REFRESH_THRESHOLD_SECONDS
): boolean {
  if (!expiryTimestamp) {
    // If no expiry timestamp, needs refresh
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = expiryTimestamp - nowSeconds;

  return timeUntilExpiry <= thresholdSeconds;
}

/**
 * Get seconds until token expires
 *
 * @param expiryTimestamp - Unix timestamp in seconds when token expires
 * @returns Seconds until expiry (negative if already expired)
 */
export function getSecondsUntilExpiry(expiryTimestamp: number): number {
  if (!expiryTimestamp) {
    return -1;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiryTimestamp - nowSeconds;
}

/**
 * Validate session contains required token data
 *
 * @param session - Express session object
 * @returns true if session has all required token fields
 */
export function hasValidTokenData(session: Session & Partial<SessionData>): boolean {
  if (!session || !session.user) {
    return false;
  }

  const user = session.user as UserSessionData;

  return !!(
    user.accessToken &&
    user.refreshToken &&
    user.accessTokenExpiry &&
    !isTokenExpired(user.accessTokenExpiry)
  );
}
