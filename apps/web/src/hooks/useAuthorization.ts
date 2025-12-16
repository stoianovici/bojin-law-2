/**
 * Authorization Hook
 * Provides role-based access control for UI components
 * Story 2.4.1: Partner User Management
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/hooks/useAuth';
import type { UserRole } from '@legal-platform/types';

/**
 * Hook to require a specific role for accessing a page/component
 * Redirects to /403 if user doesn't have required role
 *
 * @param requiredRole - The role required to access the resource
 * @returns Object with authorized flag
 */
export function useRequireRole(requiredRole: UserRole) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== requiredRole)) {
      router.push('/403');
    }
  }, [user, isLoading, requiredRole, router]);

  return {
    authorized: user?.role === requiredRole,
    isLoading,
  };
}

/**
 * Hook to check if user has a specific role without redirecting
 *
 * @param role - The role to check
 * @returns Boolean indicating if user has the role
 */
export function useHasRole(role: UserRole): boolean {
  const { user } = useAuth();
  return user?.role === role;
}

/**
 * Hook to check if user has any of the specified roles
 *
 * @param roles - Array of roles to check
 * @returns Boolean indicating if user has any of the roles
 */
export function useHasAnyRole(roles: UserRole[]): boolean {
  const { user } = useAuth();
  return user ? roles.includes(user.role) : false;
}

/**
 * Hook for simple role-based authorization checks
 * Story 2.8.2: Case Approval Workflow
 * Story 2.11.1: Added BusinessOwner role support
 *
 * @returns Object with role flags and financial access flag
 */
export function useAuthorization() {
  const { user } = useAuth();

  const isBusinessOwner = user?.role === 'BusinessOwner';
  const isPartner = user?.role === 'Partner';

  return {
    isBusinessOwner, // Story 2.11.1
    isPartner,
    isAssociate: user?.role === 'Associate',
    isParalegal: user?.role === 'Paralegal',
    // Story 2.11.1: BusinessOwners also have financial access
    canAccessFinancials: isPartner || isBusinessOwner,
  };
}
