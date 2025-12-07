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
  type ReactNode,
} from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { initializeMsal, loginRequest, getMsalInstance } from '@/lib/msal-config';
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
        console.log('[AuthContext] Session cookie valid, user:', data.user.email);
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
        const msalInstance = await initializeMsal();

        if (!msalInstance || !isMounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        setMsalInitialized(true);

        // Handle redirect response (if returning from Azure AD)
        const response = await msalInstance.handleRedirectPromise();

        if (response && response.account) {
          const token = response.accessToken;
          const user = await provisionUser(response.account, token);

          if (isMounted && user) {
            setState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              msalAccount: response.account,
            });
          }
          return;
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
            console.warn('Silent token acquisition failed:', error);
            if (isMounted) {
              setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
                msalAccount: null,
              });
            }
          }
        } else {
          // No MSAL accounts - check session cookie as fallback
          console.log('[AuthContext] No MSAL accounts, checking session cookie...');
          const sessionUser = await checkSessionCookie();

          if (isMounted) {
            if (sessionUser) {
              // Session cookie is valid - user is authenticated
              console.log('[AuthContext] Session cookie valid, user authenticated');
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
  }, [provisionUser, checkSessionCookie]);

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
   * Logout from Azure AD
   */
  const logout = useCallback(async () => {
    const msalInstance = getMsalInstance();

    if (!msalInstance) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        msalAccount: null,
      });
      return;
    }

    try {
      const account = state.msalAccount;

      await msalInstance.logoutRedirect({
        account: account || undefined,
        postLogoutRedirectUri: window.location.origin,
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
    }
  }, [state.msalAccount]);

  /**
   * Get access token for API calls
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const msalInstance = getMsalInstance();

    if (!msalInstance || !state.msalAccount) {
      return null;
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: state.msalAccount,
      });

      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          await msalInstance.acquireTokenRedirect(loginRequest);
        } catch (redirectError) {
          console.error('Token redirect error:', redirectError);
        }
      }
      return null;
    }
  }, [state.msalAccount]);

  /**
   * Refresh token (for compatibility with existing code)
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const token = await getAccessToken();
    return token !== null;
  }, [getAccessToken]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    getAccessToken,
    refreshToken,
    clearError,
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
