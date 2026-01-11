/**
 * Authentication Service - MSAL Popup
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PublicClientApplication,
  BrowserAuthError,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';

// ============================================================================
// Config
// ============================================================================

const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID || '';

const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin + '/word-addin/taskpane.html',
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage' as const,
  },
};

const scopes = ['openid', 'profile', 'email', 'User.Read'];

// ============================================================================
// MSAL Instance
// ============================================================================

let msal: PublicClientApplication | null = null;
let msalInitialized = false;

async function getMsal(): Promise<PublicClientApplication> {
  if (!msal) {
    msal = new PublicClientApplication(msalConfig);
    await msal.initialize();

    // Handle redirect response (for popup callback)
    try {
      const response = await msal.handleRedirectPromise();
      if (response) {
        console.log('[Auth] Redirect response handled');
      }
    } catch (e) {
      console.error('[Auth] Error handling redirect:', e);
    }

    msalInitialized = true;
  }
  return msal;
}

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
// Auth Functions
// ============================================================================

async function login(): Promise<void> {
  updateState({ loading: true, error: null });

  try {
    const instance = await getMsal();

    console.log('[Auth] Starting popup login...');
    const result = await instance.loginPopup({ scopes });
    console.log('[Auth] Login successful');

    // Get user info from Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${result.accessToken}` },
    });
    const userData = await userResponse.json();

    updateState({
      isAuthenticated: true,
      user: {
        id: userData.id,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
      },
      accessToken: result.accessToken,
      loading: false,
    });
  } catch (e) {
    console.error('[Auth] Login failed:', e);
    updateState({ loading: false, error: (e as Error).message });
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

// ============================================================================
// Hook
// ============================================================================

export function useAuth() {
  const [state, setState] = useState(authState);

  useEffect(() => {
    const listener = () => setState({ ...authState });
    listeners.add(listener);
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
