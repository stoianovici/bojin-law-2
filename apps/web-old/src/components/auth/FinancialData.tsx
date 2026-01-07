/**
 * FinancialData Component
 * Story 2.8.3: Role-Based Financial Visibility
 *
 * Wrapper component that conditionally renders financial data based on user role.
 * Only Partners see financial data. Associates and Paralegals see nothing.
 *
 * Key Features:
 * - Renders children only for Partners
 * - Returns null for non-Partners (no placeholders, no "Permission Denied")
 * - Optional fallback content
 * - Clean UI with no gaps when hidden
 */

'use client';

import { type ReactNode } from 'react';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';

export interface FinancialDataProps {
  /**
   * Content to render if user has financial access
   */
  children: ReactNode;

  /**
   * Optional fallback content to render if user lacks financial access
   * Default: null (renders nothing)
   *
   * @example
   * ```tsx
   * <FinancialData fallback={<div>Not authorized</div>}>
   *   <BillingInfo />
   * </FinancialData>
   * ```
   */
  fallback?: ReactNode;
}

/**
 * FinancialData Wrapper Component
 *
 * Conditionally renders children based on financial access permissions.
 * Partners see children, non-Partners see fallback (default: null).
 *
 * @example
 * ```tsx
 * // Hide billing section from Associates/Paralegals
 * <FinancialData>
 *   <BillingInfoSection case={caseData} />
 * </FinancialData>
 *
 * // Hide table column
 * <FinancialData>
 *   <TableColumn header="Case Value">
 *     {formatCurrency(case.value)}
 *   </TableColumn>
 * </FinancialData>
 *
 * // With custom fallback
 * <FinancialData fallback={<div>Restricted</div>}>
 *   <FinancialChart />
 * </FinancialData>
 * ```
 */
export function FinancialData({ children, fallback = null }: FinancialDataProps) {
  const { hasFinancialAccess } = useFinancialAccess();

  // Non-Partners see fallback (default: null)
  if (!hasFinancialAccess) {
    return <>{fallback}</>;
  }

  // Partners see children
  return <>{children}</>;
}
