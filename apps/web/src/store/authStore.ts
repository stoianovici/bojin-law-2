import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Role type definitions
export type UserRole = 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
export type DatabaseRole = 'Partner' | 'Associate' | 'AssociateJr' | 'BusinessOwner' | 'Paralegal';
export type CaseRole = 'Lead' | 'Support' | 'Observer';

// Role helper functions
export function isPartner(role: UserRole | string): boolean {
  return role === 'ADMIN';
}

export function isPartnerDb(dbRole?: DatabaseRole | string): boolean {
  return dbRole === 'Partner' || dbRole === 'BusinessOwner';
}

export function isAssociateOrAbove(dbRole?: DatabaseRole | string): boolean {
  return dbRole === 'Partner' || dbRole === 'BusinessOwner' || dbRole === 'Associate';
}

export function isAssignmentBasedRole(dbRole?: DatabaseRole | string): boolean {
  return dbRole === 'AssociateJr' || dbRole === 'Paralegal';
}

export function canViewFinancials(role: UserRole | string): boolean {
  return role === 'ADMIN';
}

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  dbRole?: DatabaseRole;
  firmId: string;
  hasOperationalOversight?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  graphToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;

  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, graphToken?: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      graphToken: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (accessToken, graphToken) => set({ accessToken, graphToken }),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          graphToken: null,
          isAuthenticated: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Security: session only
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }), // Don't persist tokens
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
