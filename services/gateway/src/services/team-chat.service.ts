/**
 * Team Chat Service
 * Task 3.2: Team Chat Service
 *
 * Provides ephemeral team chat functionality with:
 * - 24-hour message expiration
 * - Real-time typing indicators via Redis
 * - Threaded replies support
 * - User mentions
 * - GraphQL subscription events via PubSub
 */

import { PubSub } from 'graphql-subscriptions';
import { prisma, redis } from '@legal-platform/database';

// ============================================================================
// Event Constants
// ============================================================================

export const TEAM_CHAT_MESSAGE_RECEIVED = 'TEAM_CHAT_MESSAGE_RECEIVED';
export const TEAM_CHAT_MESSAGE_DELETED = 'TEAM_CHAT_MESSAGE_DELETED';
export const TEAM_CHAT_TYPING_UPDATED = 'TEAM_CHAT_TYPING_UPDATED';

// ============================================================================
// PubSub Instance
// ============================================================================

export const pubsub = new PubSub();

// ============================================================================
// Service
// ============================================================================

class TeamChatService {
  private readonly typingTtl = 5; // seconds

  /**
   * Get Redis key for typing indicators
   */
  private getTypingKey(firmId: string): string {
    return `team_chat:typing:${firmId}`;
  }

  /**
   * Send a new chat message
   * Messages automatically expire after 24 hours
   */
  async sendMessage(
    firmId: string,
    authorId: string,
    content: string,
    parentId?: string,
    mentions?: string[]
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const message = await prisma.teamChatMessage.create({
      data: {
        firmId,
        authorId,
        content,
        parentId: parentId || null,
        mentions: mentions || [],
        expiresAt,
      },
      include: {
        author: true,
      },
    });

    await pubsub.publish(`${TEAM_CHAT_MESSAGE_RECEIVED}:${firmId}`, {
      teamChatMessageReceived: message,
    });

    return message;
  }

  /**
   * Delete a chat message
   * Only the author can delete their own messages
   */
  async deleteMessage(id: string, userId: string): Promise<boolean> {
    const message = await prisma.teamChatMessage.findUnique({
      where: { id },
    });

    if (!message || message.authorId !== userId) {
      return false;
    }

    await prisma.teamChatMessage.delete({
      where: { id },
    });

    await pubsub.publish(`${TEAM_CHAT_MESSAGE_DELETED}:${message.firmId}`, {
      teamChatMessageDeleted: id,
    });

    return true;
  }

  /**
   * Get chat messages for a firm
   * Returns non-expired messages, optionally filtered by parent
   */
  async getMessages(firmId: string, limit = 50, offset = 0, parentId?: string) {
    return prisma.teamChatMessage.findMany({
      where: {
        firmId,
        parentId: parentId || null,
        expiresAt: { gt: new Date() },
      },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get replies to a specific message
   */
  async getReplies(messageId: string) {
    return prisma.teamChatMessage.findMany({
      where: {
        parentId: messageId,
        expiresAt: { gt: new Date() },
      },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Set typing indicator for a user
   * Uses Redis sorted set with timestamp scores for automatic expiration
   */
  async setTyping(
    firmId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<boolean> {
    const key = this.getTypingKey(firmId);

    if (isTyping) {
      const score = Date.now();
      await redis.zadd(key, score, JSON.stringify({ userId, userName }));
      await redis.expire(key, this.typingTtl * 2);
    } else {
      // Remove by scanning for user
      const members = await redis.zrange(key, 0, -1);
      for (const member of members) {
        const parsed = JSON.parse(member);
        if (parsed.userId === userId) {
          await redis.zrem(key, member);
          break;
        }
      }
    }

    const typingUsers = await this.getTypingUsers(firmId);
    await pubsub.publish(`${TEAM_CHAT_TYPING_UPDATED}:${firmId}`, {
      teamChatTypingUpdated: typingUsers,
    });

    return true;
  }

  /**
   * Get currently typing users for a firm
   * Automatically removes stale entries older than typingTtl
   */
  async getTypingUsers(firmId: string): Promise<Array<{ userId: string; userName: string }>> {
    const key = this.getTypingKey(firmId);
    const cutoff = Date.now() - this.typingTtl * 1000;

    // Remove stale entries
    await redis.zremrangebyscore(key, 0, cutoff);

    const members = await redis.zrange(key, 0, -1);
    return members.map((m) => JSON.parse(m));
  }

  /**
   * Cleanup expired messages
   * Should be called by a background job periodically
   */
  async cleanupExpiredMessages(): Promise<number> {
    const result = await prisma.teamChatMessage.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const teamChatService = new TeamChatService();
