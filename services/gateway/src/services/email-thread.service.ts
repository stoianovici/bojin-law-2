/**
 * Email Thread Grouping Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Groups emails into conversation threads using Graph API conversationId
 * and SMTP headers as fallback. Provides thread-level operations.
 *
 * [Source: packages/shared/types/src/communication.ts - CommunicationThread type]
 */

import { PrismaClient, Email } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface EmailThread {
  id: string;
  conversationId: string;
  subject: string;
  participantCount: number;
  messageCount: number;
  emails: ThreadEmail[];
  caseId: string | null;
  caseName?: string;
  hasUnread: boolean;
  hasAttachments: boolean;
  lastMessageDate: Date;
  firstMessageDate: Date;
}

export interface ThreadEmail {
  id: string;
  graphMessageId: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentType: string;
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  receivedDateTime: Date;
  sentDateTime: Date;
  hasAttachments: boolean;
  importance: string;
  isRead: boolean;
  caseId: string | null;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface ThreadParticipant {
  email: string;
  name?: string;
  messageCount: number;
  roles: ('sender' | 'recipient' | 'cc')[];
}

export interface ThreadFilters {
  userId: string;
  caseId?: string;
  hasUnread?: boolean;
  hasAttachments?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  includeIgnored?: boolean; // Include ignored threads (default: false)
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

// ============================================================================
// Email Thread Service
// ============================================================================

export class EmailThreadService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Group emails into threads by conversationId (AC: 3)
   *
   * Uses Graph API conversationId as primary grouping key.
   * Sorts messages chronologically within each thread.
   *
   * @param emails - Array of emails to group
   * @returns Array of email threads
   */
  groupEmailsIntoThreads(emails: Email[]): EmailThread[] {
    const threadMap = new Map<string, Email[]>();

    // Group by conversationId, fallback to graphMessageId for emails without conversationId
    for (const email of emails) {
      // Use conversationId if available, otherwise use graphMessageId as single-email "thread"
      const key = email.conversationId || email.graphMessageId;
      // Skip emails with neither (should never happen)
      if (!key) {
        continue;
      }
      if (!threadMap.has(key)) {
        threadMap.set(key, []);
      }
      threadMap.get(key)!.push(email);
    }

    // Transform to EmailThread format
    const threads: EmailThread[] = [];

    for (const [conversationId, threadEmails] of threadMap) {
      // Sort by receivedDateTime chronologically
      const sortedEmails = threadEmails.sort(
        (a, b) => a.receivedDateTime.getTime() - b.receivedDateTime.getTime()
      );

      const participants = this.extractParticipants(sortedEmails);
      const hasUnread = sortedEmails.some((e) => !e.isRead);
      const hasAttachments = sortedEmails.some((e) => e.hasAttachments);
      const lastEmail = sortedEmails[sortedEmails.length - 1];
      const firstEmail = sortedEmails[0];

      // Use subject from first email (original message)
      const subject = this.normalizeSubject(firstEmail.subject);

      // Determine case assignment (use most common caseId in thread)
      const caseId = this.determineCaseId(sortedEmails);

      threads.push({
        id: conversationId, // Use conversationId as thread ID
        conversationId,
        subject,
        participantCount: participants.length,
        messageCount: sortedEmails.length,
        emails: sortedEmails.map((e) => this.transformToThreadEmail(e)),
        caseId,
        hasUnread,
        hasAttachments,
        lastMessageDate: lastEmail.receivedDateTime,
        firstMessageDate: firstEmail.receivedDateTime,
      });
    }

    // Sort threads by last message date (newest first)
    return threads.sort((a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());
  }

  /**
   * Get threads for a user with filtering and pagination
   *
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Array of email threads
   */
  async getThreads(
    filters: ThreadFilters,
    pagination: PaginationOptions = {}
  ): Promise<{ threads: EmailThread[]; totalCount: number }> {
    const { userId, caseId, hasUnread, hasAttachments, search, dateFrom, dateTo, includeIgnored } =
      filters;
    const { limit = 20, offset = 0 } = pagination;

    // Build where clause
    const where: any = { userId };

    // Filter out ignored emails only when explicitly requested
    // Note: includeIgnored defaults to undefined, meaning show all
    // Set includeIgnored=false to hide ignored emails
    if (includeIgnored === false) {
      where.isIgnored = false;
    }

    if (caseId) {
      where.caseId = caseId;
    }

    if (hasAttachments !== undefined) {
      where.hasAttachments = hasAttachments;
    }

    if (dateFrom || dateTo) {
      where.receivedDateTime = {};
      if (dateFrom) where.receivedDateTime.gte = dateFrom;
      if (dateTo) where.receivedDateTime.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { bodyPreview: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get unique conversation IDs with aggregation
    const conversationGroups = await this.prisma.email.groupBy({
      by: ['conversationId'],
      where,
      _max: { receivedDateTime: true },
      _count: true,
      orderBy: { _max: { receivedDateTime: 'desc' } },
    });

    const totalCount = conversationGroups.length;

    // Apply pagination to conversation IDs
    const paginatedConversations = conversationGroups.slice(offset, offset + limit);

    // Fetch all emails for paginated conversations
    const emails = await this.prisma.email.findMany({
      where: {
        userId,
        conversationId: { in: paginatedConversations.map((g) => g.conversationId) },
      },
      orderBy: { receivedDateTime: 'asc' },
    });

    // Filter for unread if needed (post-fetch filter)
    let threads = this.groupEmailsIntoThreads(emails);

    if (hasUnread !== undefined) {
      threads = threads.filter((t) => t.hasUnread === hasUnread);
    }

    return { threads, totalCount };
  }

  /**
   * Get a single thread by conversationId
   *
   * @param conversationId - Graph API conversation ID
   * @param userId - User ID for access control
   * @returns Email thread or null
   */
  async getThread(conversationId: string, userId: string): Promise<EmailThread | null> {
    const emails = await this.prisma.email.findMany({
      where: { conversationId, userId },
      orderBy: { receivedDateTime: 'asc' },
    });

    if (emails.length === 0) {
      return null;
    }

    const threads = this.groupEmailsIntoThreads(emails);
    return threads[0] || null;
  }

  /**
   * Get thread participants with roles
   *
   * @param conversationId - Graph API conversation ID
   * @param userId - User ID for access control
   * @returns Array of thread participants
   */
  async getThreadParticipants(
    conversationId: string,
    userId: string
  ): Promise<ThreadParticipant[]> {
    const emails = await this.prisma.email.findMany({
      where: { conversationId, userId },
      select: { from: true, toRecipients: true, ccRecipients: true },
    });

    return this.extractParticipants(emails as any);
  }

  /**
   * Assign all emails in a thread to a case (AC: 6)
   *
   * @param conversationId - Graph API conversation ID
   * @param caseId - Case ID to assign
   * @param userId - User ID for access control
   * @returns Updated email count
   */
  async assignThreadToCase(
    conversationId: string,
    caseId: string,
    userId: string
  ): Promise<number> {
    const result = await this.prisma.email.updateMany({
      where: { conversationId, userId },
      data: { caseId },
    });

    return result.count;
  }

  /**
   * Mark all emails in thread as read
   *
   * @param conversationId - Graph API conversation ID
   * @param userId - User ID for access control
   * @returns Updated email count
   */
  async markThreadAsRead(conversationId: string, userId: string): Promise<number> {
    const result = await this.prisma.email.updateMany({
      where: { conversationId, userId },
      data: { isRead: true },
    });

    return result.count;
  }

  /**
   * Get thread statistics for a user
   *
   * @param userId - User ID
   * @returns Thread statistics
   */
  async getThreadStats(userId: string): Promise<{
    totalThreads: number;
    unreadThreads: number;
    uncategorizedThreads: number;
    threadsByCase: { caseId: string | null; count: number }[];
  }> {
    // Get all conversation groups
    const conversations = await this.prisma.email.groupBy({
      by: ['conversationId', 'caseId'],
      where: { userId },
      _count: true,
    });

    // Get unread conversations
    const unreadEmails = await this.prisma.email.findMany({
      where: { userId, isRead: false },
      select: { conversationId: true },
    });
    const unreadConversationIds = new Set(unreadEmails.map((e) => e.conversationId));

    // Get unique conversations
    const uniqueConversations = new Set(conversations.map((c) => c.conversationId));

    // Count by case
    const caseMap = new Map<string | null, number>();
    for (const conv of conversations) {
      const key = conv.caseId;
      caseMap.set(key, (caseMap.get(key) || 0) + 1);
    }

    return {
      totalThreads: uniqueConversations.size,
      unreadThreads: unreadConversationIds.size,
      uncategorizedThreads: caseMap.get(null) || 0,
      threadsByCase: Array.from(caseMap.entries()).map(([caseId, count]) => ({
        caseId,
        count,
      })),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Extract participants from emails (AC: 3)
   *
   * Tracks from, toRecipients, ccRecipients and aggregates roles.
   */
  private extractParticipants(emails: Email[]): ThreadParticipant[] {
    const participantMap = new Map<string, ThreadParticipant>();

    for (const email of emails) {
      const from = email.from as unknown as EmailAddress;
      const toRecipients = (email.toRecipients || []) as unknown as EmailAddress[];
      const ccRecipients = (email.ccRecipients || []) as unknown as EmailAddress[];

      // Add sender
      if (from?.address) {
        const key = from.address.toLowerCase();
        if (!participantMap.has(key)) {
          participantMap.set(key, {
            email: from.address,
            name: from.name,
            messageCount: 0,
            roles: [],
          });
        }
        const participant = participantMap.get(key)!;
        participant.messageCount++;
        if (!participant.roles.includes('sender')) {
          participant.roles.push('sender');
        }
      }

      // Add recipients
      for (const recipient of toRecipients) {
        if (recipient?.address) {
          const key = recipient.address.toLowerCase();
          if (!participantMap.has(key)) {
            participantMap.set(key, {
              email: recipient.address,
              name: recipient.name,
              messageCount: 0,
              roles: [],
            });
          }
          const participant = participantMap.get(key)!;
          if (!participant.roles.includes('recipient')) {
            participant.roles.push('recipient');
          }
        }
      }

      // Add CC recipients
      for (const recipient of ccRecipients) {
        if (recipient?.address) {
          const key = recipient.address.toLowerCase();
          if (!participantMap.has(key)) {
            participantMap.set(key, {
              email: recipient.address,
              name: recipient.name,
              messageCount: 0,
              roles: [],
            });
          }
          const participant = participantMap.get(key)!;
          if (!participant.roles.includes('cc')) {
            participant.roles.push('cc');
          }
        }
      }
    }

    return Array.from(participantMap.values());
  }

  /**
   * Normalize subject line (remove Re:, Fwd:, etc.)
   */
  private normalizeSubject(subject: string): string {
    return (
      subject
        .replace(/^(re|fwd|fw):\s*/gi, '')
        .replace(/^(re|fwd|fw)\[\d+\]:\s*/gi, '')
        .trim() || '(No Subject)'
    );
  }

  /**
   * Determine the most appropriate case ID for a thread
   *
   * Uses the most commonly assigned case ID in the thread.
   */
  private determineCaseId(emails: Email[]): string | null {
    const caseCount = new Map<string, number>();

    for (const email of emails) {
      if (email.caseId) {
        caseCount.set(email.caseId, (caseCount.get(email.caseId) || 0) + 1);
      }
    }

    if (caseCount.size === 0) {
      return null;
    }

    // Return case with most emails
    let maxCount = 0;
    let maxCaseId: string | null = null;

    for (const [caseId, count] of caseCount) {
      if (count > maxCount) {
        maxCount = count;
        maxCaseId = caseId;
      }
    }

    return maxCaseId;
  }

  /**
   * Transform Prisma Email to ThreadEmail
   */
  private transformToThreadEmail(email: Email): ThreadEmail {
    return {
      id: email.id,
      graphMessageId: email.graphMessageId,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      bodyContent: email.bodyContent,
      bodyContentType: email.bodyContentType,
      from: email.from as unknown as EmailAddress,
      toRecipients: (email.toRecipients || []) as unknown as EmailAddress[],
      ccRecipients: (email.ccRecipients || []) as unknown as EmailAddress[],
      receivedDateTime: email.receivedDateTime,
      sentDateTime: email.sentDateTime,
      hasAttachments: email.hasAttachments,
      importance: email.importance,
      isRead: email.isRead,
      caseId: email.caseId,
    };
  }

  /**
   * Parse internet message headers for In-Reply-To and References (fallback)
   *
   * Used when conversationId is not available.
   *
   * @param headers - Array of {name, value} header objects
   * @returns Related message IDs
   */
  parseMessageHeaders(headers: Array<{ name: string; value: string }>): {
    inReplyTo?: string;
    references: string[];
  } {
    let inReplyTo: string | undefined;
    const references: string[] = [];

    for (const header of headers) {
      const name = header.name.toLowerCase();

      if (name === 'in-reply-to') {
        inReplyTo = this.extractMessageId(header.value);
      } else if (name === 'references') {
        // References header contains space-separated message IDs
        const ids = header.value.split(/\s+/).filter(Boolean);
        for (const id of ids) {
          const extracted = this.extractMessageId(id);
          if (extracted) {
            references.push(extracted);
          }
        }
      }
    }

    return { inReplyTo, references };
  }

  /**
   * Extract message ID from header value (remove angle brackets)
   */
  private extractMessageId(value: string): string | undefined {
    const match = value.match(/<([^>]+)>/);
    return match ? match[1] : value.trim() || undefined;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailThreadServiceInstance: EmailThreadService | null = null;

export function getEmailThreadService(prisma: PrismaClient): EmailThreadService {
  if (!emailThreadServiceInstance) {
    emailThreadServiceInstance = new EmailThreadService(prisma);
  }
  return emailThreadServiceInstance;
}
