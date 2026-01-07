'use client';

import { MsalProvider, useMsal } from '@azure/msal-react';
import { EventType, type AuthenticationResult, PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest, mailScopes } from '@/lib/msal-config';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useRef, useState } from 'react';
import { setMsAccessTokenGetter } from '@/lib/apollo-client';
import { getGatewayMode, type GatewayMode } from '@/hooks/useGateway';

// MSAL instance singleton - lazy initialized
let msalInstance: PublicClientApplication | null = null;
let msalInitialized = false;
let msalInitPromise: Promise<PublicClientApplication> | null = null;

// Get or create MSAL instance (lazy)
function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

// Initialize MSAL instance
function initializeMsal(): Promise<PublicClientApplication> {
  if (msalInitialized && msalInstance) return Promise.resolve(msalInstance);
  if (msalInitPromise) return msalInitPromise;

  const instance = getMsalInstance();
  msalInitPromise = instance
    .initialize()
    .then(() => {
      msalInitialized = true;
      // Handle redirect promise on initial load
      return instance.handleRedirectPromise().catch((error) => {
        console.error('[MSAL] Error handling redirect:', error);
      });
    })
    .then(() => instance);

  return msalInitPromise;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
  firmId: string;
}

// Test users for development - one for each gateway mode
const DEV_TEST_USERS: Record<GatewayMode, User> = {
  // Seed mode: uses real Bojin-law data (production backup)
  seed: {
    id: 'b2592964-a904-4432-8b39-07bb209a7624',
    email: 'lucian.bojin@bojin-law.com',
    name: 'Lucian Bojin',
    role: 'ADMIN',
    firmId: 'f8f501d6-4444-4d5c-bc4b-a5c8ab0ec7fb', // Bojin-law Law Firm
  },
  // Real mode: uses actual Bojin-law firm data
  real: {
    id: 'b2592964-a904-4432-8b39-07bb209a7624',
    email: 'lucian.bojin@bojin-law.com',
    name: 'Lucian Bojin',
    role: 'ADMIN',
    firmId: 'f8f501d6-4444-4d5c-bc4b-a5c8ab0ec7fb', // Bojin-law Law Firm (real)
  },
  // Production mode: uses real auth, this is fallback for dev testing
  production: {
    id: 'b2592964-a904-4432-8b39-07bb209a7624',
    email: 'lucian.bojin@bojin-law.com',
    name: 'Lucian Bojin',
    role: 'ADMIN',
    firmId: 'f8f501d6-4444-4d5c-bc4b-a5c8ab0ec7fb', // Bojin-law Law Firm (production)
  },
};

async function fetchUserProfile(accessToken: string): Promise<User | null> {
  // In development, use test user that matches current gateway mode
  if (process.env.NODE_ENV === 'development') {
    const mode = getGatewayMode();
    return DEV_TEST_USERS[mode];
  }

  // TODO: In production, call backend API to get user profile
  try {
    // Decode JWT payload (base64)
    const payload = accessToken.split('.')[1];
    const decoded = JSON.parse(atob(payload));

    return {
      id: decoded.oid || decoded.sub || '',
      email: decoded.email || decoded.preferred_username || '',
      name: decoded.name || '',
      role: 'LAWYER', // Default role - should come from backend
      firmId: decoded.tid || '', // Tenant ID as firm ID
    };
  } catch (error) {
    console.error('[Auth] Error decoding token:', error);
    return null;
  }
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setTokens, clearAuth } = useAuthStore();
  const { instance, accounts, inProgress } = useMsal();
  const initializedRef = useRef(false);

  // Set up MS access token getter for Apollo Client on mount
  useEffect(() => {
    const getMsAccessToken = async (): Promise<string | null> => {
      try {
        const activeAccount = instance.getActiveAccount() || instance.getAllAccounts()[0];
        if (!activeAccount) {
          console.log('[Auth] No active account for MS token');
          return null;
        }

        console.log('[Auth] Acquiring MS token for account:', activeAccount.username);
        const response = await instance.acquireTokenSilent({
          scopes: mailScopes,
          account: activeAccount,
        });
        console.log('[Auth] MS token acquired successfully');
        return response.accessToken;
      } catch (error: any) {
        console.warn('[Auth] Silent token acquisition failed:', error?.message || error);

        // If silent fails due to interaction required, try popup
        if (error?.name === 'InteractionRequiredAuthError') {
          try {
            console.log('[Auth] Trying interactive token acquisition...');
            const response = await instance.acquireTokenPopup({
              scopes: mailScopes,
            });
            console.log('[Auth] MS token acquired via popup');
            return response.accessToken;
          } catch (popupError: any) {
            console.error(
              '[Auth] Interactive token acquisition failed:',
              popupError?.message || popupError
            );
          }
        }
        return null;
      }
    };

    setMsAccessTokenGetter(getMsAccessToken);
    console.log('[Auth] MS token getter registered');
  }, [instance]);

  // Handle authentication - check if there's an active account
  useEffect(() => {
    if (initializedRef.current) return;

    // Wait for MSAL to finish any in-progress operations
    if (inProgress !== 'none') return;

    // In development mode, auto-login with test user (no MSAL required)
    if (process.env.NODE_ENV === 'development' && accounts.length === 0) {
      const mode = getGatewayMode();
      const testUser = DEV_TEST_USERS[mode];
      console.log('[Auth] Development mode: auto-login with test user', testUser.email);
      setUser(testUser);
      setTokens('dev-token');
      initializedRef.current = true;
      setLoading(false);
      return;
    }

    // No accounts = no logged in user, stop loading
    if (accounts.length === 0) {
      initializedRef.current = true;
      setLoading(false);
      return;
    }

    // User has an account, try to get token silently
    const activeAccount = accounts[0];
    instance
      .acquireTokenSilent({
        ...loginRequest,
        account: activeAccount,
      })
      .then((response) => {
        initializedRef.current = true;
        return fetchUserProfile(response.accessToken).then((user) => {
          if (user) {
            setUser(user);
            setTokens(response.accessToken);
          }
        });
      })
      .catch((error) => {
        console.warn('[Auth] Silent token acquisition failed:', error);
        initializedRef.current = true;
      })
      .finally(() => setLoading(false));
  }, [accounts, inProgress, instance, setUser, setTokens, setLoading]);

  // Handle account changes (login/logout events)
  useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const authResult = event.payload as AuthenticationResult;
        fetchUserProfile(authResult.accessToken)
          .then((user) => {
            if (user) {
              setUser(user);
              setTokens(authResult.accessToken);
            }
          })
          .finally(() => setLoading(false));
      }

      if (event.eventType === EventType.LOGOUT_SUCCESS) {
        clearAuth();
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance, setUser, setTokens, setLoading, clearAuth]);

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializedInstance, setInitializedInstance] = useState<PublicClientApplication | null>(
    msalInitialized ? msalInstance : null
  );

  useEffect(() => {
    if (!initializedInstance) {
      initializeMsal().then((instance) => setInitializedInstance(instance));
    }
  }, [initializedInstance]);

  if (!initializedInstance) {
    // Show loading while MSAL initializes
    return (
      <div className="flex h-screen items-center justify-center bg-linear-bg-primary">
        <div className="animate-spin h-8 w-8 border-2 border-linear-accent border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <MsalProvider instance={initializedInstance}>
      <AuthInitializer>{children}</AuthInitializer>
    </MsalProvider>
  );
}
