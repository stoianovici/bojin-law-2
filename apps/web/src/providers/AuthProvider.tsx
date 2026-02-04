'use client';

import { MsalProvider, useMsal } from '@azure/msal-react';
import { EventType, type AuthenticationResult, PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest, mailScopes, graphScopes } from '@/lib/msal-config';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useRef, useState } from 'react';
import { setMsAccessTokenGetter } from '@/lib/apollo-client';

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

// Clear stuck MSAL state from storage
function clearMsalState() {
  if (typeof window === 'undefined') return;
  Object.keys(sessionStorage)
    .filter((k) => k.toLowerCase().includes('msal'))
    .forEach((k) => sessionStorage.removeItem(k));
}

// Initialize MSAL instance
function initializeMsal(): Promise<PublicClientApplication> {
  if (msalInitialized && msalInstance) return Promise.resolve(msalInstance);
  if (msalInitPromise) return msalInitPromise;

  // Clear stuck interaction state before initializing
  clearMsalState();

  const instance = getMsalInstance();
  msalInitPromise = instance
    .initialize()
    .then(() => {
      msalInitialized = true;
      // Handle redirect promise on initial load
      return instance.handleRedirectPromise().catch((error) => {
        // Ignore 'no_token_request_cache_error' - this is expected on normal page loads
        // when there's no pending redirect flow from Microsoft login
        const errorCode = (error as { errorCode?: string })?.errorCode;
        if (errorCode === 'no_token_request_cache_error') {
          // Silently ignore - this is normal behavior, not an error
          return;
        }
        console.error('[MSAL] Error handling redirect:', error);
        clearMsalState(); // Clear again if redirect handling fails
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
  dbRole?: 'Partner' | 'Associate' | 'AssociateJr' | 'BusinessOwner' | 'Paralegal';
  firmId: string;
  hasOperationalOversight?: boolean;
}

async function fetchUserProfile(accessToken: string): Promise<User | null> {
  // Call our API to get user profile with role from database
  try {
    // First try to get user from our API (which queries the gateway)
    const response = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const userData = await response.json();
      console.log(
        '[Auth] User profile fetched from API:',
        userData.email,
        userData.role,
        userData._dbRole,
        'hasOperationalOversight:',
        userData.hasOperationalOversight
      );
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        dbRole: userData._dbRole,
        firmId: userData.firmId || '',
        hasOperationalOversight: userData.hasOperationalOversight || false,
      };
    }

    console.warn('[Auth] API fetch failed, falling back to token decode');
  } catch (error) {
    console.warn('[Auth] Error fetching user profile from API:', error);
  }

  // Fallback: decode JWT payload if API fails
  try {
    const payload = accessToken.split('.')[1];
    const decoded = JSON.parse(atob(payload));

    return {
      id: decoded.oid || decoded.sub || '',
      email: decoded.email || decoded.preferred_username || '',
      name: decoded.name || '',
      role: 'LAWYER', // Default role when API unavailable
      firmId: decoded.tid || '', // Tenant ID as firm ID
    };
  } catch (error) {
    console.error('[Auth] Error decoding token:', error);
    return null;
  }
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const {
    setUser,
    setLoading,
    setTokens,
    clearAuth,
    isAuthenticated: storeAuthenticated,
  } = useAuthStore();
  const { instance, accounts, inProgress } = useMsal();
  const initializedRef = useRef(false);

  // Detect and fix auth state mismatch: store says authenticated but MSAL has no accounts
  // This happens when MSAL session expires but store data persists
  useEffect(() => {
    if (inProgress !== 'none') return; // Wait for MSAL to finish

    if (storeAuthenticated && accounts.length === 0) {
      console.warn(
        '[Auth] State mismatch: store authenticated but no MSAL accounts. Clearing auth and redirecting to login.'
      );
      clearAuth();
      // Redirect to login with return URL
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnUrl=${returnUrl}`;
      }
    }
  }, [storeAuthenticated, accounts.length, inProgress, clearAuth]);

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
        // Use combined scopes for both mail and SharePoint/OneDrive operations
        const response = await instance.acquireTokenSilent({
          scopes: [...mailScopes, ...graphScopes],
          account: activeAccount,
        });
        console.log('[Auth] MS token acquired successfully');
        return response.accessToken;
      } catch (error) {
        console.warn('[Auth] Silent token acquisition failed:', (error as Error)?.message || error);

        // If silent fails due to interaction required, try popup
        if ((error as { name?: string })?.name === 'InteractionRequiredAuthError') {
          try {
            console.log('[Auth] Trying interactive token acquisition...');
            const response = await instance.acquireTokenPopup({
              scopes: [...mailScopes, ...graphScopes],
            });
            console.log('[Auth] MS token acquired via popup');
            return response.accessToken;
          } catch (popupError) {
            console.error(
              '[Auth] Interactive token acquisition failed:',
              (popupError as Error)?.message || popupError
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
              // Navigate after successful login to avoid race condition
              // where useEffect in login page may not trigger due to state sync timing
              if (typeof window !== 'undefined') {
                const returnUrl = sessionStorage.getItem('returnUrl') || '/';
                sessionStorage.removeItem('returnUrl');
                // Use window.location for reliable navigation after auth
                window.location.href = returnUrl;
              }
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
