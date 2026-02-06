/**
 * Authentication Service - Office SSO with MSAL Fallback
 *
 * Uses Office.auth.getAccessToken() for seamless authentication.
 * Falls back to MSAL popup auth when SSO is not available (e.g., Word Online).
 *
 * Security improvements:
 * - Token expiration validation
 * - Automatic token refresh before expiry
 * - Proactive refresh 5 minutes before expiration
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginScopes } from './msal-config';

// ============================================================================
// Constants
// ============================================================================

/** Refresh token 5 minutes before expiration */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Minimum token validity to consider it usable (30 seconds) */
const MIN_TOKEN_VALIDITY_MS = 30 * 1000;

// ============================================================================
// State
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  tokenExpiresAt: number | null; // Unix timestamp in milliseconds
  loading: boolean;
  error: string | null;
}

let authState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  tokenExpiresAt: null,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function updateState(updates: Partial<AuthState>) {
  authState = { ...authState, ...updates };
  listeners.forEach((fn) => fn());
}

// ============================================================================
// Token Refresh Timer
// ============================================================================

let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

function scheduleTokenRefresh(expiresAt: number): void {
  // Clear any existing timer
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }

  const now = Date.now();
  const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS;
  const delay = Math.max(0, refreshAt - now);

  if (delay > 0) {
    console.log('[Auth] Scheduling token refresh in', Math.round(delay / 1000), 'seconds');
    refreshTimerId = setTimeout(() => {
      console.log('[Auth] Token refresh timer triggered');
      refreshToken().catch((err) => {
        console.error('[Auth] Scheduled token refresh failed:', err);
      });
    }, delay);
  } else {
    // Token is already expired or about to expire, refresh now
    console.log('[Auth] Token expired or expiring soon, refreshing now');
    refreshToken().catch((err) => {
      console.error('[Auth] Immediate token refresh failed:', err);
    });
  }
}

// ============================================================================
// MSAL Instance (lazy initialized)
// ============================================================================

let msalInstance: PublicClientApplication | null = null;
let useMsalFallback = false; // Track if we should use MSAL instead of Office SSO

async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
}

// ============================================================================
// Office SSO
// ============================================================================

async function getOfficeToken(): Promise<string> {
  if (typeof Office === 'undefined' || !Office.auth) {
    throw new Error('Office.auth not available');
  }

  const result = await Office.auth.getAccessToken({
    allowSignInPrompt: true,
    allowConsentPrompt: true,
  });

  return result;
}

// ============================================================================
// MSAL Popup Fallback
// ============================================================================

async function getMsalToken(): Promise<string> {
  console.log('[Auth] Using MSAL popup fallback...');
  const msal = await getMsalInstance();

  // Try silent first (cached token)
  const accounts = msal.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const silentResult = await msal.acquireTokenSilent({
        scopes: loginScopes,
        account: accounts[0],
      });
      console.log('[Auth] MSAL silent token acquired');
      return silentResult.accessToken;
    } catch {
      console.log('[Auth] MSAL silent failed, trying popup');
    }
  }

  // Fall back to popup
  const popupResult = await msal.acquireTokenPopup({
    scopes: loginScopes,
  });
  console.log('[Auth] MSAL popup token acquired');
  return popupResult.accessToken;
}

// ============================================================================
// Token Parsing & Validation
// ============================================================================

interface TokenPayload {
  oid?: string;
  sub?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
  exp?: number; // Expiration time (Unix timestamp in seconds)
  iat?: number; // Issued at (Unix timestamp in seconds)
}

/**
 * Decode JWT payload (no signature verification - that's done server-side)
 * This is safe because:
 * 1. The token is verified by the server before any privileged operations
 * 2. We only use this for UI display (user name, email) and expiration checking
 */
