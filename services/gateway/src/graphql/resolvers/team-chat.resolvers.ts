/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Team Chat Resolvers
 * Real-time ephemeral team chat with subscriptions
 *
 * Provides:
 * - Query: teamChatMessages, teamChatTypingUsers
 * - Mutation: sendTeamChatMessage, deleteTeamChatMessage, setTeamChatTyping
 * - Subscription: teamChatMessageReceived, teamChatMessageDeleted, teamChatTypingUpdated
 */

import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';
import {
  teamChatService,
  pubsub,
  TEAM_CHAT_MESSAGE_RECEIVED,
  TEAM_CHAT_MESSAGE_DELETED,
  TEAM_CHAT_TYPING_UPDATED,
  type ChatAttachment,
} from '../../services/team-chat.service';
import { requireAuth, type Context } from '../utils/auth';

/**
 * Get display name from user context
 */
function getUserName(user: NonNullable<Context['user']>): string {
  return user.name || user.email.split('@')[0];
}

// ============================================================================
// Resolvers
// ============================================================================

const teamChatResolvers = {
  // ==========================================================================
  // Query Resolvers
  // ==========================================================================
  Query: {
    /**
     * Get team chat messages with pagination
     * Optionally filter by parentId for thread replies
     */
    teamChatMessages: async (
      _: unknown,
      args: { limit?: number; offset?: number; parentId?: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { limit = 50, offset = 0, parentId } = args;

      return teamChatService.getMessages(user.firmId, limit, offset, parentId || undefined);
    },

    /**
     * Get list of users currently typing
     */
    teamChatTypingUsers: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      return teamChatService.getTypingUsers(user.firmId);
    },
  },

  // ==========================================================================
  // Mutation Resolvers
  // ==========================================================================
  Mutation: {
    /**
     * Send a new team chat message
     */
    sendTeamChatMessage: async (
      _: unknown,
      args: {
        content: string;
        parentId?: string;
        mentions?: string[];
        attachments?: ChatAttachment[];
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { content, parentId, mentions, attachments } = args;

      if (!content.trim()) {
        throw new GraphQLError('Message content cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Clear typing indicator when sending message
      await teamChatService.setTyping(user.firmId, user.id, getUserName(user), false);

      return teamChatService.sendMessage(
        user.firmId,
        user.id,
        content.trim(),
        parentId || undefined,
        mentions || undefined,
        attachments || undefined
      );
    },

    /**
     * Delete a team chat message (author only)
     */
    deleteTeamChatMessage: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);
      const { id } = args;

      const deleted = await teamChatService.deleteMessage(id, user.id);

      if (!deleted) {
        throw new GraphQLError('Message not found or you are not the author', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return true;
    },

    /**
     * Set typing indicator status
     */
    setTeamChatTyping: async (_: unknown, args: { isTyping: boolean }, context: Context) => {
      const user = requireAuth(context);
      const { isTyping } = args;

      return teamChatService.setTyping(user.firmId, user.id, getUserName(user), isTyping);
    },
  },

  // ==========================================================================
  // Subscription Resolvers
  // ==========================================================================
  Subscription: {
    /**
     * Subscribe to new messages in the user's firm
     */
    teamChatMessageReceived: {
      subscribe: withFilter(
        (_: unknown, __: unknown, context: Context) => {
          const user = requireAuth(context);
          return pubsub.asyncIterableIterator(`${TEAM_CHAT_MESSAGE_RECEIVED}:${user.firmId}`);
        },
        (payload: any, _: unknown, context: Context) => {
          // Only receive messages from the same firm
          const user = context.user;
          if (!user) return false;
          return payload.teamChatMessageReceived?.firmId === user.firmId;
        }
      ),
    },

    /**
     * Subscribe to deleted message notifications
     */
    teamChatMessageDeleted: {
      subscribe: withFilter(
        (_: unknown, __: unknown, context: Context) => {
          const user = requireAuth(context);
          return pubsub.asyncIterableIterator(`${TEAM_CHAT_MESSAGE_DELETED}:${user.firmId}`);
        },
        (_payload: any, _: unknown, context: Context) => {
          return !!context.user;
        }
      ),
    },

    /**
     * Subscribe to typing indicator updates
     */
    teamChatTypingUpdated: {
      subscribe: withFilter(
        (_: unknown, __: unknown, context: Context) => {
          const user = requireAuth(context);
          return pubsub.asyncIterableIterator(`${TEAM_CHAT_TYPING_UPDATED}:${user.firmId}`);
        },
        (_payload: any, _: unknown, context: Context) => {
          return !!context.user;
        }
      ),
    },
  },

  // ==========================================================================
  // Field Resolvers
  // ==========================================================================
  TeamChatMessage: {
    /**
     * Lazy load replies for a message
     */
    replies: async (parent: { id: string }) => {
      return teamChatService.getReplies(parent.id);
    },
  },
};

export default teamChatResolvers;
