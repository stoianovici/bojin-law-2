'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useCallback, useEffect, useState, useRef } from 'react';

// Timeout for detecting stale syncs (5 minutes)
const SYNC_TIMEOUT_MS = 5 * 60 * 1000;

// Inline query for polling sync status
const GET_CASE_SYNC_STATUS = gql`
  query GetCaseSyncStatus($id: UUID!) {
    case(id: $id) {
      id
      syncStatus
      syncError
    }
  }
`;

const RETRY_CASE_SYNC = gql`
  mutation RetryCaseSync($caseId: UUID!) {
    retryCaseSync(caseId: $caseId) {
      id
      syncStatus
      syncError
    }
  }
`;

type CaseSyncStatus = 'Pending' | 'Syncing' | 'Completed' | 'Failed';

interface CaseSyncStatusData {
  case: {
    id: string;
    syncStatus: CaseSyncStatus;
    syncError: string | null;
  } | null;
}

interface RetryCaseSyncData {
  retryCaseSync: {
    id: string;
    syncStatus: CaseSyncStatus;
    syncError: string | null;
  } | null;
}

interface UseCaseSyncStatusOptions {
  caseId: string;
  initialStatus?: CaseSyncStatus;
}

interface UseCaseSyncStatusResult {
  syncStatus: CaseSyncStatus | null;
  syncError: string | null;
  isPolling: boolean;
  isStale: boolean; // True if sync has been pending/syncing too long
  retryCaseSync: () => Promise<void>;
  loading: boolean;
}

export function useCaseSyncStatus({
  caseId,
  initialStatus,
}: UseCaseSyncStatusOptions): UseCaseSyncStatusResult {
  const [isPolling, setIsPolling] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const pollingStartedAt = useRef<number | null>(null);
  const staleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we should be polling based on status
  const shouldPoll = (status: CaseSyncStatus | null | undefined): boolean => {
    return status === 'Pending' || status === 'Syncing';
  };

  // Query for sync status with conditional polling
  const { data, loading, startPolling, stopPolling } = useQuery<CaseSyncStatusData>(
    GET_CASE_SYNC_STATUS,
    {
      variables: { id: caseId },
      skip: !caseId,
      fetchPolicy: 'network-only',
    }
  );

  const syncStatus = data?.case?.syncStatus ?? initialStatus ?? null;
  const syncError = data?.case?.syncError ?? null;

  // Manage polling and stale detection based on status
  useEffect(() => {
    if (shouldPoll(syncStatus)) {
      startPolling(5000); // Poll every 5 seconds
      setIsPolling(true);

      // Start tracking time if not already
      if (pollingStartedAt.current === null) {
        pollingStartedAt.current = Date.now();

        // Set timeout to mark as stale
        staleTimeoutRef.current = setTimeout(() => {
          setIsStale(true);
          stopPolling(); // Stop polling after timeout
          setIsPolling(false);
        }, SYNC_TIMEOUT_MS);
      }
    } else {
      stopPolling();
      setIsPolling(false);
      setIsStale(false);
      pollingStartedAt.current = null;

      // Clear stale timeout
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
        staleTimeoutRef.current = null;
      }
    }

    return () => {
      stopPolling();
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
      }
    };
  }, [syncStatus, startPolling, stopPolling]);

  // Retry mutation - use 'all' error policy to always get errors
  const [retryMutation] = useMutation<RetryCaseSyncData>(RETRY_CASE_SYNC, {
    errorPolicy: 'all',
  });

  const retryCaseSync = useCallback(async () => {
    try {
      const result = await retryMutation({
        variables: { caseId },
        refetchQueries: [{ query: GET_CASE_SYNC_STATUS, variables: { id: caseId } }],
      });

      // Check for GraphQL errors - they can be in various places depending on errorPolicy
      // With errorPolicy: 'all', errors come through result.error, not result.errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apolloError = result.error as any;
      const graphQLErrors = apolloError?.graphQLErrors || apolloError?.networkError?.result?.errors;

      if (graphQLErrors && graphQLErrors.length > 0) {
        const error = graphQLErrors[0];
        if (
          error.extensions?.code === 'UNAUTHORIZED' ||
          error.message?.includes('Access token required')
        ) {
          throw new Error('Trebuie să fiți autentificat cu Microsoft pentru sincronizare');
        }
        throw new Error(error.message || 'Eroare la sincronizare');
      }

      // Also check if data is null (indicates error)
      if (!result.data?.retryCaseSync) {
        // Check for network error
        if (apolloError?.networkError) {
          throw new Error('Eroare de rețea. Verificați conexiunea.');
        }
        throw new Error('Eroare la sincronizare. Verificați autentificarea Microsoft.');
      }
    } catch (err) {
      // Re-throw our custom errors
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Eroare necunoscută la sincronizare');
    }
  }, [caseId, retryMutation]);

  return {
    syncStatus,
    syncError,
    isPolling,
    isStale,
    retryCaseSync,
    loading,
  };
}
