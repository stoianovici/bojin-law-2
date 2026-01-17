/**
 * Authentication Service - Office SSO with MSAL Fallback
 *
 * Tries Office.auth.getAccessToken() first for seamless authentication.
 * Falls back to MSAL dialog if SSO is not configured or fails.
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginScopes } from './msal-config';

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
  loading: boolean;
  error: string | null;
}

let authState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function updateState(updates: Partial<AuthState>) {
  authState = { ...authState, ...updates };
  listeners.forEach((fn) => fn());
}

// ============================================================================
// MSAL Instance
// ============================================================================

let msalInstance: PublicClientApplication | null = null;
let msalInitPromise: Promise<PublicClientApplication> | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (msalInitPromise) {
    return msalInitPromise;
  }

  msalInitPromise = (async () => {
    if (!msalInstance) {
      console.log('[Auth] Creating MSAL instance...');
      msalInstance = new PublicClientApplication(msalConfig);
      await msalInstance.initialize();
      console.log('[Auth] MSAL initialized');

      // Handle redirect from popup - this is critical for popup auth flow
      try {
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
          console.log('[Auth] Handled redirect response, account:', response.account?.username);
          // Update auth state with the response
          const user: User = {
            id: response.account?.localAccountId || '',
            email: response.account?.username || '',
            name: response.account?.name || 'User',
          };
          updateState({
            isAuthenticated: true,
            user,
            accessToken: response.accessToken,
            loading: false,
          });
        }
      } catch (e) {
        console.warn('[Auth] handleRedirectPromise error:', e);
      }
    }
    return msalInstance;
  })();

  return msalInitPromise;
}

// Initialize MSAL immediately to handle popup redirects
getMsalInstance();

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

async function getUserInfo(token: string): Promise<User> {
  // Decode the JWT to get user info (Office token contains basic claims)
  const payload = JSON.parse(atob(token.split('.')[1]));

  return {
    id: payload.oid || payload.sub,
    email: payload.preferred_username || payload.upn || '',
    name: payload.name || payload.preferred_username || 'User',
  };
}

// ============================================================================
// MSAL Fallback (using Office Dialog API)
// ============================================================================

async function loginWithMsal(): Promise<void> {
  console.log('[Auth] Falling back to MSAL...');

  const msal = await getMsalInstance();

  // Check for existing session
  const accounts = msal.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const silentResult = await msal.acquireTokenSilent({
        scopes: loginScopes,
        account: accounts[0],
      });

      const user: User = {
        id: silentResult.account?.localAccountId || '',
        email: silentResult.account?.username || '',
        name: silentResult.account?.name || 'User',
      };

      updateState({
        isAuthenticated: true,
        user,
        accessToken: silentResult.accessToken,
        loading: false,
      });
      return;
    } catch (e) {
      if (!(e instanceof InteractionRequiredAuthError)) throw e;
      console.log('[Auth] Silent auth failed, need interactive');
    }
  }

  // Use Office Dialog API if available (works better in Office Add-ins)
  const hasOfficeDialog =
    typeof Office !== 'undefined' &&
    Office.context?.ui &&
    typeof Office.context.ui.displayDialogAsync === 'function';
  if (hasOfficeDialog) {
    console.log('[Auth] Using Office Dialog API for auth');
    return loginWithOfficeDialog();
  }

  // Fallback to MSAL popup for non-Office environments (debugging)
  console.log('[Auth] Using MSAL popup (non-Office environment)');
  const result = await msal.loginPopup({
    scopes: loginScopes,
    prompt: 'select_account',
  });

  const user: User = {
    id: result.account?.localAccountId || '',
    email: result.account?.username || '',
    name: result.account?.name || 'User',
  };

  updateState({
    isAuthenticated: true,
    user,
    accessToken: result.accessToken,
    loading: false,
  });
}

// Generate a random session ID
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Get API base URL - use current origin when on bojin-law.com domains (dev or prod)
const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('bojin-law.com')) {
      return origin;
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';
})();

/**
 * Poll server for auth token
 */
async function pollForToken(sessionId: string): Promise<{
  accessToken: string;
  account: { username?: string; name?: string };
} | null> {
  const pollUrl = `${API_BASE_URL}/api/word-addin/auth/poll/${sessionId}`;
  try {
    const response = await fetch(pollUrl);
    const data = await response.json();

    console.log('[Auth] Poll response for session', sessionId, ':', JSON.stringify(data));

    if (data.ready) {
      console.log('[Auth] Token received from poll!');
      return {
        accessToken: data.accessToken,
        account: data.account,
      };
    }
    return null;
  } catch (error) {
    console.error('[Auth] Poll error:', error);
    console.error('[Auth] Poll URL was:', pollUrl);
    return null;
  }
}

