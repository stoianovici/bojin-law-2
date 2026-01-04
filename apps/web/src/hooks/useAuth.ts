import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { useAuthStore } from '@/store/authStore';
import { loginRequest, graphScopes, mailScopes } from '@/lib/msal-config';
import { getGatewayMode, type GatewayMode } from '@/hooks/useGateway';

// Dev mode bypass - set via URL param ?devAuth=true or env var
const isDevAuthEnabled = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.search.includes('devAuth=true') ||
    process.env.NEXT_PUBLIC_DEV_AUTH === 'true' ||
    process.env.NODE_ENV === 'development'
  );
};

// Test users for development - one for each gateway mode
const DEV_TEST_USERS: Record<
  GatewayMode,
  {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
    firmId: string;
  }
> = {
  seed: {
    id: 'aa3992a2-4bb0-45e2-9bc5-15e75f6a5793',
    email: 'partner@demo.lawfirm.ro',
    name: 'Demo Partner',
    role: 'ADMIN',
    firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b',
  },
  real: {
    id: 'b2592964-a904-4432-8b39-07bb209a7624',
    email: 'lucian.bojin@bojin-law.com',
    name: 'Lucian Bojin',
    role: 'ADMIN',
    firmId: 'f8f501d6-4444-4d5c-bc4b-a5c8ab0ec7fb',
  },
  // Production mode uses real auth - this is fallback for dev testing
  production: {
    id: 'b2592964-a904-4432-8b39-07bb209a7624',
    email: 'lucian.bojin@bojin-law.com',
    name: 'Lucian Bojin',
    role: 'ADMIN',
    firmId: 'f8f501d6-4444-4d5c-bc4b-a5c8ab0ec7fb',
  },
};

// Get the appropriate dev user based on gateway mode
const getDevTestUser = () => DEV_TEST_USERS[getGatewayMode()];

// Valid test credentials
const TEST_CREDENTIALS = {
  username: 'test',
  password: 'test',
};

export function useAuth() {
  const { instance, accounts } = useMsal();
  const msalAuthenticated = useIsAuthenticated();
  const {
    user,
    isAuthenticated,
    isLoading,
    _hasHydrated,
    setUser,
    setTokens,
    clearAuth,
    setLoading,
  } = useAuthStore();

  // In dev mode with devAuth, bypass MSAL check
  const devMode = isDevAuthEnabled();

  const login = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    clearAuth();
    if (!devMode) {
      await instance.logoutRedirect();
    }
  };

  const devLogin = (username: string, password: string): boolean => {
    if (username === TEST_CREDENTIALS.username && password === TEST_CREDENTIALS.password) {
      setUser(getDevTestUser());
      setLoading(false);
      return true;
    }
    return false;
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      // Fallback to interactive if silent fails
      await instance.acquireTokenRedirect(loginRequest);
      return null;
    }
  };

  const getGraphToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const response = await instance.acquireTokenSilent({
        scopes: graphScopes,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      await instance.acquireTokenRedirect({ scopes: graphScopes });
      return null;
    }
  };

  const getMailToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const response = await instance.acquireTokenSilent({
        scopes: mailScopes,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      // Return null gracefully if user hasn't consented to mail scopes
      console.warn('Mail token acquisition failed:', error);
      return null;
    }
  };

  return {
    user,
    // In dev mode, derive auth from user presence; in prod, require both MSAL and store
    isAuthenticated: devMode ? !!user : msalAuthenticated && isAuthenticated,
    // In dev mode, wait for store hydration; in prod, use normal loading state
    isLoading: devMode ? !_hasHydrated : isLoading,
    isDevMode: devMode,
    login,
    logout,
    devLogin,
    getAccessToken,
    getGraphToken,
    getMailToken,
  };
}
