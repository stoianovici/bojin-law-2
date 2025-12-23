/**
 * Notification Resolvers
 * Story 2.8.2: Case Approval Workflow
 * OPS-120: Activity-based In-App Notifications
 *
 * GraphQL resolvers for notifications (both case approval and activity-based)
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { notificationService } from '../../services/notification.service';
import { activityNotificationService } from '../../services/activity-notification.service';

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

export const notificationResolvers = {
  Query: {
    /**
     * Get notifications for current user
     * Optional filtering by read status
     * Default limit: 50
     */
    notifications: async (_: any, args: { read?: boolean; limit?: number }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await notificationService.getNotifications(user.id, {
        read: args.read,
        limit: args.limit || 50,
      });
    },

    /**
     * Get count of unread notifications for badge
     */
    unreadNotificationCount: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await notificationService.getUnreadCount(user.id);
    },

    // =========================================================================
    // OPS-120: Activity-based In-App Notifications
    // =========================================================================

    /**
     * Get in-app notifications for current user
     * Returns unread notifications by default
     */
    inAppNotifications: async (
      _: any,
      args: { includeRead?: boolean; limit?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return activityNotificationService.getInAppNotifications(user.id, {
        includeRead: args.includeRead ?? false,
        limit: args.limit ?? 20,
      });
    },

    /**
     * Get count of unread in-app notifications
     */
    inAppNotificationCount: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return activityNotificationService.getInAppNotificationCount(user.id);
    },
  },

  Mutation: {
    /**
     * Mark a notification as read
     */
    markNotificationAsRead: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;
      const { id } = args;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify notification belongs to user
      const notification = await prisma.notification.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!notification) {
        throw new GraphQLError('Notification not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (notification.userId !== user.id) {
        throw new GraphQLError('Not authorized to modify this notification', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Mark as read
      await notificationService.markAsRead(id, user.id);

      // Return updated notification
      return await prisma.notification.findUnique({
        where: { id },
        include: { user: true },
      });
    },

    /**
     * Mark all notifications as read for current user
     */
    markAllNotificationsAsRead: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await notificationService.markAllAsRead(user.id);
    },

    // =========================================================================
    // OPS-120: Activity-based In-App Notifications
    // =========================================================================

    /**
     * Mark an in-app notification as read
     */
    markInAppNotificationRead: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return activityNotificationService.markInAppNotificationRead(args.id, user.id);
    },

    /**
     * Mark all in-app notifications as read
     */
    markAllInAppNotificationsRead: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return activityNotificationService.markAllInAppNotificationsRead(user.id);
    },

    /**
     * Subscribe to push notifications
     */
    subscribeToPush: async (
      _: any,
      args: {
        input: { endpoint: string; p256dhKey: string; authKey: string; userAgent?: string };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return activityNotificationService.subscribeToPush(user.id, args.input);
    },

    /**
     * Unsubscribe from push notifications
     */
    unsubscribeFromPush: async (_: any, args: { subscriptionId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return activityNotificationService.unsubscribeFromPush(args.subscriptionId, user.id);
    },
  },

  // Field resolvers
  Notification: {
    user: async (parent: any, _: any, __: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
  },

  // OPS-120: InAppNotification field resolvers
  InAppNotification: {
    action: (parent: any) => {
      // The action is stored in actionData, return it directly
      return parent.action || null;
    },
  },
};
