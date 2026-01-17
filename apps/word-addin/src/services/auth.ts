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

/**
 * Login using Office Dialog API - more reliable in Office Add-ins
 */
function loginWithOfficeDialog(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clear any previous auth result from localStorage
    localStorage.removeItem('auth-dialog-result');

    // Get the auth dialog URL - use the same origin as taskpane
    const dialogUrl = new URL('/word-addin/auth-dialog.html', window.location.origin).href;
    console.log('[Auth] Opening Office dialog:', dialogUrl);

    // Setup BroadcastChannel listener (works across same-origin iframes)
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('auth-channel');
      broadcastChannel.onmessage = (event) => {
        console.log('[Auth] Got auth result from BroadcastChannel:', event.data);
        cleanup();
        handleAuthResult(event.data, resolve, reject);
      };
    }

    // Poll localStorage as fallback (in case messageParent doesn't work after redirect)
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      pollInterval = setInterval(() => {
        const result = localStorage.getItem('auth-dialog-result');
        if (result) {
          localStorage.removeItem('auth-dialog-result');
          cleanup();
          try {
            const message = JSON.parse(result);
            console.log('[Auth] Got auth result from localStorage:', message);
            handleAuthResult(message, resolve, reject);
          } catch (e) {
            console.error('[Auth] Failed to parse localStorage result:', e);
          }
        }
      }, 500);
    };

    const cleanup = () => {
      if (pollInterval) clearInterval(pollInterval);
      if (broadcastChannel) broadcastChannel.close();
    };

    Office.context.ui.displayDialogAsync(
      dialogUrl,
      { height: 60, width: 30, promptBeforeOpen: false },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          console.error('[Auth] Failed to open dialog:', result.error.message);
          updateState({ loading: false, error: result.error.message });
          reject(new Error(result.error.message));
          return;
        }

        const dialog = result.value;
        console.log('[Auth] Dialog opened successfully');

        // Start polling localStorage as fallback
        startPolling();

        dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg: any) => {
          cleanup();
          dialog.close();

          try {
            const message = JSON.parse(arg.message);
            console.log('[Auth] Received message from dialog:', message);
            handleAuthResult(message, resolve, reject);
          } catch (e) {
            console.error('[Auth] Failed to parse dialog message:', e);
            updateState({ loading: false, error: 'Failed to process auth response' });
            reject(e);
          }
        });

        dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg: any) => {
          console.log('[Auth] Dialog event:', arg);
          cleanup();
          if (arg.error === 12006) {
            // Dialog closed by user
            updateState({ loading: false });
            reject(new Error('Dialog closed'));
          }
        });
      }
    );
  });
}

function handleAuthResult(
  message: {
    success: boolean;
    accessToken?: string;
    account?: { username?: string; name?: string };
    errorMessage?: string;
  },
  resolve: () => void,
  reject: (error: Error) => void
): void {
  if (message.success) {
    const user: User = {
      id: '',
      email: message.account?.username || '',
      name: message.account?.name || 'User',
    };

    updateState({
      isAuthenticated: true,
      user,
      accessToken: message.accessToken || null,
      loading: false,
    });
    resolve();
  } else {
    updateState({ loading: false, error: message.errorMessage || 'Auth failed' });
    reject(new Error(message.errorMessage || 'Auth failed'));
  }
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
