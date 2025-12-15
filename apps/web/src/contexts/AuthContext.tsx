'use client';

/**
 * Authentication Context
 * Provides Azure AD authentication via MSAL with user provisioning
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, getMsalInstance, handleMsalRedirect } from '@/lib/msal-config';
import { setMsAccessTokenGetter } from '@/lib/apollo-client';
import type { User } from '@legal-platform/types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  msalAccount: AccountInfo | null;
}

export interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  /** Whether an MSAL account is available for MS Graph API access */
  hasMsalAccount: boolean;
  /** Trigger Microsoft re-authentication (for email access) */
  reconnectMicrosoft: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    msalAccount: null,
  });

  const [msalInitialized, setMsalInitialized] = useState(false);
  const [hasMsalAccountState, setHasMsalAccountState] = useState(false);

  /**
   * Update hasMsalAccount state based on current MSAL accounts
   */
  const updateHasMsalAccount = useCallback(() => {
    const msalInstance = getMsalInstance();
    if (!msalInstance) {
      setHasMsalAccountState(false);
      return;
    }
    const accounts = msalInstance.getAllAccounts();
    setHasMsalAccountState(accounts.length > 0);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Check session cookie for existing authentication
   * Fallback when MSAL has no cached tokens
   */
  const checkSessionCookie = useCallback(async (): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.authenticated && data.user) {
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('[AuthContext] Session check error:', error);
      return null;
    }
  }, []);

  /**
   * Provision user in database after Azure AD login
   */
  const provisionUser = useCallback(
    async (account: AccountInfo, accessToken: string): Promise<User | null> => {
      try {
        const response = await fetch('/api/auth/provision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            idTokenClaims: account.idTokenClaims,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to provision user');
        }

        const data = await response.json();
        return data.user;
      } catch (error) {
        console.error('User provisioning error:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Initialize MSAL and check for existing session
   */
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        // Use singleton handleMsalRedirect to prevent duplicate processing
        const response = await handleMsalRedirect();

        const msalInstance = getMsalInstance();
        if (!msalInstance || !isMounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        setMsalInitialized(true);
        // Update MSAL account state immediately after initialization
        updateHasMsalAccount();

        // Handle redirect response (if returning from Azure AD)
        if (response && response.account) {
          const token = response.accessToken;
          try {
            const user = await provisionUser(response.account, token);

            if (isMounted && user) {
              setState({
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                msalAccount: response.account,
              });
              return;
            }
          } catch (error) {
            // Provisioning failed, check session cookie as fallback
            const sessionUser = await checkSessionCookie();
            if (isMounted && sessionUser) {
              setState({
                user: sessionUser,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                msalAccount: null,
              });
              return;
            }
          }
        }

        // Check for existing accounts
        const accounts = msalInstance.getAllAccounts();

        if (accounts.length > 0) {
          const account = accounts[0];

          try {
            const tokenResponse = await msalInstance.acquireTokenSilent({
              ...loginRequest,
              account,
            });

            const user = await provisionUser(account, tokenResponse.accessToken);

            if (isMounted && user) {
              setState({
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                msalAccount: account,
              });
            }
          } catch (error) {
            // Fall back to session cookie when MSAL fails
            const sessionUser = await checkSessionCookie();
            if (isMounted) {
              if (sessionUser) {
                setState({
                  user: sessionUser,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                  msalAccount: null,
                });
              } else {
                setState({
                  user: null,
                  isAuthenticated: false,
                  isLoading: false,
                  error: null,
                  msalAccount: null,
                });
              }
            }
          }
        } else {
          // No MSAL accounts - check session cookie as fallback
          const sessionUser = await checkSessionCookie();

          if (isMounted) {
            if (sessionUser) {
              setState({
                user: sessionUser,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                msalAccount: null, // No MSAL account, but session is valid
              });
            } else {
              // No MSAL account and no valid session cookie
              setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
                msalAccount: null,
              });
            }
          }
        }
      } catch (error) {
        console.error('MSAL initialization error:', error);
        if (isMounted) {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Failed to initialize authentication',
            msalAccount: null,
          });
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [provisionUser, checkSessionCookie, updateHasMsalAccount]);

  /**
   * Login via Azure AD redirect
   */
  const login = useCallback(async () => {
    const msalInstance = getMsalInstance();

    if (!msalInstance || !msalInitialized) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication not ready. Please refresh the page.',
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await msalInstance.loginRedirect(loginRequest);
    } catch (error: unknown) {
      console.error('Login error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed. Please try again.',
      }));
    }
  }, [msalInitialized]);

  /**
   * Logout from Azure AD and clear session cookie
   */
  const logout = useCallback(async () => {
    // First, clear the session cookie via API
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      // Ignore logout errors - redirect will clear state anyway
    }

    const msalInstance = getMsalInstance();

    if (!msalInstance) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        msalAccount: null,
      });
      // Redirect to login page
      window.location.href = '/login';
      return;
    }

    try {
      const account = state.msalAccount;

      await msalInstance.logoutRedirect({
        account: account || undefined,
        postLogoutRedirectUri: window.location.origin + '/login',
      });
    } catch (error) {
      console.error('Logout error:', error);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        msalAccount: null,
      });
      // Redirect to login page on error
      window.location.href = '/login';
    }
  }, [state.msalAccount]);

  /**
   * Get access token for API calls
   * This tries to acquire a token silently, falling back to checking for any MSAL accounts
   * when the user was authenticated via session cookie only.
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const msalInstance = getMsalInstance();

    if (!msalInstance) {
      return null;
    }

    // If we have a cached msalAccount, use it directly
    if (state.msalAccount) {
      try {
        const response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: state.msalAccount,
        });
        return response.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          setHasMsalAccountState(false);
        }
        return null;
      }
    }

    // No cached msalAccount - try to find any MSAL accounts (may have been cached by browser)
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        return response.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          setHasMsalAccountState(false);
        }
        return null;
      }
    }

    // No MSAL accounts available - user needs to re-authenticate with Microsoft
    return null;
  }, [state.msalAccount]);

  /**
   * Refresh token (for compatibility with existing code)
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const token = await getAccessToken();
    return token !== null;
  }, [getAccessToken]);

  /**
   * Reconnect Microsoft account - tries SSO first, then falls back to redirect
   * Used when user is authenticated via session cookie but needs MS Graph access
   */
  const reconnectMicrosoft = useCallback(async () => {
    const msalInstance = getMsalInstance();

    if (!msalInstance) {
      setState((prev) => ({
        ...prev,
        error: 'Authentication not ready. Please refresh the page.',
      }));
      return;
    }

    try {
      // Try SSO (silent login using existing browser session with Microsoft)
      const ssoResult = await msalInstance.ssoSilent({
        ...loginRequest,
        loginHint: state.user?.email,
      });

      if (ssoResult && ssoResult.account) {
        setHasMsalAccountState(true);
        setState((prev) => ({
          ...prev,
          msalAccount: ssoResult.account,
        }));
        return;
      }
    } catch (ssoError) {
      // SSO failed, will try redirect
    }

    // SSO failed, use redirect login
    try {
      await msalInstance.loginRedirect(loginRequest);
    } catch (error: unknown) {
      console.error('Microsoft reconnect error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect Microsoft account.',
      }));
    }
  }, [state.user?.email]);

  /**
   * Keep hasMsalAccountState in sync with state.msalAccount
   */
  useEffect(() => {
    if (state.msalAccount) {
      setHasMsalAccountState(true);
    }
    // Note: We don't set to false here because MSAL accounts may exist
    // in browser storage even when state.msalAccount is null
  }, [state.msalAccount]);

  /**
   * Register MS access token getter with Apollo client
   * This allows GraphQL requests to include the MS access token for email operations
   */
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  useEffect(() => {
    // Set up the token getter for Apollo client
    setMsAccessTokenGetter(() => getAccessTokenRef.current());
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    getAccessToken,
    refreshToken,
    clearError,
    hasMsalAccount: hasMsalAccountState,
    reconnectMicrosoft,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
