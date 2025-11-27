/**
 * Dashboard Header Component
 * Story 2.11.4: Financial Dashboard UI
 *
 * Displays dashboard title and data scope indicator.
 * Shows "My Cases" (blue) for Partners, "Firm-wide" (purple) for BusinessOwners.
 */

'use client';

import React from 'react';
import { Building2, Briefcase } from 'lucide-react';
import { useFinancialDataScope } from '../../hooks/useFinancialDataScope';

export interface DashboardHeaderProps {
  /**
   * Optional additional class names
   */
  className?: string;
}

/**
 * DashboardHeader - Displays title and data scope badge
 *
 * @example
 * ```tsx
 * <DashboardHeader />
 * ```
 */
export function DashboardHeader({ className = '' }: DashboardHeaderProps) {
  const { scope, isBusinessOwner } = useFinancialDataScope();

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Panou Financiar</h1>

        {/* Data Scope Badge */}
        {scope && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full ${
              isBusinessOwner
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isBusinessOwner ? (
              <>
                <Building2 className="w-4 h-4" />
                Întreaga firmă
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4" />
                Dosarele mele
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export default DashboardHeader;
