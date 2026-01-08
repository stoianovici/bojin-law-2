/**
 * Personal Contact Service
 * OPS-190: Personal Contacts Service + GraphQL
 *
 * Manages personal contact blocklist. Emails from personal contacts won't be synced.
 * This is a per-user setting.
 */

import { prisma } from '@legal-platform/database';
import type { PersonalContact, PersonalThread } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface PersonalContactResult {
  id: string;
  email: string;
  createdAt: Date;
}

export interface PersonalThreadResult {
  id: string;
  conversationId: string;
  userId: string;
  createdAt: Date;
}

// ============================================================================
// Service
// ============================================================================

export class PersonalContactService {
  /**
   * Add email to personal blocklist
   * When a user marks an email sender as "personal", future emails from that sender
   * should not be retrieved during sync.
   */
  async addPersonalContact(userId: string, email: string): Promise<PersonalContactResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already exists
    const existing = await prisma.personalContact.findUnique({
      where: {
        userId_email: {
          userId,
          email: normalizedEmail,
        },
      },
    });

    if (existing) {
      return this.mapToResult(existing);
    }

    const contact = await prisma.personalContact.create({
      data: {
        userId,
        email: normalizedEmail,
      },
    });

    return this.mapToResult(contact);
  }

  /**
   * Remove from blocklist (re-enable sync)
   */
  async removePersonalContact(userId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      await prisma.personalContact.delete({
        where: {
          userId_email: {
            userId,
            email: normalizedEmail,
          },
        },
      });
      return true;
    } catch {
      // Record doesn't exist
      return false;
    }
  }

  /**
   * Get all personal contacts for user
   */
  async getPersonalContacts(userId: string): Promise<PersonalContactResult[]> {
    const contacts = await prisma.personalContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map(this.mapToResult);
  }

  /**
   * Check if email is personal (for sync worker)
   */
  async isPersonalContact(userId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const contact = await prisma.personalContact.findUnique({
      where: {
        userId_email: {
          userId,
          email: normalizedEmail,
        },
      },
    });

    return !!contact;
  }

  /**
   * Batch check for sync worker efficiency
   * Returns list of emails from input that ARE personal contacts
   */
  async filterPersonalContacts(userId: string, emails: string[]): Promise<string[]> {
    if (emails.length === 0) return [];

    const normalizedEmails = emails.map((e) => e.toLowerCase().trim());

    const personalContacts = await prisma.personalContact.findMany({
      where: {
        userId,
        email: { in: normalizedEmails },
      },
      select: { email: true },
    });

    return personalContacts.map((c) => c.email);
  }

  /**
   * Mark sender of an email as personal and optionally ignore the email
   * Convenience method that combines addPersonalContact with marking email as ignored
   */
  async markSenderAsPersonal(
    userId: string,
    emailId: string,
    ignoreEmail: boolean = true
  ): Promise<PersonalContactResult> {
    // Get the email to extract sender
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId,
      },
      select: {
        from: true,
      },
    });

    if (!email) {
      throw new Error('Email not found');
    }

    const fromAddress = (email.from as { address?: string })?.address;
    if (!fromAddress) {
      throw new Error('Email sender address not found');
    }

    // Add to personal contacts
    const contact = await this.addPersonalContact(userId, fromAddress);

    // Optionally mark the email as ignored
    if (ignoreEmail) {
      await prisma.email.update({
        where: { id: emailId },
        data: { isIgnored: true },
      });
    }

    return contact;
  }

  /**
   * Get count of personal contacts for a user
   */
  async getPersonalContactsCount(userId: string): Promise<number> {
    return prisma.personalContact.count({
      where: { userId },
    });
  }

  // ============================================================================
  // Personal Thread Methods
  // ============================================================================

  /**
   * Mark an email thread as personal/private
   * The thread will be hidden from team members but visible to the partner who marked it
   */
  async markThreadAsPersonal(
    userId: string,
    firmId: string,
    conversationId: string
  ): Promise<PersonalThreadResult> {
    // Check if already exists
    const existing = await prisma.personalThread.findUnique({
      where: {
        conversationId_firmId: {
          conversationId,
          firmId,
        },
      },
    });

    if (existing) {
      return this.mapThreadToResult(existing);
    }

    const thread = await prisma.personalThread.create({
      data: {
        conversationId,
        userId,
        firmId,
      },
    });

    return this.mapThreadToResult(thread);
  }

  /**
   * Unmark an email thread as personal/private
   * The thread will become visible to all team members again
   */
  async unmarkThreadAsPersonal(
    userId: string,
    firmId: string,
    conversationId: string
  ): Promise<boolean> {
    try {
      // Only allow the user who marked it to unmark it
      await prisma.personalThread.deleteMany({
        where: {
          conversationId,
          firmId,
          userId,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a thread is marked as personal for a firm
   */
  async isThreadPersonal(firmId: string, conversationId: string): Promise<boolean> {
    const thread = await prisma.personalThread.findUnique({
      where: {
        conversationId_firmId: {
          conversationId,
          firmId,
        },
      },
    });

    return !!thread;
  }

  /**
   * Get the personal thread record if it exists (includes who marked it)
   */
  async getPersonalThread(
    firmId: string,
    conversationId: string
  ): Promise<PersonalThreadResult | null> {
    const thread = await prisma.personalThread.findUnique({
      where: {
        conversationId_firmId: {
          conversationId,
          firmId,
        },
      },
    });

    return thread ? this.mapThreadToResult(thread) : null;
  }

  /**
   * Get list of conversation IDs marked as personal for a firm
   * Used to filter threads in email queries
   */
  async getPersonalThreadIds(firmId: string): Promise<string[]> {
    const threads = await prisma.personalThread.findMany({
      where: { firmId },
      select: { conversationId: true },
    });

    return threads.map((t) => t.conversationId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mapToResult(contact: PersonalContact): PersonalContactResult {
    return {
      id: contact.id,
      email: contact.email,
      createdAt: contact.createdAt,
    };
  }

  private mapThreadToResult(thread: PersonalThread): PersonalThreadResult {
    return {
      id: thread.id,
      conversationId: thread.conversationId,
      userId: thread.userId,
      createdAt: thread.createdAt,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const personalContactService = new PersonalContactService();
