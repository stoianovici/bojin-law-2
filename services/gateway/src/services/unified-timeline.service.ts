/**
 * Unified Timeline Service
 * Story 5.5: Multi-Channel Communication Hub (AC: 1, 4)
 *
 * Provides a unified timeline view of all communications across channels
 * for a specific case, with privacy filtering based on user roles.
 */

import { prisma } from '@legal-platform/database';
import {
  CommunicationChannel,
  CommunicationDirection,
  PrivacyLevel,
  UserRole,
} from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface RecipientInfo {
  id?: string;
  name: string;
  email?: string;
  type: 'to' | 'cc' | 'bcc';
}

interface TimelineEntry {
  id: string;
  channelType: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string;
  body: string;
  bodyPreview: string;
  htmlBody?: string;
  senderName: string;
  senderEmail?: string;
  recipients: RecipientInfo[];
  hasAttachments: boolean;
  isPrivate: boolean;
  privacyLevel: PrivacyLevel;
  sentAt: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  externalId?: string;
  parentId?: string;
}

interface TimelineFilter {
  caseId: string;
  channelTypes?: CommunicationChannel[];
  direction?: CommunicationDirection;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  includePrivate?: boolean;
}

interface Pagination {
  limit?: number;
  cursor?: string;
}

interface PaginatedTimeline {
  entries: TimelineEntry[];
  totalCount: number;
  hasMore: boolean;
  cursor?: string;
}

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class UnifiedTimelineService {
  /**
   * Get unified timeline of all communications for a case
   * Filters by privacy level based on user role
   */
  async getUnifiedTimeline(
    filter: TimelineFilter,
    pagination: Pagination,
    userContext: UserContext
  ): Promise<PaginatedTimeline> {
    const limit = pagination.limit || 20;

    // Build where clause
    const where: any = {
      caseId: filter.caseId,
      firm: { id: userContext.firmId },
    };

    // Filter by channel types
    if (filter.channelTypes && filter.channelTypes.length > 0) {
      where.channelType = { in: filter.channelTypes };
    }

    // Filter by direction
    if (filter.direction) {
      where.direction = filter.direction;
    }

    // Filter by date range
    if (filter.dateFrom) {
      where.sentAt = { ...where.sentAt, gte: filter.dateFrom };
    }
    if (filter.dateTo) {
      where.sentAt = { ...where.sentAt, lte: filter.dateTo };
    }

    // Search term filter
    if (filter.searchTerm) {
      where.OR = [
        { subject: { contains: filter.searchTerm, mode: 'insensitive' } },
        { body: { contains: filter.searchTerm, mode: 'insensitive' } },
        { senderName: { contains: filter.searchTerm, mode: 'insensitive' } },
      ];
    }

    // Apply privacy filter based on user role
    const privacyFilter = this.buildPrivacyFilter(userContext, filter.includePrivate);
    if (privacyFilter) {
      where.AND = where.AND || [];
      where.AND.push(privacyFilter);
    }

    // Cursor-based pagination
    if (pagination.cursor) {
      where.id = { lt: pagination.cursor };
    }

    // Get total count
    const totalCount = await prisma.communicationEntry.count({
      where: this.buildCountWhere(filter, userContext),
    });

    // Fetch entries
    const entries = await prisma.communicationEntry.findMany({
      where,
      include: {
        attachments: {
          select: { id: true },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = entries.length > limit;
    const resultEntries = hasMore ? entries.slice(0, -1) : entries;
    const nextCursor = hasMore ? resultEntries[resultEntries.length - 1]?.id : undefined;

    return {
      entries: resultEntries.map((e) => this.mapToTimelineEntry(e)),
      totalCount,
      hasMore,
      cursor: nextCursor,
    };
  }

  /**
   * Build privacy filter based on user role
   */
  private buildPrivacyFilter(userContext: UserContext, includePrivate?: boolean): any | null {
    const { userId, role } = userContext;

    // Partners can see everything
    if (role === UserRole.Partner) {
      return null;
    }

    // Associates can see Normal, Confidential (if allowed), AttorneyOnly
    if (role === UserRole.Associate) {
      return {
        OR: [
          { isPrivate: false },
          { privacyLevel: PrivacyLevel.Normal },
          { privacyLevel: PrivacyLevel.AttorneyOnly },
          {
            AND: [{ privacyLevel: PrivacyLevel.Confidential }, { allowedViewers: { has: userId } }],
          },
        ],
      };
    }

    // Paralegals and other roles can only see Normal or if they're in allowed viewers
    return {
      OR: [
        { isPrivate: false, privacyLevel: PrivacyLevel.Normal },
        { allowedViewers: { has: userId } },
        { senderId: userId }, // Can always see own messages
      ],
    };
  }

  /**
   * Build where clause for count query (same filters without cursor)
   */
  private buildCountWhere(filter: TimelineFilter, userContext: UserContext): any {
    const where: any = {
      caseId: filter.caseId,
      firm: { id: userContext.firmId },
    };

    if (filter.channelTypes && filter.channelTypes.length > 0) {
      where.channelType = { in: filter.channelTypes };
    }
    if (filter.direction) {
      where.direction = filter.direction;
    }
    if (filter.dateFrom) {
      where.sentAt = { ...where.sentAt, gte: filter.dateFrom };
    }
    if (filter.dateTo) {
      where.sentAt = { ...where.sentAt, lte: filter.dateTo };
    }
    if (filter.searchTerm) {
      where.OR = [
        { subject: { contains: filter.searchTerm, mode: 'insensitive' } },
        { body: { contains: filter.searchTerm, mode: 'insensitive' } },
        { senderName: { contains: filter.searchTerm, mode: 'insensitive' } },
      ];
    }

    const privacyFilter = this.buildPrivacyFilter(userContext, filter.includePrivate);
    if (privacyFilter) {
      where.AND = where.AND || [];
      where.AND.push(privacyFilter);
    }

    return where;
  }

  /**
   * Sync an Email record to CommunicationEntry
   * Creates a CommunicationEntry from an existing Email for unified timeline
   */
  async syncEmailToCommunicationEntry(emailId: string): Promise<TimelineEntry | null> {
    // Get the email record
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: {
        attachments: true,
        user: true,
      },
    });

    if (!email) {
      console.log('[syncEmailToCommunicationEntry] Email not found:', emailId);
      return null;
    }

    // Must have caseId to sync
    if (!email.caseId) {
      console.log('[syncEmailToCommunicationEntry] Email has no caseId:', emailId);
      return null;
    }

    // Check if already synced (by externalId)
    const existing = await prisma.communicationEntry.findFirst({
      where: { externalId: email.graphMessageId },
    });

    if (existing) {
      // If existing entry has different caseId, update it
      if (existing.caseId !== email.caseId) {
        console.log('[syncEmailToCommunicationEntry] Updating existing entry caseId:', {
          entryId: existing.id,
          oldCaseId: existing.caseId,
          newCaseId: email.caseId,
        });
        const updated = await prisma.communicationEntry.update({
          where: { id: existing.id },
          data: { caseId: email.caseId },
        });
        return this.mapToTimelineEntry(updated);
      }
      console.log('[syncEmailToCommunicationEntry] Already synced:', {
        emailId,
        entryId: existing.id,
      });
      return this.mapToTimelineEntry(existing);
    }

    // Determine direction based on email sender
    const fromAddress = (email.from as any)?.address?.toLowerCase() || '';
    const userEmail = email.user?.email?.toLowerCase() || '';
    const direction =
      fromAddress === userEmail ? CommunicationDirection.Outbound : CommunicationDirection.Inbound;

    // Map recipients
    const recipients: RecipientInfo[] = [];
    const toRecipients = email.toRecipients as any[];
    const ccRecipients = email.ccRecipients as any[];
    const bccRecipients = email.bccRecipients as any[];

    if (toRecipients) {
      recipients.push(
        ...toRecipients.map((r: any) => ({
          name: r.name || r.address,
          email: r.address,
          type: 'to' as const,
        }))
      );
    }
    if (ccRecipients) {
      recipients.push(
        ...ccRecipients.map((r: any) => ({
          name: r.name || r.address,
          email: r.address,
          type: 'cc' as const,
        }))
      );
    }
    if (bccRecipients) {
      recipients.push(
        ...bccRecipients.map((r: any) => ({
          name: r.name || r.address,
          email: r.address,
          type: 'bcc' as const,
        }))
      );
    }

    // Create CommunicationEntry
    const entry = await prisma.communicationEntry.create({
      data: {
        firmId: email.firmId,
        caseId: email.caseId!,
        channelType: CommunicationChannel.Email,
        direction,
        subject: email.subject,
        body: email.bodyContent || '', // Ensure body is never null
        htmlBody: email.bodyContentType === 'html' ? email.bodyContent : null,
        senderId: email.userId,
        senderName: (email.from as any)?.name || (email.from as any)?.address || 'Unknown',
        senderEmail: (email.from as any)?.address,
        recipients: recipients as any,
        externalId: email.graphMessageId,
        hasAttachments: email.hasAttachments,
        isPrivate: false,
        privacyLevel: PrivacyLevel.Normal,
        allowedViewers: [],
        sentAt: email.sentDateTime,
        metadata: {
          importance: email.importance,
          isRead: email.isRead,
          conversationId: email.conversationId,
          internetMessageId: email.internetMessageId,
        },
      },
      include: {
        attachments: { select: { id: true } },
      },
    });

    // Sync attachments
    if (email.attachments && email.attachments.length > 0) {
      await prisma.communicationAttachment.createMany({
        data: email.attachments.map((att) => ({
          communicationEntryId: entry.id,
          fileName: att.name,
          fileSize: att.size,
          mimeType: att.contentType,
          storageUrl: att.storageUrl || '',
          documentId: att.documentId,
        })),
      });
    }

    return this.mapToTimelineEntry(entry);
  }

  /**
   * Check if a user can view a specific communication entry
   */
  async canViewCommunication(userId: string, entryId: string): Promise<boolean> {
    // Get the entry and user
    const [entry, user] = await Promise.all([
      prisma.communicationEntry.findUnique({
        where: { id: entryId },
        select: {
          isPrivate: true,
          privacyLevel: true,
          allowedViewers: true,
          senderId: true,
          firmId: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, firmId: true },
      }),
    ]);

    if (!entry || !user) {
      return false;
    }

    // Must be same firm
    if (entry.firmId !== user.firmId) {
      return false;
    }

    // Sender can always view their own messages
    if (entry.senderId === userId) {
      return true;
    }

    // Partners can view everything
    const userRoleStr = user.role as string;
    if (userRoleStr === 'Partner') {
      return true;
    }

    // Check privacy level
    switch (entry.privacyLevel) {
      case PrivacyLevel.Normal:
        return true;

      case PrivacyLevel.Confidential:
        return entry.allowedViewers.includes(userId);

      case PrivacyLevel.AttorneyOnly:
        return userRoleStr === 'Associate' || userRoleStr === 'Partner';

      case PrivacyLevel.PartnerOnly:
        return userRoleStr === 'Partner';

      default:
        return !entry.isPrivate;
    }
  }

  /**
   * Get a single communication entry by ID with permission check
   */
  async getCommunicationEntry(
    entryId: string,
    userContext: UserContext
  ): Promise<TimelineEntry | null> {
    const canView = await this.canViewCommunication(userContext.userId, entryId);
    if (!canView) {
      return null;
    }

    const entry = await prisma.communicationEntry.findUnique({
      where: { id: entryId },
      include: {
        attachments: true,
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        children: {
          select: { id: true },
        },
      },
    });

    return entry ? this.mapToTimelineEntry(entry) : null;
  }

  /**
   * Get thread of communications (parent and children)
   */
  async getCommunicationThread(
    entryId: string,
    userContext: UserContext
  ): Promise<TimelineEntry[]> {
    const entry = await prisma.communicationEntry.findUnique({
      where: { id: entryId },
      select: { parentId: true },
    });

    if (!entry) {
      return [];
    }

    // Find root of thread
    let rootId = entryId;
    if (entry.parentId) {
      rootId = entry.parentId;
    }

    // Get all entries in thread
    const threadEntries = await prisma.communicationEntry.findMany({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
        firmId: userContext.firmId,
      },
      include: {
        attachments: { select: { id: true } },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { sentAt: 'asc' },
    });

    // Filter by permissions
    const visibleEntries: TimelineEntry[] = [];
    for (const e of threadEntries) {
      const canView = await this.canViewCommunication(userContext.userId, e.id);
      if (canView) {
        visibleEntries.push(this.mapToTimelineEntry(e));
      }
    }

    return visibleEntries;
  }

  /**
   * Map Prisma result to TimelineEntry type
   */
  private mapToTimelineEntry(entry: any): TimelineEntry {
    const recipients = (entry.recipients as RecipientInfo[]) || [];
    const body = entry.body || '';
    const bodyPreview = body.substring(0, 200) + (body.length > 200 ? '...' : '');

    return {
      id: entry.id,
      channelType: entry.channelType,
      direction: entry.direction,
      subject: entry.subject || undefined,
      body, // Full body content
      bodyPreview,
      htmlBody: entry.htmlBody || undefined, // HTML version if available
      senderName: entry.senderName,
      senderEmail: entry.senderEmail || undefined,
      recipients,
      hasAttachments: entry.hasAttachments || entry.attachments?.length > 0,
      isPrivate: entry.isPrivate,
      privacyLevel: entry.privacyLevel,
      sentAt: entry.sentAt,
      createdAt: entry.createdAt,
      metadata: entry.metadata || undefined,
      externalId: entry.externalId || undefined,
      parentId: entry.parentId || undefined,
    };
  }
}

// Export singleton instance
export const unifiedTimelineService = new UnifiedTimelineService();
