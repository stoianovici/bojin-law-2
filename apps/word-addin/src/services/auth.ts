/**
 * Authentication Service for Word Add-in
 * Story 3.4: Word Integration with Live AI Assistance - Task 13
 *
 * Handles SSO authentication with Microsoft Identity Platform.
 */

import { useState, useEffect, useCallback } from 'react';

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

// Configuration from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';
const AUTH_CONFIG = {
  clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID || '',
  authority: 'https://login.microsoftonline.com/common',
  // In production, redirect to gateway; in dev, to localhost
  redirectUri: import.meta.env.DEV
    ? 'https://localhost:3005/taskpane.html'
    : `${API_BASE_URL}/word-addin/taskpane.html`,
  scopes: ['User.Read', 'Files.ReadWrite'],
};

// Singleton state
let authState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  loading: true,
  error: null,
};

let listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Initialize authentication using Office SSO
 */
async function initAuth(): Promise<void> {
  console.log('[Auth] Initializing authentication...');
  try {
    authState = { ...authState, loading: true, error: null };
    notifyListeners();

    // Try to get SSO token from Office
    console.log('[Auth] Attempting to get SSO token...');
    const ssoToken = await getOfficeSsoToken();
    console.log('[Auth] SSO token result:', ssoToken ? 'obtained' : 'not available');

    if (ssoToken) {
      // Exchange SSO token for access token
      const accessToken = await exchangeToken(ssoToken);

      // Get user info
      const user = await getUserInfo(accessToken);

      authState = {
        isAuthenticated: true,
        user,
        accessToken,
        loading: false,
        error: null,
      };
    } else {
      authState = {
        ...authState,
        loading: false,
        isAuthenticated: false,
      };
    }
  } catch (error) {
    console.error('Auth initialization failed:', error);
    authState = {
      ...authState,
      loading: false,
      error: (error as Error).message,
      isAuthenticated: false,
    };
  }

  notifyListeners();
}

/**
 * Get SSO token from Office with timeout
 */
async function getOfficeSsoToken(): Promise<string | null> {
  return new Promise((resolve) => {
    // Timeout after 3 seconds to avoid hanging
    const timeout = setTimeout(() => {
      console.log('[Auth] SSO token request timed out');
      resolve(null);
    }, 3000);

    try {
      // Check if Office.auth is available
      if (!Office.auth || typeof Office.auth.getAccessToken !== 'function') {
        console.log('[Auth] Office.auth not available');
        clearTimeout(timeout);
        resolve(null);
        return;
      }

      Office.auth
        .getAccessToken({
          allowSignInPrompt: false,
          allowConsentPrompt: false,
        })
        .then((token: string) => {
          clearTimeout(timeout);
          console.log('[Auth] SSO token obtained');
          resolve(token);
        })
        .catch((error: { code: string }) => {
          clearTimeout(timeout);
          console.log('[Auth] SSO token not available:', error.code);
          resolve(null);
        });
    } catch (err) {
      clearTimeout(timeout);
      console.log('[Auth] SSO token error:', err);
      resolve(null);
    }
  });
}

/**
 * Exchange Office SSO token for access token via backend
 */
async function exchangeToken(ssoToken: string): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/auth/exchange-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ssoToken }),
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  const data = await response.json();
  return data.accessToken;
}

/**
 * Get user info from Microsoft Graph
 */
async function getUserInfo(accessToken: string): Promise<User> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json();

  return {
    id: data.id,
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
  };
}

/**
 * Interactive login flow
 */
