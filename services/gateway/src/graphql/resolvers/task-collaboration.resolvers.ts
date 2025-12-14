// @ts-nocheck
/**
 * Task Collaboration GraphQL Resolvers
 * Story 4.6: Task Collaboration and Updates
 *
 * Resolvers for task comments, history, activity feed, attachments, subtasks, and subscriptions
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { taskCommentService } from '../../services/task-comment.service';
import { taskHistoryService } from '../../services/task-history.service';
import { caseActivityService } from '../../services/case-activity.service';
import { taskAttachmentService } from '../../services/task-attachment.service';
import { subtaskService } from '../../services/subtask.service';
import { caseSubscriptionService } from '../../services/case-subscription.service';
import { getTaskCollaborationLoaders } from '../dataloaders/task-collaboration.dataloaders';
import type { Context } from './case.resolvers';

// Helper to get authenticated user context
function getAuthContext(context: Context): { userId: string; firmId: string } {
  if (!context.user?.id || !context.user?.firmId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return { userId: context.user.id, firmId: context.user.firmId };
}

export const taskCollaborationResolvers = {
  // ============================================================================
  // Query Resolvers
  // ============================================================================
  Query: {
    // Task Comments (AC: 1)
    taskComments: async (_: any, args: { taskId: string }, context: Context) => {
      const { firmId } = getAuthContext(context);
      return taskCommentService.getComments(args.taskId, firmId);
    },

    taskComment: async (_: any, args: { commentId: string }, context: Context) => {
      getAuthContext(context); // Ensure authenticated
      return taskCommentService.getComment(args.commentId);
    },

    // Task History (AC: 5)
    taskHistory: async (
      _: any,
      args: { taskId: string; options?: any },
      context: Context
    ) => {
      getAuthContext(context);
      return taskHistoryService.getHistory(args.taskId, args.options);
    },

    // Case Activity Feed (AC: 2)
    caseActivityFeed: async (
      _: any,
      args: { caseId: string; options?: any },
      context: Context
    ) => {
      const { firmId } = getAuthContext(context);
      return caseActivityService.getActivityFeed(args.caseId, firmId, args.options);
    },

    recentCaseActivity: async (
      _: any,
      args: { caseId: string; limit?: number },
      context: Context
    ) => {
      const { firmId } = getAuthContext(context);
      return caseActivityService.getRecentActivity(args.caseId, firmId, args.limit || 10);
    },

    // Task Attachments (AC: 3)
    taskAttachments: async (_: any, args: { taskId: string }, context: Context) => {
      const { firmId } = getAuthContext(context);
      return taskAttachmentService.getAttachments(args.taskId, firmId);
    },

    taskAttachment: async (_: any, args: { attachmentId: string }, context: Context) => {
      getAuthContext(context);
      return taskAttachmentService.getAttachment(args.attachmentId);
    },

    attachmentVersionHistory: async (
      _: any,
      args: { attachmentId: string },
      context: Context
    ) => {
      getAuthContext(context);
      return taskAttachmentService.getVersionHistory(args.attachmentId);
    },

    attachmentDownloadUrl: async (
      _: any,
      args: { attachmentId: string },
      context: Context
    ) => {
      const { firmId } = getAuthContext(context);
      return taskAttachmentService.getDownloadUrl(args.attachmentId, firmId);
    },

    // Subtasks (AC: 4)
    subtasks: async (_: any, args: { parentTaskId: string }, context: Context) => {
      const { firmId } = getAuthContext(context);
      return subtaskService.getSubtasks(args.parentTaskId, firmId);
    },

    subtaskProgress: async (_: any, args: { parentTaskId: string }, context: Context) => {
      getAuthContext(context);
      return subtaskService.getSubtaskProgress(args.parentTaskId);
    },

    // Case Subscriptions (AC: 6)
    caseSubscription: async (_: any, args: { caseId: string }, context: Context) => {
      const { userId } = getAuthContext(context);
      return caseSubscriptionService.getSubscription(args.caseId, userId);
    },

    myCaseSubscriptions: async (_: any, __: any, context: Context) => {
      const { userId } = getAuthContext(context);
      return caseSubscriptionService.getUserSubscriptions(userId);
    },

    myDailyDigest: async (_: any, args: { date?: string }, context: Context) => {
      const { userId } = getAuthContext(context);
      const date = args.date ? new Date(args.date) : undefined;
      return caseSubscriptionService.generateDailyDigest(userId, date);
    },
  },

  // ============================================================================
  // Mutation Resolvers
  // ============================================================================
  Mutation: {
    // Task Comments (AC: 1)
    createTaskComment: async (_: any, args: { input: any }, context: Context) => {
      const { userId, firmId } = getAuthContext(context);
      return taskCommentService.createComment(args.input, userId, firmId);
    },

    updateTaskComment: async (
      _: any,
      args: { commentId: string; input: any },
      context: Context
    ) => {
      const { userId } = getAuthContext(context);
      return taskCommentService.updateComment(args.commentId, args.input, userId);
    },

    deleteTaskComment: async (_: any, args: { commentId: string }, context: Context) => {
      const { userId } = getAuthContext(context);
      await taskCommentService.deleteComment(args.commentId, userId);
      return true;
    },

    // Task Attachments (AC: 3)
    // Note: Upload is handled via REST endpoint due to file upload limitations in GraphQL
    deleteTaskAttachment: async (
      _: any,
      args: { attachmentId: string },
      context: Context
    ) => {
      const { userId, firmId } = getAuthContext(context);
      await taskAttachmentService.deleteAttachment(args.attachmentId, userId, firmId);
      return true;
    },

    // Subtasks (AC: 4)
    createSubtask: async (_: any, args: { input: any }, context: Context) => {
      const { userId, firmId } = getAuthContext(context);
      return subtaskService.createSubtask(args.input, userId, firmId);
    },

    completeSubtask: async (_: any, args: { subtaskId: string }, context: Context) => {
      const { userId, firmId } = getAuthContext(context);
      return subtaskService.completeSubtask(args.subtaskId, userId, firmId);
    },

    // Case Subscriptions (AC: 6)
    subscribeToCaseFeed: async (
      _: any,
      args: { caseId: string; options?: any },
      context: Context
    ) => {
      const { userId } = getAuthContext(context);
      return caseSubscriptionService.subscribe(args.caseId, userId, args.options);
    },

    unsubscribeFromCaseFeed: async (_: any, args: { caseId: string }, context: Context) => {
      const { userId } = getAuthContext(context);
      await caseSubscriptionService.unsubscribe(args.caseId, userId);
      return true;
    },

    updateCaseSubscription: async (
      _: any,
      args: { caseId: string; input: any },
      context: Context
    ) => {
      const { userId } = getAuthContext(context);
      return caseSubscriptionService.updateSubscription(args.caseId, userId, args.input);
    },
  },

  // ============================================================================
  // Field Resolvers
  // ============================================================================

  TaskComment: {
    author: async (parent: any) => {
      if (parent.author) return parent.author;
      const loaders = getTaskCollaborationLoaders();
      return loaders.userLoader.load(parent.authorId);
    },
    parent: async (parent: any) => {
      if (!parent.parentId) return null;
      if (parent.parent) return parent.parent;
      return prisma.taskComment.findUnique({
        where: { id: parent.parentId },
        include: { author: true },
      });
    },
    replies: async (parent: any) => {
      if (parent.replies) return parent.replies;
      return prisma.taskComment.findMany({
        where: { parentId: parent.id },
        include: { author: true },
        orderBy: { createdAt: 'asc' },
      });
    },
    mentionedUsers: async (parent: any) => {
      if (!parent.mentions || parent.mentions.length === 0) return [];
      const loaders = getTaskCollaborationLoaders();
      return loaders.userLoader.loadMany(parent.mentions);
    },
  },

  TaskHistoryEntry: {
    actor: async (parent: any) => {
      if (parent.actor) return parent.actor;
      const loaders = getTaskCollaborationLoaders();
      return loaders.userLoader.load(parent.actorId);
    },
  },

  CaseActivityEntry: {
    case: async (parent: any) => {
      const loaders = getTaskCollaborationLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
    actor: async (parent: any) => {
      if (parent.actor) return parent.actor;
      const loaders = getTaskCollaborationLoaders();
      return loaders.userLoader.load(parent.actorId);
    },
  },

  TaskAttachment: {
    uploader: async (parent: any) => {
      if (parent.uploader) return parent.uploader;
      const loaders = getTaskCollaborationLoaders();
      return loaders.userLoader.load(parent.uploadedBy);
    },
    document: async (parent: any) => {
      if (!parent.documentId) return null;
      if (parent.document) return parent.document;
      const loaders = getTaskCollaborationLoaders();
      return loaders.documentLoader.load(parent.documentId);
    },
    previousVersion: async (parent: any) => {
      if (!parent.previousVersionId) return null;
      return prisma.taskAttachment.findUnique({
        where: { id: parent.previousVersionId },
        include: { uploader: true },
      });
    },
  },

  CaseSubscription: {
    case: async (parent: any) => {
      const loaders = getTaskCollaborationLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
    user: async (parent: any) => {
      const loaders = getTaskCollaborationLoaders();
      return loaders.userLoader.load(parent.userId);
    },
  },

  SubtaskWithContext: {
    subtask: (parent: any) => parent.subtask,
    parentTask: (parent: any) => parent.parentTask,
  },

  // ============================================================================
  // Subscription Resolvers (for real-time updates)
  // ============================================================================
  Subscription: {
    taskCommentAdded: {
      subscribe: async (_: any, args: { taskId: string }, context: Context) => {
        // This would use pubsub in a real implementation
        // For now, return a placeholder
        throw new GraphQLError('Subscriptions not yet implemented');
      },
    },
    caseActivityAdded: {
      subscribe: async (_: any, args: { caseId: string }, context: Context) => {
        throw new GraphQLError('Subscriptions not yet implemented');
      },
    },
  },
};

export default taskCollaborationResolvers;
