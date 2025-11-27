/**
 * Notification Hooks
 * Story 2.8.2: Case Approval Workflow - Notifications
 *
 * Hooks for managing in-app notifications
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

const GET_NOTIFICATIONS = gql`
  query GetNotifications($read: Boolean, $limit: Int) {
    notifications(read: $read, limit: $limit) {
      id
      userId
      type
      title
      message
      link
      read
      caseId
      createdAt
      readAt
    }
  }
`;

const GET_UNREAD_COUNT = gql`
  query GetUnreadNotificationCount {
    unreadNotificationCount
  }
`;

const MARK_AS_READ = gql`
  mutation MarkNotificationAsRead($id: UUID!) {
    markNotificationAsRead(id: $id) {
      id
      read
      readAt
    }
  }
`;

const MARK_ALL_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

interface GetNotificationsResult {
  notifications: any[];
}

interface GetNotificationsVariables {
  read?: boolean;
  limit?: number;
}

/**
 * Hook to fetch and manage notifications
 */
export function useNotifications(options?: { read?: boolean; limit?: number }) {
  const { data, loading, error, refetch } = useQuery<GetNotificationsResult, GetNotificationsVariables>(GET_NOTIFICATIONS, {
    variables: {
      read: options?.read,
      limit: options?.limit || 50,
    },
    pollInterval: 30000, // Poll every 30 seconds for new notifications
  });

  return {
    notifications: (data?.notifications || []) as any[],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to get unread notification count (for badge)
 */
interface GetUnreadCountResult {
  unreadNotificationCount: number;
}

/**
 * Hook to get unread notification count (for badge)
 */
export function useUnreadNotificationCount() {
  const { data, loading, error, refetch } = useQuery<GetUnreadCountResult>(GET_UNREAD_COUNT, {
    pollInterval: 30000, // Poll every 30 seconds
  });

  return {
    unreadCount: data?.unreadNotificationCount || 0,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to mark a notification as read
 */
export function useMarkNotificationAsRead() {
  const [markAsRead, { loading, error }] = useMutation(MARK_AS_READ, {
    refetchQueries: [GET_NOTIFICATIONS, GET_UNREAD_COUNT],
  });

  const markNotificationAsRead = async (id: string) => {
    try {
      await markAsRead({ variables: { id } });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  };

  return {
    markNotificationAsRead,
    loading,
    error,
  };
}

/**
 * Hook to mark all notifications as read
 */
interface MarkAllAsReadResult {
  markAllNotificationsAsRead: number;
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  const [markAllAsRead, { loading, error }] = useMutation<MarkAllAsReadResult>(MARK_ALL_AS_READ, {
    refetchQueries: [GET_NOTIFICATIONS, GET_UNREAD_COUNT],
  });

  const markAllNotificationsAsRead = async () => {
    try {
      const result = await markAllAsRead();
      return result.data?.markAllNotificationsAsRead || 0;
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      throw err;
    }
  };

  return {
    markAllNotificationsAsRead,
    loading,
    error,
  };
}
