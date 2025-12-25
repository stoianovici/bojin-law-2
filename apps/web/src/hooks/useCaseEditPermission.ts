/**
 * Case Edit Permission Hook
 * Provides centralized permission check for case editing
 * OPS-207: Part of Expandable Case Workspace Epic
 *
 * Edit permissions are granted to:
 * - Partners (any case)
 * - BusinessOwners (any case, including financials)
 * - Leads (their assigned cases, excluding financials)
 */

'use client';

import { useMemo } from 'react';
import { useAuth } from '../lib/hooks/useAuth';
import { useCase } from './useCase';

// ============================================================================
// Types
// ============================================================================

export type EditReason = 'partner' | 'businessOwner' | 'lead' | null;

export interface CaseEditPermission {
  /** Whether user can edit case details */
  canEdit: boolean;
  /** Whether user can edit financial data (only Partners and BusinessOwners) */
  canEditFinancials: boolean;
  /** Reason for edit permission, null if no permission */
  editReason: EditReason;
  /** Loading state while fetching case data */
  isLoading: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to check if the current user can edit a case
 *
 * @param caseId - The case ID to check permissions for
 * @returns Permission object with canEdit, canEditFinancials, editReason, and isLoading
 *
 * @example
 * ```tsx
 * function CaseEditor({ caseId }: { caseId: string }) {
 *   const { canEdit, canEditFinancials, isLoading } = useCaseEditPermission(caseId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (!canEdit) return <ReadOnlyView />;
 *
 *   return <EditableView showFinancials={canEditFinancials} />;
 * }
 * ```
 */
export function useCaseEditPermission(caseId: string): CaseEditPermission {
  const { user, isLoading: authLoading } = useAuth();
  const { case: caseData, loading: caseLoading } = useCase(caseId);

  const permission = useMemo<Omit<CaseEditPermission, 'isLoading'>>(() => {
    // No user = no permission
    if (!user) {
      return { canEdit: false, canEditFinancials: false, editReason: null };
    }

    // BusinessOwners have full access including financials
    if (user.role === 'BusinessOwner') {
      return { canEdit: true, canEditFinancials: true, editReason: 'businessOwner' };
    }

    // Partners have full access including financials
    if (user.role === 'Partner') {
      return { canEdit: true, canEditFinancials: true, editReason: 'partner' };
    }

    // Check if user is Lead on this case
    const isLead = caseData?.teamMembers?.some(
      (member) => member.userId === user.id && member.role === 'Lead'
    );

    if (isLead) {
      // Leads can edit but not financials
      return { canEdit: true, canEditFinancials: false, editReason: 'lead' };
    }

    // No permission
    return { canEdit: false, canEditFinancials: false, editReason: null };
  }, [user, caseData]);

  return {
    ...permission,
    isLoading: authLoading || caseLoading,
  };
}
