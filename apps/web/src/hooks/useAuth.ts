/**
 * Authentication hook - MS auth only, no dev mode
 */
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useAuthStore } from '@/store/authStore';
import { loginRequest, graphScopes, mailScopes } from '@/lib/msal-config';

export function useAuth() {
  const { instance, accounts, inProgress } = useMsal();
  const msalAuthenticated = useIsAuthenticated();
  const { user, isAuthenticated, isLoading, clearAuth } = useAuthStore();

  const login = async () => {
    // Prevent multiple concurrent login attempts
    if (inProgress !== InteractionStatus.None) {
      console.log('[Auth] Interaction already in progress, skipping');
      return;
    }

    try {
      const response = await instance.loginPopup(loginRequest);
      if (response?.account) {
        instance.setActiveAccount(response.account);
      }
    } catch (error) {
      const errorCode = (error as { errorCode?: string })?.errorCode;
      if (errorCode === 'user_cancelled' || errorCode === 'interaction_in_progress') {
        return;
      }
      console.error('[Auth] Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    clearAuth();
    await instance.logoutRedirect();
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch {
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
    } catch {
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
      console.warn('Mail token acquisition failed:', error);
      return null;
    }
  };

  return {
    user,
    isAuthenticated: msalAuthenticated && isAuthenticated,
    isLoading,
    login,
    logout,
    getAccessToken,
    getGraphToken,
    getMailToken,
  };
}
