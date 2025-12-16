/**
 * Notification Resolvers
 * Story 2.8.2: Case Approval Workflow
 *
 * GraphQL resolvers for in-app notifications
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { notificationService } from '../../services/notification.service';

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
  },

  // Field resolvers
  Notification: {
    user: async (parent: any, _: any, __: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
  },
};
