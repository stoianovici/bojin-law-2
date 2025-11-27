/**
 * Financial Access Context
 * Story 2.8.3: Role-Based Financial Visibility
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 *
 * Manages financial data access permissions based on user role.
 * Partners and BusinessOwners have access to financial data.
 * - BusinessOwner: sees all firm cases ('firm' scope)
 * - Partner: sees only managed cases ('own' scope)
 * Associates and Paralegals see no financial information.
 */

'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

/**
 * Financial data scope type
 * Story 2.11.1: Determines how much financial data the user can see
 * - 'own': Partner can see only cases they manage (Lead role)
 * - 'firm': BusinessOwner can see all firm cases
 */
export type FinancialDataScope = 'own' | 'firm';

/**
 * Financial access context type
 */
export interface FinancialAccessContextType {
  /**
   * Whether the current user has access to financial data
   * true if user is Partner or BusinessOwner, false otherwise
   */
  hasFinancialAccess: boolean;

  /**
   * Whether the current user is a BusinessOwner
   * Story 2.11.1
   */
  isBusinessOwner: boolean;

  /**
   * Financial data scope
   * Story 2.11.1: 'firm' for BusinessOwner, 'own' for Partner, null for others
   */
  financialDataScope: FinancialDataScope | null;

  /**
   * User's role (for debugging/logging purposes)
   */
  userRole: string | null;
}

// Create context
const FinancialAccessContext = createContext<
  FinancialAccessContextType | undefined
>(undefined);

// Provider props
export interface FinancialAccessProviderProps {
  children: ReactNode;
}

/**
 * Financial Access Provider
 * Wraps the application and provides financial access state
 *
 * IMPORTANT: Must be rendered inside AuthProvider
 */
export function FinancialAccessProvider({
  children,
}: FinancialAccessProviderProps) {
  const { user, isAuthenticated } = useAuth();

  /**
   * Compute financial access
   * Story 2.11.1: Partners and BusinessOwners have access to financial data
   */
  const value = useMemo((): FinancialAccessContextType => {
    // Not authenticated - no access
    if (!isAuthenticated || !user) {
      return {
        hasFinancialAccess: false,
        isBusinessOwner: false,
        financialDataScope: null,
        userRole: null,
      };
    }

    // Check if user is BusinessOwner
    const isBusinessOwnerRole = user.role === 'BusinessOwner';

    // Check if user has financial access (Partner or BusinessOwner)
    const hasAccess = user.role === 'Partner' || isBusinessOwnerRole;

    // Determine financial data scope
    let scope: FinancialDataScope | null = null;
    if (isBusinessOwnerRole) {
      scope = 'firm';
    } else if (user.role === 'Partner') {
      scope = 'own';
    }

    return {
      hasFinancialAccess: hasAccess,
      isBusinessOwner: isBusinessOwnerRole,
      financialDataScope: scope,
      userRole: user.role,
    };
  }, [isAuthenticated, user]);

  return (
    <FinancialAccessContext.Provider value={value}>
      {children}
    </FinancialAccessContext.Provider>
  );
}

/**
 * Hook to access financial access context
 *
 * @returns Financial access state
 * @throws Error if used outside FinancialAccessProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasFinancialAccess } = useFinancialAccess();
 *
 *   if (!hasFinancialAccess) {
 *     return null; // Hide component for non-Partners
 *   }
 *
 *   return <div>Financial Data Here</div>;
 * }
 * ```
 */
export function useFinancialAccess(): FinancialAccessContextType {
  const context = useContext(FinancialAccessContext);
  if (!context) {
    throw new Error(
      'useFinancialAccess must be used within a FinancialAccessProvider'
    );
  }
  return context;
}
