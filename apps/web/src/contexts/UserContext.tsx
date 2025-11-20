/**
 * User Context
 * Provides mock user data for testing navigation and role switching
 */

'use client';

import React, { createContext, useContext, type ReactNode } from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../stores/navigation.store';
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
 * Provides mock user data synchronized with navigation store's current role
 */
export function UserProvider({ children }: UserProviderProps) {
  const { currentRole } = useNavigationStore();

  // Mock user data
  const user: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alexandru.popescu@example.com',
    firstName: 'Alexandru',
    lastName: 'Popescu',
    role: currentRole,
    status: 'Active',
    firmId: '550e8400-e29b-41d4-a716-446655440001',
    azureAdId: 'azure-ad-id-12345',
    preferences: {},
    createdAt: new Date('2024-01-01'),
    lastActive: new Date(),
  };

  return (
    <UserContext.Provider value={{ user }}>
      {children}
    </UserContext.Provider>
  );
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
