// @ts-nocheck
/**
 * Notification Service
 * Story 2.8.2: Case Approval Workflow
 * Story 3.6: Document Review and Approval Workflow
 *
 * Handles creation and management of in-app notifications for approval workflow events
 */

import { prisma } from '@legal-platform/database';
import { NotificationType } from '@prisma/client';
import type {
  DocumentReviewContext,
  CommentContext,
  MentionContext,
} from '@legal-platform/shared/types';

export interface NotificationContext {
  caseId: string;
  caseTitle: string;
  actorName: string;
  revisionCount?: number;
  rejectionReason?: string;
}

export { DocumentReviewContext, CommentContext, MentionContext };

export class NotificationService {
  /**
   * Send notification to Partners when case is submitted for approval (AC2)
   * Sent to ALL Partners in the firm
   */
  async notifyCasePendingApproval(firmId: string, context: NotificationContext): Promise<void> {
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
  async notifyCaseApproved(userId: string, context: NotificationContext): Promise<void> {
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
  async notifyCaseRejected(userId: string, context: NotificationContext): Promise<void> {
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
   * Send notification to Partners when a case is created without financial info
   * Sent to ALL Partners in the firm
   */
  async notifyCaseNeedsFinancialSetup(firmId: string, context: NotificationContext): Promise<void> {
    // Get all Partners in the firm
    const partners = await prisma.user.findMany({
      where: {
        firmId,
        role: 'Partner',
        status: 'Active',
      },
    });

    if (!partners || partners.length === 0) {
      console.warn(`No active Partners found in firm ${firmId} for financial setup notification`);
      return;
    }

    // Create notification for each Partner
    await prisma.notification.createMany({
      data: partners.map((partner) => ({
        userId: partner.id,
        type: NotificationType.CaseNeedsFinancialSetup,
        title: 'Dosar nou - lipsește configurarea financiară',
        message: `Dosarul "${context.caseTitle}" introdus de ${context.actorName} necesită configurarea detaliilor de facturare.`,
        link: `/cases/${context.caseId}/edit`,
        caseId: context.caseId,
      })),
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
  async getNotifications(userId: string, options?: { read?: boolean; limit?: number }) {
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

  // ============================================================================
  // Story 3.6: Document Review Notifications
  // ============================================================================

  /**
   * Send notification when document review is requested
   * Sent to assigned reviewer or all Partners in the firm
   */
  async notifyDocumentReviewRequested(
    reviewerId: string | null,
    firmId: string,
    context: DocumentReviewContext
  ): Promise<void> {
    const revisionText =
      context.revisionNumber && context.revisionNumber > 0
        ? ` (Revision #${context.revisionNumber})`
        : '';

    if (reviewerId) {
      // Send to specific reviewer
      await prisma.notification.create({
        data: {
          userId: reviewerId,
          type: NotificationType.DocumentReviewAssigned,
          title: 'Document Review Assigned',
          message: `You have been assigned to review "${context.documentTitle}" by ${context.actorName}${revisionText}`,
          link: `/reviews/${context.reviewId}`,
        },
      });
    } else {
      // Send to all Partners in firm
      const partners = await prisma.user.findMany({
        where: {
          firmId,
          role: 'Partner',
          status: 'Active',
        },
      });

      if (partners.length > 0) {
        await prisma.notification.createMany({
          data: partners.map((partner) => ({
            userId: partner.id,
            type: NotificationType.DocumentReviewRequested,
            title: 'New Document Review Request',
            message: `"${context.documentTitle}" submitted by ${context.actorName} needs review${revisionText}`,
            link: `/reviews/${context.reviewId}`,
          })),
        });
      }
    }
  }

  /**
   * Send notification when document is approved
   */
  async notifyDocumentApproved(submitterId: string, context: DocumentReviewContext): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: submitterId,
        type: NotificationType.DocumentApproved,
        title: 'Document Approved',
        message: `Your document "${context.documentTitle}" has been approved by ${context.actorName}`,
        link: `/reviews/${context.reviewId}`,
      },
    });
  }

  /**
   * Send notification when document is rejected
   */
  async notifyDocumentRejected(submitterId: string, context: DocumentReviewContext): Promise<void> {
    const feedbackPreview = context.feedback
      ? ` Feedback: ${context.feedback.substring(0, 100)}${context.feedback.length > 100 ? '...' : ''}`
      : '';

    await prisma.notification.create({
      data: {
        userId: submitterId,
        type: NotificationType.DocumentRejected,
        title: 'Document Rejected - Action Required',
        message: `Your document "${context.documentTitle}" was rejected by ${context.actorName}.${feedbackPreview}`,
        link: `/reviews/${context.reviewId}`,
      },
    });
  }

  /**
   * Send notification when document revision is requested
   */
  async notifyDocumentRevisionRequested(
    submitterId: string,
    context: DocumentReviewContext
  ): Promise<void> {
    const feedbackPreview = context.feedback
      ? ` Feedback: ${context.feedback.substring(0, 100)}${context.feedback.length > 100 ? '...' : ''}`
      : '';

    await prisma.notification.create({
      data: {
        userId: submitterId,
        type: NotificationType.DocumentRevisionRequested,
        title: 'Document Revision Requested',
        message: `${context.actorName} has requested revisions on "${context.documentTitle}".${feedbackPreview}`,
        link: `/reviews/${context.reviewId}`,
      },
    });
  }

  /**
   * Send notification when comment is added to a review
   */
  async notifyCommentAdded(userId: string, context: CommentContext): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.DocumentCommentAdded,
        title: 'New Comment on Document',
        message: `${context.authorName} commented on "${context.documentTitle}": ${context.commentPreview}`,
        link: `/reviews/${context.reviewId}#comment-${context.commentId}`,
      },
    });
  }

  /**
   * Send notification when user is @mentioned in a comment
   */
  async notifyMentioned(userId: string, context: MentionContext): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.DocumentCommentMentioned,
        title: 'You Were Mentioned',
        message: `${context.mentionedBy} mentioned you in a comment on "${context.documentTitle}"`,
        link: `/reviews/${context.reviewId}#comment-${context.commentId}`,
      },
    });
  }

  /**
   * Parse @mentions from comment content and return user IDs
   */
  async parseMentions(content: string, firmId: string): Promise<string[]> {
    // Match @username pattern
    const mentionPattern = /@([\w-]+)/g;
    const matches = content.match(mentionPattern);

    if (!matches) {
      return [];
    }

    // Extract usernames without the @ symbol
    const usernames = matches.map((m) => m.substring(1));

    // Find users by email prefix in the same firm
    const users = await prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        OR: usernames.map((username) => ({
          email: {
            startsWith: username,
          },
        })),
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
