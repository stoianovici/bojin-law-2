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
  tenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID || '',
  authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_AD_TENANT_ID || 'common'}`,
  // In production, redirect to gateway; in dev, to localhost
  redirectUri: import.meta.env.DEV
    ? 'https://localhost:3005/taskpane.html'
    : `${API_BASE_URL}/word-addin/taskpane.html`,
  // Include OpenID scopes for ID token claims + User.Read for Graph access
  // Note: offline_access is not supported for SPA redirect URIs
  scopes: ['openid', 'profile', 'email', 'User.Read'],
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
  console.log('[Auth] Starting dialog login...');
  console.log('[Auth] Client ID:', AUTH_CONFIG.clientId);
  console.log('[Auth] Redirect URI:', AUTH_CONFIG.redirectUri);

  return new Promise((resolve, reject) => {
    // Use local auth-start page that redirects to Microsoft login
    // This avoids Office dialog security restrictions with external URLs
    const baseUrl = import.meta.env.DEV ? 'https://localhost:3005' : `${API_BASE_URL}/word-addin`;

    const authStartUrl =
      `${baseUrl}/auth-start.html?` +
      `client_id=${encodeURIComponent(AUTH_CONFIG.clientId)}` +
      `&redirect_uri=${encodeURIComponent(AUTH_CONFIG.redirectUri)}` +
      `&scope=${encodeURIComponent(AUTH_CONFIG.scopes.join(' '))}`;

    console.log('[Auth] Opening dialog with URL:', authStartUrl);

    Office.context.ui.displayDialogAsync(
      authStartUrl,
      { height: 60, width: 40 },
      (result: Office.AsyncResult<Office.Dialog>) => {
        console.log('[Auth] displayDialogAsync result:', result.status, result.error?.message);
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          console.log('[Auth] Dialog opened successfully');
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
          console.error('[Auth] Dialog failed to open:', result.error?.code, result.error?.message);
          authState = {
            ...authState,
            loading: false,
            error: `Failed to open login dialog: ${result.error?.message || 'Unknown error'}`,
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
  const response = await fetch(`${getApiBaseUrl()}/auth/dialog-callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, redirectUri: AUTH_CONFIG.redirectUri }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Code exchange failed');
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
