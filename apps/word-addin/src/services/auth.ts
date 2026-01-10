/**
 * Authentication Service for Word Add-in
 * Story 3.4: Word Integration with Live AI Assistance - Task 13
 *
 * Uses MSAL.js for authentication via Office dialog API.
 */

import { useState, useEffect, useCallback } from 'react';
import { authConfig } from './msal-config';

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
 * Get API base URL
 */
function getApiBaseUrl(): string {
  return authConfig.apiBaseUrl;
}

/**
 * Initialize authentication - check for existing session
 */
async function initAuth(): Promise<void> {
  console.log('[Auth] Initializing authentication...');
  try {
    authState = { ...authState, loading: true, error: null };
    notifyListeners();

    // Try to get SSO token from Office (might work if manifest cache cleared)
    console.log('[Auth] Attempting to get SSO token...');
    const ssoToken = await getOfficeSsoToken();
    console.log('[Auth] SSO token result:', ssoToken ? 'obtained' : 'not available');

    if (ssoToken) {
      // Exchange SSO token for access token
      const accessToken = await exchangeToken(ssoToken);
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
    const timeout = setTimeout(() => {
      console.log('[Auth] SSO token request timed out');
      resolve(null);
    }, 3000);

    try {
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
 * Interactive login flow using MSAL dialog
 */
async function login(): Promise<void> {
  try {
    authState = { ...authState, loading: true, error: null };
    notifyListeners();

    // DEV MODE: Skip real auth for testing
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS === 'true') {
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

    // Try SSO first with prompts enabled
    try {
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
        notifyListeners();
        return;
      }
    } catch (ssoError) {
      console.log('[Auth] SSO login failed, falling back to MSAL dialog:', ssoError);
    }

    // Fallback to MSAL dialog-based auth
    await msalDialogLogin();
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    authState = {
      ...authState,
      loading: false,
      error: (error as Error).message || 'Autentificarea a eșuat. Vă rugăm să încercați din nou.',
    };
    notifyListeners();
  }
}

/**
 * MSAL Dialog-based login
 * Opens auth-dialog.html which uses MSAL.js for authentication
 * Falls back to window.open if Office dialog API is unavailable
 */
async function msalDialogLogin(): Promise<void> {
  console.log('[Auth] Starting MSAL dialog login...');

  const baseUrl = import.meta.env.DEV
    ? 'https://localhost:3005'
    : `${authConfig.apiBaseUrl}/word-addin`;

  const dialogUrl = `${baseUrl}/auth-dialog.html`;
  console.log('[Auth] Opening dialog:', dialogUrl);

  // Check if Office dialog API is available
  const hasOfficeDialogApi =
    typeof Office !== 'undefined' &&
    Office.context?.ui &&
    typeof Office.context.ui.displayDialogAsync === 'function';

  if (hasOfficeDialogApi) {
    console.log('[Auth] Using Office dialog API');
    return openOfficeDialog(dialogUrl);
  } else {
    console.log('[Auth] Office dialog API not available, using window.open fallback');
    return openWindowDialog(dialogUrl);
  }
}

/**
 * Open dialog using Office API
 */
function openOfficeDialog(dialogUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      dialogUrl,
      { height: 60, width: 40, promptBeforeOpen: false },
      (result: Office.AsyncResult<Office.Dialog>) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          console.error('[Auth] Failed to open dialog:', result.error?.message);
          authState = {
            ...authState,
            loading: false,
            error: `Failed to open login dialog: ${result.error?.message || 'Unknown error'}`,
          };
          notifyListeners();
          reject(new Error('Failed to open dialog'));
          return;
        }

        console.log('[Auth] Dialog opened successfully');
        const dialog = result.value;

        // Handle messages from the dialog
        dialog.addEventHandler(
          Office.EventType.DialogMessageReceived,
          async (args: { message?: string } | { error: number }) => {
            console.log('[Auth] Received message from dialog');
            dialog.close();

            try {
              if ('error' in args) {
                throw new Error(`Dialog error: ${args.error}`);
              }

              const message = JSON.parse(args.message || '{}');
              console.log('[Auth] Dialog message:', message.success ? 'success' : 'failed');

              if (message.success && message.accessToken) {
                // Get user info using the access token
                const user = await getUserInfo(message.accessToken);

                authState = {
                  isAuthenticated: true,
                  user,
                  accessToken: message.accessToken,
                  loading: false,
                  error: null,
                };
                notifyListeners();
                resolve();
              } else {
                throw new Error(message.errorMessage || 'Authentication failed');
              }
            } catch (error) {
              console.error('[Auth] Error processing dialog result:', error);
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

        // Handle dialog closed by user
        dialog.addEventHandler(
          Office.EventType.DialogEventReceived,
          (args: { message: string; origin: string | undefined } | { error: number }) => {
            console.log('[Auth] Dialog event received:', args);
            if ('error' in args && args.error === 12006) {
              // Dialog was closed by user
              console.log('[Auth] Dialog closed by user');
              authState = { ...authState, loading: false };
              notifyListeners();
              resolve();
            }
          }
        );
      }
    );
  });
}

/**
 * Open dialog using window.open (fallback for when Office API is unavailable)
 */
function openWindowDialog(dialogUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      dialogUrl,
      'auth-dialog',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      authState = {
        ...authState,
        loading: false,
        error: 'Popup was blocked. Please allow popups for this site.',
      };
      notifyListeners();
      reject(new Error('Popup blocked'));
      return;
    }

    // Listen for messages from the popup
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      const expectedOrigin = import.meta.env.DEV
        ? 'https://localhost:3005'
        : 'https://legal-platform-gateway.onrender.com';

      if (event.origin !== expectedOrigin) {
        return;
      }

      console.log('[Auth] Received postMessage from popup');
      window.removeEventListener('message', handleMessage);

      try {
        const message = event.data;
        console.log('[Auth] Popup message:', message.success ? 'success' : 'failed');

        if (message.success && message.accessToken) {
          const user = await getUserInfo(message.accessToken);

          authState = {
            isAuthenticated: true,
            user,
            accessToken: message.accessToken,
            loading: false,
            error: null,
          };
          notifyListeners();
          resolve();
        } else {
          throw new Error(message.errorMessage || 'Authentication failed');
        }
      } catch (error) {
        console.error('[Auth] Error processing popup result:', error);
        authState = {
          ...authState,
          loading: false,
          error: (error as Error).message,
        };
        notifyListeners();
        reject(error);
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);

        // Only update state if still loading (auth not completed)
        if (authState.loading) {
          console.log('[Auth] Popup closed by user');
          authState = { ...authState, loading: false };
          notifyListeners();
          resolve();
        }
      }
    }, 500);
  });
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
