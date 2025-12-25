/**
 * Email Thread Grouping Service
 * Story 5.1: Email Integration and Synchronization
 * OPS-125: Auto-Add Sender as Case Contact on Assignment
 *
 * Groups emails into conversation threads using Graph API conversationId
 * and SMTP headers as fallback. Provides thread-level operations.
 *
 * [Source: packages/shared/types/src/communication.ts - CommunicationThread type]
 */

import { PrismaClient, Email, CaseActorRole } from '@prisma/client';
import { getEmailAttachmentService } from './email-attachment.service';
import logger from '../utils/logger';

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

// OPS-127: Attachment type for thread emails
export interface ThreadEmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  documentId?: string | null;
  storageUrl?: string | null;
  filterStatus?: string | null;
}

export interface ThreadEmail {
  id: string;
  graphMessageId: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentType: string;
  bodyContentClean?: string | null; // OPS-090: AI-cleaned content
  folderType?: string | null; // OPS-091: 'inbox' or 'sent'
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  receivedDateTime: Date;
  sentDateTime: Date;
  hasAttachments: boolean;
  attachments?: ThreadEmailAttachment[]; // OPS-127: Actual attachment data
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
  /** OPS-191: Skip privacy filter (for /communications where user sees their own private emails) */
  skipPrivacyFilter?: boolean;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

// OPS-125: Result type for assignThreadToCase with contact auto-add info
export interface AssignThreadResult {
  /** Number of emails updated */
  emailCount: number;
  /** Whether a new contact was auto-added to the case */
  newContactAdded: boolean;
  /** Name of the added contact (if any) */
  contactName?: string;
  /** Email of the added contact (if any) */
  contactEmail?: string;
}

// OPS-125: Context needed for auto-adding contacts
export interface UserContext {
  userId: string;
  firmId: string;
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
   * @param emails - Array of emails to group (may include attachments from Prisma include)
   * @returns Array of email threads
   */
  groupEmailsIntoThreads(
    emails: Array<
      Email & {
        attachments?: Array<{
          id: string;
          name: string;
          contentType: string;
          size: number;
          documentId: string | null;
          storageUrl: string | null;
          filterStatus: string | null;
        }>;
      }
    >
  ): EmailThread[] {
    const threadMap = new Map<
      string,
      Array<
        Email & {
          attachments?: Array<{
            id: string;
            name: string;
            contentType: string;
            size: number;
            documentId: string | null;
            storageUrl: string | null;
            filterStatus: string | null;
          }>;
        }
      >
    >();

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
    const {
      userId,
      caseId,
      hasUnread,
      hasAttachments,
      search,
      dateFrom,
      dateTo,
      includeIgnored,
      skipPrivacyFilter,
    } = filters;
    const { limit = 20, offset = 0 } = pagination;

    // Build where clause
    const where: any = { userId };

    // Filter out ignored emails only when explicitly requested
    // Note: includeIgnored defaults to undefined, meaning show all
    // Set includeIgnored=false to hide ignored emails
    if (includeIgnored === false) {
      where.isIgnored = false;
    }

    // OPS-186: Filter by EmailCaseLink table, not legacy Email.caseId
    // This ensures we use the newer multi-case link system introduced in OPS-058
    if (caseId) {
      where.caseLinks = {
        some: {
          caseId: caseId,
        },
      };
    }

    if (hasAttachments !== undefined) {
      where.hasAttachments = hasAttachments;
    }

    if (dateFrom || dateTo) {
      where.receivedDateTime = {};
      if (dateFrom) where.receivedDateTime.gte = dateFrom;
      if (dateTo) where.receivedDateTime.lte = dateTo;
    }

    // Build AND conditions for various filters that need OR logic
    const andConditions: any[] = [];

    // OPS-191: Filter private emails when viewing case details
    // Private emails are hidden from case communications unless:
    // 1. The viewer is the one who marked them private
    // 2. skipPrivacyFilter is true (for /communications personal view)
    if (caseId && !skipPrivacyFilter) {
      andConditions.push({
        OR: [{ isPrivate: false }, { isPrivate: null }, { markedPrivateBy: userId }],
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { bodyPreview: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // Combine AND conditions if any exist
    if (andConditions.length > 0) {
      where.AND = andConditions;
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
    // OPS-127: Include attachments when fetching thread emails
    // OPS-191: Apply privacy filter when fetching individual emails
    const emailWhere: any = {
      userId,
      conversationId: { in: paginatedConversations.map((g) => g.conversationId) },
    };

    // OPS-191: Re-apply privacy filter when fetching thread emails
    if (caseId && !skipPrivacyFilter) {
      emailWhere.OR = [{ isPrivate: false }, { isPrivate: null }, { markedPrivateBy: userId }];
    }

    const emails = await this.prisma.email.findMany({
      where: emailWhere,
      orderBy: { receivedDateTime: 'asc' },
      include: {
        attachments: {
          where: {
            OR: [{ filterStatus: null }, { filterStatus: { not: 'dismissed' } }],
          },
        },
      },
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
   * @param accessToken - Optional MS Graph access token for auto-syncing attachments (OPS-176)
   * @returns Email thread or null
   */
  async getThread(
    conversationId: string,
    userId: string,
    accessToken?: string
  ): Promise<EmailThread | null> {
    // OPS-127: Include attachments when fetching thread emails
    const emails = await this.prisma.email.findMany({
      where: { conversationId, userId },
      orderBy: { receivedDateTime: 'asc' },
      include: {
        attachments: {
          where: {
            OR: [{ filterStatus: null }, { filterStatus: { not: 'dismissed' } }],
          },
        },
      },
    });

    if (emails.length === 0) {
      return null;
    }

    // OPS-176: Auto-sync attachments for emails that have hasAttachments but no EmailAttachment records
    if (accessToken) {
      const attachmentService = getEmailAttachmentService(this.prisma);
      for (const email of emails) {
        if (email.hasAttachments && email.attachments.length === 0) {
          try {
            logger.info('[EmailThread.getThread] Auto-syncing attachments', {
              emailId: email.id,
              conversationId,
            });
            await attachmentService.syncAllAttachments(email.id, accessToken);
          } catch (error) {
            logger.error('[EmailThread.getThread] Auto-sync failed', {
              emailId: email.id,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue with other emails - don't fail the whole request
          }
        }
      }

      // Re-fetch emails with newly synced attachments
      const syncedEmails = await this.prisma.email.findMany({
        where: { conversationId, userId },
        orderBy: { receivedDateTime: 'asc' },
        include: {
          attachments: {
            where: {
              OR: [{ filterStatus: null }, { filterStatus: { not: 'dismissed' } }],
            },
          },
        },
      });

      const threads = this.groupEmailsIntoThreads(syncedEmails);
      return threads[0] || null;
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
   * OPS-125: Now auto-adds sender as case contact if not already present
   *
   * @param conversationId - Graph API conversation ID
   * @param caseId - Case ID to assign
   * @param userId - User ID for access control
   * @param userContext - Optional context for auto-adding contacts (firmId needed)
   * @returns Result with email count and contact info
   */
  async assignThreadToCase(
    conversationId: string,
    caseId: string,
    userId: string,
    userContext?: UserContext
  ): Promise<AssignThreadResult> {
    // OPS-186: Get all emails in the thread first
    const emails = await this.prisma.email.findMany({
      where: { conversationId, userId },
      select: { id: true },
    });

    // OPS-186: Create EmailCaseLink records for each email (upsert to handle existing links)
    // This is the new primary way to link emails to cases (OPS-058)
    const linkPromises = emails.map((email) =>
      this.prisma.emailCaseLink.upsert({
        where: {
          emailId_caseId: {
            emailId: email.id,
            caseId: caseId,
          },
        },
        create: {
          emailId: email.id,
          caseId: caseId,
          confidence: 1.0,
          matchType: 'Manual',
          linkedBy: userId,
          isPrimary: true,
        },
        update: {
          // If link exists, mark it as primary
          isPrimary: true,
        },
      })
    );
    await Promise.all(linkPromises);

    // Also update legacy caseId for backwards compatibility
    const result = await this.prisma.email.updateMany({
      where: { conversationId, userId },
      data: { caseId },
    });

    // OPS-125: Auto-add sender as case contact if firmId is provided
    if (!userContext?.firmId) {
      return {
        emailCount: result.count,
        newContactAdded: false,
      };
    }

    // Get the first email in the thread to extract sender info
    const firstEmail = await this.prisma.email.findFirst({
      where: { conversationId, userId },
      orderBy: { receivedDateTime: 'asc' },
      select: {
        from: true,
      },
    });

    if (!firstEmail?.from) {
      return {
        emailCount: result.count,
        newContactAdded: false,
      };
    }

    const fromData = firstEmail.from as { name?: string; address: string };
    const senderEmail = fromData.address?.toLowerCase();
    const senderName = fromData.name || senderEmail;

    if (!senderEmail) {
      return {
        emailCount: result.count,
        newContactAdded: false,
      };
    }

    // Check if sender is from a court/institution domain (skip auto-add)
    const isInstitution = await this.checkInstitutionDomain(senderEmail, userContext.firmId);
    if (isInstitution) {
      return {
        emailCount: result.count,
        newContactAdded: false,
      };
    }

    // Check if sender is already a contact on this case
    const existingActor = await this.prisma.caseActor.findFirst({
      where: {
        caseId,
        email: { equals: senderEmail, mode: 'insensitive' },
      },
    });

    if (existingActor) {
      return {
        emailCount: result.count,
        newContactAdded: false,
      };
    }

    // Check if sender is the client on this case
    const caseWithClient = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: {
          select: { contactInfo: true },
        },
      },
    });

    const clientEmail = (caseWithClient?.client?.contactInfo as { email?: string })?.email;
    if (clientEmail && clientEmail.toLowerCase() === senderEmail) {
      return {
        emailCount: result.count,
        newContactAdded: false,
      };
    }

    // Auto-add sender as case contact with "Other" role
    await this.prisma.caseActor.create({
      data: {
        caseId,
        email: senderEmail,
        name: senderName,
        role: CaseActorRole.Other,
        createdBy: userId,
        notes: 'Adăugat automat din atribuire email',
      },
    });

    return {
      emailCount: result.count,
      newContactAdded: true,
      contactName: senderName,
      contactEmail: senderEmail,
    };
  }

  /**
   * OPS-125: Check if email domain is from a court/institution
   * Uses GlobalEmailSource table for domain matching
   */
  private async checkInstitutionDomain(email: string, firmId: string): Promise<boolean> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;

    const source = await this.prisma.globalEmailSource.findFirst({
      where: {
        firmId,
        domains: { has: domain },
      },
    });

    return !!source;
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
   * OPS-127: Now handles attachments when included in query
   */
  private transformToThreadEmail(
    email: Email & {
      attachments?: Array<{
        id: string;
        name: string;
        contentType: string;
        size: number;
        documentId: string | null;
        storageUrl: string | null;
        filterStatus: string | null;
      }>;
    }
  ): ThreadEmail {
    return {
      id: email.id,
      graphMessageId: email.graphMessageId,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      bodyContent: email.bodyContent,
      bodyContentType: email.bodyContentType,
      bodyContentClean: email.bodyContentClean, // OPS-090: AI-cleaned content
      folderType: email.folderType, // OPS-091: 'inbox' or 'sent'
      from: email.from as unknown as EmailAddress,
      toRecipients: (email.toRecipients || []) as unknown as EmailAddress[],
      ccRecipients: (email.ccRecipients || []) as unknown as EmailAddress[],
      receivedDateTime: email.receivedDateTime,
      sentDateTime: email.sentDateTime,
      hasAttachments: email.hasAttachments,
      // OPS-127: Map attachments with all fields needed for GraphQL resolvers
      attachments: email.attachments?.map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
        documentId: a.documentId,
        storageUrl: a.storageUrl,
        filterStatus: a.filterStatus,
      })),
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
