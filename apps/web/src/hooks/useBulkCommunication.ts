/**
 * Bulk Communication React Hooks
 * Story 5.5: Multi-Channel Communication Hub (AC: 3)
 *
 * Provides hooks for managing bulk communications to multiple recipients
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const BULK_COMMUNICATION_FRAGMENT = gql`
  fragment BulkCommunicationFields on BulkCommunication {
    id
    subject
    body
    channelType
    recipientType
    totalRecipients
    sentCount
    failedCount
    status
    scheduledFor
    startedAt
    completedAt
    createdBy {
      id
      firstName
      lastName
    }
    createdAt
    case {
      id
      title
    }
  }
`;

const BULK_PROGRESS_FRAGMENT = gql`
  fragment BulkCommunicationProgressFields on BulkCommunicationProgress {
    totalRecipients
    sentCount
    failedCount
    pendingCount
    percentComplete
    estimatedTimeRemaining
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_BULK_COMMUNICATIONS = gql`
  ${BULK_COMMUNICATION_FRAGMENT}
  query GetBulkCommunications($caseId: ID, $status: BulkCommunicationStatus) {
    bulkCommunications(caseId: $caseId, status: $status) {
      ...BulkCommunicationFields
    }
  }
`;

const GET_BULK_COMMUNICATION_PROGRESS = gql`
  ${BULK_PROGRESS_FRAGMENT}
  query GetBulkCommunicationProgress($id: ID!) {
    bulkCommunicationProgress(id: $id) {
      ...BulkCommunicationProgressFields
    }
  }
`;

const GET_BULK_FAILED_RECIPIENTS = gql`
  query GetBulkFailedRecipients($id: ID!, $limit: Int, $offset: Int) {
    bulkCommunicationFailedRecipients(id: $id, limit: $limit, offset: $offset) {
      logs {
        id
        recipientEmail
        recipientName
        status
        errorMessage
        sentAt
      }
      total
      hasMore
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const CREATE_BULK_COMMUNICATION = gql`
  ${BULK_COMMUNICATION_FRAGMENT}
  mutation CreateBulkCommunication($input: CreateBulkCommunicationInput!) {
    createBulkCommunication(input: $input) {
      ...BulkCommunicationFields
    }
  }
`;

const SEND_BULK_COMMUNICATION = gql`
  ${BULK_COMMUNICATION_FRAGMENT}
  mutation SendBulkCommunication($id: ID!) {
    sendBulkCommunication(id: $id) {
      ...BulkCommunicationFields
    }
  }
`;

const CANCEL_BULK_COMMUNICATION = gql`
  ${BULK_COMMUNICATION_FRAGMENT}
  mutation CancelBulkCommunication($id: ID!) {
    cancelBulkCommunication(id: $id) {
      ...BulkCommunicationFields
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type CommunicationChannel =
  | 'Email'
  | 'InternalNote'
  | 'WhatsApp'
  | 'Phone'
  | 'Meeting'
  | 'SMS';

export type BulkRecipientType =
  | 'CaseClients'
  | 'CaseTeam'
  | 'AllClients'
  | 'CustomList'
  | 'CaseTypeClients';

export type BulkCommunicationStatus =
  | 'Draft'
  | 'Scheduled'
  | 'InProgress'
  | 'Completed'
  | 'PartiallyFailed'
  | 'Cancelled';

export interface BulkCommunication {
  id: string;
  subject: string;
  body: string;
  channelType: CommunicationChannel;
  recipientType: BulkRecipientType;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: BulkCommunicationStatus;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  case?: {
    id: string;
    title: string;
  };
}

export interface BulkCommunicationProgress {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  percentComplete: number;
  estimatedTimeRemaining?: number; // seconds
}

export interface FailedRecipient {
  id: string;
  recipientEmail: string;
  recipientName: string;
  status: string;
  errorMessage?: string;
  sentAt?: string;
}

export interface FailedRecipientsResult {
  logs: FailedRecipient[];
  total: number;
  hasMore: boolean;
}

export interface CustomRecipient {
  id: string;
  name: string;
  email: string;
}

export interface RecipientFilter {
  caseIds?: string[];
  caseTypes?: string[];
  customRecipients?: CustomRecipient[];
}

export interface CreateBulkCommunicationInput {
  caseId?: string;
  templateId?: string;
  subject: string;
  body: string;
  channelType: CommunicationChannel;
  recipientType: BulkRecipientType;
  recipientFilter: RecipientFilter;
  scheduledFor?: string;
}

export interface BulkCommunicationFilter {
  caseId?: string;
  status?: BulkCommunicationStatus;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for listing bulk communications with optional filters
 */
