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
// MSAL Fallback
// ============================================================================

async function loginWithMsal(): Promise<void> {
  console.log('[Auth] Falling back to MSAL popup...');

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

  // Interactive login via popup
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
