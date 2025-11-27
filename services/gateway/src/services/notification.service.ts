/**
 * Notification Service
 * Story 2.8.2: Case Approval Workflow
 *
 * Handles creation and management of in-app notifications for approval workflow events
 */

import { prisma } from '@legal-platform/database';
import { NotificationType } from '@prisma/client';

export interface NotificationContext {
  caseId: string;
  caseTitle: string;
  actorName: string;
  revisionCount?: number;
  rejectionReason?: string;
}

export class NotificationService {
  /**
   * Send notification to Partners when case is submitted for approval (AC2)
   * Sent to ALL Partners in the firm
   */
  async notifyCasePendingApproval(
    firmId: string,
    context: NotificationContext
  ): Promise<void> {
    // Get all Partners in the firm
    const partners = await prisma.user.findMany({
      where: {
        firmId,
        role: 'Partner',
        status: 'Active',
      },
    });

    if (!partners || partners.length === 0) {
      console.warn(`No active Partners found in firm ${firmId} for notification`);
      return;
    }

    const revisionText =
      context.revisionCount && context.revisionCount > 0
        ? ` (Revision #${context.revisionCount})`
        : '';

    // Create notification for each Partner
    await prisma.notification.createMany({
      data: partners.map((partner) => ({
        userId: partner.id,
        type: NotificationType.CasePendingApproval,
        title: 'New Case Pending Approval',
        message: `Case "${context.caseTitle}" submitted by ${context.actorName} needs approval${revisionText}`,
        link: `/cases/${context.caseId}`,
        caseId: context.caseId,
      })),
    });
  }

  /**
   * Send notification to Associate when case is approved (AC7)
   */
  async notifyCaseApproved(
    userId: string,
    context: NotificationContext
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.CaseApproved,
        title: 'Case Approved',
        message: `Your case "${context.caseTitle}" has been approved by ${context.actorName}`,
        link: `/cases/${context.caseId}`,
        caseId: context.caseId,
      },
    });
  }

  /**
   * Send notification to Associate when case is rejected (AC7)
   */
  async notifyCaseRejected(
    userId: string,
    context: NotificationContext
  ): Promise<void> {
    const reasonPreview = context.rejectionReason
      ? ` Reason: ${context.rejectionReason.substring(0, 100)}${
          context.rejectionReason.length > 100 ? '...' : ''
        }`
      : '';

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.CaseRejected,
        title: 'Case Rejected - Action Required',
        message: `Your case "${context.caseTitle}" was rejected by ${context.actorName}.${reasonPreview}`,
        link: `/cases/${context.caseId}`,
        caseId: context.caseId,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Security: Only allow user to mark their own notifications
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options?: { read?: boolean; limit?: number }
  ) {
    const where: any = { userId };

    if (options?.read !== undefined) {
      where.read = options.read;
    }

    return await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 50,
      include: {
        user: true,
      },
    });
  }

  /**
   * Get unread notification count for badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
