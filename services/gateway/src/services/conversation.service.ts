/**
 * Conversation Service
 * OPS-065: Conversation Service
 *
 * Manages AI conversation state, including CRUD operations for conversations
 * and messages with firm isolation.
 */

import { prisma } from '@legal-platform/database';
import {
  AIConversation,
  AIMessage,
  ConversationStatus,
  AIMessageRole,
  AIActionStatus,
} from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface UserContext {
  userId: string;
  firmId: string;
}

interface CreateMessageInput {
  role: AIMessageRole;
  content: string;
  intent?: string;
  confidence?: number;
  actionType?: string;
  actionPayload?: Record<string, unknown>;
  actionStatus?: AIActionStatus;
  tokensUsed?: number;
  modelUsed?: string;
  latencyMs?: number;
}

interface ConversationWithMessages extends AIConversation {
  messages: AIMessage[];
}

// ============================================================================
// Service
// ============================================================================

export class ConversationService {
  /**
   * Get or create an active conversation for the user.
   * Returns existing active conversation if one exists for the context.
   */
  async getOrCreateConversation(
    userContext: UserContext,
    caseId?: string
  ): Promise<AIConversation> {
    // Look for existing active conversation
    const existing = await prisma.aIConversation.findFirst({
      where: {
        firmId: userContext.firmId,
        userId: userContext.userId,
        caseId: caseId ?? null,
        status: ConversationStatus.Active,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation
    const conversation = await prisma.aIConversation.create({
      data: {
        firmId: userContext.firmId,
        userId: userContext.userId,
        caseId: caseId ?? null,
        status: ConversationStatus.Active,
        context: {},
      },
    });

    return conversation;
  }

  /**
   * Get a conversation by ID with firm isolation.
   */
  async getConversation(id: string, firmId: string): Promise<ConversationWithMessages | null> {
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        firmId, // Firm isolation
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }, // Oldest first
        },
      },
    });

    return conversation;
  }

  /**
   * Add a message to a conversation.
   */
  async addMessage(
    conversationId: string,
    message: CreateMessageInput,
    firmId: string
  ): Promise<AIMessage> {
    // Verify conversation exists and belongs to firm
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        firmId,
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // When adding a new Proposed action, mark any old Proposed actions as Rejected
    // This prevents stale proposed actions from being accidentally confirmed
    if (message.actionStatus === 'Proposed') {
      await prisma.aIMessage.updateMany({
        where: {
          conversationId,
          actionStatus: 'Proposed',
        },
        data: {
          actionStatus: 'Rejected',
        },
      });
    }

    // Create message
    const newMessage = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: message.role,
        content: message.content,
        intent: message.intent,
        confidence: message.confidence,
        actionType: message.actionType,
        actionPayload: message.actionPayload
          ? JSON.parse(JSON.stringify(message.actionPayload))
          : undefined,
        actionStatus: message.actionStatus,
        tokensUsed: message.tokensUsed,
        modelUsed: message.modelUsed,
        latencyMs: message.latencyMs,
      },
    });

    // Update conversation updatedAt timestamp
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return newMessage;
  }

  /**
   * Update conversation status.
   */
  async updateStatus(
    id: string,
    status: ConversationStatus,
    firmId: string
  ): Promise<AIConversation> {
    // Verify conversation exists and belongs to firm
    const existing = await prisma.aIConversation.findFirst({
      where: {
        id,
        firmId,
      },
    });

    if (!existing) {
      throw new Error('Conversation not found');
    }

    const conversation = await prisma.aIConversation.update({
      where: { id },
      data: {
        status,
        closedAt:
          status === ConversationStatus.Completed || status === ConversationStatus.Expired
            ? new Date()
            : undefined,
      },
    });

    return conversation;
  }

  /**
   * Update message action status (when action is confirmed/executed).
   */
  async updateMessageActionStatus(
    messageId: string,
    status: AIActionStatus,
    firmId: string
  ): Promise<AIMessage> {
    // Get message with conversation to verify firm
    const message = await prisma.aIMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversation.firmId !== firmId) {
      throw new Error('Message not found');
    }

    const updatedMessage = await prisma.aIMessage.update({
      where: { id: messageId },
      data: { actionStatus: status },
    });

    return updatedMessage;
  }

  /**
   * Close a conversation.
   */
  async closeConversation(id: string, firmId: string): Promise<AIConversation> {
    return this.updateStatus(id, ConversationStatus.Completed, firmId);
  }

  /**
   * Get conversation history for a user.
   */
  async getHistory(
    userContext: UserContext,
    limit: number,
    caseId?: string
  ): Promise<AIConversation[]> {
    const conversations = await prisma.aIConversation.findMany({
      where: {
        firmId: userContext.firmId,
        userId: userContext.userId,
        ...(caseId !== undefined ? { caseId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return conversations;
  }

  /**
   * Expire stale conversations (for cleanup job).
   * Conversations older than 24 hours are marked as Expired.
   */
  async expireStaleConversations(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.aIConversation.updateMany({
      where: {
        status: ConversationStatus.Active,
        updatedAt: { lt: twentyFourHoursAgo },
      },
      data: {
        status: ConversationStatus.Expired,
        closedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get active conversation count for a user (useful for limits).
   */
  async getActiveConversationCount(userContext: UserContext): Promise<number> {
    const count = await prisma.aIConversation.count({
      where: {
        firmId: userContext.firmId,
        userId: userContext.userId,
        status: ConversationStatus.Active,
      },
    });

    return count;
  }

  /**
   * Get conversation with case details.
   */
  async getConversationWithCase(
    id: string,
    firmId: string
  ): Promise<
    | (ConversationWithMessages & {
        case?: { id: string; caseNumber: string; title: string } | null;
      })
    | null
  > {
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        firmId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
          },
        },
      },
    });

    return conversation;
  }
}

// Export singleton instance
export const conversationService = new ConversationService();