function decodeTokenPayload(token: string): TokenPayload {
  const base64Payload = token.split('.')[1];
  if (!base64Payload) {
    throw new Error('Invalid token format');
  }
  const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

/**
 * Extract user info and expiration from token
 */
function parseToken(token: string): { user: User; expiresAt: number } {
  const payload = decodeTokenPayload(token);

  // Validate expiration exists
  if (!payload.exp) {
    console.warn('[Auth] Token missing expiration claim, assuming 1 hour validity');
  }

  // exp is in seconds, convert to milliseconds
  const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;

  // Check if token is already expired
  if (expiresAt <= Date.now()) {
    throw new Error('Token is expired');
  }

  const user: User = {
    id: payload.oid || payload.sub || '',
    email: payload.preferred_username || payload.upn || '',
    name: payload.name || payload.preferred_username || 'User',
  };

  return { user, expiresAt };
}

/**
 * Check if the current token is still valid (not expired)
 */
function isTokenValid(): boolean {
  if (!authState.accessToken || !authState.tokenExpiresAt) {
    return false;
  }
  return authState.tokenExpiresAt > Date.now() + MIN_TOKEN_VALIDITY_MS;
}

/**
 * Check if token needs refresh (expiring within buffer period)
 */
function tokenNeedsRefresh(): boolean {
  if (!authState.accessToken || !authState.tokenExpiresAt) {
    return true;
  }
  return authState.tokenExpiresAt < Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

// ============================================================================
// Auth Functions
// ============================================================================

async function login(): Promise<void> {
  updateState({ loading: true, error: null });

  try {
    // Try Office SSO first
    console.log('[Auth] Getting Office SSO token...');
    const token = await getOfficeToken();
    console.log('[Auth] Office SSO token obtained');

    const { user, expiresAt } = parseToken(token);

    updateState({
      isAuthenticated: true,
      user,
      accessToken: token,
      tokenExpiresAt: expiresAt,
      loading: false,
    });

    // Schedule automatic refresh
    scheduleTokenRefresh(expiresAt);
  } catch (e: unknown) {
    const error = e as { code?: number; message?: string };
    console.error('[Auth] Office SSO failed:', error);

    // SSO not supported - fall back to MSAL popup
    const ssoNotSupported = error.code === 13000 || error.code === 13012;
    if (ssoNotSupported) {
      console.log('[Auth] SSO not supported, falling back to MSAL popup...');
      useMsalFallback = true;
      try {
        const token = await getMsalToken();
        const { user, expiresAt } = parseToken(token);

        updateState({
          isAuthenticated: true,
          user,
          accessToken: token,
          tokenExpiresAt: expiresAt,
          loading: false,
        });

        // Schedule automatic refresh
        scheduleTokenRefresh(expiresAt);
        return;
      } catch (msalError) {
        console.error('[Auth] MSAL fallback failed:', msalError);
        updateState({
          loading: false,
          error: 'Authentication failed. Please try again.',
        });
        return;
      }
    }

    // Handle other Office SSO errors
    let errorMessage = error.message || 'Authentication failed';
    if (error.code === 13001) {
      errorMessage = 'User is not signed in to Office';
    } else if (error.code === 13002) {
      errorMessage = 'Consent required - please contact admin';
    } else if (error.code === 13003) {
      errorMessage = 'User account type not supported for SSO';
    } else if (error.code === 13004) {
      errorMessage = 'Invalid resource - Azure AD config mismatch';
    } else if (error.code === 13005) {
      errorMessage = 'Office not pre-authorized in Azure AD';
    } else if (error.code === 13006) {
      errorMessage = 'Client error - try signing out and back in';
    } else if (error.code === 13007) {
      errorMessage = 'Unable to get token - check Azure AD permissions';
    } else if (error.code) {
      errorMessage = `Office SSO error ${error.code}: ${error.message}`;
    }

    updateState({ loading: false, error: errorMessage });
  }
}

function logout(): void {
  // Clear refresh timer
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }

  updateState({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    tokenExpiresAt: null,
    loading: false,
    error: null,
  });
}

/**
 * Refresh the access token
 * Uses the same method that was successful during login
 */
async function refreshToken(): Promise<void> {
  console.log('[Auth] Refreshing token...');

  try {
    let token: string;

    if (useMsalFallback) {
      // Use MSAL for refresh
      const msal = await getMsalInstance();
      const accounts = msal.getAllAccounts();

      if (accounts.length === 0) {
        throw new Error('No MSAL account available for refresh');
      }

      const silentResult = await msal.acquireTokenSilent({
        scopes: loginScopes,
        account: accounts[0],
      });
      token = silentResult.accessToken;
    } else {
      // Use Office SSO for refresh
      token = await getOfficeToken();
    }

    const { user, expiresAt } = parseToken(token);

    updateState({
      isAuthenticated: true,
      user,
      accessToken: token,
      tokenExpiresAt: expiresAt,
    });

    // Schedule next refresh
    scheduleTokenRefresh(expiresAt);

    console.log(
      '[Auth] Token refreshed successfully, valid until',
      new Date(expiresAt).toISOString()
    );
  } catch (error) {
    console.error('[Auth] Token refresh failed:', error);

    // If refresh fails, mark as logged out so user can re-authenticate
    updateState({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      tokenExpiresAt: null,
      error: 'Session expired. Please log in again.',
    });
  }
}

// Auto-login on load (silent SSO, with MSAL fallback)
export async function tryAutoLogin(): Promise<boolean> {
  try {
    console.log('[Auth] Attempting auto-login via Office SSO...');
    const token = await getOfficeToken();
    const { user, expiresAt } = parseToken(token);

    updateState({
      isAuthenticated: true,
      user,
      accessToken: token,
      tokenExpiresAt: expiresAt,
      loading: false,
    });

    // Schedule automatic refresh
    scheduleTokenRefresh(expiresAt);

    console.log('[Auth] Auto-login successful');
    return true;
  } catch (e) {
    const error = e as { code?: number; message?: string };
    console.log('[Auth] Office SSO auto-login failed:', error.message);

    // SSO not supported - try MSAL silent
    const ssoNotSupported = error.code === 13000 || error.code === 13012;
    if (ssoNotSupported) {
      useMsalFallback = true;
      try {
        console.log('[Auth] Trying MSAL silent auth...');
        const msal = await getMsalInstance();
        const accounts = msal.getAllAccounts();

        if (accounts.length > 0) {
          const silentResult = await msal.acquireTokenSilent({
            scopes: loginScopes,
            account: accounts[0],
          });
          const { user, expiresAt } = parseToken(silentResult.accessToken);

          updateState({
            isAuthenticated: true,
            user,
            accessToken: silentResult.accessToken,
            tokenExpiresAt: expiresAt,
            loading: false,
          });

          // Schedule automatic refresh
          scheduleTokenRefresh(expiresAt);

          console.log('[Auth] MSAL silent auto-login successful');
          return true;
        }
      } catch (msalError) {
        console.log('[Auth] MSAL silent failed:', (msalError as Error).message);
      }
    }

    return false;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth() {
  const [state, setState] = useState(authState);

  useEffect(() => {
    const listener = () => setState({ ...authState });
    listeners.add(listener);

    // Try auto-login on mount
    if (!authState.isAuthenticated && !authState.loading) {
      tryAutoLogin();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    ...state,
    login: useCallback(() => login(), []),
    logout: useCallback(() => logout(), []),
  };
}

/**
 * Get the current access token, refreshing if needed
 * Returns null if not authenticated or refresh fails
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (!authState.isAuthenticated) {
    return null;
  }

  // If token needs refresh, refresh it first
  if (tokenNeedsRefresh()) {
    try {
      await refreshToken();
    } catch (error) {
      console.error('[Auth] Failed to refresh token:', error);
      return null;
    }
  }

  return authState.accessToken;
}

/**
 * Get the current access token (synchronous, no refresh)
 * For backwards compatibility - prefer getValidAccessToken() for new code
 */
export function getAccessToken(): string | null {
  // Log a warning if token is expired
  if (authState.accessToken && !isTokenValid()) {
    console.warn('[Auth] getAccessToken called but token is expired');
  }
  return authState.accessToken;
}

export function isAuthenticated(): boolean {
  return authState.isAuthenticated;
}

/**
 * Handle a 401 response by attempting to refresh the token
 * Call this when an API request fails with 401
 */
export async function handleUnauthorized(): Promise<boolean> {
  console.log('[Auth] Handling 401 unauthorized response');

  if (!authState.isAuthenticated) {
    return false;
  }

  try {
    await refreshToken();
    return true; // Token refreshed, caller can retry the request
  } catch (error) {
    console.error('[Auth] Token refresh after 401 failed:', error);
    return false; // Refresh failed, user needs to re-authenticate
  }
}
