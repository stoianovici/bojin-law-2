/**
 * Word Integration Resolvers
 * Story 3.4: Word Integration with Live AI Assistance
 * OPS-164: Fix Word button to open in desktop Word
 *
 * GraphQL resolvers for Word document editing, locking, and sync.
 */

import { GraphQLError } from 'graphql';
import { wordIntegrationService } from '../../services/word-integration.service';
import { requireAuth, type Context } from '../utils/auth';

// ============================================================================
// Resolvers
// ============================================================================

export const wordIntegrationResolvers = {
  Query: {
    // Get lock status for a document
    documentLockStatus: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      const lock = await wordIntegrationService.getDocumentLock(args.documentId);

      return {
        isLocked: !!lock,
        lock,
        currentUserHoldsLock: lock?.userId === user.id,
      };
    },
  },

  Mutation: {
    // Open a document in Word desktop application
    openInWord: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft access token required', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      try {
        const session = await wordIntegrationService.openInWord(
          args.documentId,
          user.id,
          user.accessToken
        );

        return {
          documentId: session.documentId,
          wordUrl: session.wordUrl,
          webUrl: session.webUrl,
          lockToken: session.lockToken,
          expiresAt: session.expiresAt,
          oneDriveId: session.oneDriveId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to open document in Word';
        throw new GraphQLError(message, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // Renew an existing document lock
    renewDocumentLock: async (
      _: any,
      args: { documentId: string; lockToken: string },
      context: Context
    ) => {
      requireAuth(context);

      try {
        const lock = await wordIntegrationService.renewDocumentLock(
          args.documentId,
          args.lockToken
        );
        return lock;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to renew lock';
        throw new GraphQLError(message, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // Force release a document lock (admin only)
    forceReleaseDocumentLock: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only partners can force release locks', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get the lock to find the current holder
      const lock = await wordIntegrationService.getDocumentLock(args.documentId);
      if (!lock) {
        return true; // Already unlocked
      }

      return wordIntegrationService.releaseDocumentLock(args.documentId, lock.userId);
    },

    // Close a Word editing session and sync changes (OPS-182, OPS-184)
    closeWordSession: async (
      _: any,
      args: { documentId: string; lockToken: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft access token required', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      try {
        const result = await wordIntegrationService.closeWordSession(
          args.documentId,
          args.lockToken,
          user.accessToken,
          user.id
        );

        return {
          updated: result.updated,
          newVersionNumber: result.newVersionNumber,
          trackChanges: null, // Not implemented yet
          commentsCount: null, // Not implemented yet
          migrated: result.migrated, // OPS-184: OneDrive to SharePoint migration
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to close Word session';
        throw new GraphQLError(message, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // Explicit sync from SharePoint (OPS-182)
    syncDocumentFromSharePoint: async (_: any, args: { documentId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft access token required', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      try {
        const result = await wordIntegrationService.syncFromSharePointIfChanged(
          args.documentId,
          user.accessToken,
          user.id
        );

        return {
          updated: result.synced,
          newVersionNumber: result.newVersion,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to sync from SharePoint';
        throw new GraphQLError(message, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },
  },
};
