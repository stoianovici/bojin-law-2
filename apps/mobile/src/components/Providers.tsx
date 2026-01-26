'use client';

import { ApolloProvider } from '@apollo/client/react';
import { PublicClientApplication, EventType, type AuthenticationResult } from '@azure/msal-browser';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { useEffect, useState, useRef } from 'react';
import { apolloClient, setMsAccessTokenGetter } from '@/lib/apollo';
import { msalConfig, graphScopes, loginRequest } from '@/lib/msal';
import { useAuthStore } from '@/store/auth';

// ============================================
// MSAL Instance Management
// ============================================

let msalInstance: PublicClientApplication | null = null;
let msalInitialized = false;
let msalInitPromise: Promise<PublicClientApplication> | null = null;

function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

// Clear only stuck interaction state, not auth tokens
function clearStuckInteractionState() {
  if (typeof window === 'undefined') return;
  // Only clear session storage (interaction state), not localStorage (auth tokens)
  Object.keys(sessionStorage)
    .filter((k) => k.toLowerCase().includes('msal'))
    .forEach((k) => sessionStorage.removeItem(k));
}

function initializeMsal(): Promise<PublicClientApplication> {
  if (msalInitialized && msalInstance) return Promise.resolve(msalInstance);
  if (msalInitPromise) return msalInitPromise;

  clearStuckInteractionState();

  const instance = getMsalInstance();
  msalInitPromise = instance
    .initialize()
    .then(() => instance.handleRedirectPromise())
    .catch((error) => {
      // Ignore expected errors
      const errorCode = (error as { errorCode?: string })?.errorCode;
      if (errorCode !== 'no_token_request_cache_error') {
        console.error('[MSAL] Error handling redirect:', error);
      }
    })
    .then(() => {
      msalInitialized = true;
      return instance;
    });

  return msalInitPromise;
}

// ============================================
// Auth Initializer Component
// ============================================

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, logout: clearAuth } = useAuthStore();
  const { instance, accounts, inProgress } = useMsal();
  const initializedRef = useRef(false);

  // Set up MS access token getter for Apollo
  useEffect(() => {
    setMsAccessTokenGetter(async () => {
      const activeAccount = instance.getActiveAccount() || instance.getAllAccounts()[0];
      if (!activeAccount) return null;

      try {
        const response = await instance.acquireTokenSilent({
          scopes: graphScopes,
          account: activeAccount,
        });
        return response.accessToken;
      } catch (error) {
        console.warn('[Auth] Silent token acquisition failed:', error);
        return null;
      }
    });
  }, [instance]);

  // Handle authentication state
  useEffect(() => {
    if (initializedRef.current) return;
    if (inProgress !== 'none') return; // Wait for MSAL to finish

    // No accounts = no logged in user
    if (accounts.length === 0) {
      console.log('[Auth] No accounts found, user not logged in');
      initializedRef.current = true;
      setLoading(false);
      return;
    }

    // User has an account, try to get token
    const activeAccount = accounts[0];
    console.log('[Auth] Found account:', activeAccount.username);

    instance
      .acquireTokenSilent({
        ...loginRequest,
        account: activeAccount,
      })
      .then((response) => {
        initializedRef.current = true;
        // Decode basic user info from token
        const payload = response.accessToken.split('.')[1];
        const decoded = JSON.parse(atob(payload));

        setUser({
          id: decoded.oid || decoded.sub || '',
          email: decoded.email || decoded.preferred_username || '',
          name: decoded.name || '',
          role: 'LAWYER', // Default, real role comes from API
          firmId: decoded.tid || '',
        });
      })
      .catch((error) => {
        console.warn('[Auth] Silent token acquisition failed:', error);
        initializedRef.current = true;
        setLoading(false);
      });
  }, [accounts, inProgress, instance, setUser, setLoading]);

  // Handle login/logout events
  useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const authResult = event.payload as AuthenticationResult;
        const payload = authResult.accessToken.split('.')[1];
        const decoded = JSON.parse(atob(payload));

        setUser({
          id: decoded.oid || decoded.sub || '',
          email: decoded.email || decoded.preferred_username || '',
          name: decoded.name || '',
          role: 'LAWYER',
          firmId: decoded.tid || '',
        });
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
  }, [instance, setUser, clearAuth]);

  return <>{children}</>;
}

// ============================================
// Providers Component
// ============================================

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [initializedInstance, setInitializedInstance] = useState<PublicClientApplication | null>(
    msalInitialized ? msalInstance : null
  );

  useEffect(() => {
    if (!initializedInstance) {
      initializeMsal().then((instance) => setInitializedInstance(instance));
    }
  }, [initializedInstance]);

  if (!initializedInstance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <MsalProvider instance={initializedInstance}>
      <ApolloProvider client={apolloClient}>
        <AuthInitializer>{children}</AuthInitializer>
      </ApolloProvider>
    </MsalProvider>
  );
}
