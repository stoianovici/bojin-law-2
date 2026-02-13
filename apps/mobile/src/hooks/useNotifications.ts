/**
 * Notifications Hook
 * Manages in-app notifications with polling for new items
 */

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useRealtimeStore, InAppNotification } from '@/store/realtime';
import { GET_IN_APP_NOTIFICATIONS, GET_IN_APP_NOTIFICATION_COUNT } from '@/graphql/queries';
import {
  MARK_IN_APP_NOTIFICATION_READ,
  MARK_ALL_IN_APP_NOTIFICATIONS_READ,
} from '@/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

interface InAppNotificationsData {
  inAppNotifications: InAppNotification[];
}

interface InAppNotificationCountData {
  inAppNotificationCount: number;
}

export interface UseNotificationsResult {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  error?: Error;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useNotifications(): UseNotificationsResult {
  const {
    notifications,
    unreadNotificationCount,
    setNotifications,
    setUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useRealtimeStore();

  // ============================================================================
  // Queries
  // ============================================================================

  const {
    data: notificationsData,
    loading,
    error,
    refetch,
  } = useQuery<InAppNotificationsData>(GET_IN_APP_NOTIFICATIONS, {
    variables: { includeRead: true, limit: 50 },
    fetchPolicy: 'cache-and-network',
  });

  // Sync notifications to store
  useEffect(() => {
    if (notificationsData?.inAppNotifications) {
      setNotifications(notificationsData.inAppNotifications);
    }
  }, [notificationsData, setNotifications]);

  const { data: countData, refetch: refetchCount } = useQuery<InAppNotificationCountData>(
    GET_IN_APP_NOTIFICATION_COUNT,
    {
      fetchPolicy: 'network-only',
      pollInterval: 30000, // Poll every 30 seconds for new notifications
    }
  );

  // Sync count to store
  useEffect(() => {
    if (countData?.inAppNotificationCount !== undefined) {
      setUnreadNotificationCount(countData.inAppNotificationCount);
    }
  }, [countData, setUnreadNotificationCount]);

  // ============================================================================
  // Mutations
  // ============================================================================

  const [markReadMutation] = useMutation(MARK_IN_APP_NOTIFICATION_READ);
  const [markAllReadMutation] = useMutation(MARK_ALL_IN_APP_NOTIFICATIONS_READ);

  // ============================================================================
  // Actions
  // ============================================================================

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      markNotificationRead(id);

      try {
        await markReadMutation({ variables: { id } });
      } catch {
        // Refetch on error to sync state
        refetch();
        refetchCount();
      }
    },
    [markReadMutation, markNotificationRead, refetch, refetchCount]
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    markAllNotificationsRead();

    try {
      await markAllReadMutation();
    } catch {
      // Refetch on error to sync state
      refetch();
      refetchCount();
    }
  }, [markAllReadMutation, markAllNotificationsRead, refetch, refetchCount]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    notifications,
    unreadCount: unreadNotificationCount,
    loading,
    error: error as Error | undefined,
    markAsRead,
    markAllAsRead,
    refetch: () => {
      refetch();
      refetchCount();
    },
  };
}
