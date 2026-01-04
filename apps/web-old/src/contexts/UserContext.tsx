/**
 * User Context
 * Provides authenticated user data from AuthContext
 */

'use client';

import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '../lib/hooks/useAuth';
import type { User } from '@legal-platform/types';

interface UserContextType {
  user: User;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export interface UserProviderProps {
  children: ReactNode;
}

/**
 * User Context Provider
 * Provides authenticated user data from AuthContext
 */
export function UserProvider({ children }: UserProviderProps) {
  const { user: authUser } = useAuth();

  // Use authenticated user from AuthContext
  // Fallback to minimal user object if not authenticated (shouldn't happen in protected routes)
  const user: User = authUser ?? {
    id: '',
    email: '',
    firstName: 'Guest',
    lastName: '',
    role: 'Associate',
    status: 'Pending',
    firmId: null,
    azureAdId: '',
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  };

  return <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>;
}

/**
 * Hook to access user context
 * @throws Error if used outside UserProvider
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
