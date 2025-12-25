/**
 * Email Privacy Service
 * OPS-191: Partner email privacy feature
 *
 * Partners can mark emails as private, hiding them from case details
 * while keeping them visible in their /communications view.
 */

import { prisma } from '@legal-platform/database';
import { Email, UserRole } from '@prisma/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface UserContext {
  id: string;
  role: UserRole;
  firmId: string;
}

interface PrivacyResult {
  email: Email;
  affectedCount: number;
}

interface ThreadPrivacyResult {
  emails: Email[];
  affectedCount: number;
}

// ============================================================================
// Service
// ============================================================================

export class EmailPrivacyService {
  /**
   * Validate that the user has Partner role
   * Only partners can mark emails as private
   */
  private validatePartnerRole(role: UserRole): void {
    if (role !== UserRole.Partner) {
      throw new Error('Only partners can mark emails as private');
    }
  }

  /**
   * Mark a single email as private
   * The email will be hidden from case details but visible to the marking partner
   */
  async markAsPrivate(emailId: string, user: UserContext): Promise<Email> {
    this.validatePartnerRole(user.role);

    // Verify email exists and belongs to user's firm
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        firmId: user.firmId,
      },
    });

    if (!email) {
      throw new Error('Email not found');
    }

    // Already private by this user - return as-is
    if (email.isPrivate && email.markedPrivateBy === user.id) {
      logger.info('[EmailPrivacyService] Email already marked private by user', {
        emailId,
        userId: user.id,
      });
      return email;
    }

    // Mark as private
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        isPrivate: true,
        markedPrivateBy: user.id,
        markedPrivateAt: new Date(),
      },
    });

    logger.info('[EmailPrivacyService] Email marked as private', {
      emailId,
      userId: user.id,
    });

    return updatedEmail;
  }

  /**
   * Unmark a single email as private
   * Restores visibility in case details
   */
  async unmarkAsPrivate(emailId: string, user: UserContext): Promise<Email> {
    this.validatePartnerRole(user.role);

    // Verify email exists and belongs to user's firm
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        firmId: user.firmId,
      },
    });

    if (!email) {
      throw new Error('Email not found');
    }

    // Only the user who marked it private can unmark it
    if (email.isPrivate && email.markedPrivateBy !== user.id) {
      throw new Error('Only the partner who marked this email as private can restore it');
    }

    // Not private - return as-is
    if (!email.isPrivate) {
      return email;
    }

    // Unmark as private
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        isPrivate: false,
        markedPrivateBy: null,
        markedPrivateAt: null,
      },
    });

    logger.info('[EmailPrivacyService] Email unmarked as private', {
      emailId,
      userId: user.id,
    });

    return updatedEmail;
  }

  /**
   * Mark all emails in a thread as private
   */
  async markThreadAsPrivate(
    conversationId: string,
    user: UserContext
  ): Promise<ThreadPrivacyResult> {
    this.validatePartnerRole(user.role);

    // Get all emails in the thread belonging to user's firm
    const emails = await prisma.email.findMany({
      where: {
        conversationId,
        firmId: user.firmId,
      },
    });

    if (emails.length === 0) {
      throw new Error('No emails found in thread');
    }

    // Mark all as private in a transaction
    const updatedEmails = await prisma.$transaction(
      emails.map((email) =>
        prisma.email.update({
          where: { id: email.id },
          data: {
            isPrivate: true,
            markedPrivateBy: user.id,
            markedPrivateAt: new Date(),
          },
        })
      )
    );

    logger.info('[EmailPrivacyService] Thread marked as private', {
      conversationId,
      userId: user.id,
      emailCount: updatedEmails.length,
    });

    return {
      emails: updatedEmails,
      affectedCount: updatedEmails.length,
    };
  }

  /**
   * Unmark all emails in a thread as private
   * Only emails marked by this user will be unmarked
   */
  async unmarkThreadAsPrivate(
    conversationId: string,
    user: UserContext
  ): Promise<ThreadPrivacyResult> {
    this.validatePartnerRole(user.role);

    // Get all emails in the thread that this user marked as private
    const emails = await prisma.email.findMany({
      where: {
        conversationId,
        firmId: user.firmId,
        isPrivate: true,
        markedPrivateBy: user.id,
      },
    });

    if (emails.length === 0) {
      // Return empty result - no emails to unmark
      const allEmails = await prisma.email.findMany({
        where: {
          conversationId,
          firmId: user.firmId,
        },
      });
      return {
        emails: allEmails,
        affectedCount: 0,
      };
    }

    // Unmark all in a transaction
    const updatedEmails = await prisma.$transaction(
      emails.map((email) =>
        prisma.email.update({
          where: { id: email.id },
          data: {
            isPrivate: false,
            markedPrivateBy: null,
            markedPrivateAt: null,
          },
        })
      )
    );

    logger.info('[EmailPrivacyService] Thread unmarked as private', {
      conversationId,
      userId: user.id,
      emailCount: updatedEmails.length,
    });

    // Return all emails in thread (including those that weren't modified)
    const allEmails = await prisma.email.findMany({
      where: {
        conversationId,
        firmId: user.firmId,
      },
    });

    return {
      emails: allEmails,
      affectedCount: updatedEmails.length,
    };
  }

  /**
   * Build a Prisma where clause to filter out private emails
   * in case context (unless viewer is the one who marked them)
   *
   * Used by case communications queries to hide private emails
   * from team members who aren't the marking partner.
   */
  buildPrivacyFilter(currentUserId: string): any {
    return {
      OR: [
        { isPrivate: false },
        { isPrivate: null }, // Handle null values
        { markedPrivateBy: currentUserId }, // Show to the partner who marked them
      ],
    };
  }

  /**
   * Check if user can view a specific email given privacy settings
   */
  async canViewEmail(emailId: string, userId: string): Promise<boolean> {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      select: {
        isPrivate: true,
        markedPrivateBy: true,
        userId: true,
      },
    });

    if (!email) {
      return false;
    }

    // Email owner can always view
    if (email.userId === userId) {
      return true;
    }

    // Non-private emails are visible to all
    if (!email.isPrivate) {
      return true;
    }

    // Private emails only visible to the partner who marked them
    if (email.markedPrivateBy === userId) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const emailPrivacyService = new EmailPrivacyService();

// Export factory for testing
export function getEmailPrivacyService(): EmailPrivacyService {
  return emailPrivacyService;
}
