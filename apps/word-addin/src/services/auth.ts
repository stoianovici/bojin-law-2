/**
 * Authentication Service - Office SSO with MSAL Fallback
 *
 * Uses Office.auth.getAccessToken() for seamless authentication.
 * Falls back to MSAL popup auth when SSO is not available (e.g., Word Online).
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
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
// MSAL Instance (lazy initialized)
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
    } catch (e) {
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

async function getUserInfo(token: string): Promise<User> {
  // Decode the JWT to get user info (Office token contains basic claims)
  // JWT uses base64url encoding, convert to standard base64 for atob()
  const base64Payload = token.split('.')[1];
  const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(base64));

  return {
    id: payload.oid || payload.sub,
    email: payload.preferred_username || payload.upn || '',
    name: payload.name || payload.preferred_username || 'User',
  };
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

    const user = await getUserInfo(token);

    updateState({
      isAuthenticated: true,
      user,
      accessToken: token,
      loading: false,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; message?: string };
    console.error('[Auth] Office SSO failed:', error);

    // SSO not supported - fall back to MSAL popup
    const ssoNotSupported = error.code === 13000 || error.code === 13012;
    if (ssoNotSupported) {
      console.log('[Auth] SSO not supported, falling back to MSAL popup...');
      try {
        const token = await getMsalToken();
        const user = await getUserInfo(token);

        updateState({
          isAuthenticated: true,
          user,
          accessToken: token,
          loading: false,
        });
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
  updateState({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    loading: false,
    error: null,
  });
}

// Auto-login on load (silent SSO, with MSAL fallback)
export async function tryAutoLogin(): Promise<boolean> {
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

    console.log('[Auth] Auto-login successful');
    return true;
  } catch (e) {
    const error = e as { code?: number; message?: string };
    console.log('[Auth] Office SSO auto-login failed:', error.message);

    // SSO not supported - try MSAL silent
    const ssoNotSupported = error.code === 13000 || error.code === 13012;
    if (ssoNotSupported) {
      try {
        console.log('[Auth] Trying MSAL silent auth...');
        const msal = await getMsalInstance();
        const accounts = msal.getAllAccounts();

        if (accounts.length > 0) {
          const silentResult = await msal.acquireTokenSilent({
            scopes: loginScopes,
            account: accounts[0],
          });
          const user = await getUserInfo(silentResult.accessToken);

          updateState({
            isAuthenticated: true,
            user,
            accessToken: silentResult.accessToken,
            loading: false,
          });

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

export function getAccessToken(): string | null {
  return authState.accessToken;
}

export function isAuthenticated(): boolean {
  return authState.isAuthenticated;
}
