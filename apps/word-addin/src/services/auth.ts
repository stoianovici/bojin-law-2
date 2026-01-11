/**
 * Authentication Service - Office SSO
 *
 * Uses Office.auth.getAccessToken() for seamless authentication.
 * No popups, no user interaction - just works if user is signed into Office.
 */

import { useState, useEffect, useCallback } from 'react';

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
// Auth Functions
// ============================================================================

async function login(): Promise<void> {
  updateState({ loading: true, error: null });

  try {
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

    // Handle specific Office SSO errors
    let errorMessage = error.message || 'Authentication failed';
    if (error.code === 13003) {
      errorMessage = 'Please sign in to Office first';
    } else if (error.code === 13001) {
      errorMessage = 'User is not signed in to Office';
    } else if (error.code === 13002) {
      errorMessage = 'Consent required - please contact admin';
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

// Auto-login on load (silent SSO)
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
    console.log('[Auth] Auto-login not available:', (e as Error).message);
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
