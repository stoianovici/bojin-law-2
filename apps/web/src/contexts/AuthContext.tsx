/**
 * Authentication Context
 * Manages user authentication state, login/logout flows, and token refresh
 * Story 2.4: Authentication with Azure AD
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@legal-platform/types';

// Authentication state interface
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Authentication context type
export interface AuthContextType extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

// Create context - exported for testing purposes
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider
 * Manages authentication state and provides login/logout methods
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Initialize authentication state on mount
   * Checks for existing session and validates it
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user has active session by calling a protected endpoint
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Include session cookie
        });

        if (response.ok) {
          const userData = await response.json();
          setState({
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          // No active session
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Failed to initialize authentication',
        });
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login method
   * Redirects to backend OAuth login endpoint
   */
  const login = useCallback(() => {
    // Redirect to backend login endpoint which initiates OAuth flow
    window.location.href = 'http://localhost:4000/auth/login';
  }, []);

  /**
   * Logout method
   * Calls backend logout endpoint and clears local state
   */
  const logout = useCallback(async () => {
    try {
      // Call backend logout endpoint
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include session cookie
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      // Clear authentication state
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to logout. Please try again.',
      }));
    }
  }, []);

  /**
   * Refresh access token
   * Exchanges refresh token for new access token
   * Returns true if successful, false otherwise
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include session cookie with refresh token
      });

      if (response.ok) {
        const data = await response.json();

        // Update user data if returned
        if (data.user) {
          setState((prev) => ({
            ...prev,
            user: data.user,
            isAuthenticated: true,
          }));
        }

        return true;
      } else {
        // Refresh token expired or invalid
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Session expired. Please login again.',
        });
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired. Please login again.',
      });
      return false;
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
