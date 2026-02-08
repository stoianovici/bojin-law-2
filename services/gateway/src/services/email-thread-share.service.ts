/**
 * Email Thread Share Service
 *
 * Handles sharing email threads between team members.
 * Allows users to grant access to their email conversations
 * so colleagues can view them in the platform.
 */

import { PrismaClient, ShareAccessLevel } from '@prisma/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ShareThreadInput {
  conversationId: string;
  sharedByUserId: string;
  sharedWithUserId: string;
  firmId: string;
  accessLevel?: ShareAccessLevel;
}

export interface ShareResult {
  success: boolean;
  shareId: string;
  sharedWith: string;
  sharedWithName: string;
}

export interface ThreadShareInfo {
  id: string;
  conversationId: string;
  sharedBy: string;
  sharedByName?: string;
  sharedWith: string;
  sharedWithName?: string;
  accessLevel: ShareAccessLevel;
  createdAt: Date;
}

// ============================================================================
// Email Thread Share Service
// ============================================================================

export class EmailThreadShareService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Share an email thread with a colleague.
   *
   * Creates a share record that grants the recipient access to view
   * all emails in the conversation that belong to the sharer.
   */
  async shareThread(input: ShareThreadInput): Promise<ShareResult> {
    const {
      conversationId,
      sharedByUserId,
      sharedWithUserId,
      firmId,
      accessLevel = ShareAccessLevel.Read,
    } = input;

    logger.info('[EmailThreadShare] Sharing thread', {
      conversationId,
      sharedBy: sharedByUserId,
      sharedWith: sharedWithUserId,
      accessLevel,
    });

    // Verify sharedWith user exists and is in the same firm
    const sharedWithUser = await this.prisma.user.findFirst({
      where: {
        id: sharedWithUserId,
        firmId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!sharedWithUser) {
      throw new Error('Utilizatorul nu există sau nu face parte din aceeași firmă');
    }

    // Verify the sharer has emails in this conversation
    const sharerEmails = await this.prisma.email.count({
      where: {
        conversationId,
        userId: sharedByUserId,
      },
    });

    if (sharerEmails === 0) {
      throw new Error('Nu aveți email-uri în această conversație');
    }

    // Create or update the share (upsert to handle re-sharing)
    const share = await this.prisma.emailThreadShare.upsert({
      where: {
        conversationId_sharedWith_firmId: {
          conversationId,
          sharedWith: sharedWithUserId,
          firmId,
        },
      },
      create: {
        conversationId,
        sharedBy: sharedByUserId,
        sharedWith: sharedWithUserId,
        firmId,
        accessLevel,
      },
      update: {
        sharedBy: sharedByUserId,
        accessLevel,
      },
    });

    logger.info('[EmailThreadShare] Thread shared successfully', {
      shareId: share.id,
      conversationId,
    });

    return {
      success: true,
      shareId: share.id,
      sharedWith: sharedWithUser.email,
      sharedWithName: `${sharedWithUser.firstName} ${sharedWithUser.lastName}`.trim(),
    };
  }

  /**
   * Remove a thread share.
   */
  async unshareThread(
    conversationId: string,
    sharedWithUserId: string,
    firmId: string,
    currentUserId: string
  ): Promise<boolean> {
    // Find the share
    const share = await this.prisma.emailThreadShare.findUnique({
      where: {
        conversationId_sharedWith_firmId: {
          conversationId,
          sharedWith: sharedWithUserId,
          firmId,
        },
      },
    });

    if (!share) {
      return false;
    }

    // Only the sharer can remove the share
    if (share.sharedBy !== currentUserId) {
      throw new Error('Nu aveți permisiunea de a revoca acest acces');
    }

    await this.prisma.emailThreadShare.delete({
      where: { id: share.id },
    });

    logger.info('[EmailThreadShare] Share removed', {
      shareId: share.id,
      conversationId,
    });

    return true;
  }

  /**
   * Get all shares for a conversation (threads I've shared with others).
   */
  async getThreadShares(
    conversationId: string,
    sharedByUserId: string
  ): Promise<ThreadShareInfo[]> {
    const shares = await this.prisma.emailThreadShare.findMany({
      where: {
        conversationId,
        sharedBy: sharedByUserId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user names for display
    const userIds = shares.map((s) => s.sharedWith);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return shares.map((s) => ({
      id: s.id,
      conversationId: s.conversationId,
      sharedBy: s.sharedBy,
      sharedWith: s.sharedWith,
      sharedWithName: userMap.get(s.sharedWith),
      accessLevel: s.accessLevel,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Get threads shared with me.
   */
  async getSharedWithMe(userId: string, firmId: string): Promise<ThreadShareInfo[]> {
    const shares = await this.prisma.emailThreadShare.findMany({
      where: {
        sharedWith: userId,
        firmId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user names for display
    const userIds = shares.map((s) => s.sharedBy);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return shares.map((s) => ({
      id: s.id,
      conversationId: s.conversationId,
      sharedBy: s.sharedBy,
      sharedByName: userMap.get(s.sharedBy),
      sharedWith: s.sharedWith,
      accessLevel: s.accessLevel,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Check if a user has access to a thread via sharing.
   *
   * Returns the access level if shared, null otherwise.
   */
  async getShareAccess(
    conversationId: string,
    userId: string,
    firmId: string
  ): Promise<ShareAccessLevel | null> {
    const share = await this.prisma.emailThreadShare.findUnique({
      where: {
        conversationId_sharedWith_firmId: {
          conversationId,
          sharedWith: userId,
          firmId,
        },
      },
      select: { accessLevel: true },
    });

    return share?.accessLevel || null;
  }

  /**
   * Get all conversation IDs that have been shared with a user.
   */
  async getSharedConversationIds(userId: string, firmId: string): Promise<string[]> {
    const shares = await this.prisma.emailThreadShare.findMany({
      where: {
        sharedWith: userId,
        firmId,
      },
      select: { conversationId: true },
    });

    return shares.map((s) => s.conversationId);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailThreadShareServiceInstance: EmailThreadShareService | null = null;

export function getEmailThreadShareService(prisma: PrismaClient): EmailThreadShareService {
  if (!emailThreadShareServiceInstance) {
    emailThreadShareServiceInstance = new EmailThreadShareService(prisma);
  }
  return emailThreadShareServiceInstance;
}
