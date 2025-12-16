/**
 * Hook for classification review and email reassignment
 * OPS-031: Classification Review & Correction
 *
 * Provides access to the classification queue, move/reassign operations,
 * and audit trail for email classifications.
 */

import { useMemo, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';

// ============================================================================
// GraphQL Operations - Queries
// ============================================================================

const GET_CLASSIFICATION_QUEUE = gql`
  query GetClassificationQueue($filter: ClassificationQueueFilter, $limit: Int, $offset: Int) {
    classificationQueue(filter: $filter, limit: $limit, offset: $offset) {
      items {
        id
        email {
          id
          subject
          bodyPreview
          from
          receivedDateTime
          hasAttachments
        }
        reason
        suggestedCases {
          caseId
          case {
            id
            title
            caseNumber
            client {
              name
            }
          }
          confidence
          matchType
          reason
        }
        detectedReferences
        createdAt
      }
      total
      hasMore
    }
  }
`;

const GET_PENDING_CLASSIFICATION_COUNT = gql`
  query GetPendingClassificationCount {
    pendingClassificationCount
  }
`;

const GET_EMAIL_CLASSIFICATION_HISTORY = gql`
  query GetEmailClassificationHistory($emailId: ID!) {
    emailClassificationHistory(emailId: $emailId) {
      email {
        id
        subject
        from
      }
      logs {
        id
        action
        fromCase {
          id
          title
          caseNumber
        }
        toCase {
          id
          title
          caseNumber
        }
        wasAutomatic
        confidence
        matchType
        correctionReason
        performedBy {
          id
          firstName
          lastName
        }
        performedAt
      }
    }
  }
`;

const GET_CASES_FOR_REASSIGNMENT = gql`
  query GetCasesForReassignment($emailId: ID!) {
    casesForReassignment(emailId: $emailId) {
      id
      title
      caseNumber
      status
      client {
        id
        name
      }
    }
  }
`;

const GET_CLASSIFICATION_STATS = gql`
  query GetClassificationStats($period: StatsPeriod!) {
    classificationStats(period: $period) {
      autoClassified
      manuallyReviewed
      movedAfterImport
      pendingReview
      aiAccuracy
    }
  }
`;

// ============================================================================
// GraphQL Operations - Mutations
// ============================================================================

const MOVE_EMAIL_TO_CASE = gql`
  mutation MoveEmailToCase($input: MoveEmailInput!) {
    moveEmailToCase(input: $input) {
      success
      email {
        id
        caseId
      }
      fromCase {
        id
        title
      }
      toCase {
        id
        title
      }
      attachmentsMoved
      actorCreated
      error
    }
  }
`;

const IGNORE_EMAIL = gql`
  mutation IgnoreEmail($input: IgnoreEmailInput!) {
    ignoreEmail(input: $input)
  }
`;

const BULK_ASSIGN_EMAILS = gql`
  mutation BulkAssignEmails($input: BulkAssignEmailsInput!) {
    bulkAssignEmails(input: $input) {
      success
      emailsAssigned
      errors
    }
  }
`;

const ASSIGN_PENDING_EMAIL_TO_CASE = gql`
  mutation AssignPendingEmailToCase($pendingId: ID!, $caseId: ID!, $reason: String) {
    assignPendingEmailToCase(pendingId: $pendingId, caseId: $caseId, reason: $reason) {
      success
      email {
        id
        caseId
      }
      toCase {
        id
        title
      }
      error
    }
  }
`;

const DISMISS_FROM_QUEUE = gql`
  mutation DismissFromQueue($pendingId: ID!, $reason: String) {
    dismissFromQueue(pendingId: $pendingId, reason: $reason)
  }
`;

const ADD_REFERENCE_TO_CASE = gql`
  mutation AddReferenceToCase($caseId: ID!, $reference: String!) {
    addReferenceToCase(caseId: $caseId, reference: $reference) {
      id
      referenceNumbers
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type ClassificationReason =
  | 'MULTI_CASE_CONFLICT'
  | 'LOW_CONFIDENCE'
  | 'NO_MATCHING_CASE'
  | 'COURT_NO_REFERENCE'
  | 'UNKNOWN_CONTACT';

export type ClassificationMatchType =
  | 'ACTOR'
  | 'REFERENCE_NUMBER'
  | 'KEYWORD'
  | 'SEMANTIC'
  | 'GLOBAL_SOURCE'
  | 'MANUAL';

export type ClassificationAction = 'ASSIGNED' | 'MOVED' | 'IGNORED' | 'UNASSIGNED';

export type StatsPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER';

export interface EmailFrom {
  name?: string;
  address: string;
}

export interface CaseSuggestion {
  caseId: string;
  case: {
    id: string;
    title: string;
    caseNumber: string;
    client?: { name: string };
  };
  confidence: number;
  matchType: ClassificationMatchType;
  reason: string;
}

export interface PendingClassificationItem {
  id: string;
  email: {
    id: string;
    subject: string | null;
    bodyPreview: string | null;
    from: EmailFrom | null;
    receivedDateTime: string;
    hasAttachments: boolean;
  };
  reason: ClassificationReason;
  suggestedCases: CaseSuggestion[];
  detectedReferences: string[];
  createdAt: string;
}

export interface ClassificationQueueFilter {
  clientId?: string;
  reason?: ClassificationReason;
  createdAfter?: string;
  createdBefore?: string;
}

export interface ClassificationLogEntry {
  id: string;
  action: ClassificationAction;
  fromCase?: { id: string; title: string; caseNumber: string };
  toCase?: { id: string; title: string; caseNumber: string };
  wasAutomatic: boolean;
  confidence?: number;
  matchType?: ClassificationMatchType;
  correctionReason?: string;
  performedBy: { id: string; firstName: string; lastName: string };
  performedAt: string;
}

export interface CaseForReassignment {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
  client?: { id: string; name: string };
}

export interface ClassificationStats {
  autoClassified: number;
  manuallyReviewed: number;
  movedAfterImport: number;
  pendingReview: number;
  aiAccuracy: number | null;
}

interface MoveEmailInput {
  emailId: string;
  toCaseId: string;
  reason?: string;
  moveAttachments?: boolean;
  addSenderAsActor?: boolean;
}

interface BulkAssignInput {
  emailIds: string[];
  caseId: string;
  reason?: string;
}

interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Reason Labels (Romanian)
// ============================================================================

export const REASON_LABELS: Record<ClassificationReason, string> = {
  MULTI_CASE_CONFLICT: 'Conflict între dosare',
  LOW_CONFIDENCE: 'Încredere scăzută',
  NO_MATCHING_CASE: 'Niciun dosar potrivit',
  COURT_NO_REFERENCE: 'Email instanță fără referință',
  UNKNOWN_CONTACT: 'Contact necunoscut',
};

export const REASON_DESCRIPTIONS: Record<ClassificationReason, string> = {
  MULTI_CASE_CONFLICT: 'Emailul poate aparține mai multor dosare cu probabilități similare',
  LOW_CONFIDENCE: 'Clasificarea automată nu a putut determina dosarul cu certitudine',
  NO_MATCHING_CASE: 'Nu s-a găsit niciun dosar care să corespundă emailului',
  COURT_NO_REFERENCE: 'Email de la instanță dar fără număr de dosar identificabil',
  UNKNOWN_CONTACT: 'Expeditorul nu este asociat cu niciun dosar',
};

export const MATCH_TYPE_LABELS: Record<ClassificationMatchType, string> = {
  ACTOR: 'Contact cunoscut',
  REFERENCE_NUMBER: 'Număr referință',
  KEYWORD: 'Cuvinte cheie',
  SEMANTIC: 'Analiză AI',
  GLOBAL_SOURCE: 'Sursă globală',
  MANUAL: 'Manual',
};

// ============================================================================
// Query Response Types (for useQuery)
// ============================================================================

interface ClassificationQueueResponse {
  classificationQueue: {
    items: PendingClassificationItem[];
    total: number;
    hasMore: boolean;
  };
}

interface PendingClassificationCountResponse {
  pendingClassificationCount: number;
}

interface EmailClassificationHistoryResponse {
  emailClassificationHistory: {
    email: { id: string; subject: string; from: EmailFrom | null };
    logs: ClassificationLogEntry[];
  };
}

interface CasesForReassignmentResponse {
  casesForReassignment: CaseForReassignment[];
}

interface ClassificationStatsResponse {
  classificationStats: ClassificationStats;
}

interface MoveEmailResponse {
  moveEmailToCase: {
    success: boolean;
    attachmentsMoved?: number;
    actorCreated?: boolean;
    error?: string;
    email?: { id: string; caseId: string };
    toCase?: { id: string; title: string };
  };
}

interface IgnoreEmailResponse {
  ignoreEmail: boolean;
}

interface BulkAssignResponse {
  bulkAssignEmails: {
    success: boolean;
    emailsAssigned: number;
    errors?: string[];
  };
}

interface AssignPendingEmailToCaseResponse {
  assignPendingEmailToCase: {
    success: boolean;
    error?: string;
    email?: { id: string; caseId: string };
    toCase?: { id: string; title: string };
  };
}

interface DismissFromQueueResponse {
  dismissFromQueue: boolean;
}

interface AddReferenceToCaseResponse {
  addReferenceToCase: { id: string; referenceNumbers: string[] };
}

// ============================================================================
// Main Hook - Classification Queue
// ============================================================================

export function useClassificationQueue(
  filter?: ClassificationQueueFilter,
  limit: number = 50,
  offset: number = 0
) {
  const { data, loading, error, refetch } = useQuery<ClassificationQueueResponse>(
    GET_CLASSIFICATION_QUEUE,
    {
      variables: { filter, limit, offset },
      fetchPolicy: 'cache-and-network',
      pollInterval: 30000, // Refresh every 30 seconds
    }
  );

  const items = useMemo<PendingClassificationItem[]>(() => {
    return data?.classificationQueue?.items ?? [];
  }, [data?.classificationQueue?.items]);

  const total = data?.classificationQueue?.total ?? 0;
  const hasMore = data?.classificationQueue?.hasMore ?? false;

  return {
    items,
    total,
    hasMore,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Hook - Pending Count (for badge)
// ============================================================================

export function usePendingClassificationCount() {
  const { data, loading, refetch } = useQuery<PendingClassificationCountResponse>(
    GET_PENDING_CLASSIFICATION_COUNT,
    {
      fetchPolicy: 'cache-and-network',
      pollInterval: 60000, // Refresh every minute
    }
  );

  return {
    count: data?.pendingClassificationCount ?? 0,
    loading,
    refetch,
  };
}

// ============================================================================
// Hook - Classification History
// ============================================================================

export function useEmailClassificationHistory(emailId: string | null) {
  const { data, loading, error, refetch } = useQuery<EmailClassificationHistoryResponse>(
    GET_EMAIL_CLASSIFICATION_HISTORY,
    {
      variables: { emailId },
      skip: !emailId,
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    email: data?.emailClassificationHistory?.email,
    logs: (data?.emailClassificationHistory?.logs ?? []) as ClassificationLogEntry[],
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Hook - Cases for Reassignment
// ============================================================================

export function useCasesForReassignment(emailId: string | null) {
  const { data, loading, error } = useQuery<CasesForReassignmentResponse>(
    GET_CASES_FOR_REASSIGNMENT,
    {
      variables: { emailId },
      skip: !emailId,
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    cases: (data?.casesForReassignment ?? []) as CaseForReassignment[],
    loading,
    error,
  };
}

// ============================================================================
// Hook - Classification Stats
// ============================================================================

export function useClassificationStats(period: StatsPeriod = 'WEEK') {
  const { data, loading, error, refetch } = useQuery<ClassificationStatsResponse>(
    GET_CLASSIFICATION_STATS,
    {
      variables: { period },
      fetchPolicy: 'cache-and-network',
    }
  );

  return {
    stats: data?.classificationStats as ClassificationStats | undefined,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Hook - Classification Mutations
// ============================================================================

export function useClassificationMutations() {
  const [moveEmailMutation, { loading: moveLoading }] =
    useMutation<MoveEmailResponse>(MOVE_EMAIL_TO_CASE);
  const [ignoreEmailMutation, { loading: ignoreLoading }] =
    useMutation<IgnoreEmailResponse>(IGNORE_EMAIL);
  const [bulkAssignMutation, { loading: bulkLoading }] =
    useMutation<BulkAssignResponse>(BULK_ASSIGN_EMAILS);
  const [assignEmailMutation, { loading: assignLoading }] =
    useMutation<AssignPendingEmailToCaseResponse>(ASSIGN_PENDING_EMAIL_TO_CASE);
  const [dismissMutation, { loading: dismissLoading }] =
    useMutation<DismissFromQueueResponse>(DISMISS_FROM_QUEUE);
  const [addReferenceMutation, { loading: addRefLoading }] =
    useMutation<AddReferenceToCaseResponse>(ADD_REFERENCE_TO_CASE);

  const moveEmail = useCallback(
    async (
      input: MoveEmailInput
    ): Promise<MutationResult<{ attachmentsMoved: number; actorCreated: boolean }>> => {
      try {
        const result = await moveEmailMutation({ variables: { input } });

        if (result.data?.moveEmailToCase?.success) {
          return {
            success: true,
            data: {
              attachmentsMoved: result.data.moveEmailToCase.attachmentsMoved ?? 0,
              actorCreated: result.data.moveEmailToCase.actorCreated ?? false,
            },
          };
        }

        return {
          success: false,
          error: result.data?.moveEmailToCase?.error ?? 'Eroare la mutarea emailului',
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [moveEmailMutation]
  );

  const ignoreEmail = useCallback(
    async (emailId: string, reason?: string): Promise<MutationResult<boolean>> => {
      try {
        const result = await ignoreEmailMutation({
          variables: { input: { emailId, reason } },
        });

        if (result.data?.ignoreEmail) {
          return { success: true, data: true };
        }

        return { success: false, error: 'Eroare la ignorarea emailului' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [ignoreEmailMutation]
  );

  const bulkAssign = useCallback(
    async (
      input: BulkAssignInput
    ): Promise<MutationResult<{ emailsAssigned: number; errors: string[] }>> => {
      try {
        const result = await bulkAssignMutation({ variables: { input } });

        if (result.data?.bulkAssignEmails?.success) {
          return {
            success: true,
            data: {
              emailsAssigned: result.data.bulkAssignEmails.emailsAssigned,
              errors: result.data.bulkAssignEmails.errors || [],
            },
          };
        }

        return {
          success: false,
          error: result.data?.bulkAssignEmails?.errors?.[0] ?? 'Eroare la atribuirea emailurilor',
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [bulkAssignMutation]
  );

  const assignFromQueue = useCallback(
    async (
      pendingId: string,
      caseId: string,
      reason?: string
    ): Promise<MutationResult<{ caseTitle: string }>> => {
      try {
        const result = await assignEmailMutation({
          variables: { pendingId, caseId, reason },
        });

        if (result.data?.assignPendingEmailToCase?.success) {
          return {
            success: true,
            data: { caseTitle: result.data.assignPendingEmailToCase.toCase?.title ?? '' },
          };
        }

        return {
          success: false,
          error: result.data?.assignPendingEmailToCase?.error ?? 'Eroare la atribuirea emailului',
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [assignEmailMutation]
  );

  const dismissFromQueue = useCallback(
    async (pendingId: string, reason?: string): Promise<MutationResult<boolean>> => {
      try {
        const result = await dismissMutation({
          variables: { pendingId, reason },
        });

        if (result.data?.dismissFromQueue) {
          return { success: true, data: true };
        }

        return { success: false, error: 'Eroare la eliminarea din coadă' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [dismissMutation]
  );

  const addReferenceToCase = useCallback(
    async (caseId: string, reference: string): Promise<MutationResult<boolean>> => {
      try {
        const result = await addReferenceMutation({
          variables: { caseId, reference },
        });

        if (result.data?.addReferenceToCase) {
          return { success: true, data: true };
        }

        return { success: false, error: 'Eroare la adăugarea referinței' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [addReferenceMutation]
  );

  return {
    moveEmail,
    moveLoading,
    ignoreEmail,
    ignoreLoading,
    bulkAssign,
    bulkLoading,
    assignFromQueue,
    assignLoading,
    dismissFromQueue,
    dismissLoading,
    addReferenceToCase,
    addRefLoading,
    mutating:
      moveLoading ||
      ignoreLoading ||
      bulkLoading ||
      assignLoading ||
      dismissLoading ||
      addRefLoading,
  };
}