async function login(): Promise<void> {
  try {
    authState = { ...authState, loading: true, error: null };
    notifyListeners();

    // DEV MODE: Skip real auth for testing
    if (import.meta.env.DEV) {
      console.log('[Auth] Dev mode - using mock authentication');
      authState = {
        isAuthenticated: true,
        user: {
          id: 'dev-user',
          email: 'dev@bojin-law.com',
          name: 'Dev User',
        },
        accessToken: 'dev-token',
        loading: false,
        error: null,
      };
      notifyListeners();
      return;
    }

    // Try SSO with prompts enabled
    const token = await Office.auth.getAccessToken({
      allowSignInPrompt: true,
      allowConsentPrompt: true,
    });

    if (token) {
      const accessToken = await exchangeToken(token);
      const user = await getUserInfo(accessToken);

      authState = {
        isAuthenticated: true,
        user,
        accessToken,
        loading: false,
        error: null,
      };
    } else {
      // Fallback to dialog-based auth
      await dialogLogin();
    }
  } catch (error) {
    // SSO failed - always try dialog fallback regardless of error code
    // Common errors: 13003 (user not signed in), domain mismatch, consent required
    console.error('[Auth] SSO login failed, falling back to dialog:', error);
    try {
      await dialogLogin();
    } catch (dialogError) {
      // Both SSO and dialog failed
      console.error('[Auth] Dialog login also failed:', dialogError);
      authState = {
        ...authState,
        loading: false,
        error: 'Autentificarea a eșuat. Vă rugăm să încercați din nou.',
      };
    }
  }

  notifyListeners();
}

/**
 * Dialog-based login fallback
 */
async function dialogLogin(): Promise<void> {
  return new Promise((resolve, reject) => {
    const authUrl =
      `${AUTH_CONFIG.authority}/oauth2/v2.0/authorize?` +
      `client_id=${AUTH_CONFIG.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(AUTH_CONFIG.redirectUri)}` +
      `&scope=${encodeURIComponent(AUTH_CONFIG.scopes.join(' '))}`;

    Office.context.ui.displayDialogAsync(
      authUrl,
      { height: 60, width: 40 },
      (result: Office.AsyncResult<Office.Dialog>) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          const dialog = result.value;

          dialog.addEventHandler(
            Office.EventType.DialogMessageReceived,
            async (args: { message?: string; origin?: string } | { error: number }) => {
              dialog.close();

              try {
                if ('error' in args) {
                  throw new Error(`Dialog error: ${args.error}`);
                }
                const message = JSON.parse(args.message || '{}');
                if (message.code) {
                  // Exchange auth code for tokens
                  const tokens = await exchangeAuthCode(message.code);
                  const user = await getUserInfo(tokens.accessToken);

                  authState = {
                    isAuthenticated: true,
                    user,
                    accessToken: tokens.accessToken,
                    loading: false,
                    error: null,
                  };
                  notifyListeners();
                  resolve();
                } else {
                  throw new Error(message.error || 'Auth failed');
                }
              } catch (error) {
                authState = {
                  ...authState,
                  loading: false,
                  error: (error as Error).message,
                };
                notifyListeners();
                reject(error);
              }
            }
          );

          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            authState = { ...authState, loading: false };
            notifyListeners();
            resolve();
          });
        } else {
          authState = {
            ...authState,
            loading: false,
            error: 'Failed to open login dialog',
          };
          notifyListeners();
          reject(new Error('Dialog failed'));
        }
      }
    );
  });
}

/**
 * Exchange auth code for tokens
 */
async function exchangeAuthCode(code: string): Promise<{ accessToken: string }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, redirectUri: AUTH_CONFIG.redirectUri }),
  });

  if (!response.ok) {
    throw new Error('Code exchange failed');
  }

  return response.json();
}

/**
 * Logout
 */
function logout(): void {
  authState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    loading: false,
    error: null,
  };
  notifyListeners();
}

/**
 * Get API base URL
 */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';
}

/**
 * React hook for auth state
 */
export function useAuth() {
  const [state, setState] = useState(authState);

  useEffect(() => {
    const listener = () => setState({ ...authState });
    listeners.add(listener);

    // Initialize auth on first mount
    if (authState.loading) {
      initAuth();
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
 * Get current access token
 */
export function getAccessToken(): string | null {
  return authState.accessToken;
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  return authState.isAuthenticated;
}
