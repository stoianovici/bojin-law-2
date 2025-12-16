/**
 * useFinancialDataScope Hook
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 *
 * Hook for accessing financial data scope based on user role.
 * - BusinessOwner: 'firm' scope (sees all firm cases)
 * - Partner: 'own' scope (sees only managed cases)
 * - Others: null scope (no financial access)
 */

import { useFinancialAccess, type FinancialDataScope } from '../contexts/FinancialAccessContext';

/**
 * Return type for useFinancialDataScope hook
 */
export interface UseFinancialDataScopeReturn {
  /**
   * Financial data scope
   * - 'firm': BusinessOwner can see all firm cases
   * - 'own': Partner can see only cases they manage
   * - null: No financial access
   */
  scope: FinancialDataScope | null;

  /**
   * Whether the current user is a BusinessOwner
   */
  isBusinessOwner: boolean;

  /**
   * Whether the current user has any financial access
   */
  hasAccess: boolean;
}

/**
 * Hook to get financial data scope for the current user
 *
 * @returns Financial data scope information
 *
 * @example
 * ```tsx
 * function FinancialDashboard() {
 *   const { scope, isBusinessOwner, hasAccess } = useFinancialDataScope();
 *
 *   if (!hasAccess) {
 *     return <AccessDenied />;
 *   }
 *
 *   if (scope === 'firm') {
 *     return <FirmWideFinancials />; // BusinessOwner view
 *   }
 *
 *   return <MyCaseFinancials />; // Partner view (own cases only)
 * }
 * ```
 */
export function useFinancialDataScope(): UseFinancialDataScopeReturn {
  const { financialDataScope, isBusinessOwner, hasFinancialAccess } = useFinancialAccess();

  return {
    scope: financialDataScope,
    isBusinessOwner,
    hasAccess: hasFinancialAccess,
  };
}

export default useFinancialDataScope;
