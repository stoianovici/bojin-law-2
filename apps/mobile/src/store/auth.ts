/**
 * Auth Store for Mobile
 * Manages user authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
  firmId: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'mobile-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
