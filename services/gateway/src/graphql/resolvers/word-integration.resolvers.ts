/**
 * Word Integration GraphQL Resolvers
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Resolvers for document locking, comments, track changes, and sync operations.
 */

import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import { PubSub } from 'graphql-subscriptions';
import { prisma } from '@legal-platform/database';
import { wordIntegrationService } from '../../services/word-integration.service';
import { oneDriveSyncService } from '../../services/onedrive-sync.service';
import { documentCommentsService } from '../../services/document-comments.service';
import { trackChangesService } from '../../services/track-changes.service';
import logger from '../../utils/logger';

// Subscription event names
const DOCUMENT_LOCK_CHANGED = 'DOCUMENT_LOCK_CHANGED';
const COMMENT_ADDED = 'COMMENT_ADDED';
const COMMENT_RESOLVED = 'COMMENT_RESOLVED';
const DOCUMENT_SYNC_STATUS_CHANGED = 'DOCUMENT_SYNC_STATUS_CHANGED';

// PubSub events type - maps event name patterns to payload types
type PubSubChannels = {
  [key: `${typeof DOCUMENT_LOCK_CHANGED}.${string}`]: { documentLockChanged: unknown };
  [key: `${typeof COMMENT_ADDED}.${string}`]: { commentAdded: unknown };
  [key: `${typeof COMMENT_RESOLVED}.${string}`]: { commentResolved: unknown };
  [key: `${typeof DOCUMENT_SYNC_STATUS_CHANGED}.${string}`]: { documentSyncStatusChanged: unknown };
};

const pubsub = new PubSub<PubSubChannels>();

/**
 * Context type from Apollo Server
 */
interface Context {
  user?: {
    userId: string;
    firmId: string;
    role: string;
    accessToken: string;
  };
}

/**
 * Require authentication
 */
function requireAuth(context: Context): NonNullable<Context['user']> {
  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }
  return context.user;
}

