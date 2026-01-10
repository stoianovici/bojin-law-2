'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { useState, useCallback } from 'react';
import { GET_PENDING_CASES } from '@/graphql/queries';
import { APPROVE_CASE, REJECT_CASE } from '@/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

interface ApprovalUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CaseApproval {
  id: string;
  submittedBy: ApprovalUser;
  submittedAt: string;
  reviewedBy?: ApprovalUser | null;
  reviewedAt?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string | null;
  revisionCount: number;
}

export interface CaseWithApproval {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  description?: string;
  openedDate?: string;
  closedDate?: string;
  client: { id: string; name: string };
  teamMembers: Array<{
    id: string;
    role: string;
    user: { id: string; firstName: string; lastName: string };
  }>;
  approval?: CaseApproval | null;
  billingType?: string;
  fixedAmount?: number;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  };
  createdAt: string;
  updatedAt: string;
  syncStatus?: string;
  syncError?: string;
}

interface PendingCasesResponse {
  pendingCases: CaseWithApproval[];
}

interface ApproveCaseResponse {
  approveCase: {
    id: string;
    status: string;
    approval: CaseApproval;
  };
}

interface RejectCaseResponse {
  rejectCase: {
    id: string;
    status: string;
    approval: CaseApproval;
  };
}

// ============================================================================
// usePendingCases Hook
// ============================================================================

export function usePendingCases() {
  const { data, loading, error, refetch } = useQuery<PendingCasesResponse>(GET_PENDING_CASES, {
    fetchPolicy: 'cache-and-network',
  });

  return {
    pendingCases: data?.pendingCases || [],
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// useCaseApprovalActions Hook
// ============================================================================

export function useCaseApprovalActions() {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [approveCaseMutation] = useMutation<ApproveCaseResponse>(APPROVE_CASE);

  const [rejectCaseMutation] = useMutation<RejectCaseResponse>(REJECT_CASE);

  const approveCase = useCallback(
    async (caseId: string): Promise<{ success: boolean; error?: string }> => {
      setApproving(true);
      setError(null);
      try {
        const result = await approveCaseMutation({ variables: { caseId } });

        // Check if mutation actually returned data
        if (!result.data?.approveCase) {
          // Extract error from the result - Apollo puts GraphQL errors in result.error
          const errorMsg = result.error?.message || 'Eroare la aprobare';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Eroare la aprobare';
        setError(message);
        return { success: false, error: message };
      } finally {
        setApproving(false);
      }
    },
    [approveCaseMutation]
  );

  const rejectCase = useCallback(
    async (caseId: string, reason: string): Promise<boolean> => {
      setRejecting(true);
      setError(null);
      try {
        await rejectCaseMutation({
          variables: { input: { caseId, reason } },
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Eroare la respingere';
        setError(message);
        return false;
      } finally {
        setRejecting(false);
      }
    },
    [rejectCaseMutation]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    approveCase,
    rejectCase,
    approving,
    rejecting,
    error,
    clearError,
  };
}
