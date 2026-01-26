'use client';

import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { useAuthStore, type User } from '@/store/auth';
import { loginRequest } from '@/lib/msal';

// ============================================
// Types
// ============================================

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

// ============================================
// Hook
// ============================================

export function useAuth(): UseAuthReturn {
  const { instance } = useMsal();
  const {
    user,
    isAuthenticated,
    isLoading,
    setUser,
    setLoading,
    logout: clearAuth,
  } = useAuthStore();

  const login = useCallback(async () => {
    try {
      setLoading(true);
      // Redirect to Microsoft login
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('[useAuth] Login failed:', error);
      setLoading(false);
      throw error;
    }
  }, [instance, setLoading]);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      clearAuth();

      // Clear MSAL cache and redirect
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error('[useAuth] Logout failed:', error);
      setLoading(false);
      throw error;
    }
  }, [instance, setLoading, clearAuth]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}

// ============================================
// Auth Guard Hook
// ============================================

export function useRequireAuth(): UseAuthReturn & { isReady: boolean } {
  const auth = useAuth();

  // Ready when not loading
  const isReady = !auth.isLoading;

  return {
    ...auth,
    isReady,
  };
}