export const wordIntegrationResolvers = {
  Query: {
    /**
     * Get lock status for a document
     */
    documentLockStatus: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const lock = await wordIntegrationService.getDocumentLock(args.documentId);

      return {
        isLocked: !!lock,
        lock,
        currentUserHoldsLock: lock?.userId === user.userId,
      };
    },

    /**
     * Get all comments for a document
     */
    documentComments: async (
      _: unknown,
      args: { documentId: string; unresolvedOnly?: boolean },
      context: Context
    ) => {
      requireAuth(context);

      const comments = await documentCommentsService.getDocumentComments(args.documentId);

      if (args.unresolvedOnly) {
        return comments.filter((c) => !c.resolved);
      }

      return comments;
    },

    /**
     * Get track changes from a Word document
     */
    documentTrackChanges: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Get document OneDrive ID
      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        select: { oneDriveId: true },
      });

      if (!document?.oneDriveId) {
        return [];
      }

      return trackChangesService.extractTrackChanges(
        args.documentId,
        user.accessToken,
        document.oneDriveId
      );
    },

    /**
     * Get track changes summary
     */
    documentTrackChangesSummary: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Get document OneDrive ID
      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        select: { oneDriveId: true },
      });

      if (!document?.oneDriveId) {
        return {
          totalChanges: 0,
          insertions: 0,
          deletions: 0,
          modifications: 0,
          formatChanges: 0,
          authors: [],
          summary: 'No changes',
        };
      }

      const trackChanges = await trackChangesService.extractTrackChanges(
        args.documentId,
        user.accessToken,
        document.oneDriveId
      );

      return trackChangesService.formatChangesSummary(trackChanges);
    },

    /**
     * Get sync status for a document
     */
    documentSyncStatus: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      requireAuth(context);

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        select: {
          oneDriveId: true,
          oneDrivePath: true,
          updatedAt: true,
        },
      });

      if (!document) {
        throw new UserInputError('Document not found');
      }

      return {
        status: document.oneDriveId ? 'SYNCED' : 'PENDING_CHANGES',
        lastSyncAt: document.updatedAt,
        oneDriveId: document.oneDriveId,
        oneDrivePath: document.oneDrivePath,
        errorMessage: null,
      };
    },
  },

  Mutation: {
    /**
     * Open a document in Word desktop
     */
    openInWord: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      logger.info('Opening document in Word', {
        documentId: args.documentId,
        userId: user.userId,
      });

      const session = await wordIntegrationService.openInWord(
        args.documentId,
        user.userId,
        user.accessToken
      );

      // Publish lock change
      pubsub.publish(`${DOCUMENT_LOCK_CHANGED}.${args.documentId}`, {
        documentLockChanged: {
          isLocked: true,
          lock: await wordIntegrationService.getDocumentLock(args.documentId),
          currentUserHoldsLock: true,
        },
      });

      return session;
    },

    /**
     * Close Word session and sync
     */
    closeWordSession: async (
      _: unknown,
      args: { documentId: string; lockToken: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      logger.info('Closing Word session', {
        documentId: args.documentId,
        userId: user.userId,
      });

      // Release lock
      await wordIntegrationService.releaseDocumentLock(args.documentId, user.userId);

      // Sync from OneDrive
      const syncResult = await oneDriveSyncService.syncDocumentChanges(
        args.documentId,
        user.accessToken
      );

      // Publish lock change
      pubsub.publish(`${DOCUMENT_LOCK_CHANGED}.${args.documentId}`, {
        documentLockChanged: {
          isLocked: false,
          lock: null,
          currentUserHoldsLock: false,
        },
      });

      return syncResult;
    },

    /**
     * Renew document lock
     */
    renewDocumentLock: async (
      _: unknown,
      args: { documentId: string; lockToken: string },
      context: Context
    ) => {
      requireAuth(context);

      return wordIntegrationService.renewDocumentLock(args.documentId, args.lockToken);
    },

    /**
     * Force release lock (admin only)
     */
    forceReleaseDocumentLock: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Only Partners can force release locks
      if (user.role !== 'Partner') {
        throw new ForbiddenError('Only Partners can force release document locks');
      }

      const lock = await wordIntegrationService.getDocumentLock(args.documentId);

      if (lock) {
        await wordIntegrationService.releaseDocumentLock(args.documentId, lock.userId);

        // Publish lock change
        pubsub.publish(`${DOCUMENT_LOCK_CHANGED}.${args.documentId}`, {
          documentLockChanged: {
            isLocked: false,
            lock: null,
            currentUserHoldsLock: false,
          },
        });
      }

      return true;
    },

    /**
     * Add a comment to a document
     */
    addDocumentComment: async (
      _: unknown,
      args: {
        input: {
          documentId: string;
          content: string;
          anchorText?: string;
          anchorStart?: number;
          anchorEnd?: number;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      const comment = await documentCommentsService.addComment({
        documentId: args.input.documentId,
        authorId: user.userId,
        content: args.input.content,
        anchorText: args.input.anchorText,
        anchorStart: args.input.anchorStart,
        anchorEnd: args.input.anchorEnd,
      });

      // Get full comment with author
      const commentWithAuthor = (
        await documentCommentsService.getDocumentComments(args.input.documentId)
      ).find((c) => c.id === comment.id);

      // Publish new comment
      pubsub.publish(`${COMMENT_ADDED}.${args.input.documentId}`, {
        commentAdded: commentWithAuthor,
      });

      return commentWithAuthor;
    },

    /**
     * Resolve a document comment
     */
    resolveDocumentComment: async (
      _: unknown,
      args: { commentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const comment = await documentCommentsService.resolveComment(
        args.commentId,
        user.userId
      );

      // Get full comment with author
      const commentWithAuthor = (
        await documentCommentsService.getDocumentComments(comment.documentId)
      ).find((c) => c.id === comment.id);

      // Publish resolution
      pubsub.publish(`${COMMENT_RESOLVED}.${comment.documentId}`, {
        commentResolved: commentWithAuthor,
      });

      return commentWithAuthor;
    },

    /**
     * Unresolve a document comment
     */
    unresolveDocumentComment: async (
      _: unknown,
      args: { commentId: string },
      context: Context
    ) => {
      requireAuth(context);

      const comment = await documentCommentsService.unresolveComment(args.commentId);

      // Get full comment with author
      const commentWithAuthor = (
        await documentCommentsService.getDocumentComments(comment.documentId)
      ).find((c) => c.id === comment.id);

      return commentWithAuthor;
    },

    /**
     * Delete a comment
     */
    deleteComment: async (
      _: unknown,
      args: { commentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Get comment to verify ownership
      const comment = await prisma.documentComment.findUnique({
        where: { id: args.commentId },
      });

      if (!comment) {
        throw new UserInputError('Comment not found');
      }

      // Only author or Partners can delete
      if (comment.authorId !== user.userId && user.role !== 'Partner') {
        throw new ForbiddenError('Cannot delete this comment');
      }

      await prisma.documentComment.delete({
        where: { id: args.commentId },
      });

      return true;
    },

    /**
     * Sync comments from Word
     */
    syncCommentsFromWord: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        select: { oneDriveId: true },
      });

      if (!document?.oneDriveId) {
        throw new UserInputError('Document is not in OneDrive');
      }

      return documentCommentsService.syncCommentsFromWord(
        args.documentId,
        user.accessToken,
        document.oneDriveId
      );
    },

    /**
     * Sync comments to Word
     */
    syncCommentsToWord: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const document = await prisma.document.findUnique({
        where: { id: args.documentId },
        select: { oneDriveId: true },
      });

      if (!document?.oneDriveId) {
        throw new UserInputError('Document is not in OneDrive');
      }

      return documentCommentsService.syncCommentsToWord(
        args.documentId,
        user.accessToken,
        document.oneDriveId
      );
    },

    /**
     * Manually sync from OneDrive
     */
    syncDocumentFromOneDrive: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      return oneDriveSyncService.syncDocumentChanges(args.documentId, user.accessToken);
    },

    /**
     * Upload document to OneDrive
     */
    uploadToOneDrive: async (
      _: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      return oneDriveSyncService.uploadToOneDrive(args.documentId, user.accessToken);
    },
  },

  Subscription: {
    documentLockChanged: {
      subscribe: (_: unknown, args: { documentId: string }) => {
        return pubsub.asyncIterableIterator(`${DOCUMENT_LOCK_CHANGED}.${args.documentId}` as keyof PubSubChannels);
      },
    },

    commentAdded: {
      subscribe: (_: unknown, args: { documentId: string }) => {
        return pubsub.asyncIterableIterator(`${COMMENT_ADDED}.${args.documentId}` as keyof PubSubChannels);
      },
    },

    commentResolved: {
      subscribe: (_: unknown, args: { documentId: string }) => {
        return pubsub.asyncIterableIterator(`${COMMENT_RESOLVED}.${args.documentId}` as keyof PubSubChannels);
      },
    },

    documentSyncStatusChanged: {
      subscribe: (_: unknown, args: { documentId: string }) => {
        return pubsub.asyncIterableIterator(`${DOCUMENT_SYNC_STATUS_CHANGED}.${args.documentId}` as keyof PubSubChannels);
      },
    },
  },

  // Type resolvers for nested fields
  DocumentLock: {
    user: async (parent: { userId: string }) => {
      return prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
  },

  DocumentComment: {
    author: async (parent: { authorId: string }) => {
      return prisma.user.findUnique({
        where: { id: parent.authorId },
      });
    },

    resolvedBy: async (parent: { resolvedBy?: string }) => {
      if (!parent.resolvedBy) return null;
      return prisma.user.findUnique({
        where: { id: parent.resolvedBy },
      });
    },
  },
};