/**
 * Login using regular browser popup with server-side token storage
 * Falls back from Office Dialog API which doesn't work reliably in Word Online
 */
function loginWithOfficeDialog(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Generate unique session ID for this auth attempt
    const sessionId = generateSessionId();
    console.log('[Auth] Generated session ID:', sessionId);
    console.log('[Auth] API base URL for polling:', API_BASE_URL);

    // Get the auth popup URL with session ID
    const popupUrl = new URL('/word-addin/auth-popup.html', window.location.origin);
    popupUrl.searchParams.set('sessionId', sessionId);
    console.log('[Auth] Opening browser popup:', popupUrl.href);

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let popup: Window | null = null;

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    // Poll server for token
    const startPolling = () => {
      pollInterval = setInterval(async () => {
        // Check if popup was closed
        if (popup && popup.closed) {
          console.log('[Auth] Popup was closed');
          // Don't cleanup yet - give it a moment to store the token
        }

        const result = await pollForToken(sessionId);
        if (result) {
          console.log('[Auth] Got token from server poll');
          cleanup();
          if (popup && !popup.closed) popup.close();

          const user: User = {
            id: '',
            email: result.account?.username || '',
            name: result.account?.name || 'User',
          };

          updateState({
            isAuthenticated: true,
            user,
            accessToken: result.accessToken,
            loading: false,
          });
          resolve();
        }
      }, 1000); // Poll every second
    };

    // Open browser popup (works better than Office Dialog in Word Online)
    popup = window.open(
      popupUrl.href,
      'authPopup',
      'width=500,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      console.error('[Auth] Popup blocked');
      updateState({
        loading: false,
        error: 'Popup was blocked. Please allow popups and try again.',
      });
      reject(new Error('Popup blocked'));
      return;
    }

    console.log('[Auth] Popup opened successfully');
    startPolling();

    // Timeout after 5 minutes
    setTimeout(
      () => {
        if (pollInterval) {
          cleanup();
          if (popup && !popup.closed) popup.close();
          updateState({ loading: false, error: 'Authentication timed out' });
          reject(new Error('Authentication timed out'));
        }
      },
      5 * 60 * 1000
    );
  });
}

// ============================================================================
// Auth Functions
// ============================================================================

async function login(): Promise<void> {
  updateState({ loading: true, error: null });

  try {
    // Try Office SSO first
    console.log('[Auth] Trying Office SSO...');
    const token = await getOfficeToken();
    console.log('[Auth] Office SSO token obtained');

    const user = await getUserInfo(token);

    updateState({
      isAuthenticated: true,
      user,
      accessToken: token,
      loading: false,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; message?: string };
    console.log('[Auth] Office SSO failed, trying MSAL fallback:', error.code, error.message);

    // Fall back to MSAL popup
    try {
      await loginWithMsal();
    } catch (msalError) {
      console.error('[Auth] MSAL fallback also failed:', msalError);
      updateState({
        loading: false,
        error: (msalError as Error).message || 'Authentication failed',
      });
    }
  }
}

function logout(): void {
  updateState({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    loading: false,
    error: null,
  });
}

// Auto-login on load (silent SSO or MSAL)
export async function tryAutoLogin(): Promise<boolean> {
  // Try Office SSO first
  try {
    console.log('[Auth] Attempting auto-login via Office SSO...');
    const token = await getOfficeToken();
    const user = await getUserInfo(token);

    updateState({
      isAuthenticated: true,
      user,
      accessToken: token,
      loading: false,
    });

    console.log('[Auth] Auto-login via Office SSO successful');
    return true;
  } catch (e) {
    console.log('[Auth] Office SSO auto-login not available:', (e as Error).message);
  }

  // Try MSAL silent login
  try {
    console.log('[Auth] Attempting auto-login via MSAL...');
    const msal = await getMsalInstance();
    const accounts = msal.getAllAccounts();

    if (accounts.length > 0) {
      const silentResult = await msal.acquireTokenSilent({
        scopes: loginScopes,
        account: accounts[0],
      });

      const user: User = {
        id: silentResult.account?.localAccountId || '',
        email: silentResult.account?.username || '',
        name: silentResult.account?.name || 'User',
      };

      updateState({
        isAuthenticated: true,
        user,
        accessToken: silentResult.accessToken,
        loading: false,
      });

      console.log('[Auth] Auto-login via MSAL successful');
      return true;
    }
  } catch (e) {
    console.log('[Auth] MSAL auto-login not available:', (e as Error).message);
  }

  return false;
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

export function getAccessToken(): string | null {
  return authState.accessToken;
}

export function isAuthenticated(): boolean {
  return authState.isAuthenticated;
}