export function useBulkCommunications(filter?: BulkCommunicationFilter) {
  const { data, loading, error, refetch } = useQuery(GET_BULK_COMMUNICATIONS, {
    variables: filter || {},
    fetchPolicy: 'cache-and-network',
  });

  return {
    bulkCommunications: (data?.bulkCommunications || []) as BulkCommunication[],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for creating a new bulk communication
 */
export function useCreateBulkCommunication() {
  const [createMutation, { loading, error }] = useMutation(CREATE_BULK_COMMUNICATION, {
    refetchQueries: [{ query: GET_BULK_COMMUNICATIONS }],
  });

  const create = useCallback(
    async (input: CreateBulkCommunicationInput) => {
      const result = await createMutation({
        variables: {
          input: {
            ...input,
            recipientFilter: input.recipientFilter,
          },
        },
      });

      return result.data?.createBulkCommunication as BulkCommunication;
    },
    [createMutation]
  );

  return {
    create,
    loading,
    error,
  };
}

/**
 * Hook for sending a bulk communication
 */
export function useSendBulkCommunication() {
  const [sendMutation, { loading, error }] = useMutation(SEND_BULK_COMMUNICATION, {
    refetchQueries: [{ query: GET_BULK_COMMUNICATIONS }],
  });

  const send = useCallback(
    async (id: string) => {
      const result = await sendMutation({
        variables: { id },
      });

      return result.data?.sendBulkCommunication as BulkCommunication;
    },
    [sendMutation]
  );

  return {
    send,
    loading,
    error,
  };
}

/**
 * Hook for cancelling a bulk communication
 */
export function useCancelBulkCommunication() {
  const [cancelMutation, { loading, error }] = useMutation(CANCEL_BULK_COMMUNICATION, {
    refetchQueries: [{ query: GET_BULK_COMMUNICATIONS }],
  });

  const cancel = useCallback(
    async (id: string) => {
      const result = await cancelMutation({
        variables: { id },
      });

      return result.data?.cancelBulkCommunication as BulkCommunication;
    },
    [cancelMutation]
  );

  return {
    cancel,
    loading,
    error,
  };
}

/**
 * Hook for real-time progress tracking of a bulk communication
 */
export function useBulkCommunicationProgress(
  id: string,
  options?: { pollingInterval?: number; enabled?: boolean }
) {
  const { pollingInterval = 2000, enabled = true } = options || {};
  const [isPolling, setIsPolling] = useState(false);

  const { data, loading, error, startPolling, stopPolling, refetch } = useQuery(
    GET_BULK_COMMUNICATION_PROGRESS,
    {
      variables: { id },
      skip: !id || !enabled,
      fetchPolicy: 'network-only',
    }
  );

  const progress = data?.bulkCommunicationProgress as BulkCommunicationProgress | undefined;

  // Start polling when communication is in progress
  useEffect(() => {
    if (!id || !enabled) return;

    if (progress && progress.percentComplete < 100 && !isPolling) {
      startPolling(pollingInterval);
      setIsPolling(true);
    } else if (progress && progress.percentComplete >= 100 && isPolling) {
      stopPolling();
      setIsPolling(false);
    }

    return () => {
      if (isPolling) {
        stopPolling();
      }
    };
  }, [id, enabled, progress, isPolling, pollingInterval, startPolling, stopPolling]);

  return {
    progress,
    loading,
    error,
    isPolling,
    refetch,
  };
}

/**
 * Utility hook for recipient type options
 */
export function useRecipientTypes() {
  const recipientTypes: { value: BulkRecipientType; label: string; description: string }[] = [
    {
      value: 'CaseClients',
      label: 'Case Clients',
      description: 'All clients on a specific case',
    },
    {
      value: 'CaseTeam',
      label: 'Case Team',
      description: 'All team members on a case',
    },
    {
      value: 'AllClients',
      label: 'All Clients',
      description: 'All firm clients',
    },
    {
      value: 'CaseTypeClients',
      label: 'Case Type Clients',
      description: 'Clients by case type',
    },
    {
      value: 'CustomList',
      label: 'Custom List',
      description: 'Custom recipient list',
    },
  ];

  const getRecipientTypeLabel = useCallback((type: BulkRecipientType) => {
    return recipientTypes.find((t) => t.value === type)?.label || type;
  }, []);

  const getRecipientTypeDescription = useCallback((type: BulkRecipientType) => {
    return recipientTypes.find((t) => t.value === type)?.description || '';
  }, []);

  return {
    recipientTypes,
    getRecipientTypeLabel,
    getRecipientTypeDescription,
  };
}

/**
 * Utility hook for bulk communication status
 */
export function useBulkCommunicationStatuses() {
  const statuses: { value: BulkCommunicationStatus; label: string; color: string }[] = [
    {
      value: 'Draft',
      label: 'Draft',
      color: 'bg-gray-100 text-gray-700',
    },
    {
      value: 'Scheduled',
      label: 'Scheduled',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      value: 'InProgress',
      label: 'In Progress',
      color: 'bg-yellow-100 text-yellow-700',
    },
    {
      value: 'Completed',
      label: 'Completed',
      color: 'bg-green-100 text-green-700',
    },
    {
      value: 'PartiallyFailed',
      label: 'Partially Failed',
      color: 'bg-orange-100 text-orange-700',
    },
    {
      value: 'Cancelled',
      label: 'Cancelled',
      color: 'bg-red-100 text-red-700',
    },
  ];

  const getStatusLabel = useCallback((status: BulkCommunicationStatus) => {
    return statuses.find((s) => s.value === status)?.label || status;
  }, []);

  const getStatusColor = useCallback((status: BulkCommunicationStatus) => {
    return statuses.find((s) => s.value === status)?.color || 'bg-gray-100 text-gray-700';
  }, []);

  const isTerminalStatus = useCallback((status: BulkCommunicationStatus) => {
    return ['Completed', 'PartiallyFailed', 'Cancelled'].includes(status);
  }, []);

  const canCancel = useCallback((status: BulkCommunicationStatus) => {
    return ['Draft', 'Scheduled', 'InProgress'].includes(status);
  }, []);

  const canSend = useCallback((status: BulkCommunicationStatus) => {
    return status === 'Draft';
  }, []);

  return {
    statuses,
    getStatusLabel,
    getStatusColor,
    isTerminalStatus,
    canCancel,
    canSend,
  };
}

/**
 * Format estimated time remaining
 */
export function formatEstimatedTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'Almost done';

  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

/**
 * Hook for fetching failed recipients of a bulk communication
 */
export function useBulkFailedRecipients(
  id: string,
  options?: { limit?: number; offset?: number; enabled?: boolean }
) {
  const { limit = 50, offset = 0, enabled = true } = options || {};

  const { data, loading, error, refetch } = useQuery(GET_BULK_FAILED_RECIPIENTS, {
    variables: { id, limit, offset },
    skip: !id || !enabled,
    fetchPolicy: 'network-only',
  });

  const result = data?.bulkCommunicationFailedRecipients as FailedRecipientsResult | undefined;

  return {
    failedRecipients: result?.logs || [],
    total: result?.total || 0,
    hasMore: result?.hasMore || false,
    loading,
    error,
    refetch,
  };
}
