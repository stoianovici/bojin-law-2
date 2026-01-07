'use client';

import { useState, useCallback } from 'react';
import { useQuery } from './useGraphQL';
import { GET_EMAIL_SYNC_STATUS, START_EMAIL_SYNC } from '@/graphql/queries';
import { apolloClient } from '@/lib/apollo-client';
import type { EmailSyncStatus } from '@/types/email';

interface UseEmailSyncResult {
  syncStatus: EmailSyncStatus | null;
  loading: boolean;
  syncing: boolean;
  error: Error | undefined;
  startSync: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useEmailSync(): UseEmailSyncResult {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<Error | undefined>(undefined);

  const { data, loading, error, refetch } = useQuery<{ emailSyncStatus: EmailSyncStatus }>(
    GET_EMAIL_SYNC_STATUS
  );

  const startSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(undefined);

    try {
      await apolloClient.mutate({
        mutation: START_EMAIL_SYNC,
      });
      // Refetch status after starting sync
      await refetch();
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  return {
    syncStatus: data?.emailSyncStatus || null,
    loading,
    syncing: syncing || data?.emailSyncStatus?.status === 'syncing',
    error: error || syncError,
    startSync,
    refetch,
  };
}
